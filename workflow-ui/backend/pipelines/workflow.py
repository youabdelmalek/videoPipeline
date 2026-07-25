"""Run a composed workflow: seed every pasted input, then run the stages in order.

This is one job from the UI's point of view, so the processing panel shows a
single progress stream across however many stages were composed.
"""

from __future__ import annotations

from backend.jobs import lookup_job, update_job
from backend.models import WorkflowDefinition
from backend.runs.paths import run_dir
from backend.runs.ports import seed_port
from backend.runs.workflow import invalid_links, load_workflow, missing_inputs, stage_order
from backend.stages.registry import STAGES, resolve_job


def _seed_inputs(job_id: str, slug: str, workflow: WorkflowDefinition) -> list[str]:
    """Write every input node's text into the run. Returns validation failures."""
    failures: list[str] = []
    path = run_dir(slug)

    for node in workflow.nodes:
        if node.kind != "input" or not node.port:
            continue
        check = seed_port(path, node.port, node.text)
        if check.ok:
            update_job(job_id, "running", f"Seeded {node.port}: {check.summary}")
        else:
            failures.append(f"{node.port}: {check.summary}")
    return failures


def run_workflow_job(job_id: str, slug: str, model: str) -> None:
    try:
        workflow = load_workflow(run_dir(slug))
        stage_nodes = {node.id: node for node in workflow.nodes if node.kind == "stage"}
        if not stage_nodes:
            raise RuntimeError("This workflow has no stages to run")

        bad_links = invalid_links(workflow)
        if bad_links:
            raise RuntimeError("Some links are not valid - " + "; ".join(bad_links))

        failures = _seed_inputs(job_id, slug, workflow)
        if failures:
            raise RuntimeError("Some inputs did not validate - " + "; ".join(failures))

        gaps = missing_inputs(workflow)
        if gaps:
            detail = "; ".join(
                f"{STAGES[stage_nodes[node_id].stage].label} needs {', '.join(ports)}"
                for node_id, ports in gaps.items()
                if node_id in stage_nodes
            )
            raise RuntimeError("Some stages have no input for - " + detail)

        order = stage_order(workflow)
        for position, node_id in enumerate(order, start=1):
            stage_id = stage_nodes[node_id].stage
            contract = STAGES.get(stage_id)
            if contract is None:
                raise RuntimeError(f"Unknown stage '{stage_id}'")

            update_job(
                job_id, "running", f"Stage {position}/{len(order)}: {contract.label}"
            )
            # Each stage job reports its own completion; run it inline so the
            # whole workflow stays one job rather than fanning out.
            resolve_job(stage_id)(job_id, slug, model, *contract.extra_args)

            # Stage jobs swallow their own exceptions and mark the job errored,
            # so the status is the only signal that this stage did not finish.
            job = lookup_job(job_id)
            if job and job.status == "error":
                raise RuntimeError(f"{contract.label} failed: {job.error or 'unknown error'}")

        update_job(job_id, "done", f"Workflow complete: {len(order)} stages")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Workflow failed", str(exc))
