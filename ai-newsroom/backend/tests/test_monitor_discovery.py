import unittest

from app.services.monitor_discovery import (
    BILIBILI_RSSHUB_FALLBACK_ERROR,
    _normalize_browser_video,
    _parse_browser_count,
    _resolve_browser_invalid_reason,
    _sort_xiaohongshu_items,
    get_default_discovery_mode,
    normalize_monitor_discovery_mode,
)


class ResolveBrowserInvalidReasonTests(unittest.TestCase):
    def test_xiaohongshu_overlay_with_videos_is_not_invalid(self):
        content = "登录后查看发布内容 迟到大部分原因是不知道今天穿哪套｜OOTD"
        reason = _resolve_browser_invalid_reason(
            "xiaohongshu",
            content=content,
            videos_found=20,
        )
        self.assertIsNone(reason)

    def test_xiaohongshu_overlay_without_videos_is_invalid(self):
        reason = _resolve_browser_invalid_reason(
            "xiaohongshu",
            content="登录后查看发布内容",
            videos_found=0,
        )
        self.assertEqual(reason, "小红书页面仅返回登录弹层，Cookie 可能已失效。")


class MonitorDiscoveryModeTests(unittest.TestCase):
    def test_default_modes_match_platforms(self):
        self.assertEqual(get_default_discovery_mode("bilibili"), "rsshub")
        self.assertEqual(get_default_discovery_mode("xiaohongshu"), "cookie")

    def test_normalize_monitor_discovery_mode_respects_platform_constraints(self):
        self.assertEqual(normalize_monitor_discovery_mode("bilibili", "cookie"), "cookie")
        self.assertEqual(normalize_monitor_discovery_mode("youtube", "cookie"), "rsshub")
        self.assertEqual(normalize_monitor_discovery_mode("xiaohongshu", "rsshub"), "cookie")

    def test_bilibili_rsshub_failure_hint_mentions_cookie_mode(self):
        self.assertIn("Cookie", BILIBILI_RSSHUB_FALLBACK_ERROR)


class XiaohongshuExtractionHelpersTests(unittest.TestCase):
    def test_parse_browser_count_supports_wan_and_plus_suffix(self):
        self.assertEqual(_parse_browser_count("1.5万"), 15000)
        self.assertEqual(_parse_browser_count("10万+"), 100000)
        self.assertEqual(_parse_browser_count("340"), 340)

    def test_normalize_browser_video_preserves_xiaohongshu_metadata(self):
        normalized = _normalize_browser_video(
            {
                "title": "没时间修图了",
                "url": "/explore/69e34039000000001a031925?xsec_token=token&xsec_source=pc_user",
                "thumbnail": "https://example.com/cover.jpg",
                "is_sticky": True,
                "note_type": "video",
                "like_count": "10万+",
            },
            "https://www.xiaohongshu.com/user/profile/57abf42c5e87e768d026adcc",
        )

        self.assertEqual(
            normalized["url"],
            "https://www.xiaohongshu.com/explore/69e34039000000001a031925?xsec_token=token&xsec_source=pc_user",
        )
        self.assertTrue(normalized["is_sticky"])
        self.assertEqual(normalized["note_type"], "video")
        self.assertEqual(normalized["like_count"], 100000)

    def test_sort_xiaohongshu_items_prefers_sticky_then_visual_order(self):
        ordered = _sort_xiaohongshu_items(
            [
                {
                    "title": "第二列更靠上",
                    "url": "https://example.com/3",
                    "is_sticky": False,
                    "dom_top": 90,
                    "dom_left": 260,
                    "dom_index": 2,
                },
                {
                    "title": "置顶内容",
                    "url": "https://example.com/1",
                    "is_sticky": True,
                    "dom_top": 220,
                    "dom_left": 200,
                    "dom_index": 1,
                },
                {
                    "title": "左上普通内容",
                    "url": "https://example.com/2",
                    "is_sticky": False,
                    "dom_top": 90,
                    "dom_left": 80,
                    "dom_index": 0,
                },
            ]
        )

        self.assertEqual(
            [item["title"] for item in ordered],
            ["置顶内容", "左上普通内容", "第二列更靠上"],
        )

    def test_sort_xiaohongshu_items_handles_missing_coordinates(self):
        ordered = _sort_xiaohongshu_items(
            [
                {
                    "title": "无坐标内容",
                    "url": "https://example.com/2",
                    "is_sticky": False,
                    "dom_index": 1,
                },
                {
                    "title": "有坐标内容",
                    "url": "https://example.com/1",
                    "is_sticky": False,
                    "dom_top": 10,
                    "dom_left": 10,
                    "dom_index": 0,
                },
            ]
        )

        self.assertEqual(
            [item["title"] for item in ordered],
            ["有坐标内容", "无坐标内容"],
        )


if __name__ == "__main__":
    unittest.main()
