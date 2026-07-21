"""Build or regenerate the visual asset catalog from all shot lists."""

from __future__ import annotations

import time

from backend.jobs import update_job
from backend.models import EARLY_STOP_SCORE, MAX_BEST_OF_ATTEMPTS
from backend.runs.assets import catalog_markdown, grouped_catalog, load_manifest, write_manifest
from backend.pipelines.json_assets import build_json_assets
from backend.runs.paths import run_dir
from backend.runs.shots import load_detailed_videos
from backend.runs.store import story_idea_path
from backend.stages.context import StageContext
from backend.stages.asset_catalog import detail_asset, extract_assets, judge_assets, save_extraction
from backend.utils.file_ops import read_optional, write_text
from backend.utils.parser import extract_score


def _all_shots_text(ctx: StageContext) -> str:
    drafts = load_detailed_videos(ctx.workflow)
    polished_by_index = {video.index: video for video in load_detailed_videos(ctx.workflow, rewritten=True)}
    videos = [polished_by_index.get(video.index, video) for video in drafts]
    if not videos:
        raise RuntimeError("Split all videos into shots before extracting backgrounds, props, and characters")

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


def _write_catalog_preview(ctx: StageContext) -> None:
    write_text(ctx.workflow / "asset_catalog.md", catalog_markdown(grouped_catalog(ctx.workflow)))


def _regenerate_one(ctx: StageContext, story_idea: str, all_shots: str, item_id: str) -> None:
    items = load_manifest(ctx.workflow)
    item = next((entry for entry in items if entry.id == item_id), None)
    if not item:
        raise RuntimeError(f"Asset item '{item_id}' was not found")

    artifact_dir = ctx.workflow / "asset_details" / f"regenerate_{int(time.time())}"
    updated = detail_asset(ctx, story_idea, all_shots, item, artifact_dir, 1, item.detail)
    next_items = [updated if entry.id == item.id else entry for entry in items]
    write_manifest(ctx.workflow, next_items)
    write_text(
        ctx.workflow / "asset_detailer.md",
        "\n\n".join(entry.detail for entry in next_items if entry.detail) or updated.detail,
    )
    _write_catalog_preview(ctx)
    # The prose changed, so this asset's JSON spec is now stale.
    build_json_assets(ctx, item_id=item.id)
    update_job(ctx.job_id, "done", f"Regenerated description and spec for {item.name}")


def run_asset_catalog_job(job_id: str, slug: str, model: str, item_id: str = "") -> None:
    try:
        path = run_dir(slug)
        ctx = StageContext(job_id=job_id, slug=slug, path=path, model=model)

        story_idea = read_optional(story_idea_path(path))
        if not story_idea:
            raise RuntimeError("Missing story idea")

        all_shots = _all_shots_text(ctx)
        if item_id:
            _regenerate_one(ctx, story_idea, all_shots, item_id)
            return

        artifact_dir = ctx.workflow / "asset_catalog_runs" / f"catalog_{int(time.time())}"
        # Always run the full set of attempts and keep the best-scoring one,
        # the same way the main workflow picks its extraction.
        feedback: str | None = None
        accepted_items = []
        accepted_judge = ""
        accepted_extraction = ""
        best_score = -1

        for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
            items, extraction_json = extract_assets(ctx, story_idea, all_shots, artifact_dir, attempt, feedback)
            judge = judge_assets(ctx, story_idea, all_shots, extraction_json, artifact_dir, attempt)
            score = extract_score(judge)
            if score > best_score:
                accepted_items = items
                accepted_judge = judge
                accepted_extraction = extraction_json
                best_score = score
            feedback = judge
            ctx.log(f"Asset extraction attempt {attempt}: score {score}; best {best_score}")
            if best_score > EARLY_STOP_SCORE:
                break

        write_text(ctx.workflow / "asset_judge.md", accepted_judge)
        save_extraction(ctx.workflow, accepted_items)
        write_text(ctx.workflow / "asset_extraction.json", accepted_extraction)
        write_text(ctx.workflow / "asset_judge.md", accepted_judge)

        detailed = []
        for index, item in enumerate(accepted_items, start=1):
            ctx.log(f"Asset detailer {index}/{len(accepted_items)}")
            detailed.append(detail_asset(ctx, story_idea, all_shots, item, artifact_dir, 1))

        write_manifest(ctx.workflow, detailed)
        detailer_text = "\n\n".join(item.detail for item in detailed if item.detail)
        write_text(ctx.workflow / "asset_detailer.md", detailer_text or "No details generated.")
        _write_catalog_preview(ctx)

        # A fresh catalog always lands with its JSON specs, so the frame delta
        # stage downstream can cite asset states without a second manual step.
        ctx.log("Asset catalog done; building JSON specs")
        build_json_assets(ctx)

        update_job(job_id, "done", f"Detailed and specified {len(detailed)} visual assets")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Asset catalog failed", str(exc))
