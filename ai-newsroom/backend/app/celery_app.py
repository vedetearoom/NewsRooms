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
    result_expires=3600,
    worker_max_tasks_per_child=50,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_queue="newsroom_default",
    task_routes={
        "newsroom.check_monitor": {"queue": "newsroom_fast"},
        "newsroom.scrape": {"queue": "newsroom_fast"},
        "newsroom.manual_scrape": {"queue": "newsroom_fast"},
        "newsroom.process": {"queue": "newsroom_ai"},
        "newsroom.process_selected": {"queue": "newsroom_ai"},
        "newsroom.review": {"queue": "newsroom_ai"},
        "newsroom.analyze_video_metadata": {"queue": "newsroom_ai"},
        "newsroom.plugin_install": {"queue": "newsroom_ai"},
        "newsroom.plugin_prepare_write": {"queue": "newsroom_ai"},
        "newsroom.analyze_video": {"queue": "newsroom_video"},
    },
    task_annotations={
        "newsroom.check_monitor": {"soft_time_limit": 600, "time_limit": 720},
        "newsroom.scrape": {"soft_time_limit": 900, "time_limit": 1200},
        "newsroom.manual_scrape": {"soft_time_limit": 600, "time_limit": 900},
        "newsroom.process": {"soft_time_limit": 1800, "time_limit": 2100},
        "newsroom.process_selected": {"soft_time_limit": 1800, "time_limit": 2100},
        "newsroom.review": {"soft_time_limit": 1800, "time_limit": 2100},
        "newsroom.analyze_video_metadata": {"soft_time_limit": 900, "time_limit": 1200},
        "newsroom.plugin_install": {"soft_time_limit": 600, "time_limit": 900},
        "newsroom.plugin_prepare_write": {"soft_time_limit": 900, "time_limit": 1020},
        "newsroom.analyze_video": {"soft_time_limit": 3300, "time_limit": 3600},
    },
    broker_transport_options={"visibility_timeout": 7200},
    result_backend_transport_options={"visibility_timeout": 7200},
)

# Auto-discover tasks in app.workers.tasks
celery_app.autodiscover_tasks(["app.workers"])
