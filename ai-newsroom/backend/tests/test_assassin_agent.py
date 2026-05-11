import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services.assassin_agent import AssassinAgent


class QwenReviewerCompatibilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_review_disables_thinking_and_requests_json_output(self):
        recorded: dict = {}

        class FakeCompletions:
            async def create(self, **kwargs):
                recorded.update(kwargs)
                return SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(
                                content='{"critiques":[],"overall_score":8.0,"overall_comment":"ok"}'
                            )
                        )
                    ]
                )

        fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))

        with patch("app.services.assassin_agent.genai.Client"):
            with patch("openai.AsyncOpenAI", return_value=fake_client):
                agent = AssassinAgent(api_key="test-key")
                result = await agent.review("draft content", model_ref="qwen-plus")

        self.assertEqual(result["overall_score"], 8.0)
        self.assertEqual(recorded["extra_body"], {"enable_thinking": False})
        self.assertEqual(recorded["response_format"], {"type": "json_object"})

    async def test_revise_disables_thinking_for_qwen(self):
        recorded: dict = {}

        class FakeCompletions:
            async def create(self, **kwargs):
                recorded.update(kwargs)
                return SimpleNamespace(
                    choices=[SimpleNamespace(message=SimpleNamespace(content="revised draft"))]
                )

        fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))

        with patch("app.services.assassin_agent.genai.Client"):
            with patch("openai.AsyncOpenAI", return_value=fake_client):
                agent = AssassinAgent(api_key="test-key")
                result = await agent.revise_standalone("draft content", model_ref="qwen-plus")

        self.assertEqual(result, "revised draft")
        self.assertEqual(recorded["extra_body"], {"enable_thinking": False})

