"""Turn one catalog asset's prose description into a JSON generation spec."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from backend.models import MIN_ASSET_ANGLES, MIN_ASSET_STATES, AssetCatalogItem
from backend.prompts.json_assets import json_assets_judge_prompt, json_assets_prompt
from backend.stages.context import StageContext, run_llm_stage


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
        raise ValueError("Specifier returned JSON, but not an object")
    return value


def parse_spec(output: str) -> dict[str, Any]:
    """Parse the spec and enforce the shape the judge cannot check cheaply.

    Only structural facts are gated here - angle and state counts, and that the
    entries are objects. Everything about quality is the judge's call.
    """
    spec = _json_object(output)

    for field, minimum in (("angles", MIN_ASSET_ANGLES), ("states", MIN_ASSET_STATES)):
        entries = spec.get(field)
        if not isinstance(entries, list):
            raise ValueError(f"Spec is missing a '{field}' list")
        usable = [entry for entry in entries if isinstance(entry, dict)]
        if len(usable) < minimum:
            raise ValueError(
                f"Spec has {len(usable)} {field}, needs at least {minimum}"
            )
        spec[field] = usable

    if not isinstance(spec.get("art_style"), dict):
        raise ValueError("Spec is missing an 'art_style' object")
    if not str(spec.get("detailed_description", "")).strip():
        raise ValueError("Spec is missing 'detailed_description'")

    return spec


def specify_asset(
    ctx: StageContext,
    story_idea: str,
    all_shots: str,
    item: AssetCatalogItem,
    artifact_dir: Path,
    attempt: int,
    feedback: str | None = None,
    current_spec: str | None = None,
) -> tuple[dict[str, Any], str]:
    ctx.log(f"JsonAssets attempt {attempt}: specifying {item.theme} '{item.name}'")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"json_assets_{item.id}_attempt_{attempt:02d}",
        title=f"JsonAssets - {item.name}",
        prompt=json_assets_prompt(story_idea, all_shots, item, feedback, current_spec),
        attempt=attempt,
        stage="json_assets",
    )
    return parse_spec(output), output


def judge_spec(
    ctx: StageContext,
    story_idea: str,
    all_shots: str,
    item: AssetCatalogItem,
    spec_json: str,
    artifact_dir: Path,
    attempt: int,
) -> str:
    ctx.log(f"JsonAssets judge attempt {attempt}: scoring spec for '{item.name}'")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"json_assets_judge_{item.id}_attempt_{attempt:02d}",
        title=f"JsonAssets Judge - {item.name}",
        prompt=json_assets_judge_prompt(story_idea, all_shots, item, spec_json),
        attempt=attempt,
        stage="json_assets_judge",
    )
