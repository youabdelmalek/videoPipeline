"""Visual asset extraction, judging, and per-item detailing."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from backend.models import AssetCatalogItem, AssetTheme
from backend.prompts.asset_catalog import (
    asset_detailer_prompt,
    asset_extractor_prompt,
    asset_judge_prompt,
)
from backend.runs.assets import item_id, write_detail, write_manifest
from backend.stages.context import StageContext, run_llm_stage

_THEMES: tuple[AssetTheme, ...] = ("background", "prop", "character")


def _json_object(text: str) -> dict[str, Any]:
    """Parse a model JSON object, tolerating accidental code fences or preface."""
    cleaned = re.sub(r"^\s*```(?:json)?|```\s*$", "", text.strip(), flags=re.IGNORECASE)
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end <= start:
            raise
        value = json.loads(cleaned[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("Extractor returned JSON, but not an object")
    return value


def parse_extraction(output: str) -> list[AssetCatalogItem]:
    raw = _json_object(output)
    used: set[str] = set()
    items: list[AssetCatalogItem] = []
    for theme in _THEMES:
        entries = raw.get(theme, [])
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("name", "")).strip()
            if not name:
                continue
            shot_refs = entry.get("shot_refs", [])
            if not isinstance(shot_refs, list):
                shot_refs = []
            items.append(
                AssetCatalogItem(
                    id=item_id(theme, name, used),
                    theme=theme,
                    name=name,
                    evidence=str(entry.get("evidence", "")).strip(),
                    shot_refs=[str(ref).strip() for ref in shot_refs if str(ref).strip()],
                )
            )
    return items


def extract_assets(
    ctx: StageContext,
    story_idea: str,
    all_shots: str,
    artifact_dir: Path,
    attempt: int,
    feedback: str | None,
) -> tuple[list[AssetCatalogItem], str]:
    ctx.log(f"Asset extractor attempt {attempt}: finding backgrounds, props, and characters")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"asset_extractor_attempt_{attempt:02d}",
        title="Asset Extractor",
        prompt=asset_extractor_prompt(story_idea, all_shots, feedback),
        attempt=attempt,
        stage="asset_extractor",
    )
    items = parse_extraction(output)
    if not items:
        raise RuntimeError("Asset extractor returned no usable backgrounds, props, or characters")
    return items, output


def judge_assets(
    ctx: StageContext,
    story_idea: str,
    all_shots: str,
    extraction_json: str,
    artifact_dir: Path,
    attempt: int,
) -> str:
    ctx.log(f"Asset judge attempt {attempt}: checking extraction coherence")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"asset_judge_attempt_{attempt:02d}",
        title="Asset Extraction Judge",
        prompt=asset_judge_prompt(story_idea, all_shots, extraction_json),
        attempt=attempt,
        stage="asset_judge",
    )


def detail_asset(
    ctx: StageContext,
    story_idea: str,
    all_shots: str,
    item: AssetCatalogItem,
    artifact_dir: Path,
    attempt: int,
    current_detail: str | None = None,
) -> AssetCatalogItem:
    ctx.log(f"Asset detailer: describing {item.theme} '{item.name}'")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"asset_detailer_{item.id}",
        title=f"Asset Detailer - {item.name}",
        prompt=asset_detailer_prompt(story_idea, all_shots, item, current_detail),
        attempt=attempt,
        stage="asset_detailer",
    )
    return write_detail(ctx.workflow, item, output)


def save_extraction(workflow: Path, items: list[AssetCatalogItem]) -> None:
    write_manifest(workflow, items)
