"""Prompts for the three-agent frame stage.

The stage used to be one call that received every shot in a video, the whole
asset catalogue, and the state vocabulary at once - about 24 KB, of which 71%
was the asset list - and was asked to write first frame, last frame, and delta
for fourteen shots in one pass. Each agent below gets only what its own decision
needs:

1. describer  - the video's shots, to write what one shot is about.
2. asset picker - that description plus the catalogue, to choose the cast.
3. frame writer - only the chosen cast, to write the two frames and the delta.
"""

from __future__ import annotations

import json
from typing import Any


def shot_description_prompt(video_shots: str, shot_ref: str, shot_text: str) -> str:
    """Agent 1: what this shot is about, and what belongs in it."""
    return f"""You are the Shot Describer Agent.

Describe ONE shot. The other shots are context so you know what came before and
what follows; do not describe them.

SHOTS IN THIS VIDEO:
{video_shots.strip()}

THE SHOT TO DESCRIBE: {shot_ref}
{shot_text.strip()}

Write what this shot is, what it is for, and what must not creep into it. Judge
"should not include" from the story: things belonging to another shot, anything
that would spoil a later reveal, and anything the action does not call for.

OUTPUT:
Plain text, exactly these five labels, one line each:
Shot: {shot_ref}
Description: what the viewer sees and what happens, in one or two sentences.
Emotion: the feeling this shot is meant to land, and on whom.
Should include: comma-separated things the shot needs.
Should not include: comma-separated things that must stay out of it.
"""


def shot_assets_prompt(
    shot_ref: str,
    shot_title: str,
    shot_description: str,
    asset_catalog: str,
    asset_states: str | None = None,
) -> str:
    """Agent 2: pick the cast for the described shot, as JSON."""
    states = ""
    if asset_states and asset_states.strip():
        states = f"""
ASSET STATES:
Each asset has a fixed set of states. Name the state you mean for every asset you
choose. Use only the states listed here; if the shot does not call for a specific
one, use the first.
{asset_states.strip()}
"""

    return f"""You are the Shot Asset Agent.

Choose which existing assets appear in this shot. Choose nothing new: every name
you write must appear in the asset list exactly as spelled there.

SHOT DESCRIPTION:
{shot_description.strip()}

ASSET LIST:
{asset_catalog.strip()}
{states}
RULES:
- Exactly one background.
- Only characters and props the description actually calls for.
- Anything under "Should not include" must not appear.
- Copy the description and emotion through unchanged.

OUTPUT:
A single JSON object, no prose and no code fence:
{{
  "shot_ref": "{shot_ref}",
  "shot_title": "{shot_title}",
  "description": "the shot description, copied",
  "emotion": "the emotion, copied",
  "should_not_include": ["..."],
  "assets": {{
    "background": {{"asset": "Name", "state": "State"}},
    "characters": [{{"asset": "Name", "state": "State"}}],
    "props": [{{"asset": "Name", "state": "State"}}]
  }}
}}
"""


def frame_write_prompt(
    selection: dict[str, Any],
    previous_output: str | None = None,
    judge_feedback: str | None = None,
) -> str:
    """Agent 3: the two frames and a delta split into four moving parts."""
    retry = ""
    if previous_output or judge_feedback:
        retry = f"""
YOUR PREVIOUS ANSWER:
{(previous_output or '').strip()}

JUDGE FEEDBACK:
{(judge_feedback or '').strip()}
"""

    shot_ref = str(selection.get("shot_ref", ""))
    shot_title = str(selection.get("shot_title", ""))

    return f"""You are the Frame Writer Agent.

Write the first frame, the last frame, and the delta between them for one shot.
Everything you may use is in the JSON below - use only those assets, and keep the
same cast in both frames. Do not add or remove a character or prop between them.

SHOT:
{json.dumps(selection, indent=2, ensure_ascii=False)}
{retry}
RULES:
- Both frames are still images. Describe what is visible, not what happens over time.
- The delta is the movement between them, and must be small enough to film in one take.
- Fill all four delta fields. If one genuinely does not move, say "none".
- Camera movement must be one simple move: static, slow push in, pull back, pan
  left, pan right, tilt up, tilt down.

OUTPUT:
A single JSON object, no prose and no code fence:
{{
  "shot_ref": "{shot_ref}",
  "shot_title": "{shot_title}",
  "first_frame": "what the opening still shows",
  "last_frame": "what the closing still shows",
  "delta": {{
    "summary": "one line: what changes",
    "emotion": "how the feeling shifts across the shot",
    "character_movement": "what the characters do, and how much",
    "background_movement": "what moves behind them, or 'none'",
    "camera_movement": "the one camera move"
  }}
}}
"""


def frame_write_judge_prompt(selection: dict[str, Any], frame_json: str) -> str:
    return f"""You are the Frame Writer Judge Agent.

Score the frame answer. This workflow keeps the best score from three tries.

THE SHOT AND ITS ALLOWED ASSETS:
{json.dumps(selection, indent=2, ensure_ascii=False)}

THE ANSWER:
{frame_json.strip()}

JUDGE FOR:
- The first and last frames match the shot description and its emotion.
- Both frames use only the assets listed, and the same cast appears in both.
- Nothing from "should_not_include" appears.
- All four delta fields are filled and say something specific.
- The movement is small enough to film as one continuous take.
- Camera movement is a single simple move.

OUTPUT FORMAT:
VERDICT: PASS or RETRY
SCORE: 0-100
CHECKS:
- concise bullets
TARGETED FIXES:
- concise bullets
"""
