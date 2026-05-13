from app.services.job_manager import job_manager


async def _track_celery_job(name: str, celery_id: str, meta: dict | None = None) -> str:
    payload = {"celery_id": celery_id}
    if meta:
        payload.update(meta)
    return await job_manager.submit(name, celery_id, meta=payload)


async def dispatch_scrape_all_job(owner_user_id: int) -> str:
    from app.workers.tasks import celery_scrape_task

    result = celery_scrape_task.delay(owner_user_id)
    return await _track_celery_job("scrape_all", result.id, meta={"owner_user_id": owner_user_id})


async def dispatch_process_all_job(owner_user_id: int) -> str:
    from app.workers.tasks import celery_process_task

    result = celery_process_task.delay(owner_user_id)
    return await _track_celery_job("process_all", result.id, meta={"owner_user_id": owner_user_id})


async def dispatch_process_selected_job(article_ids: list[int], owner_user_id: int) -> str:
    from app.workers.tasks import celery_process_selected_task

    result = celery_process_selected_task.delay(article_ids, owner_user_id)
    return await _track_celery_job(
        "process_selected",
        result.id,
        meta={"article_ids": article_ids, "owner_user_id": owner_user_id},
    )


async def dispatch_video_metadata_analysis_job(
    video_url: str,
    owner_user_id: int,
    seed_metadata: dict | None = None,
    source_kind: str = "url",
) -> str:
    from app.workers.tasks import celery_analyze_video_metadata

    result = celery_analyze_video_metadata.delay(video_url, owner_user_id, seed_metadata or {}, source_kind)
    return await _track_celery_job(
        "analyze_video_metadata",
        result.id,
        meta={
            "video_url": video_url,
            "owner_user_id": owner_user_id,
            "seed_metadata": seed_metadata or {},
            "source_kind": source_kind,
        },
    )


async def dispatch_video_analysis_job(
    video_url: str,
    owner_user_id: int,
    preferred_thumbnail: str | None = None,
    source_kind: str = "url",
    storage_key: str | None = None,
    original_filename: str | None = None,
    mime_type: str | None = None,
) -> str:
    from app.workers.tasks import celery_analyze_video

    result = celery_analyze_video.delay(
        video_url,
        owner_user_id,
        preferred_thumbnail,
        source_kind,
        storage_key,
        original_filename,
        mime_type,
    )
    return await _track_celery_job(
        "analyze_video",
        result.id,
        meta={
            "video_url": video_url,
            "owner_user_id": owner_user_id,
            "preferred_thumbnail": preferred_thumbnail,
            "source_kind": source_kind,
            "storage_key": storage_key,
            "original_filename": original_filename,
            "mime_type": mime_type,
        },
    )


async def dispatch_monitor_check_job(monitor_id: int, owner_user_id: int, platform: str) -> str:
    from app.workers.tasks import celery_check_monitor

    result = celery_check_monitor.delay(monitor_id, owner_user_id, platform)
    return await _track_celery_job(
        "check_monitor",
        result.id,
        meta={"monitor_id": monitor_id, "owner_user_id": owner_user_id, "platform": platform},
    )


async def dispatch_manual_scrape_job(source_id: int, owner_user_id: int) -> str:
    from app.workers.tasks import celery_manual_scrape

    result = celery_manual_scrape.delay(source_id, owner_user_id)
    return await _track_celery_job(
        f"scrape_source_{source_id}",
        result.id,
        meta={"source_id": source_id, "owner_user_id": owner_user_id},
    )


async def dispatch_review_job(task_id: int, owner_user_id: int, reviewer_id: int | None = None) -> str:
    from app.workers.tasks import celery_review_task

    result = celery_review_task.delay(task_id, owner_user_id, reviewer_id)
    return await _track_celery_job(
        "review_task",
        result.id,
        meta={"task_id": task_id, "reviewer_id": reviewer_id, "owner_user_id": owner_user_id},
    )


async def dispatch_plugin_install_job(plugin_id: int, owner_user_id: int) -> str:
    from app.workers.tasks import celery_plugin_install

    result = celery_plugin_install.delay(plugin_id, owner_user_id)
    return await _track_celery_job(
        "plugin_install",
        result.id,
        meta={"plugin_id": plugin_id, "owner_user_id": owner_user_id},
    )


async def dispatch_plugin_prepare_write_job(task_id: int, owner_user_id: int, writer_agent_id: int) -> str:
    from app.workers.tasks import celery_plugin_prepare_write

    result = celery_plugin_prepare_write.delay(task_id, owner_user_id, writer_agent_id)
    return await _track_celery_job(
        "plugin_prepare_write",
        result.id,
        meta={
            "task_id": task_id,
            "owner_user_id": owner_user_id,
            "writer_agent_id": writer_agent_id,
        },
    )
