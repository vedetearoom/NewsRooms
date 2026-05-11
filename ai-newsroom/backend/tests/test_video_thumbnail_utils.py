import unittest

from app.services.video.thumbnail_utils import (
    choose_better_thumbnail,
    thumbnail_quality_score,
    upgrade_xiaohongshu_thumbnail_url,
)


class ThumbnailUtilsTests(unittest.TestCase):
    def test_xiaohongshu_medium_webp_beats_preview_jpg(self):
        preview = (
            "http://sns-webpic-qc.xhscdn.com/202604191233/"
            "0302b80162xyg6s10p80115kiwp06bm1ku!nd_prv_wlteh_jpg_3"
        )
        medium = (
            "https://sns-webpic-qc.xhscdn.com/202604191214/"
            "0302b80162xyg6s10p80115kiwp06bm1ku!nc_n_webp_mw_1"
        )

        self.assertGreater(thumbnail_quality_score(medium), thumbnail_quality_score(preview))
        self.assertEqual(choose_better_thumbnail(preview, medium), medium)

    def test_empty_candidate_does_not_replace_existing(self):
        existing = "http://i1.hdslb.com/bfs/archive/example.jpg"
        self.assertEqual(choose_better_thumbnail(existing, ""), existing)

    def test_upgrade_xiaohongshu_preview_thumbnail_strips_preview_suffix(self):
        preview = (
            "https://sns-webpic-qc.xhscdn.com/202604191603/"
            "4a9e0d19dad926c2e76bab3a1978145c/1040g2sg31t4kplj2m8e048kskkq2pbecbrgco40!nc_n_webp_prv_1"
        )
        self.assertEqual(
            upgrade_xiaohongshu_thumbnail_url(preview),
            (
                "https://sns-webpic-qc.xhscdn.com/202604191603/"
                "4a9e0d19dad926c2e76bab3a1978145c/1040g2sg31t4kplj2m8e048kskkq2pbecbrgco40"
            ),
        )


if __name__ == "__main__":
    unittest.main()
