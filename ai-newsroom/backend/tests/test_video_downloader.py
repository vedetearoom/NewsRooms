import tempfile
import unittest

from app.services.video.downloader import (
    BILIBILI_412_ERROR,
    _apply_cookie_file_option,
    _build_request_headers,
    _rewrite_platform_download_error,
    _write_yt_dlp_cookie_file,
)


class RewritePlatformDownloadErrorTests(unittest.TestCase):
    def test_xiaohongshu_missing_xsec_token_gets_actionable_message(self):
        error = _rewrite_platform_download_error(
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e",
            Exception("ERROR: [XiaoHongShu] 636a3c3e000000000703436e: No video formats found!"),
        )
        self.assertIsInstance(error, ValueError)
        self.assertEqual(
            str(error),
            "小红书链接缺少 xsec_token，请先重新检查监控源，再执行解构。",
        )

    def test_xiaohongshu_with_xsec_token_keeps_original_error(self):
        original = Exception("ERROR: [XiaoHongShu] 636a3c3e000000000703436e: No video formats found!")
        error = _rewrite_platform_download_error(
            "https://www.xiaohongshu.com/explore/636a3c3e000000000703436e?xsec_token=abc",
            original,
        )
        self.assertIs(error, original)

    def test_bilibili_412_gets_actionable_message(self):
        error = _rewrite_platform_download_error(
            "https://www.bilibili.com/video/BV1ifdaBtE5S",
            Exception(
                "ERROR: [BiliBili] 1ifdaBtE5S: Unable to download JSON metadata: "
                "HTTP Error 412: Precondition Failed"
            ),
        )
        self.assertIsInstance(error, ValueError)
        self.assertEqual(str(error), BILIBILI_412_ERROR)


class YtDlpCookieFileTests(unittest.TestCase):
    def test_request_headers_do_not_include_cookie_header(self):
        headers = _build_request_headers(
            "https://www.bilibili.com/video/BV1ifdaBtE5S",
            cookie_header="SESSDATA=session-value; bili_jct=csrf-value",
        )

        self.assertNotIn("Cookie", headers)
        self.assertEqual(headers["Referer"], "https://www.bilibili.com/")
        self.assertEqual(headers["Origin"], "https://www.bilibili.com")
        self.assertIn("zh-CN", headers["Accept-Language"])

    def test_bilibili_cookie_header_is_written_as_netscape_cookie_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cookie_file = _write_yt_dlp_cookie_file(
                "https://www.bilibili.com/video/BV1ifdaBtE5S",
                "Cookie: SESSDATA=session-value; bili_jct=csrf-value; path=/; Secure",
                directory=temp_dir,
            )
            self.assertIsNotNone(cookie_file)

            with open(cookie_file or "", encoding="utf-8") as handle:
                content = handle.read()

        self.assertIn("# Netscape HTTP Cookie File", content)
        self.assertIn(".bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\tsession-value", content)
        self.assertIn(".bilibili.com\tTRUE\t/\tTRUE\t0\tbili_jct\tcsrf-value", content)
        self.assertNotIn("\tpath\t", content)

    def test_cookie_file_path_is_passed_to_yt_dlp_options(self):
        ydl_opts = {"http_headers": _build_request_headers("https://www.bilibili.com/video/BV1")}
        with tempfile.TemporaryDirectory() as temp_dir:
            cookie_file = _apply_cookie_file_option(
                ydl_opts,
                "https://www.bilibili.com/video/BV1ifdaBtE5S",
                "SESSDATA=session-value",
                directory=temp_dir,
            )

            self.assertEqual(ydl_opts["cookiefile"], cookie_file)
            self.assertTrue(cookie_file and cookie_file.endswith(".cookies.txt"))

        self.assertNotIn("Cookie", ydl_opts["http_headers"])


if __name__ == "__main__":
    unittest.main()
