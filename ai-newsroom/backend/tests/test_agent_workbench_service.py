import unittest
from types import SimpleNamespace

from app.services.agent_workbench_service import (
    _apply_read_tool_hints,
    _build_read_tool_results_reply,
    _build_smalltalk_reply,
    _is_smalltalk_prompt,
)


class WorkbenchSmalltalkDetectionTests(unittest.TestCase):
    def test_detects_plain_greetings(self):
        for prompt in ["hi", "hello!", "你好", "您好。", "在吗", "晚上好~"]:
            with self.subTest(prompt=prompt):
                self.assertTrue(_is_smalltalk_prompt(prompt))

    def test_does_not_treat_real_requests_as_smalltalk(self):
        for prompt in ["帮我看最新卡片", "写一篇摘要", "hi，帮我写一篇文章", "列出最近来源"]:
            with self.subTest(prompt=prompt):
                self.assertFalse(_is_smalltalk_prompt(prompt))


class WorkbenchSmalltalkReplyTests(unittest.TestCase):
    def test_writer_reply_guides_to_cards_and_tasks(self):
        reply = _build_smalltalk_reply(SimpleNamespace(role="writer"))
        self.assertIn("情报卡片", reply)
        self.assertIn("写作任务", reply)

    def test_extractor_reply_guides_to_sources(self):
        reply = _build_smalltalk_reply(SimpleNamespace(role="extractor"))
        self.assertIn("来源", reply)
        self.assertIn("RSS/Web", reply)


class WorkbenchReadToolFallbackReplyTests(unittest.TestCase):
    def test_lists_card_titles_when_model_reply_is_empty(self):
        reply = _build_read_tool_results_reply([
            {
                "skill": "cards.list",
                "summary": "已读取 2 张最新情报卡片。",
                "payload": {
                    "items": [
                        {"id": 12, "title": "模型发布", "category": "AI", "importance_score": 0.86},
                        {"id": 13, "title": "算力扩建", "importance_score": 0.72},
                    ],
                },
            }
        ])

        self.assertIn("2 张最新情报卡片", reply)
        self.assertIn("#12 模型发布", reply)
        self.assertIn("#13 算力扩建", reply)

    def test_lists_sources_when_source_tool_was_read(self):
        reply = _build_read_tool_results_reply([
            {
                "skill": "sources.list",
                "summary": "已读取 1 个来源。",
                "payload": {
                    "items": [
                        {"id": 3, "name": "The Verge", "source_type": "rss", "is_active": True},
                    ],
                },
            }
        ])

        self.assertIn("1 个信号源", reply)
        self.assertIn("#3 The Verge", reply)


class WorkbenchReadToolHintTests(unittest.TestCase):
    def test_source_management_prompt_prefers_source_list_over_cards(self):
        calls = _apply_read_tool_hints(
            "我需要你看下信号源管理中的卡片列表",
            [{"skill": "cards.list", "args": {"limit": 5}}],
            allowed_skills=["sources.list", "cards.list"],
            permission_codes={"network.view", "discover.view"},
        )

        self.assertEqual(calls[0]["skill"], "sources.list")
        self.assertNotIn("cards.list", [call["skill"] for call in calls])
