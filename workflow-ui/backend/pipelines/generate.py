"""The main workflow job: prompt -> story -> videos -> shots -> assets -> frames."""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

from backend.jobs import update_job
from backend.models import EARLY_STOP_SCORE, MAX_BEST_OF_ATTEMPTS, DetailedVideo
from backend.pipelines.json_assets import build_json_assets
from backend.pipelines.json_frames import build_json_frames
from backend.runs.assets import catalog_markdown, grouped_catalog, load_manifest
from backend.runs.json_assets import load_specs, state_vocabulary
from backend.runs.paths import run_dir
from backend.runs.shots import load_detailed_videos
from backend.runs.store import story_idea_path
from backend.stages.asset_catalog import detail_asset, extract_assets, judge_assets, save_extraction
from backend.stages.context import StageContext
from backend.stages.full_workflow import (
    enhance_prompt,
    generate_small_stories,
    judge_frame_deltas,
    judge_separator,
    judge_story,
    separate_story,
    write_frame_deltas,
)
from backend.stages.shot_writer import clear_detailed_videos, detail_video
from backend.utils.file_ops import markdown_artifact, read_optional, write_text
from backend.utils.parser import extract_score, parse_frame_deltas, parse_scene_cards


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


def _missing_refs(frame_plan: str, required: list[str]) -> list[str]:
    written = {frame.ref for frame in parse_frame_deltas(frame_plan)}
    return [ref for ref in required if ref not in written]


def _best_frame_deltas_for_video(
    ctx: StageContext,
    video: DetailedVideo,
    asset_text: str,
    asset_states: str,
    artifact_dir: Path,
) -> BestAttempt:
    """Frame plan for one video, retried until every shot in it is covered.

    One video at a time: asking for all of a series' shots in a single call
    made the model truncate and return only the last video's shots.
    """
    label = f"video_{video.index:02d}"
    shots_text = _video_shots_text(video)
    required = [f"V{video.index:02d}S{shot.index:02d}" for shot in video.shots]

    best = BestAttempt()
    best_missing = len(required) + 1
    previous: str | None = None
    feedback: str | None = None

    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        frame_plan = write_frame_deltas(
            ctx, shots_text, asset_text, artifact_dir, attempt, previous, feedback,
            asset_states, label, required,
        )
        missing = _missing_refs(frame_plan, required)
        judge = judge_frame_deltas(
            ctx, shots_text, asset_text, frame_plan, artifact_dir, attempt, label
        )
        score = extract_score(judge)

        # Coverage beats quality: a plan missing shots is unusable downstream
        # no matter how well the shots it did write scored.
        if (len(missing), -score) < (best_missing, -best.score):
            best = BestAttempt(output=frame_plan, judge=judge, score=score, attempt=attempt)
            best_missing = len(missing)

        previous = frame_plan
        if missing:
            feedback = (
                f"{judge}\n\nYou skipped {len(missing)} shots. Write an entry for every one "
                f"of these, in order: {' '.join(missing)}"
            )
            ctx.log(
                f"Frame delta {label} attempt {attempt}: {len(required) - len(missing)}/{len(required)} "
                f"shots, score {score}; best so far {len(required) - best_missing}/{len(required)}"
            )
        else:
            feedback = judge
            ctx.log(f"Frame delta {label} attempt {attempt}: all {len(required)} shots, score {score}")
            # Coverage is part of the bar here: a high score on a plan that
            # skipped shots is exactly the case we do not want to stop on.
            if score > EARLY_STOP_SCORE:
                break

    if best_missing:
        # Never fatal: the best of five is what we keep, and the gap is logged
        # so it is visible in the processing panel.
        ctx.log(
            f"Frame delta {label}: best attempt still misses {best_missing} of {len(required)} shots"
        )
    return best


def _best_frame_deltas(
    ctx: StageContext, asset_text: str, asset_states: str = ""
) -> BestAttempt:
    """Run the frame plan one video at a time and join the results."""
    drafts = load_detailed_videos(ctx.workflow)
    polished = {video.index: video for video in load_detailed_videos(ctx.workflow, rewritten=True)}
    videos = [polished.get(draft.index, draft) for draft in drafts]
    if not videos:
        raise RuntimeError("Split the videos into shots before writing frame deltas")

    artifact_dir = ctx.workflow / "frame_delta_runs" / f"frames_{int(time.time())}"
    plans: list[str] = []
    judges: list[str] = []
    scores: list[int] = []

    for position, video in enumerate(videos, start=1):
        ctx.log(f"Frame delta {position}/{len(videos)}: video {video.index:02d}")
        best = _best_frame_deltas_for_video(ctx, video, asset_text, asset_states, artifact_dir)
        plans.append(best.output.strip())
        judges.append(f"## Video {video.index:02d}\n\n{best.judge.strip()}")
        scores.append(best.score)

    combined = BestAttempt(
        output="\n\n".join(plans),
        judge="\n\n".join(judges),
        score=min(scores) if scores else 0,
    )
    write_text(ctx.workflow / "frame_deltas.md", combined.output)
    write_text(ctx.workflow / "frame_delta_judge.md", combined.judge)
    return combined


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
        frames = _best_frame_deltas(ctx, asset_text, asset_states)
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
