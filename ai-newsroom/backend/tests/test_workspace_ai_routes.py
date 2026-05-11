import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.routing import APIRoute

from app.main import app
from app.services.stream_service import _get_draft_critique
from app.services.worker_jobs import run_review_job


def get_route_permission(path: str, method: str) -> str:
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if route.path != path or method.upper() not in route.methods:
            continue

        for dependency in route.dependant.dependencies:
            call = dependency.call
            closure = getattr(call, "__closure__", None) or ()
            for cell in closure:
                if isinstance(cell.cell_contents, str):
                    return cell.cell_contents

    raise AssertionError(f"Permission dependency not found for {method} {path}")


class WorkspaceAIRoutePermissionTests(unittest.TestCase):
    def test_rewrite_endpoint_uses_workspace_permission(self):
        self.assertEqual(get_route_permission("/api/agents/rewrite", "POST"), "workspace.view")

    def test_context_lab_chat_uses_workspace_permission(self):
        self.assertEqual(get_route_permission("/api/agents/chat", "POST"), "workspace.view")

    def test_generate_image_uses_workspace_permission(self):
        self.assertEqual(get_route_permission("/api/generate-image", "POST"), "workspace.view")

    def test_stream_review_uses_workspace_permission(self):
        self.assertEqual(get_route_permission("/api/stream/{task_id}/review", "GET"), "workspace.view")


class _FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        return self.value


class _FakeAsyncSession:
    def __init__(self, result_value):
        self.result_value = result_value
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return _FakeResult(self.result_value)


class _FakeSession:
    def __init__(self, tracker):
        self.tracker = tracker

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, statement):
        statement_sql = str(statement)

        if "FROM tasks" in statement_sql:
            return _FakeResult(self.tracker["task"])

        if "FROM drafts" in statement_sql:
            return _FakeResult(self.tracker["draft"])

        if "FROM critiques" in statement_sql:
            if statement_sql.lstrip().startswith("DELETE FROM critiques"):
                self.tracker["deleted_existing_critiques"] = True
                return _FakeResult(None)
            return _FakeResult(None)

        if "FROM agents" in statement_sql:
            order_clauses = tuple(str(clause) for clause in statement._order_by_clauses)
            self.tracker["agent_order_clauses"] = order_clauses
            prefers_active = any("agents.is_active DESC" in clause for clause in order_clauses)
            reviewer = (
                self.tracker["active_reviewer"]
                if prefers_active
                else self.tracker["inactive_reviewer"]
            )
            self.tracker["selected_reviewer"] = reviewer
            return _FakeResult(reviewer)

        raise AssertionError(f"Unexpected SQL in fake session: {statement_sql}")

    def add(self, obj):
        self.tracker.setdefault("added_objects", []).append(obj)

    def commit(self):
        self.tracker["commit_count"] = self.tracker.get("commit_count", 0) + 1


class _FakeSyncSessionFactory:
    def __init__(self, tracker):
        self.tracker = tracker

    def __call__(self):
        return _FakeSession(self.tracker)


class ReviewWorkerAgentSelectionTests(unittest.TestCase):
    def test_review_worker_prefers_active_reviewer(self):
        tracker = {
            "task": SimpleNamespace(
                id=11,
                owner_user_id=7,
                status="written",
                config={},
                task_type="multi_source_synthesis",
            ),
            "draft": SimpleNamespace(
                id=13,
                owner_user_id=7,
                task_id=11,
                content="Draft content for review",
                revised_content=None,
            ),
            "inactive_reviewer": SimpleNamespace(
                is_active=False,
                api_key="inactive-key",
                system_prompt="inactive reviewer prompt",
                context_text="inactive reviewer context",
                model_ref="review-model-inactive",
            ),
            "active_reviewer": SimpleNamespace(
                is_active=True,
                api_key="active-key",
                system_prompt="active reviewer prompt",
                context_text="active reviewer context",
                model_ref="review-model-active",
            ),
        }

        def fake_run_async(coro):
            coro.close()
            return (
                {
                    "critiques": [
                        {
                            "target_quote": "Draft",
                            "critique": "Needs polish",
                            "suggestion": "Polish it",
                        }
                    ],
                    "overall_score": 8.5,
                    "overall_comment": "Looks good",
                },
                "Revised content",
            )

        with patch("app.services.worker_jobs.SyncSession", new=_FakeSyncSessionFactory(tracker)):
            with patch("app.services.worker_jobs.run_async", new=fake_run_async):
                result = run_review_job(11, 7)

        self.assertEqual(result["status"], "completed")
        self.assertTrue(tracker["selected_reviewer"].is_active)
        self.assertIn("agents.is_active DESC", tracker["agent_order_clauses"])
        self.assertEqual(tracker["selected_reviewer"].api_key, "active-key")
        self.assertTrue(tracker["deleted_existing_critiques"])
        self.assertGreaterEqual(tracker["commit_count"], 2)


class LatestCritiqueQueryTests(unittest.TestCase):
    def test_stream_service_uses_latest_critique_for_draft(self):
        expected = SimpleNamespace(id=99)
        fake_db = _FakeAsyncSession(expected)

        result = asyncio.run(_get_draft_critique(fake_db, 13, 7))

        self.assertIs(result, expected)
        order_clauses = tuple(str(clause) for clause in fake_db.statement._order_by_clauses)
        self.assertIn("critiques.created_at DESC", order_clauses)
        self.assertIn("critiques.id DESC", order_clauses)
        self.assertEqual(fake_db.statement._limit_clause.value, 1)
