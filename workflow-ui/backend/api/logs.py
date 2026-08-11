"""Persist complete flexible-workflow execution transcripts."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from backend.config import LOGS_DIR
from backend.models import WorkflowLogRequest, WorkflowLogResponse

router = APIRouter()


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")


@router.post("/logs", response_model=WorkflowLogResponse)
def save_log(request: WorkflowLogRequest) -> WorkflowLogResponse:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    path = LOGS_DIR / f"{timestamp()}.log"
    while path.exists():
        path = LOGS_DIR / f"{timestamp()}.log"
    path.write_text(request.content, encoding="utf-8")
    return WorkflowLogResponse(filename=path.name)