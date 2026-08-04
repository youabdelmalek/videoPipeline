"""Model Context Protocol tools for the local Series Workflow UI."""

from __future__ import annotations

import json
import os
import time
from typing import Any, Literal
from urllib.parse import quote

import requests
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field


API_URL = os.getenv("WORKFLOW_UI_API_URL", "http://127.0.0.1:8000/api").rstrip("/")
FRONTEND_URL = os.getenv("WORKFLOW_UI_FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("WORKFLOW_UI_MCP_TIMEOUT", "30"))

mcp = FastMCP("series-workflow-ui")


class WorkflowNodeSpec(BaseModel):
    """A node in the run-backed composed workflow graph."""

    id: str = Field(min_length=1)
    kind: Literal["input", "stage"]
    port: str = ""
    stage: str = ""
    text: str = ""
    position: dict[str, float] = Field(default_factory=dict)


class WorkflowEdgeSpec(BaseModel):
    """A typed link between two composed workflow nodes."""

    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    source_handle: str = ""
    target_handle: str = ""


def _json(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, default=str)


def _request(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    try:
        response = requests.request(
            method,
            f"{API_URL}{path}",
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Workflow UI API is unavailable at {API_URL}: {exc}"
        ) from exc

    if not response.ok:
        try:
            detail = response.json().get("detail", response.text)
        except ValueError:
            detail = response.text
        raise RuntimeError(f"Workflow UI API returned HTTP {response.status_code}: {detail}")

    if not response.content:
        return {}
    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError("Workflow UI API returned a non-JSON response") from exc


def _workflow_payload(
    nodes: list[WorkflowNodeSpec],
    edges: list[WorkflowEdgeSpec],
) -> dict[str, Any]:
    return {
        "nodes": [node.model_dump() for node in nodes],
        "edges": [edge.model_dump() for edge in edges],
    }


def _validate_graph(
    nodes: list[WorkflowNodeSpec],
    edges: list[WorkflowEdgeSpec],
) -> list[str]:
    catalog = _request("GET", "/stages")
    stages = {stage["id"]: stage for stage in catalog.get("stages", [])}
    ports = {port["id"] for port in catalog.get("ports", [])}
    by_id: dict[str, WorkflowNodeSpec] = {}
    errors: list[str] = []

    for node in nodes:
        if node.id in by_id:
            errors.append(f"Duplicate node id: {node.id}")
        by_id[node.id] = node
        if node.kind == "input":
            if node.port not in ports:
                errors.append(f"Input node {node.id} uses unknown port '{node.port}'")
        elif node.stage not in stages:
            errors.append(f"Stage node {node.id} uses unknown stage '{node.stage}'")

    for edge in edges:
        source = by_id.get(edge.source)
        target = by_id.get(edge.target)
        if source is None or target is None:
            errors.append(f"Link points at a missing node: {edge.source} -> {edge.target}")
            continue
        if target.kind != "stage":
            errors.append(f"Link target {target.id} is not a stage")
            continue

        target_contract = stages.get(target.stage)
        if target_contract is None or edge.target_handle not in target_contract["inputs"]:
            errors.append(
                f"Link target '{edge.target_handle}' is not an input of stage '{target.stage}'"
            )
            continue

        source_port = source.port if source.kind == "input" else edge.source_handle
        if source.kind == "stage":
            source_contract = stages.get(source.stage)
            if source_contract is None or source_port not in source_contract["outputs"]:
                errors.append(
                    f"Link source '{source_port}' is not an output of stage '{source.stage}'"
                )
        if source_port != edge.target_handle:
            errors.append(
                f"'{source_port or 'nothing'}' cannot feed '{edge.target_handle}': ports differ"
            )

    return errors


def _validate_inputs(
    nodes: list[WorkflowNodeSpec],
    require_text: bool,
) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    errors: list[str] = []
    for node in nodes:
        if node.kind != "input":
            continue
        if not node.text.strip():
            if require_text:
                errors.append(f"Input node {node.id} has no text")
            continue
        check = _request("POST", "/validate", {"port": node.port, "text": node.text})
        checks[node.id] = check
        if not check.get("ok"):
            errors.append(f"Input node {node.id}: {check.get('summary', 'validation failed')}")
    if errors:
        raise ValueError("Workflow validation failed: " + "; ".join(errors))
    return checks


def _workflow_url(slug: str) -> str:
    return f"{FRONTEND_URL}/?run={quote(slug)}"


@mcp.tool()
def workflow_ui_catalog() -> str:
    """List available stages, ports, Ollama models, and saved flexible workflows.

    Call this before designing a workflow so stage ids, port ids, and model
    names come from the running Workflow UI rather than memory.
    """

    stages = _request("GET", "/stages")
    models = _request("GET", "/models")
    flexible = _request("GET", "/flexible-workflows").get("library", {})
    return _json(
        {
            "stages": stages.get("stages", []),
            "ports": stages.get("ports", []),
            "models": models.get("models", []),
            "flexible_workflows": sorted(flexible),
        }
    )


@mcp.tool()
def create_composed_workflow(
    name: str,
    nodes: list[WorkflowNodeSpec],
    edges: list[WorkflowEdgeSpec],
    prompt: str = "",
    model: str = "",
    run_after_save: bool = False,
) -> str:
    """Create a run-backed stage workflow and return its canvas URL.

    Use `workflow_ui_catalog` first. Input nodes use a port and pasted text;
    stage nodes use a stage id. Each edge must connect matching port ids, for
    example `story_idea` to `story_idea`. Set `run_after_save` only when all
    input text is ready and the workflow should start immediately.
    """

    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Workflow name is required")
    graph_errors = _validate_graph(nodes, edges)
    if graph_errors:
        raise ValueError("Workflow graph validation failed: " + "; ".join(graph_errors))
    checks = _validate_inputs(nodes, require_text=run_after_save)

    run_prompt = prompt.strip() or f"Workflow {clean_name} created by Copilot"
    if len(run_prompt) < 8:
        raise ValueError("Prompt must contain at least 8 characters")
    run_response = _request("POST", "/runs", {"prompt": run_prompt})
    slug = run_response["run"]["slug"]
    workflow = _workflow_payload(nodes, edges)
    _request("PUT", f"/runs/{quote(slug, safe='')}/workflow", workflow)

    job = None
    if run_after_save:
        run_payload = {"model": model.strip()} if model.strip() else {}
        job = _request("POST", f"/runs/{quote(slug, safe='')}/run-workflow", run_payload)

    return _json(
        {
            "ok": True,
            "kind": "composed",
            "name": clean_name,
            "slug": slug,
            "url": _workflow_url(slug),
            "workflow": workflow,
            "input_checks": checks,
            "job": job.get("job") if job else None,
        }
    )


@mcp.tool()
def update_composed_workflow(
    slug: str,
    nodes: list[WorkflowNodeSpec],
    edges: list[WorkflowEdgeSpec],
) -> str:
    """Replace the graph saved in an existing run after validating its links."""

    graph_errors = _validate_graph(nodes, edges)
    if graph_errors:
        raise ValueError("Workflow graph validation failed: " + "; ".join(graph_errors))
    workflow = _workflow_payload(nodes, edges)
    saved = _request("PUT", f"/runs/{quote(slug, safe='')}/workflow", workflow)
    return _json({"ok": True, "slug": slug, "url": _workflow_url(slug), **saved})


@mcp.tool()
def list_composed_runs() -> str:
    """List run-backed workflows and their canvas slugs."""

    return _json(_request("GET", "/runs").get("runs", []))


@mcp.tool()
def get_composed_workflow(slug: str) -> str:
    """Read the stage graph saved in a run."""

    return _json(_request("GET", f"/runs/{quote(slug, safe='')}/workflow"))


@mcp.tool()
def run_composed_workflow(slug: str, model: str = "") -> str:
    """Start a saved composed workflow and return its background job."""

    run_payload = {"model": model.strip()} if model.strip() else {}
    response = _request("POST", f"/runs/{quote(slug, safe='')}/run-workflow", run_payload)
    return _json(response)


@mcp.tool()
def get_workflow_job(job_id: str) -> str:
    """Read the status, message, events, and error for a Workflow UI job."""

    return _json(_request("GET", f"/jobs/{quote(job_id, safe='')}"))


@mcp.tool()
def list_flexible_workflows() -> str:
    """List the agent/image-node workflows saved in the Workflow UI library."""

    return _json(_request("GET", "/flexible-workflows").get("library", {}))


@mcp.tool()
def save_flexible_workflow(
    name: str,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    run_name: str = "Copilot run",
) -> str:
    """Save an agent/image-node canvas workflow to the Workflow UI library.

    Nodes and edges use the flexible canvas JSON shape. Agent nodes should
    include `kind: "agent"`, `model`, `thinking`, `inputs`, and `prompt`;
    image-text nodes should include `kind: "imageText"`, `model`, `imageUrl`,
    `inputs`, and `prompt`. Use `workflow_ui_catalog` for model names.
    """

    clean_name = name.strip()
    clean_run_name = run_name.strip() or "Copilot run"
    if not clean_name:
        raise ValueError("Workflow name is required")
    existing_library = _request("GET", "/flexible-workflows").get("library", {})
    existing_workflow = existing_library.get(clean_name, {})
    existing_runs = existing_workflow.get("runs", {}) if isinstance(existing_workflow, dict) else {}
    workflow = {
        "runs": {
            **existing_runs,
            clean_run_name: {
                "nodes": nodes,
                "edges": edges,
                "updatedAt": int(time.time() * 1000),
            }
        }
    }
    response = _request(
        "PUT",
        f"/flexible-workflows/{quote(clean_name, safe='')}",
        {"workflow": workflow},
    )
    return _json(
        {
            "ok": True,
            "kind": "flexible",
            "name": clean_name,
            "run_name": clean_run_name,
            "workflow": workflow,
            "library": response.get("library", {}),
            "url": FRONTEND_URL,
        }
    )


@mcp.tool()
def delete_flexible_workflow(name: str) -> str:
    """Delete one saved agent/image-node workflow from the Workflow UI library."""

    return _json(
        _request("DELETE", f"/flexible-workflows/{quote(name.strip(), safe='')}")
    )


if __name__ == "__main__":
    mcp.run()