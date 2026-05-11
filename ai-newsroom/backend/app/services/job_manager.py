"""Redis-backed background job manager for long-running Celery tasks.

Provides a unified persistence and tracking layer over Celery's AsyncResult.
Jobs are auto-expired after TTL to prevent stale data accumulation.
"""
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import redis.asyncio as aioredis
from app.config import get_settings

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BackgroundJobManager:
    """Redis-backed async background job tracker for Celery tasks.

    Usage:
        task = celery_task_name.delay(...)
        job_manager.submit("scrape_all", task.id)
        status = await job_manager.get_status(task.id)
    """

    PREFIX = "newsroom:job:"
    TTL = 3600  # Job status entries expire after 1 hour

    def __init__(self):
        settings = get_settings()
        self._redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
        )

    async def submit(self, name: str, celery_task_id: str, meta: dict = None) -> str:
        """Register a Celery task for background tracking. Returns the job_id (which is the celery_task_id)."""
        key = f"{self.PREFIX}{celery_task_id}"
        mapping = {
            "name": name,
            "status": JobStatus.PENDING,
            "result": "",
            "error": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if meta is not None:
            mapping["meta"] = json.dumps(meta)
            
        await self._redis.hset(key, mapping=mapping)
        await self._redis.expire(key, self.TTL)
        return celery_task_id

    async def _sync_celery_status(self, job_id: str, data: dict):
        """Internal helper to dynamically hydrate job data from Celery and update Redis."""
        # Unify status if still pending or running
        if data.get("status") in [JobStatus.PENDING, JobStatus.RUNNING]:
            from celery.result import AsyncResult
            from app.celery_app import celery_app
            
            res = AsyncResult(job_id, app=celery_app)
            state = res.state
            
            key = f"{self.PREFIX}{job_id}"
            updates = {}
            if state == "SUCCESS":
                data["status"] = JobStatus.COMPLETED
                result_data = res.result
                
                # Check for "soft failure" payload returned explicitly by CELERY tasks (e.g. video analyzer)
                if (
                    isinstance(result_data, dict)
                    and (
                        result_data.get("ok") is False
                        or result_data.get("status") == JobStatus.FAILED.value
                    )
                ):
                    data["status"] = JobStatus.FAILED
                    data["error"] = result_data.get("error", "Unknown error")
                    updates["status"] = JobStatus.FAILED
                    updates["error"] = data["error"]
                else:
                    encoded_result = json.dumps(result_data)
                    data["result"] = encoded_result
                    updates["status"] = JobStatus.COMPLETED
                    updates["result"] = encoded_result
                    
            elif state == "FAILURE":
                data["status"] = JobStatus.FAILED
                data["error"] = str(res.result)
                updates["status"] = JobStatus.FAILED
                updates["error"] = data["error"]
                
            elif state in ("STARTED", "RETRY"):
                if data["status"] != JobStatus.RUNNING:
                    data["status"] = JobStatus.RUNNING
                    updates["status"] = JobStatus.RUNNING
                    
            if updates:
                await self._redis.hset(key, mapping=updates)

    async def get_status(self, job_id: str) -> Optional[dict]:
        """Retrieve current status of a job by querying Redis + Celery AsyncResult dynamically."""
        key = f"{self.PREFIX}{job_id}"
        data = await self._redis.hgetall(key)
        if not data:
            return None
            
        await self._sync_celery_status(job_id, data)

        # Parse result back to dict if possible
        if data.get("result"):
            try:
                data["result"] = json.loads(data["result"])
            except (json.JSONDecodeError, TypeError):
                pass
                
        if data.get("meta"):
            try:
                data["meta"] = json.loads(data["meta"])
            except (json.JSONDecodeError, TypeError):
                pass
        return data

    async def get_all_jobs(self) -> list[dict]:
        """Retrieve the status of all current jobs."""
        keys = await self._redis.keys(f"{self.PREFIX}*")
        jobs = []
        if not keys:
            return jobs
            
        pipe = self._redis.pipeline()
        for key in keys:
            pipe.hgetall(key)
        
        results = await pipe.execute()
        
        for key, data in zip(keys, results):
            if not data:
                continue
            job_info = data.copy()
            job_id = key.replace(self.PREFIX, "")
            job_info["job_id"] = job_id
            
            # Sync directly if it looks pending/running
            await self._sync_celery_status(job_id, job_info)
            
            if job_info.get("result"):
                try:
                    job_info["result"] = json.loads(job_info["result"])
                except (json.JSONDecodeError, TypeError):
                    pass
                    
            if job_info.get("meta"):
                try:
                    job_info["meta"] = json.loads(job_info["meta"])
                except (json.JSONDecodeError, TypeError):
                    pass
            jobs.append(job_info)
            
        jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return jobs

# Global singleton — initialized once at import time
job_manager = BackgroundJobManager()
