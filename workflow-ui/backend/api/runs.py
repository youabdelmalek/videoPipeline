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
    PortCheck,
    PortInfo,
    RunResponse,
    StagesResponse,
    ValidatePortRequest,
    WorkflowDefinition,
    WorkflowResponse,
)
from backend.runs import artifact_text, create_run, delete_run, load_run, run_summaries
from backend.runs.paths import run_dir
from backend.runs.ports import PORTS, check_port
from backend.runs.workflow import load_workflow, save_workflow
from backend.stages.registry import stage_infos

router = APIRouter()


@router.get("/stages", response_model=StagesResponse)
def get_stages() -> StagesResponse:
    """The stage and port contracts the canvas renders its handles from."""
    return StagesResponse(
        stages=stage_infos(),
        ports=[PortInfo(id=port.id, label=port.label, hint=port.hint) for port in PORTS.values()],
    )


@router.post("/validate", response_model=PortCheck)
def post_validate(request: ValidatePortRequest) -> PortCheck:
    """Structural check on pasted text. Writes nothing."""
    return check_port(request.port, request.text)


@router.get("/runs/{slug}/workflow", response_model=WorkflowResponse)
def get_workflow(slug: str) -> WorkflowResponse:
    path = run_dir(slug)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    return WorkflowResponse(workflow=load_workflow(path))


@router.put("/runs/{slug}/workflow", response_model=WorkflowResponse)
def put_workflow(slug: str, workflow: WorkflowDefinition) -> WorkflowResponse:
    path = run_dir(slug)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    save_workflow(path, workflow)
    return WorkflowResponse(workflow=workflow)


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
