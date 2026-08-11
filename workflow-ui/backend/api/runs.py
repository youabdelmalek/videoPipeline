"""Endpoints for creating, listing, reading, and deleting runs."""

from __future__ import annotations

import json
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from backend.jobs import run_has_active_job
from backend.models import (
    CreateRunRequest,
    CreateRunResponse,
    DeleteRunResponse,
    DeleteFlexibleWorkflowResponse,
    FlexibleWorkflowLibraryResponse,
    ListRunsResponse,
    PortCheck,
    PortInfo,
    RunResponse,
    SaveFlexibleWorkflowRequest,
    StagesResponse,
    ValidatePortRequest,
    WorkflowDefinition,
    WorkflowResponse,
)
from backend.config import SAVED_WORKFLOWS_DIR

router = APIRouter()


def workflow_file_slug(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", name.strip()).strip(".-")
    if not slug:
        raise HTTPException(status_code=400, detail="Workflow name is required")
    return slug[:120]


def workflow_file_path(name: str):
    return SAVED_WORKFLOWS_DIR / f"{workflow_file_slug(name)}.json"


@router.get("/flexible-workflows", response_model=FlexibleWorkflowLibraryResponse)
def get_flexible_workflows() -> FlexibleWorkflowLibraryResponse:
    SAVED_WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    library = {}
    for path in sorted(SAVED_WORKFLOWS_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        name = data.get("name")
        workflow = data.get("workflow")
        if isinstance(name, str) and isinstance(workflow, dict):
            library[name] = workflow
    return FlexibleWorkflowLibraryResponse(library=library)


@router.put("/flexible-workflows/{name:path}", response_model=FlexibleWorkflowLibraryResponse)
def put_flexible_workflow(name: str, request: SaveFlexibleWorkflowRequest) -> FlexibleWorkflowLibraryResponse:
    SAVED_WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    workflow_file_path(name).write_text(
        json.dumps({"name": name, "workflow": request.workflow}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return get_flexible_workflows()


@router.delete("/flexible-workflows/{name:path}", response_model=DeleteFlexibleWorkflowResponse)
def delete_flexible_workflow(name: str) -> DeleteFlexibleWorkflowResponse:
    path = workflow_file_path(name)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Workflow not found")
    path.unlink()
    return DeleteFlexibleWorkflowResponse(deleted=name)


@router.get("/stages", response_model=StagesResponse)
def get_stages() -> StagesResponse:
    """The stage and port contracts the canvas renders its handles from."""
    from backend.stages.registry import stage_infos
    from backend.runs.ports import PORTS

    return StagesResponse(
        stages=stage_infos(),
        ports=[PortInfo(id=port.id, label=port.label, hint=port.hint) for port in PORTS.values()],
    )


@router.post("/validate", response_model=PortCheck)
def post_validate(request: ValidatePortRequest) -> PortCheck:
    """Structural check on pasted text. Writes nothing."""
    from backend.runs.ports import check_port

    return check_port(request.port, request.text)


@router.get("/runs/{slug}/workflow", response_model=WorkflowResponse)
def get_workflow(slug: str) -> WorkflowResponse:
    from backend.runs.paths import run_dir
    from backend.runs.workflow import load_workflow

    path = run_dir(slug)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    return WorkflowResponse(workflow=load_workflow(path))


@router.put("/runs/{slug}/workflow", response_model=WorkflowResponse)
def put_workflow(slug: str, workflow: WorkflowDefinition) -> WorkflowResponse:
    from backend.runs.paths import run_dir
    from backend.runs.workflow import save_workflow

    path = run_dir(slug)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    save_workflow(path, workflow)
    return WorkflowResponse(workflow=workflow)


@router.post("/runs", response_model=CreateRunResponse)
def post_run(request: CreateRunRequest) -> CreateRunResponse:
    from backend.runs import create_run

    return CreateRunResponse(run=create_run(request.prompt))


@router.get("/runs", response_model=ListRunsResponse)
def get_runs() -> ListRunsResponse:
    from backend.runs import run_summaries

    return ListRunsResponse(runs=run_summaries())


@router.get("/runs/{slug}", response_model=RunResponse)
def get_run(slug: str) -> RunResponse:
    from backend.runs import load_run

    return load_run(slug)


@router.delete("/runs/{slug}", response_model=DeleteRunResponse)
def remove_run(slug: str) -> DeleteRunResponse:
    from backend.runs import delete_run

    if run_has_active_job(slug):
        raise HTTPException(status_code=409, detail="Cannot delete a run while its job is running")
    delete_run(slug)
    return DeleteRunResponse(deleted=slug)


@router.get("/runs/{slug}/artifacts/{artifact_path:path}", response_class=PlainTextResponse)
def get_artifact(slug: str, artifact_path: str) -> PlainTextResponse:
    from backend.runs import artifact_text

    return PlainTextResponse(artifact_text(slug, artifact_path), media_type="text/markdown")
