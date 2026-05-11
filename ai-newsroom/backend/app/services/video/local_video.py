"""Helpers for manually uploaded local videos."""

from __future__ import annotations

import asyncio
import logging
import mimetypes
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.services.upload_service import build_public_asset_url, s3_client, settings

logger = logging.getLogger(__name__)

MAX_MANUAL_VIDEO_SIZE_BYTES = 200 * 1024 * 1024
MANUAL_VIDEO_ALLOWED_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}
MANUAL_VIDEO_ALLOWED_MIME_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
    "video/webm",
}


def format_manual_video_identity(storage_key: str) -> str:
    return f"upload://{storage_key}"


def format_local_video_display_name(filename: str | None) -> str:
    stem = Path(filename or "").stem.strip()
    return stem or "本地视频"


def _guess_video_mime_type(filename: str) -> str | None:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed.lower() if guessed else None


def _normalize_upload_content_type(filename: str, content_type: str | None) -> tuple[str, str]:
    ext = Path(filename).suffix.lower()
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    guessed_type = _guess_video_mime_type(filename)

    if ext not in MANUAL_VIDEO_ALLOWED_EXTENSIONS and normalized_type not in MANUAL_VIDEO_ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="当前仅支持 mp4、mov、m4v、webm 视频文件")

    if ext not in MANUAL_VIDEO_ALLOWED_EXTENSIONS:
        ext = next(
            (candidate for candidate, mime in mimetypes.types_map.items() if mime == normalized_type),
            ".mp4",
        )

    if ext not in MANUAL_VIDEO_ALLOWED_EXTENSIONS:
        ext = ".mp4"

    if normalized_type not in MANUAL_VIDEO_ALLOWED_MIME_TYPES:
        normalized_type = guessed_type if guessed_type in MANUAL_VIDEO_ALLOWED_MIME_TYPES else "video/mp4"

    return ext, normalized_type


async def _copy_upload_to_path(file: UploadFile, target_path: str) -> int:
    total = 0
    chunk_size = 1024 * 1024
    await file.seek(0)
    with open(target_path, "wb") as output:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_MANUAL_VIDEO_SIZE_BYTES:
                raise HTTPException(status_code=400, detail="视频文件不能超过 200MB")
            output.write(chunk)
    if total <= 0:
        raise HTTPException(status_code=400, detail="上传的视频文件为空")
    return total


def _upload_local_file_to_storage(local_path: str, storage_key: str, content_type: str) -> None:
    with open(local_path, "rb") as file_obj:
        s3_client.put_object(
            Bucket=settings.minio_bucket,
            Key=storage_key,
            Body=file_obj,
            ContentType=content_type,
        )


def _download_storage_object_to_path(storage_key: str, local_path: str) -> None:
    with open(local_path, "wb") as file_obj:
        s3_client.download_fileobj(settings.minio_bucket, storage_key, file_obj)


def _probe_video_duration(video_path: str) -> int | None:
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                video_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None

    raw = completed.stdout.strip()
    if not raw:
        return None
    try:
        return max(int(float(raw)), 0)
    except ValueError:
        return None


def _generate_video_thumbnail(video_path: str, output_path: str) -> str | None:
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-ss",
                "00:00:01",
                "-i",
                video_path,
                "-frames:v",
                "1",
                "-q:v",
                "2",
                output_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None
    return output_path if os.path.exists(output_path) else None


def _extract_audio_to_mp3(video_path: str, output_path: str) -> str:
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                video_path,
                "-vn",
                "-acodec",
                "mp3",
                "-ab",
                "128k",
                output_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError as exc:
        raise ValueError("服务器缺少 ffmpeg，暂时无法处理本地视频。") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise ValueError(f"本地视频音频提取失败：{stderr or 'ffmpeg 执行失败'}") from exc

    if not os.path.exists(output_path):
        raise ValueError("本地视频音频提取失败：未生成 MP3 文件。")
    return output_path


async def store_uploaded_manual_video(file: UploadFile) -> dict[str, object]:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="请先选择一个视频文件")

    ext, content_type = _normalize_upload_content_type(filename, file.content_type)
    temp_dir = tempfile.mkdtemp(prefix="newsroom_manual_video_")
    local_video_path = os.path.join(temp_dir, f"source{ext}")

    try:
        file_size_bytes = await _copy_upload_to_path(file, local_video_path)

        duration_seconds = await asyncio.to_thread(_probe_video_duration, local_video_path)

        storage_key = f"manual-videos/{uuid.uuid4().hex}{ext}"
        try:
            await asyncio.to_thread(_upload_local_file_to_storage, local_video_path, storage_key, content_type)
        except Exception as exc:
            logger.exception("Manual video upload to storage failed")
            raise HTTPException(
                status_code=503,
                detail="视频存储服务暂时不可用，请检查 MinIO 服务后重试。",
            ) from exc

        thumbnail_url = ""
        thumbnail_path = await asyncio.to_thread(
            _generate_video_thumbnail,
            local_video_path,
            os.path.join(temp_dir, "thumbnail.jpg"),
        )
        if thumbnail_path:
            thumbnail_key = f"manual-video-thumbnails/{uuid.uuid4().hex}.jpg"
            try:
                await asyncio.to_thread(_upload_local_file_to_storage, thumbnail_path, thumbnail_key, "image/jpeg")
                thumbnail_url = build_public_asset_url(thumbnail_key)
            except Exception as exc:
                logger.warning("Manual video thumbnail upload failed, continuing without thumbnail: %s", exc)

        return {
            "source_kind": "file",
            "original_url": f"local://{filename}",
            "normalized_url": format_manual_video_identity(storage_key),
            "platform": "upload",
            "title": format_local_video_display_name(filename),
            "original_filename": filename,
            "storage_key": storage_key,
            "mime_type": content_type,
            "file_size_bytes": file_size_bytes,
            "thumbnail": thumbnail_url,
            "duration_seconds": duration_seconds,
        }
    finally:
        await file.close()
        shutil.rmtree(temp_dir, ignore_errors=True)


async def prepare_uploaded_video_for_analysis(
    storage_key: str,
    original_filename: str | None = None,
    mime_type: str | None = None,
) -> dict[str, object]:
    ext = Path(original_filename or storage_key).suffix.lower()
    if not ext:
        ext = next(
            (candidate for candidate, mime in mimetypes.types_map.items() if mime == (mime_type or "").lower()),
            ".mp4",
        )

    temp_dir = tempfile.mkdtemp(prefix="newsroom_uploaded_video_")
    local_video_path = os.path.join(temp_dir, f"source{ext}")
    audio_path = os.path.join(temp_dir, "audio.mp3")

    try:
        await asyncio.to_thread(_download_storage_object_to_path, storage_key, local_video_path)
        await asyncio.to_thread(_extract_audio_to_mp3, local_video_path, audio_path)
        duration_seconds = await asyncio.to_thread(_probe_video_duration, local_video_path)

        return {
            "audio_path": audio_path,
            "title": format_local_video_display_name(original_filename),
            "author": "",
            "duration": duration_seconds or 0,
            "thumbnail": "",
            "platform": "upload",
            "video_url": format_manual_video_identity(storage_key),
            "cleanup_dir": temp_dir,
        }
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        if isinstance(exc, ValueError):
            raise
        raise ValueError("未找到已上传的视频文件，请重新上传后再试。") from exc
