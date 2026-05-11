from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    WRITING = "writing"
    WRITTEN = "written"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    FAILED = "failed"


TASK_STATUS_VALUES = tuple(status.value for status in TaskStatus)

LEGACY_TASK_STATUS_ALIASES = {
    "draft_ready": TaskStatus.WRITTEN.value,
    "in_progress": TaskStatus.WRITING.value,
}


def normalize_task_status(value: str | TaskStatus | None) -> str | None:
    if value is None:
        return None

    normalized = value.value if isinstance(value, TaskStatus) else str(value).strip().lower()
    if not normalized:
        return None

    if normalized in LEGACY_TASK_STATUS_ALIASES:
        return LEGACY_TASK_STATUS_ALIASES[normalized]

    if normalized in TASK_STATUS_VALUES:
        return normalized

    return None
