import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app.services import upload_service


class UploadAssetStorageTests(unittest.IsolatedAsyncioTestCase):
    async def test_store_asset_falls_back_to_local_file_when_s3_is_unavailable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            with (
                patch.object(upload_service, "LOCAL_ASSET_ROOT", root),
                patch.object(upload_service.s3_client, "put_object", side_effect=RuntimeError("minio down")),
            ):
                await upload_service.store_asset_bytes("gen_img_test.png", b"fake-png", "image/png")

                self.assertEqual((root / "gen_img_test.png").read_bytes(), b"fake-png")
                content, media_type = await upload_service.read_image_asset("gen_img_test.png")

        self.assertEqual(content, b"fake-png")
        self.assertEqual(media_type, "image/png")

    async def test_read_asset_rejects_path_traversal(self):
        with self.assertRaises(HTTPException) as ctx:
            await upload_service.read_image_asset("../secret.png")

        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
