"""In-memory job registry.

Jobs are background tasks (one per button press in the UI). They live only in
this process, so a backend restart clears them - the frontend handles the
resulting 404 by dropping its local job state.
"""

from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from backend.models import Job, JobResponse, JobStatus

_MAX_EVENTS_RETURNED = 30
_ACTIVE_STATUSES = {"queued", "running"}

_executor = ThreadPoolExecutor(max_workers=2)
_jobs_lock = threading.Lock()
_jobs: dict[str, Job] = {}


def _stamp(message: str) -> str:
    return f"{time.strftime('%H:%M:%S')} {message}"


def create_job(stage: str, slug: str) -> Job:
    job = Job(id=str(uuid.uuid4()), stage=stage, run_slug=slug)
    job.events.append(_stamp(f"Queued {stage}"))
    with _jobs_lock:
        _jobs[job.id] = job
    return job


def update_job(job_id: str, status: JobStatus, message: str, error: str | None = None) -> None:
    """Record progress. Called from worker threads, so it takes the lock."""
    with _jobs_lock:
        job = _jobs[job_id]
        job.status = status
        job.message = message
        job.error = error
        job.updated_at = time.time()
        event = _stamp(message)
        if not job.events or job.events[-1] != event:
            job.events.append(event)


def lookup_job(job_id: str) -> Job | None:
    with _jobs_lock:
        return _jobs.get(job_id)


def run_has_active_job(slug: str) -> bool:
    with _jobs_lock:
        return any(job.run_slug == slug and job.status in _ACTIVE_STATUSES for job in _jobs.values())


def submit(work: Callable[..., None], *args: object) -> None:
    _executor.submit(work, *args)


def job_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        stage=job.stage,
        run_slug=job.run_slug,
        status=job.status,
        message=job.message,
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
        events=job.events[-_MAX_EVENTS_RETURNED:],
    )
