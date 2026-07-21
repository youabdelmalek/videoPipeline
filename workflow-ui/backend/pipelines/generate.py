"""The main workflow job: prompt -> story -> videos -> shots -> assets -> frames."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.jobs import update_job
from backend.models import EARLY_STOP_SCORE, MAX_BEST_OF_ATTEMPTS, DetailedVideo, FrameDelta
from backend.pipelines.json_assets import build_json_assets
from backend.pipelines.json_frames import build_json_frames
from backend.runs.assets import catalog_markdown, grouped_catalog, load_manifest
from backend.runs.frame_deltas import deltas_markdown, write_delta
from backend.runs.json_assets import load_specs, state_vocabulary
from backend.runs.paths import run_dir
from backend.runs.shots import load_detailed_videos
from backend.runs.store import story_idea_path
from backend.stages.asset_catalog import detail_asset, extract_assets, judge_assets, save_extraction
from backend.stages.context import StageContext
from backend.stages.frame_delta import (
    describe_shot,
    judge_frame_delta,
    select_assets,
    to_frame_delta,
    write_frame_delta,
)
from backend.stages.full_workflow import (
    enhance_prompt,
    generate_small_stories,
    judge_separator,
    judge_story,
    separate_story,
)
from backend.stages.shot_writer import clear_detailed_videos, detail_video
from backend.utils.file_ops import markdown_artifact, read_optional, write_text
from backend.utils.parser import extract_score, parse_scene_cards


@dataclass
class BestAttempt:
    output: str = ""
    judge: str = ""
    score: int = -1
    attempt: int = 0


def _better(best: BestAttempt, output: str, judge: str, attempt: int) -> BestAttempt:
    score = extract_score(judge)
    if score > best.score:
        return BestAttempt(output=output, judge=judge, score=score, attempt=attempt)
    return best


def _all_shots_text(ctx: StageContext) -> str:
    videos = load_detailed_videos(ctx.workflow)
    chunks: list[str] = []
    for video in videos:
        chunks.append(f"VIDEO {video.index:02d} - {video.title}")
        for shot in video.shots:
            chunks.append(
                f"V{video.index:02d}S{shot.index:02d} - SHOT {shot.index:02d} - "
                f"{shot.seconds}s - {shot.title}\n{shot.body}"
            )
        chunks.append("")
    return "\n".join(chunks).strip()


def _best_story(ctx: StageContext, enhanced_prompt: str) -> BestAttempt:
    artifact_dir = ctx.workflow / "story_runs" / f"story_{int(time.time())}"
    best = BestAttempt()
    previous: str | None = None
    feedback: str | None = None
    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        story = generate_small_stories(ctx, enhanced_prompt, artifact_dir, attempt, previous, feedback)
        judge = judge_story(ctx, enhanced_prompt, story, artifact_dir, attempt)
        best = _better(best, story, judge, attempt)
        previous = story
        feedback = judge
        ctx.log(f"Story attempt {attempt}: score {extract_score(judge)}; best {best.score}")
        if best.score > EARLY_STOP_SCORE:
            break
    write_text(ctx.workflow / "small_stories.md", best.output)
    write_text(ctx.workflow / "story_pack.md", best.output)
    write_text(ctx.workflow / "story_judge.md", best.judge)
    return best


def _best_separator(ctx: StageContext, enhanced_prompt: str, story: str) -> BestAttempt:
    artifact_dir = ctx.workflow / "separator_runs" / f"separator_{int(time.time())}"
    best = BestAttempt()
    previous: str | None = None
    feedback: str | None = None
    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        board = separate_story(ctx, enhanced_prompt, story, artifact_dir, attempt, previous, feedback)
        judge = judge_separator(ctx, enhanced_prompt, story, board, artifact_dir, attempt)
        best = _better(best, board, judge, attempt)
        previous = board
        feedback = judge
        ctx.log(f"Separator attempt {attempt}: score {extract_score(judge)}; best {best.score}")
        if best.score > EARLY_STOP_SCORE:
            break
    write_text(ctx.workflow / "scenes.md", best.output)
    write_text(ctx.workflow / "separator_judge.md", best.judge)
    write_text(ctx.workflow / "scene_judge.md", best.judge)
    return best


def _detail_all_videos(ctx: StageContext, story_idea: str, full_story: str, board_text: str) -> int:
    cards = parse_scene_cards(board_text)
    if not cards:
        raise RuntimeError("The separator produced no VIDEO sections for shot generation")
    clear_detailed_videos(ctx.workflow, [card.index for card in cards])
    artifact_dir = ctx.workflow / "shot_details" / f"detail_{int(time.time())}"
    total = 0
    for position, card in enumerate(cards, start=1):
        ctx.log(f"Video to shots {position}/{len(cards)}: VIDEO {card.index:02d}")
        total += detail_video(ctx, story_idea, full_story, card, artifact_dir)
    judge_chunks = []
    for path in sorted((ctx.workflow / "shot_judges").glob("video_*.md")):
        judge_chunks.append(f"# {path.stem}\n\n{read_optional(path) or ''}".strip())
    write_text(ctx.workflow / "shot_judge.md", "\n\n".join(judge_chunks) or "No shot judges found.")
    return total


def _asset_catalog(ctx: StageContext, story_idea: str, all_shots: str) -> BestAttempt:
    artifact_dir = ctx.workflow / "asset_catalog_runs" / f"catalog_{int(time.time())}"
    best = BestAttempt()
    feedback: str | None = None
    best_items = []
    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        items, extraction_json = extract_assets(ctx, story_idea, all_shots, artifact_dir, attempt, feedback)
        judge = judge_assets(ctx, story_idea, all_shots, extraction_json, artifact_dir, attempt)
        best = _better(best, extraction_json, judge, attempt)
        if best.output == extraction_json:
            best_items = items
        feedback = judge
        ctx.log(f"Asset extraction attempt {attempt}: score {extract_score(judge)}; best {best.score}")
        if best.score > EARLY_STOP_SCORE:
            break

    save_extraction(ctx.workflow, best_items)
    write_text(ctx.workflow / "asset_extraction.json", best.output)
    write_text(ctx.workflow / "asset_judge.md", best.judge)
    detailed = []
    for item in best_items:
        detailed.append(detail_asset(ctx, story_idea, all_shots, item, artifact_dir, 1))
    save_extraction(ctx.workflow, detailed)
    detailer_text = "\n\n".join(item.detail for item in detailed if item.detail)
    write_text(ctx.workflow / "asset_detailer.md", detailer_text or "No asset details generated.")
    write_text(ctx.workflow / "asset_catalog.md", catalog_markdown(grouped_catalog(ctx.workflow)))
    return best


def _video_shots_text(video: DetailedVideo) -> str:
    chunks = [f"VIDEO {video.index:02d} - {video.title}"]
    for shot in video.shots:
        chunks.append(
            f"V{video.index:02d}S{shot.index:02d} - SHOT {shot.index:02d} - "
            f"{shot.seconds}s - {shot.title}\n{shot.body}"
        )
    return "\n".join(chunks).strip()


def _select_assets_for_shot(
    ctx: StageContext,
    shot_ref: str,
    shot_title: str,
    described: dict[str, str],
    asset_text: str,
    asset_states: str,
    known: set[str],
    artifact_dir: Path,
) -> dict[str, Any] | None:
    """Agent 2, retried only when its JSON does not parse or names a stray asset."""
    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        try:
            return select_assets(
                ctx, shot_ref, shot_title, described, asset_text, asset_states,
                known, artifact_dir, attempt,
            )
        except (ValueError, json.JSONDecodeError) as exc:
            ctx.log(f"Shot assets {shot_ref} attempt {attempt}: {exc}; retrying")
    return None


def _best_frame_for_shot(
    ctx: StageContext,
    selection: dict[str, Any],
    artifact_dir: Path,
) -> tuple[dict[str, Any] | None, str, int]:
    """Agent 3, judged best-of-N. Returns the winning answer, judge, and score."""
    shot_ref = str(selection.get("shot_ref", ""))
    best_frame: dict[str, Any] | None = None
    best_judge = ""
    best_score = -1
    previous: str | None = None
    feedback: str | None = None

    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        try:
            frame, raw = write_frame_delta(
                ctx, selection, artifact_dir, attempt, previous, feedback
            )
        except (ValueError, json.JSONDecodeError) as exc:
            feedback = f"The previous answer was rejected: {exc}"
            ctx.log(f"Frame writer {shot_ref} attempt {attempt}: {exc}; retrying")
            continue

        judge = judge_frame_delta(ctx, selection, raw, artifact_dir, attempt)
        score = extract_score(judge)
        if score > best_score:
            best_frame, best_judge, best_score = frame, judge, score

        previous = raw
        feedback = judge
        ctx.log(f"Frame writer {shot_ref} attempt {attempt}: score {score}; best {best_score}")
        if best_score > EARLY_STOP_SCORE:
            break

    return best_frame, best_judge, max(best_score, 0)


def _frame_deltas(ctx: StageContext, asset_text: str, asset_states: str = "") -> BestAttempt:
    """Run describer -> asset picker -> frame writer for every shot.

    Per shot rather than per video: each agent then sees only what its own
    decision needs, instead of one call holding every shot in a video plus the
    whole asset catalogue.
    """
    drafts = load_detailed_videos(ctx.workflow)
    polished = {video.index: video for video in load_detailed_videos(ctx.workflow, rewritten=True)}
    videos = [polished.get(draft.index, draft) for draft in drafts]
    if not videos:
        raise RuntimeError("Split the videos into shots before writing frame deltas")

    known = {item.name.strip().lower() for item in load_manifest(ctx.workflow) if item.name.strip()}
    artifact_dir = ctx.workflow / "frame_delta_runs" / f"frames_{int(time.time())}"

    total_shots = sum(len(video.shots) for video in videos)
    frames: list[FrameDelta] = []
    judges: list[str] = []
    scores: list[int] = []
    skipped: list[str] = []
    position = 0

    for video in videos:
        shots_text = _video_shots_text(video)
        for shot in video.shots:
            position += 1
            shot_ref = f"V{video.index:02d}S{shot.index:02d}"
            ctx.log(f"Frames {position}/{total_shots}: {shot_ref}")
            shot_text = f"{shot_ref} - SHOT {shot.index:02d} - {shot.seconds}s - {shot.title}\n{shot.body}"

            described = describe_shot(ctx, shots_text, shot_ref, shot_text, artifact_dir)
            selection = _select_assets_for_shot(
                ctx, shot_ref, shot.title, described, asset_text, asset_states, known, artifact_dir
            )
            if selection is None:
                ctx.log(f"Frames {shot_ref}: no usable asset selection; skipped")
                skipped.append(shot_ref)
                continue

            frame, judge, score = _best_frame_for_shot(ctx, selection, artifact_dir)
            if frame is None:
                ctx.log(f"Frames {shot_ref}: no usable frame answer; skipped")
                skipped.append(shot_ref)
                continue

            record = to_frame_delta(shot_ref, shot.title, described, selection, frame)
            write_delta(ctx.workflow, record)
            frames.append(record)
            judges.append(f"## {shot_ref}\n\n{judge.strip()}")
            scores.append(score)

    write_text(ctx.workflow / "frame_deltas.md", deltas_markdown(frames))
    write_text(ctx.workflow / "frame_delta_judge.md", "\n\n".join(judges))
    if skipped:
        ctx.log(f"Frames: {len(skipped)} of {total_shots} shots had no usable output: {' '.join(skipped)}")

    return BestAttempt(
        output=deltas_markdown(frames),
        judge="\n\n".join(judges),
        score=min(scores) if scores else 0,
    )


def run_generate_job(job_id: str, slug: str, model: str) -> None:
    path = run_dir(slug)
    ctx = StageContext(job_id=job_id, slug=slug, path=path, model=model)
    story_idea = read_optional(story_idea_path(path))
    if not story_idea:
        update_job(job_id, "error", "Workflow failed", "Missing story idea")
        return

    try:
        artifact_dir = ctx.workflow / "prompt_runs" / f"prompt_{int(time.time())}"
        enhanced = enhance_prompt(ctx, story_idea, artifact_dir)
        write_text(ctx.workflow / "enhanced_prompt.md", enhanced)

        story = _best_story(ctx, enhanced)
        separator = _best_separator(ctx, enhanced, story.output)
        shot_count = _detail_all_videos(ctx, story_idea, story.output, separator.output)

        all_shots = _all_shots_text(ctx)
        _asset_catalog(ctx, story_idea, all_shots)
        asset_text = read_optional(ctx.workflow / "asset_catalog.md") or ""
        build_json_assets(ctx)
        asset_states = state_vocabulary(load_specs(ctx.workflow, load_manifest(ctx.workflow)))
        frames = _frame_deltas(ctx, asset_text, asset_states)
        build_json_frames(ctx)

        update_job(
            job_id,
            "done",
            "Workflow complete: "
            f"story score {story.score}, separator score {separator.score}, "
            f"{shot_count} shots, frame score {frames.score}",
        )
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        write_text(ctx.workflow / "workflow_error.md", markdown_artifact("Workflow Error", str(exc)))
        update_job(job_id, "error", "Workflow failed", str(exc))
