import unittest

from app.services.video.url_utils import canonicalize_video_source_url


class CanonicalizeVideoSourceUrlTests(unittest.TestCase):
    def test_douyin_modal_url_is_canonicalized(self):
        self.assertEqual(
            canonicalize_video_source_url(
                "https://www.douyin.com/user/foo?from_tab_name=main&modal_id=7628920928306498851"
            ),
            "https://www.douyin.com/video/7628920928306498851",
        )

    def test_xiaohongshu_profile_note_url_preserves_xsec_token(self):
        self.assertEqual(
            canonicalize_video_source_url(
                "https://www.xiaohongshu.com/user/profile/57abf42c5e87e768d026adcc/636a3c3e000000000703436e"
                "?xsec_token=ABYd9vjNEJ6djUUhymGD3z0pBMZ6uRf1M31XCLWhjYGh0%3D&xsec_source=pc_user"
            ),
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e"
            "?xsec_token=ABYd9vjNEJ6djUUhymGD3z0pBMZ6uRf1M31XCLWhjYGh0%3D&xsec_source=pc_user",
        )

    def test_xiaohongshu_explore_url_without_xsec_stays_explore(self):
        self.assertEqual(
            canonicalize_video_source_url(
                "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e"
            ),
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e",
        )


if __name__ == "__main__":
    unittest.main()
