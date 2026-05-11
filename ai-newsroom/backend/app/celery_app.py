"""Celery application instance for AI Newsroom background tasks.

Uses Redis as both broker and result backend.
"""
from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "newsroom",
    broker=settings.redis_url,
    backend=settings.redis_url, 
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    task_track_started=True,
    result_expires=3600,  # Results expire after 1 hour
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks to prevent memory leaks
    task_acks_late=True,  # Acknowledge task after completion (prevents task loss on worker crash)
    worker_prefetch_multiplier=1,  # Only prefetch 1 task at a time for long-running AI tasks
)

# Auto-discover tasks in app.workers.tasks
celery_app.autodiscover_tasks(["app.workers"])
