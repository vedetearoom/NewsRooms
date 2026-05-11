import asyncio
import uuid
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.main import app
from app.database import async_session, engine
from app.models import Agent, Critique, Draft, MonitorTarget, Task, User
from app.schemas import DispatchAnalysisRequest
from app.services.agent_service import (
    build_agent_preference_sections,
    build_context_lab_system_prompt,
    build_rewrite_system_prompt,
    get_default_system_prompt,
    list_agents,
)
from app.services.monitor_service import dispatch_monitor_analysis, request_monitor_check
from app.services.stream_service import ensure_review_job
from app.services.upload_service import get_image_generation_settings
from app.services.video.transcriber import transcribe
from app.task_status import TaskStatus


class ContextLabPromptTests(unittest.TestCase):
    def test_newsletter_mode_changes_system_prompt(self):
        prompt = build_context_lab_system_prompt("newsletter")

        self.assertIn("The Big Story", prompt)
        self.assertIn("Quick Hits", prompt)

    def test_deep_dive_mode_changes_system_prompt(self):
        prompt = build_context_lab_system_prompt("deep_dive")

        self.assertIn("800-1200 words", prompt)
        self.assertIn("Industry implications", prompt)


class WriterPreferencePromptTests(unittest.TestCase):
    def test_edited_system_writer_prompt_is_included(self):
        agent = Agent(
            name="标准写作助手",
            role="writer",
            system_prompt="Write with a sharper, more analytical tone.",
            context_text="Example intro paragraph",
            is_system=True,
        )

        sections = build_agent_preference_sections(agent)
        rewrite_prompt = build_rewrite_system_prompt(agent)

        self.assertEqual(len(sections), 2)
        self.assertIn("WRITER PREFERENCES", sections[0])
        self.assertIn("sharper, more analytical tone", sections[0])
        self.assertIn("REFERENCE EXAMPLES", sections[1])
        self.assertIn("Example intro paragraph", sections[1])
        self.assertIn("sharper, more analytical tone", rewrite_prompt)
        self.assertIn("Example intro paragraph", rewrite_prompt)

    def test_default_system_writer_prompt_is_not_duplicated(self):
        agent = Agent(
            name="标准写作助手",
            role="writer",
            system_prompt=get_default_system_prompt("writer"),
            is_system=True,
        )

        sections = build_agent_preference_sections(agent)
        rewrite_prompt = build_rewrite_system_prompt(agent)

        self.assertEqual(sections, [])
        self.assertNotIn("=== WRITER PREFERENCES ===", rewrite_prompt)


class UploadEndpointAuthTests(unittest.TestCase):
    def test_generate_image_requires_auth(self):
        client = TestClient(app)
        response = client.post("/api/generate-image", json={"prompt": "test prompt"})
        client.close()

        self.assertEqual(response.status_code, 401)

    def test_upload_requires_auth(self):
        client = TestClient(app)
        response = client.post(
            "/api/upload",
            files={"file": ("test.png", b"fake-image", "image/png")},
        )
        client.close()

        self.assertEqual(response.status_code, 401)


class UserScopedIllustratorSettingsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await engine.dispose()
        suffix = uuid.uuid4().hex[:8]
        self.user_one = f"codex_img_a_{suffix}"
        self.user_two = f"codex_img_b_{suffix}"

        async with async_session() as db:
            db.add(
                User(
                    username=self.user_one,
                    email=f"{self.user_one}@example.com",
                    display_name="User A",
                    password_hash="test",
                    is_active=True,
                )
            )
            await db.commit()
            db.add(
                User(
                    username=self.user_two,
                    email=f"{self.user_two}@example.com",
                    display_name="User B",
                    password_hash="test",
                    is_active=True,
                )
            )
            await db.commit()

            users = (
                await db.execute(
                    select(User).where(User.username.in_([self.user_one, self.user_two]))
                )
            ).scalars().all()
            self.user_ids = {user.username: user.id for user in users}

    async def asyncTearDown(self):
        async with async_session() as db:
            await db.execute(
                delete(Agent).where(Agent.owner_user_id.in_(list(self.user_ids.values())))
            )
            await db.execute(
                delete(User).where(User.id.in_(list(self.user_ids.values())))
            )
            await db.commit()
        await engine.dispose()

    async def test_image_generation_settings_use_current_users_illustrator(self):
        user_one_id = self.user_ids[self.user_one]
        user_two_id = self.user_ids[self.user_two]

        async with async_session() as db:
            from app.services.agent_service import ensure_default_agents_for_user

            await ensure_default_agents_for_user(db, user_one_id)
            await ensure_default_agents_for_user(db, user_two_id)

            illustrators = (
                await db.execute(select(Agent).where(Agent.role == "illustrator"))
            ).scalars().all()
            for agent in illustrators:
                if agent.owner_user_id == user_one_id:
                    agent.system_prompt = "USER_ONE_STYLE"
                    agent.api_key = "key-user-one"
                    agent.model_ref = "gemini-user-one"
                elif agent.owner_user_id == user_two_id:
                    agent.system_prompt = "USER_TWO_STYLE"
                    agent.api_key = "key-user-two"
                    agent.model_ref = "gemini-user-two"
            await db.commit()

            style_prefix, model_ref, api_key = await get_image_generation_settings(db, user_one_id)

        self.assertEqual(style_prefix, "USER_ONE_STYLE\n\n")
        self.assertEqual(model_ref, "gemini-user-one")
        self.assertEqual(api_key, "key-user-one")


class ConcurrencyRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await engine.dispose()
        suffix = uuid.uuid4().hex[:8]
        self.username = f"codex_concurrency_{suffix}"

        async with async_session() as db:
            db.add(
                User(
                    username=self.username,
                    email=f"{self.username}@example.com",
                    display_name="Concurrency Test User",
                    password_hash="test",
                    is_active=True,
                )
            )
            await db.commit()

            user = (
                await db.execute(select(User).where(User.username == self.username))
            ).scalar_one()
            self.user_id = user.id

    async def asyncTearDown(self):
        async with async_session() as db:
            await db.execute(delete(Critique).where(Critique.owner_user_id == self.user_id))
            await db.execute(delete(Draft).where(Draft.owner_user_id == self.user_id))
            await db.execute(delete(Task).where(Task.owner_user_id == self.user_id))
            await db.execute(delete(MonitorTarget).where(MonitorTarget.owner_user_id == self.user_id))
            await db.execute(delete(Agent).where(Agent.owner_user_id == self.user_id))
            await db.execute(delete(User).where(User.id == self.user_id))
            await db.commit()
        await engine.dispose()

    async def test_default_agents_bootstrap_is_idempotent_under_concurrency(self):
        async def bootstrap_agents():
            async with async_session() as db:
                await list_agents(db, self.user_id)
                await db.commit()

        await asyncio.gather(bootstrap_agents(), bootstrap_agents())

        async with async_session() as db:
            agents = (
                await db.execute(
                    select(Agent).where(
                        Agent.owner_user_id == self.user_id,
                        Agent.is_system == True,
                    )
                )
            ).scalars().all()

        self.assertEqual(
            sorted(agent.role for agent in agents),
            ["extractor", "illustrator", "reviewer", "writer"],
        )
        self.assertEqual(len(agents), 4)

    async def test_monitor_check_dispatch_is_deduplicated_under_concurrency(self):
        async with async_session() as db:
            target = MonitorTarget(
                owner_user_id=self.user_id,
                name="Codex Monitor",
                platform="youtube",
                platform_id="channel-1",
                homepage_url="https://www.youtube.com/@codex",
                rss_url="https://example.com/rss.xml",
            )
            db.add(target)
            await db.commit()
            await db.refresh(target)
            monitor_id = target.id

        dispatched: list[tuple[int, int, str]] = []

        async def fake_dispatch(monitor_id: int, owner_user_id: int, platform: str) -> str:
            dispatched.append((monitor_id, owner_user_id, platform))
            return "job-monitor-1"

        async def fake_get_status(job_id: str):
            if job_id == "job-monitor-1":
                return {"status": "pending"}
            return None

        with (
            patch(
                "app.services.monitor_service.dispatch_monitor_check_job",
                new=AsyncMock(side_effect=fake_dispatch),
            ),
            patch(
                "app.services.monitor_service.job_manager.get_status",
                new=AsyncMock(side_effect=fake_get_status),
            ),
        ):
            async def request_check():
                async with async_session() as db:
                    return await request_monitor_check(db, monitor_id, self.user_id)

            first, second = await asyncio.gather(request_check(), request_check())

        self.assertEqual(first["job_id"], "job-monitor-1")
        self.assertEqual(second["job_id"], "job-monitor-1")
        self.assertEqual(len(dispatched), 1)

    async def test_monitor_active_jobs_updates_do_not_lose_parallel_dispatches(self):
        url_one = "https://www.youtube.com/watch?v=video-one"
        url_two = "https://www.youtube.com/watch?v=video-two"

        async with async_session() as db:
            target = MonitorTarget(
                owner_user_id=self.user_id,
                name="Codex Monitor",
                platform="youtube",
                platform_id="channel-2",
                homepage_url="https://www.youtube.com/@codex2",
                rss_url="https://example.com/rss2.xml",
                cached_videos=[
                    {"url": url_one, "thumbnail": "https://example.com/one.jpg"},
                    {"url": url_two, "thumbnail": "https://example.com/two.jpg"},
                ],
            )
            db.add(target)
            await db.commit()
            await db.refresh(target)
            monitor_id = target.id

        async def fake_dispatch(video_url: str, owner_user_id: int, preferred_thumbnail: str | None = None) -> str:
            return "job-one" if video_url == url_one else "job-two"

        with patch(
            "app.services.monitor_service.dispatch_video_analysis_job",
            new=AsyncMock(side_effect=fake_dispatch),
        ):
            async def dispatch_one(url: str):
                async with async_session() as db:
                    await dispatch_monitor_analysis(
                        db,
                        monitor_id,
                        DispatchAnalysisRequest(urls=[url]),
                        self.user_id,
                    )

            await asyncio.gather(dispatch_one(url_one), dispatch_one(url_two))

        async with async_session() as db:
            target = (
                await db.execute(
                    select(MonitorTarget).where(MonitorTarget.id == monitor_id)
                )
            ).scalar_one()

        self.assertEqual(
            target.active_jobs,
            {
                url_one: "job-one",
                url_two: "job-two",
            },
        )

    async def test_review_job_dispatch_is_deduplicated_under_concurrency(self):
        async with async_session() as db:
            task = Task(
                owner_user_id=self.user_id,
                task_type="newsletter",
                title="Concurrency Review Task",
                status=TaskStatus.WRITTEN.value,
            )
            db.add(task)
            await db.commit()
            await db.refresh(task)

            db.add(
                Draft(
                    owner_user_id=self.user_id,
                    task_id=task.id,
                    content="Initial draft content",
                    version=1,
                )
            )
            await db.commit()
            task_id = task.id

        dispatched: list[tuple[int, int, int | None]] = []

        async def fake_dispatch(task_id: int, owner_user_id: int, reviewer_id: int | None = None) -> str:
            dispatched.append((task_id, owner_user_id, reviewer_id))
            return "review-job-1"

        with patch(
            "app.services.stream_service.dispatch_review_job",
            new=AsyncMock(side_effect=fake_dispatch),
        ):
            await asyncio.gather(
                ensure_review_job(task_id, self.user_id, None, False),
                ensure_review_job(task_id, self.user_id, None, False),
            )

        self.assertEqual(len(dispatched), 1)

        async with async_session() as db:
            task = (
                await db.execute(
                    select(Task).where(Task.id == task_id, Task.owner_user_id == self.user_id)
                )
            ).scalar_one()

        self.assertEqual(task.status, TaskStatus.REVIEWING.value)


class AsyncOffloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_generate_gemini_uses_to_thread_for_blocking_sdk_call(self):
        from app.services.upload_service import _generate_gemini

        fake_response = SimpleNamespace(
            candidates=[
                SimpleNamespace(
                    content=SimpleNamespace(
                        parts=[
                            SimpleNamespace(
                                inline_data=SimpleNamespace(
                                    data=b"fake-image-bytes",
                                    mime_type="image/png",
                                )
                            )
                        ]
                    )
                )
            ]
        )
        fake_client = SimpleNamespace(models=SimpleNamespace(generate_content=object()))

        with (
            patch("google.genai.Client", return_value=fake_client),
            patch(
                "app.services.upload_service.asyncio.to_thread",
                new=AsyncMock(return_value=fake_response),
            ) as to_thread_mock,
        ):
            image_bytes, mime_type = await _generate_gemini("prompt", "gemini-model", "api-key")

        self.assertEqual(image_bytes, b"fake-image-bytes")
        self.assertEqual(mime_type, "image/png")
        to_thread_mock.assert_awaited_once()

    async def test_transcribe_uses_to_thread_for_blocking_file_upload(self):
        fake_audio_file = SimpleNamespace(name="files/audio-1")
        fake_client = SimpleNamespace(files=SimpleNamespace(upload=object()))

        with (
            patch("app.services.video.transcriber.genai.Client", return_value=fake_client),
            patch(
                "app.services.video.transcriber.asyncio.to_thread",
                new=AsyncMock(return_value=fake_audio_file),
            ) as to_thread_mock,
            patch(
                "app.services.video.transcriber._generate_json_transcript",
                new=AsyncMock(return_value="[]"),
            ),
        ):
            transcript = await transcribe("/tmp/fake-audio.mp3", "api-key")

        self.assertEqual(transcript, [])
        to_thread_mock.assert_awaited_once()
