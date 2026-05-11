import unittest

from app.services.monitor_service import (
    MISSING_ANALYSIS_JOB_ERROR,
    _lookup_analyzed_video_meta,
    _remove_cached_monitor_videos,
    _remove_monitor_active_jobs,
    _resolve_missing_monitor_job_status,
    _resolve_monitor_video_url,
)


class ResolveMonitorVideoUrlTests(unittest.TestCase):
    def test_xiaohongshu_bare_url_uses_cached_xsec_token_variant(self):
        cached_videos = [
            {
                "url": (
                    "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e"
                    "?xsec_token=abc123&xsec_source=pc_user"
                )
            }
        ]

        resolved = _resolve_monitor_video_url(
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e",
            cached_videos,
        )

        self.assertEqual(
            resolved,
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e"
            "?xsec_token=abc123&xsec_source=pc_user",
        )

    def test_exact_cached_url_is_preserved(self):
        cached_videos = [
            {"url": "https://www.douyin.com/video/7628920928306498851"}
        ]

        resolved = _resolve_monitor_video_url(
            "https://www.douyin.com/user/foo?modal_id=7628920928306498851",
            cached_videos,
        )

        self.assertEqual(resolved, "https://www.douyin.com/video/7628920928306498851")


class RemoveMonitorCachedVideosTests(unittest.TestCase):
    def test_remove_cached_videos_matches_xiaohongshu_identity(self):
        cached_videos = [
            {
                "url": (
                    "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e"
                    "?xsec_token=abc123&xsec_source=pc_user"
                )
            },
            {"url": "https://www.xiaohongshu.com/explore/69e34039000000001a031925?xsec_token=keep"},
        ]

        remaining, removed = _remove_cached_monitor_videos(
            cached_videos,
            ["https://www.xiaohongshu.com/explore/636a3c3e000000000703436e"],
        )

        self.assertEqual(removed, 1)
        self.assertEqual(
            remaining,
            [{"url": "https://www.xiaohongshu.com/explore/69e34039000000001a031925?xsec_token=keep"}],
        )

    def test_remove_monitor_active_jobs_matches_identity(self):
        active_jobs = {
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e?xsec_token=abc123": "job-1",
            "https://www.xiaohongshu.com/explore/69e34039000000001a031925?xsec_token=keep": "job-2",
        }

        remaining = _remove_monitor_active_jobs(
            active_jobs,
            ["https://www.xiaohongshu.com/explore/636a3c3e000000000703436e"],
        )

        self.assertEqual(
            remaining,
            {"https://www.xiaohongshu.com/explore/69e34039000000001a031925?xsec_token=keep": "job-2"},
        )


class AnalyzeVideoMetaLookupTests(unittest.TestCase):
    def test_lookup_uses_xiaohongshu_identity_alias(self):
        analyzed_meta = {
            "xiaohongshu:636a3c3e000000000703436e": {
                "card_id": 42,
                "last_analyzed_at": "2026-04-19T12:00:00+00:00",
            }
        }

        resolved = _lookup_analyzed_video_meta(
            analyzed_meta,
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e?xsec_token=abc123",
        )

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved["card_id"], 42)

    def test_missing_job_status_is_failed_when_no_card_exists(self):
        status, error = _resolve_missing_monitor_job_status(
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e?xsec_token=abc123",
            {},
        )

        self.assertEqual(status, "failed")
        self.assertEqual(error, MISSING_ANALYSIS_JOB_ERROR)

    def test_missing_job_status_is_completed_when_card_already_exists(self):
        status, error = _resolve_missing_monitor_job_status(
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e?xsec_token=abc123",
            {
                "xiaohongshu:636a3c3e000000000703436e": {
                    "card_id": 42,
                    "last_analyzed_at": "2026-04-19T12:00:00+00:00",
                }
            },
        )

        self.assertEqual(status, "completed")
        self.assertIsNone(error)


if __name__ == "__main__":
    unittest.main()
