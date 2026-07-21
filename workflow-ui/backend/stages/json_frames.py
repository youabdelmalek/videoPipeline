"""Turn one shot's frame delta into a paired first/last JSON image prompt."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from backend.models import FrameDelta
from backend.prompts.json_frames import json_frames_judge_prompt, json_frames_prompt
from backend.stages.context import StageContext, run_llm_stage

_FRAMES = ("first_frame", "last_frame")


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
        raise ValueError("Frame writer returned JSON, but not an object")
    return value


def _names(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if not isinstance(value, list):
        return []
    return [str(entry).strip() for entry in value if str(entry).strip()]


def _entry_assets(frame: dict[str, Any], key: str) -> list[str]:
    entries = frame.get(key)
    if not isinstance(entries, list):
        return []
    return [
        str(entry.get("asset", "")).strip()
        for entry in entries
        if isinstance(entry, dict) and str(entry.get("asset", "")).strip()
    ]


def _check_known(names: list[str], lookup: dict[str, dict[str, Any]], label: str) -> None:
    unknown = [name for name in names if name.strip().lower() not in lookup]
    if unknown:
        raise ValueError(f"{label} names no known asset: {', '.join(sorted(set(unknown)))}")


def _check_states(frame: dict[str, Any], key: str, lookup: dict[str, dict[str, Any]], where: str) -> None:
    """Every state and angle cited must exist on that asset's own spec."""
    entries = frame.get(key)
    if not isinstance(entries, list):
        return
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("asset", "")).strip()
        known = lookup.get(name.lower())
        if not known:
            continue
        for field, allowed in (("state", known["states"]), ("angle", known["angles"])):
            value = str(entry.get(field, "")).strip().lower()
            if value and allowed and value not in allowed:
                raise ValueError(
                    f"{where}: '{name}' has {field} '{entry.get(field)}', "
                    f"which is not one of its {field}s"
                )


def parse_frame_spec(output: str, lookup: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Parse the frame prompt and enforce the rules a judge cannot check cheaply.

    The continuity rules are structural, so they are gated here: one background
    for the whole shot, and an identical cast in both frames. Whether the motion
    between frames is the right size is left to the judge.
    """
    spec = _json_object(output)

    cast = spec.get("cast")
    if not isinstance(cast, dict):
        raise ValueError("Frame prompt is missing a 'cast' object")

    backgrounds = _names(cast.get("background"))
    if len(backgrounds) != 1:
        raise ValueError(
            f"A shot needs exactly one background, got {len(backgrounds)}"
        )
    characters = _names(cast.get("characters"))
    props = _names(cast.get("props"))

    _check_known(backgrounds, lookup, "cast.background")
    _check_known(characters, lookup, "cast.characters")
    _check_known(props, lookup, "cast.props")

    for name in _FRAMES:
        frame = spec.get(name)
        if not isinstance(frame, dict):
            raise ValueError(f"Frame prompt is missing a '{name}' object")
        if not str(frame.get("description", "")).strip():
            raise ValueError(f"'{name}' is missing a description")

        background = frame.get("background")
        if not isinstance(background, dict):
            raise ValueError(f"'{name}' is missing a 'background' object")

        # The same cast in both frames is what keeps the animation from having to
        # invent or delete a character between the two rendered images.
        for key, expected in (("characters", characters), ("props", props)):
            found = _entry_assets(frame, key)
            if {value.lower() for value in found} != {value.lower() for value in expected}:
                raise ValueError(
                    f"'{name}' {key} {sorted(found)} do not match cast.{key} {sorted(expected)}; "
                    "both frames must use the same cast"
                )

        _check_states(frame, "characters", lookup, name)
        _check_states(frame, "props", lookup, name)

        known_background = lookup.get(backgrounds[0].lower())
        if known_background:
            for field, allowed in (
                ("state", known_background["states"]),
                ("angle", known_background["angles"]),
            ):
                value = str(background.get(field, "")).strip().lower()
                if value and allowed and value not in allowed:
                    raise ValueError(
                        f"'{name}': background '{backgrounds[0]}' has {field} "
                        f"'{background.get(field)}', which is not one of its {field}s"
                    )

    first = str(spec["first_frame"].get("description", "")).strip().lower()
    last = str(spec["last_frame"].get("description", "")).strip().lower()
    if first == last:
        raise ValueError("Both frames have the same description; there is nothing to animate")

    return spec


def write_frame_prompt(
    ctx: StageContext,
    frame: FrameDelta,
    shot_body: str,
    asset_index: str,
    lookup: dict[str, dict[str, Any]],
    artifact_dir: Path,
    attempt: int,
    feedback: str | None = None,
    current_spec: str | None = None,
) -> tuple[dict[str, Any], str]:
    ctx.log(f"JsonFrames attempt {attempt}: writing prompt for {frame.ref}")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"json_frames_{frame.ref.lower()}_attempt_{attempt:02d}",
        title=f"JsonFrames - {frame.ref}",
        prompt=json_frames_prompt(frame, shot_body, asset_index, feedback, current_spec),
        attempt=attempt,
        stage="json_frames",
    )
    return parse_frame_spec(output, lookup), output


def judge_frame_prompt(
    ctx: StageContext,
    frame: FrameDelta,
    shot_body: str,
    spec_json: str,
    artifact_dir: Path,
    attempt: int,
) -> str:
    ctx.log(f"JsonFrames judge attempt {attempt}: scoring {frame.ref}")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"json_frames_judge_{frame.ref.lower()}_attempt_{attempt:02d}",
        title=f"JsonFrames Judge - {frame.ref}",
        prompt=json_frames_judge_prompt(frame, shot_body, spec_json),
        attempt=attempt,
        stage="json_frames_judge",
    )
