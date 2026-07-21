"""Build one JSON generation spec per catalog asset, each judged best-of-N."""

from __future__ import annotations

import json
import time
from pathlib import Path

from backend.jobs import update_job
from backend.models import EARLY_STOP_SCORE, MAX_BEST_OF_ATTEMPTS, AssetCatalogItem
from backend.runs.assets import load_manifest
from backend.runs.json_assets import load_specs, spec_file, specs_markdown, write_spec
from backend.runs.paths import run_dir
from backend.runs.store import story_idea_path
from backend.stages.context import StageContext
from backend.stages.json_assets import judge_spec, specify_asset
from backend.utils.file_ops import read_optional, write_text
from backend.utils.parser import extract_score


def _existing_spec_text(workflow: Path, item: AssetCatalogItem) -> str | None:
    return read_optional(spec_file(workflow, item.name)) or None


def _specify_one(
    ctx: StageContext,
    story_idea: str,
    all_shots: str,
    item: AssetCatalogItem,
    artifact_dir: Path,
    current_spec: str | None,
) -> str:
    """Run the specifier and judge five times, keep the best-scoring spec.

    Never fatal. If an attempt does not parse it simply cannot win, and its
    parse error becomes the feedback for the next try.
    """
    feedback: str | None = None
    best_spec: dict | None = None
    best_judge = ""
    best_score = -1

    for attempt in range(1, MAX_BEST_OF_ATTEMPTS + 1):
        try:
            spec, raw = specify_asset(
                ctx, story_idea, all_shots, item, artifact_dir, attempt, feedback, current_spec
            )
        except (ValueError, json.JSONDecodeError) as exc:
            feedback = f"The previous output could not be parsed: {exc}"
            ctx.log(f"JsonAssets '{item.name}' attempt {attempt}: {exc}; retrying")
            continue

        judge = judge_spec(ctx, story_idea, all_shots, item, raw, artifact_dir, attempt)
        score = extract_score(judge)
        if score > best_score:
            best_spec, best_judge, best_score = spec, judge, score

        feedback = judge
        ctx.log(f"JsonAssets '{item.name}' attempt {attempt}: score {score}; best {best_score}")
        if best_score > EARLY_STOP_SCORE:
            break

    if best_spec is None:
        # Nothing parsed in five tries, so there is no JSON to write. Skip this
        # asset and carry on rather than taking the whole job down.
        ctx.log(f"JsonAssets '{item.name}': no usable spec after {MAX_BEST_OF_ATTEMPTS} attempts; skipped")
        return ""

    write_spec(ctx.workflow, item, best_spec)
    return best_judge


def _write_previews(ctx: StageContext, items: list[AssetCatalogItem], judge_text: str) -> None:
    write_text(ctx.workflow / "json_assets.md", specs_markdown(load_specs(ctx.workflow, items)))
    if judge_text:
        write_text(ctx.workflow / "json_assets_judge.md", judge_text)


def run_json_assets_job(job_id: str, slug: str, model: str, item_id: str = "") -> None:
    try:
        path = run_dir(slug)
        ctx = StageContext(job_id=job_id, slug=slug, path=path, model=model)
        build_json_assets(ctx, item_id)
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "JsonAssets failed", str(exc))


def build_json_assets(ctx: StageContext, item_id: str = "") -> None:
    """Spec every catalog asset, or just one when `item_id` is set.

    Called directly by the asset catalog pipeline so a fresh catalog always
    lands with its specs, and by its own job when you rebuild from the UI.
    """
    # Imported here: the shot text builder lives in the catalog pipeline, and
    # importing it at module scope would make the two pipelines circular.
    from backend.pipelines.asset_catalog import _all_shots_text

    story_idea = read_optional(story_idea_path(ctx.path))
    if not story_idea:
        raise RuntimeError("Missing story idea")

    items = load_manifest(ctx.workflow)
    if not items:
        raise RuntimeError("Build the asset catalog before generating JSON specs")

    if item_id:
        items = [entry for entry in items if entry.id == item_id]
        if not items:
            raise RuntimeError(f"Asset item '{item_id}' was not found")

    all_shots = _all_shots_text(ctx)
    artifact_dir = ctx.workflow / "json_asset_runs" / f"specs_{int(time.time())}"

    last_judge = ""
    written = 0
    for index, item in enumerate(items, start=1):
        ctx.log(f"JsonAssets {index}/{len(items)}: {item.name}")
        judge = _specify_one(
            ctx, story_idea, all_shots, item, artifact_dir, _existing_spec_text(ctx.workflow, item)
        )
        if judge:
            last_judge = judge
            written += 1

    _write_previews(ctx, load_manifest(ctx.workflow), last_judge)
    skipped = len(items) - written
    update_job(
        ctx.job_id,
        "done",
        f"Specified {written} of {len(items)} assets as JSON"
        + (f" ({skipped} had no usable output)" if skipped else ""),
    )
