import io
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from app.services.video.local_video import store_uploaded_manual_video


class LocalVideoServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_store_uploaded_manual_video_rejects_unsupported_type(self):
        upload = UploadFile(
            io.BytesIO(b"hello"),
            filename="notes.txt",
            headers=Headers({"content-type": "text/plain"}),
        )

        with self.assertRaises(HTTPException) as ctx:
            await store_uploaded_manual_video(upload)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("mp4", str(ctx.exception.detail))

    async def test_store_uploaded_manual_video_returns_metadata(self):
        upload = UploadFile(
            io.BytesIO(b"fake-video"),
            filename="demo clip.mp4",
            headers=Headers({"content-type": "video/mp4"}),
        )

        with (
            patch("app.services.video.local_video._probe_video_duration", return_value=12),
            patch("app.services.video.local_video._generate_video_thumbnail", return_value=None),
            patch("app.services.video.local_video._upload_local_file_to_storage"),
        ):
            payload = await store_uploaded_manual_video(upload)

        self.assertEqual(payload["source_kind"], "file")
        self.assertEqual(payload["platform"], "upload")
        self.assertEqual(payload["title"], "demo clip")
        self.assertEqual(payload["file_size_bytes"], len(b"fake-video"))
        self.assertEqual(payload["mime_type"], "video/mp4")
        self.assertTrue(str(payload["normalized_url"]).startswith("upload://manual-videos/"))

    async def test_store_uploaded_manual_video_raises_when_storage_unavailable(self):
        upload = UploadFile(
            io.BytesIO(b"fake-video"),
            filename="broken.mp4",
            headers=Headers({"content-type": "video/mp4"}),
        )

        with (
            patch("app.services.video.local_video._probe_video_duration", return_value=8),
            patch("app.services.video.local_video._generate_video_thumbnail", return_value=None),
            patch(
                "app.services.video.local_video._upload_local_file_to_storage",
                side_effect=RuntimeError("minio down"),
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await store_uploaded_manual_video(upload)

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertIn("MinIO", str(ctx.exception.detail))


if __name__ == "__main__":
    unittest.main()
