import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

from app.services.plugin_source import (
    _validate_and_discover_entries,
    parse_github_plugin_source,
)


class PluginSourceParsingTests(unittest.TestCase):
    def test_parse_repo_root_url(self):
        source = parse_github_plugin_source("https://github.com/example/newsroom-skill")
        self.assertEqual(source.owner, "example")
        self.assertEqual(source.repo, "newsroom-skill")
        self.assertEqual(source.ref, "main")
        self.assertEqual(source.subdir, "")

    def test_parse_tree_url_with_subdir(self):
        source = parse_github_plugin_source(
            "https://github.com/example/newsroom-skill/tree/dev/plugins/hackernews"
        )
        self.assertEqual(source.owner, "example")
        self.assertEqual(source.repo, "newsroom-skill")
        self.assertEqual(source.ref, "dev")
        self.assertEqual(source.subdir, "plugins/hackernews")

    def test_reject_non_github_host(self):
        with self.assertRaises(HTTPException):
            parse_github_plugin_source("https://example.com/repo.zip")


class PluginEntryValidationTests(unittest.TestCase):
    def test_skill_markdown_is_accepted(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "SKILL.md").write_text("# Skill", encoding="utf-8")
            (root / "crawler.py").write_text("print('ok')\n", encoding="utf-8")
            entry_hint, detected_files = _validate_and_discover_entries(root)
            self.assertEqual(entry_hint, "SKILL.md")
            self.assertIn("crawler.py", detected_files)

    def test_script_entry_is_accepted_without_skill_markdown(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "run.py").write_text("print('ok')\n", encoding="utf-8")
            entry_hint, detected_files = _validate_and_discover_entries(root)
            self.assertEqual(entry_hint, "run.py")
            self.assertEqual(detected_files, ["run.py"])

    def test_missing_entry_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "README.md").write_text("# Plugin", encoding="utf-8")
            with self.assertRaises(HTTPException):
                _validate_and_discover_entries(root)


if __name__ == "__main__":
    unittest.main()
