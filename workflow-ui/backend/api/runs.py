"""Endpoints for creating, listing, reading, and deleting runs."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from backend.jobs import run_has_active_job
from backend.models import (
    CreateRunRequest,
    CreateRunResponse,
    DeleteRunResponse,
    ListRunsResponse,
    RunResponse,
)
from backend.runs import artifact_text, create_run, delete_run, load_run, run_summaries

router = APIRouter()


@router.post("/runs", response_model=CreateRunResponse)
def post_run(request: CreateRunRequest) -> CreateRunResponse:
    return CreateRunResponse(run=create_run(request.prompt))


@router.get("/runs", response_model=ListRunsResponse)
def get_runs() -> ListRunsResponse:
    return ListRunsResponse(runs=run_summaries())


@router.get("/runs/{slug}", response_model=RunResponse)
def get_run(slug: str) -> RunResponse:
    return load_run(slug)


@router.delete("/runs/{slug}", response_model=DeleteRunResponse)
def remove_run(slug: str) -> DeleteRunResponse:
    if run_has_active_job(slug):
        raise HTTPException(status_code=409, detail="Cannot delete a run while its job is running")
    delete_run(slug)
    return DeleteRunResponse(deleted=slug)


@router.get("/runs/{slug}/artifacts/{artifact_path:path}", response_class=PlainTextResponse)
def get_artifact(slug: str, artifact_path: str) -> PlainTextResponse:
    return PlainTextResponse(artifact_text(slug, artifact_path), media_type="text/markdown")
