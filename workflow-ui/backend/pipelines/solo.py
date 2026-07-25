"""Standalone jobs for the stages that otherwise only run inside `generate`.

The full pipeline chains these in memory. A composed workflow needs to start (or
stop) anywhere, so each one is wrapped here as a job that reads its input from
disk and writes its output back - the same contract every other pipeline uses.

These are thin wrappers: the work stays in `pipelines.generate`, so the full run
and a composed run always execute identical code.
"""

from __future__ import annotations

import time

from backend.jobs import update_job
from backend.pipelines.generate import _best_separator, _best_story, _frame_deltas
from backend.runs.assets import load_manifest
from backend.runs.json_assets import load_specs, state_vocabulary
from backend.runs.paths import run_dir
from backend.runs.store import story_idea_path
from backend.stages.context import StageContext
from backend.stages.full_workflow import enhance_prompt
from backend.utils.file_ops import read_optional, write_text


def _context(job_id: str, slug: str, model: str) -> StageContext:
    return StageContext(job_id=job_id, slug=slug, path=run_dir(slug), model=model)


def _require(value: str | None, what: str) -> str:
    if not value or not value.strip():
        raise RuntimeError(f"Missing {what}. Link an input to this stage, or run the stage before it.")
    return value


def run_prompt_enhancer_job(job_id: str, slug: str, model: str) -> None:
    try:
        ctx = _context(job_id, slug, model)
        story_idea = _require(read_optional(story_idea_path(ctx.path)), "story idea")
        artifact_dir = ctx.workflow / "prompt_runs" / f"prompt_{int(time.time())}"
        enhanced = enhance_prompt(ctx, story_idea, artifact_dir)
        write_text(ctx.workflow / "enhanced_prompt.md", enhanced)
        update_job(job_id, "done", "Prompt enhanced")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Prompt enhancer failed", str(exc))


def run_small_stories_job(job_id: str, slug: str, model: str) -> None:
    try:
        ctx = _context(job_id, slug, model)
        enhanced = _require(read_optional(ctx.workflow / "enhanced_prompt.md"), "enhanced prompt")
        best = _best_story(ctx, enhanced)
        update_job(job_id, "done", f"Small stories written, score {best.score}")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Small story generator failed", str(exc))


def run_story_separator_job(job_id: str, slug: str, model: str) -> None:
    try:
        ctx = _context(job_id, slug, model)
        enhanced = _require(read_optional(ctx.workflow / "enhanced_prompt.md"), "enhanced prompt")
        story = _require(read_optional(ctx.workflow / "small_stories.md"), "connected small stories")
        best = _best_separator(ctx, enhanced, story)
        update_job(job_id, "done", f"Videos split, score {best.score}")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Story separator failed", str(exc))


def run_frame_deltas_job(job_id: str, slug: str, model: str) -> None:
    try:
        ctx = _context(job_id, slug, model)
        asset_text = _require(read_optional(ctx.workflow / "asset_catalog.md"), "asset catalog")
        states = state_vocabulary(load_specs(ctx.workflow, load_manifest(ctx.workflow)))
        best = _frame_deltas(ctx, asset_text, states)
        update_job(job_id, "done", f"Frames written, score {best.score}")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Frame writer failed", str(exc))
