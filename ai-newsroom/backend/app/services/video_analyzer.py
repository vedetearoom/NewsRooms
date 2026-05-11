"""Video deconstruction pipeline orchestrator.

Delegates to specialized sub-modules for downloading, transcribing, and structured LLM extraction.
"""
import logging
import os
import shutil
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IntelligenceCard
from app.services.credential_service import get_decrypted_monitor_cookie
from app.services.agent_dispatcher import AgentDispatcher
from app.services.upload_service import s3_client, settings
from app.services.video.downloader import detect_platform, download_audio
from app.services.video.extractor import analyze_video_transcript
from app.services.video.local_video import prepare_uploaded_video_for_analysis
from app.services.video.thumbnail_utils import choose_better_thumbnail
from app.services.video.transcriber import transcribe as gemini_transcribe
from app.services.video.qwen_transcriber import transcribe as qwen_transcribe

logger = logging.getLogger(__name__)


class VideoAnalyzer:
    """Video deconstruction pipeline facade."""

    async def process_video(
        self,
        video_url: str,
        db: AsyncSession,
        owner_user_id: int,
        preferred_thumbnail: str | None = None,
        source_kind: str = "url",
        storage_key: str | None = None,
        original_filename: str | None = None,
        mime_type: str | None = None,
    ) -> IntelligenceCard:
        """Full pipeline: download → transcribe → analyze → save to DB."""
        # Step 1: Download or prepare audio
        if source_kind == "file":
            if not storage_key:
                raise ValueError("缺少已上传视频的存储信息，请重新上传后再试。")
            video_info = await prepare_uploaded_video_for_analysis(
                storage_key,
                original_filename=original_filename,
                mime_type=mime_type,
            )
        else:
            platform = detect_platform(video_url)
            if platform == "douyin":
                raise ValueError("当前版本暂不支持抖音视频解构，请改用本地视频上传。")
            cookie_header = None
            if platform in ["xiaohongshu", "bilibili"]:
                cookie_header = await get_decrypted_monitor_cookie(db, owner_user_id, platform)
            video_info = await download_audio(video_url, cookie_header=cookie_header)
        video_info["thumbnail"] = choose_better_thumbnail(
            video_info.get("thumbnail", ""),
            preferred_thumbnail,
        )

        try:
            # Step 2: Transcribe audio using the configured model (Gemini or Qwen)
            transcriber_config = await AgentDispatcher.get_audio_transcriber_config(db, owner_user_id=owner_user_id)
            if transcriber_config["provider"] == "qwen":
                transcript = await qwen_transcribe(
                    video_info["audio_path"], 
                    api_key=transcriber_config["api_key"], 
                    model=transcriber_config["model_ref"]
                )
            else:
                transcript = await gemini_transcribe(
                    video_info["audio_path"], 
                    api_key=transcriber_config["api_key"]
                )

            # Upload audio to MinIO
            audio_url = None
            audio_path = video_info.get("audio_path", "")
            if audio_path and os.path.exists(audio_path):
                ext = audio_path.rsplit(".", 1)[-1] if "." in audio_path else "mp3"
                filename = f"audio_{uuid.uuid4().hex[:8]}.{ext}"
                try:
                    with open(audio_path, "rb") as f:
                        s3_client.put_object(
                            Bucket=settings.minio_bucket,
                            Key=filename,
                            Body=f,
                            ContentType="audio/mpeg",
                        )
                    audio_url = f"{settings.minio_endpoint}/{settings.minio_bucket}/{filename}"
                    logger.info(f"[VideoAnalyzer] Audio uploaded to MinIO: {audio_url}")
                except Exception as e:
                    logger.error(f"[VideoAnalyzer] Failed to upload audio to MinIO: {e}")

            # Step 3: Analyze transcript with LLM (model determined by Extractor Agent config)
            card = await analyze_video_transcript(
                transcript,
                video_info,
                db,
                owner_user_id=owner_user_id,
                audio_url=audio_url,
            )

            return card

        finally:
            cleanup_dir = video_info.get("cleanup_dir", "")
            if cleanup_dir and os.path.exists(cleanup_dir):
                shutil.rmtree(cleanup_dir, ignore_errors=True)
            else:
                audio_path = video_info.get("audio_path", "")
                if audio_path and os.path.exists(audio_path):
                    try:
                        os.remove(audio_path)
                        os.rmdir(os.path.dirname(audio_path))
                    except OSError:
                        pass
