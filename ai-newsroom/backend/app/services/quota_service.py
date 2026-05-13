from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Agent,
    AgentThread,
    CustomPlugin,
    IntelligenceCard,
    ManualVideoInboxItem,
    MonitorTarget,
    QuotaUsageCounter,
    Role,
    Source,
    Task,
    User,
    user_roles,
)

QUOTA_TIMEZONE = ZoneInfo("Asia/Shanghai")

TEXT_SOURCES = "text_sources"
VIDEO_MONITORS = "video_monitors"
TASKS = "tasks"
INSPIRATIONS = "inspirations"
ARTICLE_CARDS = "article_cards"
VIDEO_CARDS = "video_cards"
MANUAL_VIDEO_ITEMS = "manual_video_items"
CUSTOM_AGENTS = "custom_agents"
INSTALLED_PLUGINS = "installed_plugins"
AGENT_THREADS = "agent_threads"
ACTIVE_BACKGROUND_JOBS = "active_background_jobs"

DAILY_SCRAPES = "daily_scrapes"
DAILY_MONITOR_CHECKS = "daily_monitor_checks"
DAILY_ARTICLE_PROCESSES = "daily_article_processes"
DAILY_VIDEO_ANALYSES = "daily_video_analyses"
DAILY_IMAGE_GENERATIONS = "daily_image_generations"
DAILY_IMAGE_UPLOADS = "daily_image_uploads"
DAILY_AGENT_MESSAGES = "daily_agent_messages"
DAILY_AI_RUNS = "daily_ai_runs"

RESOURCE_QUOTA_KEYS = [
    TEXT_SOURCES,
    VIDEO_MONITORS,
    TASKS,
    INSPIRATIONS,
    ARTICLE_CARDS,
    VIDEO_CARDS,
    MANUAL_VIDEO_ITEMS,
    CUSTOM_AGENTS,
    INSTALLED_PLUGINS,
    AGENT_THREADS,
    ACTIVE_BACKGROUND_JOBS,
]

DAILY_QUOTA_KEYS = [
    DAILY_SCRAPES,
    DAILY_MONITOR_CHECKS,
    DAILY_ARTICLE_PROCESSES,
    DAILY_VIDEO_ANALYSES,
    DAILY_IMAGE_GENERATIONS,
    DAILY_IMAGE_UPLOADS,
    DAILY_AGENT_MESSAGES,
    DAILY_AI_RUNS,
]

ALL_QUOTA_KEYS = [*RESOURCE_QUOTA_KEYS, *DAILY_QUOTA_KEYS]

DEFAULT_ROLE_QUOTA_LIMITS: dict[str, int | None] = {
    TEXT_SOURCES: 3,
    VIDEO_MONITORS: 1,
    TASKS: 3,
    INSPIRATIONS: 10,
    ARTICLE_CARDS: 30,
    VIDEO_CARDS: 5,
    MANUAL_VIDEO_ITEMS: 5,
    CUSTOM_AGENTS: 3,
    INSTALLED_PLUGINS: 3,
    AGENT_THREADS: 20,
    ACTIVE_BACKGROUND_JOBS: 3,
    DAILY_SCRAPES: 5,
    DAILY_MONITOR_CHECKS: 5,
    DAILY_ARTICLE_PROCESSES: 3,
    DAILY_VIDEO_ANALYSES: 5,
    DAILY_IMAGE_GENERATIONS: 5,
    DAILY_IMAGE_UPLOADS: 20,
    DAILY_AGENT_MESSAGES: 30,
    DAILY_AI_RUNS: 10,
}

QUOTA_LABELS: dict[str, str] = {
    TEXT_SOURCES: "图文站点",
    VIDEO_MONITORS: "视频博主",
    TASKS: "任务",
    INSPIRATIONS: "灵感",
    ARTICLE_CARDS: "图文情报",
    VIDEO_CARDS: "视频情报",
    MANUAL_VIDEO_ITEMS: "手动视频素材",
    CUSTOM_AGENTS: "自定义智能体",
    INSTALLED_PLUGINS: "插件",
    AGENT_THREADS: "工作台对话",
    ACTIVE_BACKGROUND_JOBS: "进行中的后台任务",
    DAILY_SCRAPES: "抓取",
    DAILY_MONITOR_CHECKS: "监控检查",
    DAILY_ARTICLE_PROCESSES: "文章处理",
    DAILY_VIDEO_ANALYSES: "视频解构",
    DAILY_IMAGE_GENERATIONS: "生图",
    DAILY_IMAGE_UPLOADS: "图片上传",
    DAILY_AGENT_MESSAGES: "智能体对话/改写",
    DAILY_AI_RUNS: "写作/审核 AI 运行",
}


def normalize_quota_limits(raw: dict | None) -> dict[str, int | None]:
    limits: dict[str, int | None] = {}
    raw = raw if isinstance(raw, dict) else {}
    for key, default in DEFAULT_ROLE_QUOTA_LIMITS.items():
        value = raw.get(key, default)
        if value is None or value == "":
            limits[key] = None
            continue
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            limits[key] = default
            continue
        limits[key] = max(parsed, 0)
    return limits


def default_quota_limits() -> dict[str, int | None]:
    return dict(DEFAULT_ROLE_QUOTA_LIMITS)


def unlimited_quota_limits() -> dict[str, int | None]:
    return {key: None for key in ALL_QUOTA_KEYS}


def _quota_detail(
    *,
    code: str,
    quota_key: str,
    limit: int,
    used: int,
    message: str,
) -> dict[str, object]:
    return {
        "code": code,
        "message": message,
        "quota_key": quota_key,
        "limit": limit,
        "used": used,
        "remaining": max(limit - used, 0),
    }


def _raise_resource_quota(quota_key: str, limit: int, used: int) -> None:
    label = QUOTA_LABELS.get(quota_key, quota_key)
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=_quota_detail(
            code="QUOTA_LIMIT_EXCEEDED",
            quota_key=quota_key,
            limit=limit,
            used=used,
            message=(
                f"当前套餐最多可创建 {limit} 个{label}，已使用 {used} 个。"
                "请删除旧内容或联系管理员升级套餐。"
            ),
        ),
    )


def _raise_daily_quota(quota_key: str, limit: int, used: int) -> None:
    label = QUOTA_LABELS.get(quota_key, quota_key)
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=_quota_detail(
            code="QUOTA_DAILY_EXCEEDED",
            quota_key=quota_key,
            limit=limit,
            used=used,
            message=(
                f"今日{label}额度已用完：最多 {limit} 次，已使用 {used} 次。"
                "请明天再试或联系管理员升级套餐。"
            ),
        ),
    )


async def _lock_user_row(db: AsyncSession, user_id: int) -> None:
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())


async def _load_user(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def _load_user_roles(db: AsyncSession, user_id: int) -> list[Role]:
    result = await db.execute(
        select(Role)
        .join(user_roles, user_roles.c.role_id == Role.id)
        .where(user_roles.c.user_id == user_id)
    )
    return list(result.scalars().all())


def _merge_role_limits(roles: list[Role]) -> dict[str, int | None]:
    if any(role.code == "super_admin" for role in roles):
        return unlimited_quota_limits()

    role_limits = [
        normalize_quota_limits(role.quota_limits if isinstance(role.quota_limits, dict) else None)
        for role in roles
    ]
    if not role_limits:
        role_limits = [default_quota_limits()]

    merged: dict[str, int | None] = {}
    for key in ALL_QUOTA_KEYS:
        best: int | None = 0
        for limits in role_limits:
            value = limits.get(key)
            if value is None:
                best = None
                break
            best = max(best or 0, value)
        merged[key] = best
    return merged


async def get_effective_quota_limits(db: AsyncSession, user_id: int) -> dict[str, int | None]:
    user = await _load_user(db, user_id)
    if user and user.is_super_admin:
        return unlimited_quota_limits()
    roles = await _load_user_roles(db, user_id)
    return _merge_role_limits(roles)


async def get_quota_limit(db: AsyncSession, user_id: int, quota_key: str) -> int | None:
    limits = await get_effective_quota_limits(db, user_id)
    return limits.get(quota_key)


_ACTIVE_JOB_STATUSES = {"pending", "queued", "started", "running", "retry"}


async def _count_active_background_jobs(user_id: int) -> int:
    try:
        from app.services.job_manager import job_manager

        jobs = await job_manager.get_all_jobs()
    except Exception:
        return 0
    count = 0
    for job in jobs:
        meta = job.get("meta") or {}
        if isinstance(meta, str):
            import json as _json
            try:
                meta = _json.loads(meta)
            except Exception:
                meta = {}
        if meta.get("owner_user_id") == user_id and job.get("status") in _ACTIVE_JOB_STATUSES:
            count += 1
    return count


async def count_resource_usage(db: AsyncSession, user_id: int, quota_key: str) -> int:
    if quota_key == TEXT_SOURCES:
        query = select(func.count(Source.id)).where(Source.owner_user_id == user_id)
    elif quota_key == VIDEO_MONITORS:
        query = select(func.count(MonitorTarget.id)).where(MonitorTarget.owner_user_id == user_id)
    elif quota_key == TASKS:
        query = select(func.count(Task.id)).where(Task.owner_user_id == user_id)
    elif quota_key == INSPIRATIONS:
        from app.models import InspirationAsset

        query = select(func.count(InspirationAsset.id)).where(InspirationAsset.owner_user_id == user_id)
    elif quota_key == ARTICLE_CARDS:
        query = select(func.count(IntelligenceCard.id)).where(
            IntelligenceCard.owner_user_id == user_id,
            or_(IntelligenceCard.content_type.is_(None), IntelligenceCard.content_type != "video"),
        )
    elif quota_key == VIDEO_CARDS:
        query = select(func.count(IntelligenceCard.id)).where(
            IntelligenceCard.owner_user_id == user_id,
            IntelligenceCard.content_type == "video",
        )
    elif quota_key == MANUAL_VIDEO_ITEMS:
        query = select(func.count(ManualVideoInboxItem.id)).where(ManualVideoInboxItem.owner_user_id == user_id)
    elif quota_key == CUSTOM_AGENTS:
        query = select(func.count(Agent.id)).where(
            Agent.owner_user_id == user_id,
            Agent.is_system == False,
        )
    elif quota_key == INSTALLED_PLUGINS:
        query = select(func.count(CustomPlugin.id)).where(
            CustomPlugin.owner_user_id == user_id,
            CustomPlugin.install_status.in_(["queued", "installing", "installed"]),
        )
    elif quota_key == AGENT_THREADS:
        query = select(func.count(AgentThread.id)).where(AgentThread.owner_user_id == user_id)
    elif quota_key == ACTIVE_BACKGROUND_JOBS:
        return await _count_active_background_jobs(user_id)
    else:
        raise ValueError(f"Unsupported resource quota key: {quota_key}")
    return int((await db.execute(query)).scalar() or 0)


async def get_resource_remaining(db: AsyncSession, user_id: int, quota_key: str) -> int | None:
    limit = await get_quota_limit(db, user_id, quota_key)
    if limit is None:
        return None
    used = await count_resource_usage(db, user_id, quota_key)
    return max(limit - used, 0)


async def ensure_resource_quota(
    db: AsyncSession,
    user_id: int,
    quota_key: str,
    *,
    increment: int = 1,
    lock: bool = True,
) -> None:
    if increment <= 0:
        return
    if lock:
        await _lock_user_row(db, user_id)
    limit = await get_quota_limit(db, user_id, quota_key)
    if limit is None:
        return
    used = await count_resource_usage(db, user_id, quota_key)
    if used + increment > limit:
        _raise_resource_quota(quota_key, limit, used)


def get_quota_usage_date() -> date:
    return datetime.now(QUOTA_TIMEZONE).date()


async def get_daily_usage(db: AsyncSession, user_id: int, quota_key: str, usage_date: date | None = None) -> int:
    usage_date = usage_date or get_quota_usage_date()
    result = await db.execute(
        select(QuotaUsageCounter.used).where(
            QuotaUsageCounter.owner_user_id == user_id,
            QuotaUsageCounter.quota_key == quota_key,
            QuotaUsageCounter.usage_date == usage_date,
        )
    )
    return int(result.scalar() or 0)


async def get_daily_remaining(db: AsyncSession, user_id: int, quota_key: str) -> int | None:
    limit = await get_quota_limit(db, user_id, quota_key)
    if limit is None:
        return None
    used = await get_daily_usage(db, user_id, quota_key)
    return max(limit - used, 0)


async def consume_daily_quota(
    db: AsyncSession,
    user_id: int,
    quota_key: str,
    *,
    amount: int = 1,
) -> None:
    if amount <= 0:
        return
    await _lock_user_row(db, user_id)
    limit = await get_quota_limit(db, user_id, quota_key)
    if limit is None:
        return

    usage_date = get_quota_usage_date()
    result = await db.execute(
        select(QuotaUsageCounter)
        .where(
            QuotaUsageCounter.owner_user_id == user_id,
            QuotaUsageCounter.quota_key == quota_key,
            QuotaUsageCounter.usage_date == usage_date,
        )
        .with_for_update()
    )
    counter = result.scalar_one_or_none()
    used = int(counter.used if counter else 0)
    if used + amount > limit:
        _raise_daily_quota(quota_key, limit, used)

    if counter is None:
        counter = QuotaUsageCounter(
            owner_user_id=user_id,
            quota_key=quota_key,
            usage_date=usage_date,
            used=amount,
        )
        db.add(counter)
    else:
        counter.used = used + amount
    await db.flush()


async def build_quota_snapshot(db: AsyncSession, user_id: int) -> dict[str, object]:
    limits = await get_effective_quota_limits(db, user_id)
    usage_date = get_quota_usage_date()
    resources: dict[str, dict[str, object]] = {}
    daily: dict[str, dict[str, object]] = {}

    for key in RESOURCE_QUOTA_KEYS:
        used = await count_resource_usage(db, user_id, key)
        limit = limits.get(key)
        resources[key] = {
            "label": QUOTA_LABELS.get(key, key),
            "used": used,
            "limit": limit,
            "remaining": None if limit is None else max(limit - used, 0),
        }

    for key in DAILY_QUOTA_KEYS:
        used = await get_daily_usage(db, user_id, key, usage_date)
        limit = limits.get(key)
        daily[key] = {
            "label": QUOTA_LABELS.get(key, key),
            "used": used,
            "limit": limit,
            "remaining": None if limit is None else max(limit - used, 0),
        }

    return {
        "limits": limits,
        "resources": resources,
        "daily": daily,
        "usage_date": usage_date.isoformat(),
        "timezone": "Asia/Shanghai",
    }
