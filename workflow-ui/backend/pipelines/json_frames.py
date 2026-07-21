"""Build one paired first/last JSON image prompt per shot, judged best-of-N."""

from __future__ import annotations

import json
import time
from pathlib import Path

from backend.jobs import update_job
from backend.models import EARLY_STOP_SCORE, MAX_BEST_OF_ATTEMPTS, FrameDelta
from backend.runs.assets import load_manifest
from backend.runs.json_assets import load_specs
from backend.runs.json_frames import (
    asset_index,
    asset_lookup,
    frame_file,
    frames_markdown,
    load_frames,
    write_frame,
)
from backend.runs.paths import run_dir
from backend.runs.shots import load_detailed_videos
from backend.stages.context import StageContext
from backend.stages.json_frames import judge_frame_prompt, write_frame_prompt
from backend.utils.file_ops import read_optional, write_text
from backend.utils.parser import extract_score, parse_frame_deltas


def load_frame_plan(workflow: Path) -> list[FrameDelta]:
    return parse_frame_deltas(read_optional(workflow / "frame_deltas.md") or "")


def _shot_bodies(ctx: StageContext) -> dict[str, str]:
    """Shot ref -> that shot's written body, preferring the polished pass."""
    drafts = load_detailed_videos(ctx.workflow)
    polished = {video.index: video for video in load_detailed_videos(ctx.workflow, rewritten=True)}
    bodies: dict[str, str] = {}
    for video in (polished.get(draft.index, draft) for draft in drafts):
        for shot in video.shots:
            bodies[f"V{video.index:02d}S{shot.index:02d}"] = f"{shot.title}\n{shot.body}".strip()
    return bodies


def _write_one(
    ctx: StageContext,
    frame: FrameDelta,
    shot_body: str,
    index_text: str,
    lookup: dict[str, dict],
    artifact_dir: Path,
    current_spec: str | None,
) -> str:
    """Run the writer and judge five times, keep the best-scoring prompt.

    Never fatal. Continuity and asset-name violations stop an attempt from
    winning and become the feedback for the next try, but they do not end the job.
    """
    feedback: str | None = None
    best_spec: dict | None = None
    best_judge = ""
    best_score = -1

    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        try:
            spec, raw = write_frame_prompt(
                ctx, frame, shot_body, index_text, lookup, artifact_dir, attempt, feedback, current_spec
            )
        except (ValueError, json.JSONDecodeError) as exc:
            feedback = f"The previous output was rejected: {exc}"
            ctx.log(f"JsonFrames {frame.ref} attempt {attempt}: {exc}; retrying")
            continue

        judge = judge_frame_prompt(ctx, frame, shot_body, raw, artifact_dir, attempt)
        score = extract_score(judge)
        if score > best_score:
            best_spec, best_judge, best_score = spec, judge, score

        feedback = judge
        ctx.log(f"JsonFrames {frame.ref} attempt {attempt}: score {score}; best {best_score}")
        if best_score > EARLY_STOP_SCORE:
            break

    if best_spec is None:
        ctx.log(f"JsonFrames {frame.ref}: no usable prompt after {MAX_BEST_OF_ATTEMPTS} attempts; skipped")
        return ""

    write_frame(ctx.workflow, frame, best_spec)
    return best_judge


def run_json_frames_job(job_id: str, slug: str, model: str, shot_ref: str = "") -> None:
    try:
        path = run_dir(slug)
        ctx = StageContext(job_id=job_id, slug=slug, path=path, model=model)
        build_json_frames(ctx, shot_ref)
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "JsonFrames failed", str(exc))


def build_json_frames(ctx: StageContext, shot_ref: str = "") -> None:
    """Write a frame prompt for every planned shot, or just one."""
    frames = load_frame_plan(ctx.workflow)
    if not frames:
        raise RuntimeError("Run the frame delta agent before writing JSON frame prompts")

    specs = load_specs(ctx.workflow, load_manifest(ctx.workflow))
    if not specs:
        raise RuntimeError("Build the JSON asset specs before writing JSON frame prompts")

    if shot_ref:
        wanted = shot_ref.strip().upper()
        frames = [frame for frame in frames if frame.ref == wanted]
        if not frames:
            raise RuntimeError(f"Shot '{shot_ref}' is not in the frame plan")

    index_text = asset_index(specs)
    lookup = asset_lookup(specs)
    bodies = _shot_bodies(ctx)

    # The frame plan is the source of truth for which shots exist. A short plan
    # is worth surfacing, but it is not a reason to refuse the work.
    if not shot_ref:
        uncovered = sorted(set(bodies) - {frame.ref for frame in frames})
        if uncovered:
            ctx.log(
                f"JsonFrames: the frame plan covers {len(frames)} of {len(bodies)} shots; "
                f"writing prompts for the {len(frames)} it has"
            )
    artifact_dir = ctx.workflow / "json_frame_runs" / f"frames_{int(time.time())}"

    last_judge = ""
    written = 0
    for position, frame in enumerate(frames, start=1):
        ctx.log(f"JsonFrames {position}/{len(frames)}: {frame.ref}")
        judge = _write_one(
            ctx,
            frame,
            bodies.get(frame.ref, ""),
            index_text,
            lookup,
            artifact_dir,
            read_optional(frame_file(ctx.workflow, frame.ref)) or None,
        )
        if judge:
            last_judge = judge
            written += 1

    write_text(
        ctx.workflow / "json_frames.md",
        frames_markdown(load_frames(ctx.workflow, load_frame_plan(ctx.workflow))),
    )
    if last_judge:
        write_text(ctx.workflow / "json_frames_judge.md", last_judge)
    skipped = len(frames) - written
    update_job(
        ctx.job_id,
        "done",
        f"Wrote {written} of {len(frames)} JSON frame prompts"
        + (f" ({skipped} had no usable output)" if skipped else ""),
    )
