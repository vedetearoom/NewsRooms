import unittest
from types import SimpleNamespace

from app.services.processor_support import (
    build_processor_prompt,
    card_matches_output_language,
    cards_match_output_language,
    infer_agent_output_language,
)


class ProcessorPromptTests(unittest.TestCase):
    def test_system_agent_instructions_override_default_language_rule(self):
        extractor = SimpleNamespace(
            is_system=True,
            system_prompt="你是一位专业的新闻分析师。输出内容需要是中文。",
            context_text=None,
        )

        prompt = build_processor_prompt(extractor)

        self.assertIn("=== HIGH PRIORITY AGENT INSTRUCTIONS ===", prompt)
        self.assertIn("输出内容需要是中文", prompt)
        self.assertIn("overrides the default language rule", prompt)
        self.assertEqual(infer_agent_output_language(extractor), "zh")
        self.assertLess(
            prompt.index("=== HIGH PRIORITY AGENT INSTRUCTIONS ==="),
            prompt.index("=== DEFAULT EXTRACTION RULES ==="),
        )

    def test_default_language_rule_applies_when_agent_does_not_override(self):
        prompt = build_processor_prompt(None)

        self.assertIn("Default language rule", prompt)
        self.assertIn("same language as the original articles", prompt)

    def test_chinese_output_gate_rejects_english_cards(self):
        english_card = {
            "title": "Google integrates Gemini AI into Chrome",
            "summary": "Google is enhancing Chrome for enterprise users.",
            "key_points": ["Google adds Gemini automation."],
            "tags": ["Google", "Chrome"],
        }

        self.assertFalse(card_matches_output_language(english_card, "zh"))
        self.assertFalse(cards_match_output_language([english_card], "zh"))

    def test_chinese_output_gate_accepts_chinese_cards_with_proper_nouns(self):
        chinese_card = {
            "title": "Google 将 Gemini AI 集成到 Chrome",
            "summary": "Google 正在为企业用户增强 Chrome，加入 Gemini 驱动的自动浏览能力。",
            "key_points": ["企业员工可以自动化研究和数据录入任务。"],
            "tags": ["Google", "Chrome", "企业自动化"],
        }

        self.assertTrue(card_matches_output_language(chinese_card, "zh"))
