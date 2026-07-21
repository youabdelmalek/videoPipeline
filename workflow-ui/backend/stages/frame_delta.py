"""The three agents that turn one shot into a first frame, last frame, and delta."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from backend.models import FrameDelta, FrameDeltaDetail
from backend.prompts.frame_delta import (
    frame_write_judge_prompt,
    frame_write_prompt,
    shot_assets_prompt,
    shot_description_prompt,
)
from backend.stages.context import StageContext, run_llm_stage

_DELTA_FIELDS = ("emotion", "character_movement", "background_movement", "camera_movement")


def _json_object(text: str) -> dict[str, Any]:
    """Parse a model JSON object, tolerating a code fence or a preface."""
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
        raise ValueError("Expected a JSON object")
    return value


def _labelled(text: str, label: str) -> str:
    match = re.search(rf"(?im)^\s*[-*]?\s*{re.escape(label)}\s*:\s*(.+?)\s*$", text)
    return match.group(1).strip() if match else ""


def describe_shot(
    ctx: StageContext,
    video_shots: str,
    shot_ref: str,
    shot_text: str,
    artifact_dir: Path,
) -> dict[str, str]:
    """Agent 1. Returns the described shot, and the raw text for the next agent."""
    ctx.log(f"Shot describer {shot_ref}: writing what the shot is about")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"shot_describer_{shot_ref.lower()}",
        title=f"Shot Describer - {shot_ref}",
        prompt=shot_description_prompt(video_shots, shot_ref, shot_text),
        attempt=1,
        stage="shot_describer",
    )
    return {
        "text": output.strip(),
        "description": _labelled(output, "Description"),
        "emotion": _labelled(output, "Emotion"),
        "should_include": _labelled(output, "Should include"),
        "should_not_include": _labelled(output, "Should not include"),
    }


def _asset_names(selection: dict[str, Any]) -> set[str]:
    """Every asset name the picker chose, lowercased."""
    assets = selection.get("assets")
    if not isinstance(assets, dict):
        return set()

    names: set[str] = set()
    background = assets.get("background")
    if isinstance(background, dict):
        name = str(background.get("asset", "")).strip()
        if name:
            names.add(name.lower())
    elif isinstance(background, str) and background.strip():
        names.add(background.strip().lower())

    for key in ("characters", "props"):
        for entry in assets.get(key) or []:
            if isinstance(entry, dict):
                name = str(entry.get("asset", "")).strip()
            else:
                name = str(entry).strip()
            if name:
                names.add(name.lower())
    return names


def parse_selection(output: str, known: set[str], shot_ref: str, shot_title: str) -> dict[str, Any]:
    """Parse agent 2 and reject any asset that is not in the catalogue.

    Invented assets are gated here rather than by the judge: a name that does not
    exist has no spec, so a later stage could never render it.
    """
    selection = _json_object(output)
    selection.setdefault("shot_ref", shot_ref)
    selection.setdefault("shot_title", shot_title)

    assets = selection.get("assets")
    if not isinstance(assets, dict):
        raise ValueError("Asset selection is missing an 'assets' object")

    background = assets.get("background")
    has_background = (isinstance(background, dict) and str(background.get("asset", "")).strip()) or (
        isinstance(background, str) and background.strip()
    )
    if not has_background:
        raise ValueError("Asset selection needs exactly one background")

    chosen = _asset_names(selection)
    unknown = sorted(name for name in chosen if name not in known)
    if unknown:
        raise ValueError(f"Asset selection names unknown assets: {', '.join(unknown)}")
    return selection


def select_assets(
    ctx: StageContext,
    shot_ref: str,
    shot_title: str,
    described: dict[str, str],
    asset_catalog: str,
    asset_states: str,
    known: set[str],
    artifact_dir: Path,
    attempt: int,
) -> dict[str, Any]:
    """Agent 2. Returns the parsed selection JSON."""
    ctx.log(f"Shot assets {shot_ref}: choosing the cast")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"shot_assets_{shot_ref.lower()}_attempt_{attempt:02d}",
        title=f"Shot Assets - {shot_ref}",
        prompt=shot_assets_prompt(
            shot_ref, shot_title, described["text"], asset_catalog, asset_states
        ),
        attempt=attempt,
        stage="shot_assets",
    )
    return parse_selection(output, known, shot_ref, shot_title)


def parse_frame(output: str) -> dict[str, Any]:
    """Parse agent 3 and require both frames plus a fully filled delta."""
    spec = _json_object(output)

    for key in ("first_frame", "last_frame"):
        if not str(spec.get(key, "")).strip():
            raise ValueError(f"Frame answer is missing '{key}'")

    delta = spec.get("delta")
    if not isinstance(delta, dict):
        raise ValueError("Frame answer is missing a 'delta' object")

    missing = [field for field in _DELTA_FIELDS if not str(delta.get(field, "")).strip()]
    if missing:
        raise ValueError(f"Delta is missing: {', '.join(missing)}")
    return spec


def write_frame_delta(
    ctx: StageContext,
    selection: dict[str, Any],
    artifact_dir: Path,
    attempt: int,
    previous_output: str | None,
    judge_feedback: str | None,
) -> tuple[dict[str, Any], str]:
    """Agent 3. Returns the parsed frame answer and its raw text."""
    shot_ref = str(selection.get("shot_ref", ""))
    ctx.log(f"Frame writer {shot_ref} attempt {attempt}: writing first, last, delta")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"frame_writer_{shot_ref.lower()}_attempt_{attempt:02d}",
        title=f"Frame Writer - {shot_ref}",
        prompt=frame_write_prompt(selection, previous_output, judge_feedback),
        attempt=attempt,
        stage="frame_writer",
    )
    return parse_frame(output), output


def judge_frame_delta(
    ctx: StageContext,
    selection: dict[str, Any],
    frame_json: str,
    artifact_dir: Path,
    attempt: int,
) -> str:
    shot_ref = str(selection.get("shot_ref", ""))
    ctx.log(f"Frame judge {shot_ref} attempt {attempt}: scoring the frames")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"frame_writer_judge_{shot_ref.lower()}_attempt_{attempt:02d}",
        title=f"Frame Writer Judge - {shot_ref}",
        prompt=frame_write_judge_prompt(selection, frame_json),
        attempt=attempt,
        stage="frame_writer_judge",
    )


def to_frame_delta(
    shot_ref: str,
    shot_title: str,
    described: dict[str, str],
    selection: dict[str, Any],
    frame: dict[str, Any],
) -> FrameDelta:
    """Fold the three agents' answers into the record the rest of the run uses."""
    delta = frame.get("delta") or {}
    return FrameDelta(
        ref=shot_ref,
        title=shot_title,
        first_frame=str(frame.get("first_frame", "")).strip(),
        last_frame=str(frame.get("last_frame", "")).strip(),
        delta=str(delta.get("summary", "")).strip(),
        detail=FrameDeltaDetail(**{field: str(delta.get(field, "")).strip() for field in _DELTA_FIELDS}),
        description=described.get("description", ""),
        emotion=described.get("emotion", ""),
        assets=selection.get("assets") if isinstance(selection.get("assets"), dict) else {},
    )
