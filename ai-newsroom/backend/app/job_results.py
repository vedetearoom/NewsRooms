from typing import Any

from app.services.job_manager import JobStatus


def job_success(kind: str, **data: Any) -> dict[str, Any]:
    return {
        "ok": True,
        "status": JobStatus.COMPLETED.value,
        "kind": kind,
        **data,
    }


def job_failure(kind: str, error: str, **data: Any) -> dict[str, Any]:
    return {
        "ok": False,
        "status": JobStatus.FAILED.value,
        "kind": kind,
        "error": error,
        **data,
    }
