"""Prompts that turn one shot's frame delta into a paired JSON image prompt."""

from __future__ import annotations

from backend.models import FrameDelta


def _delta_detail(frame: FrameDelta) -> str:
    """The frame writer's movement breakdown, indented under the delta line.

    Empty for a plan written before the three-agent frame stage, which had only
    the one-line delta.
    """
    lines = frame.detail.lines()
    return "\n".join(f"  - {line}" for line in lines) if lines else ""

_SCHEMA = """{
  "shot_ref": "V01S03",
  "shot_title": "string",
  "shot_description": "string, what happens across this shot in one or two sentences",
  "camera": {
    "shot_size": "string, e.g. wide, medium, close-up, over-the-shoulder",
    "angle": "string, e.g. eye level, low angle, high angle",
    "position": "string, where the camera sits relative to the subject",
    "lens": "string, focal length and depth of field",
    "movement": "string, how the camera moves across the shot, or 'static'"
  },
  "cast": {
    "background": "exact asset name, exactly one",
    "characters": ["exact asset name"],
    "props": ["exact asset name"]
  },
  "first_frame": {
    "description": "string, the full visual read of this single frame",
    "background": {
      "state": "one of that asset's states",
      "lighting": {
        "level": "string, e.g. dark, dim, bright",
        "direction": "string, where the key light comes from",
        "quality": "string, e.g. hard moonlight, soft bounce"
      },
      "angle": "one of that asset's angles"
    },
    "characters": [
      {
        "asset": "exact asset name",
        "state": "one of that asset's states",
        "position": "string, where in the frame and where in the space",
        "pose": "string, body attitude and what the character is doing",
        "emotion": "string, the readable feeling on the face and body",
        "angle": "one of that asset's angles"
      }
    ],
    "props": [
      {
        "asset": "exact asset name",
        "state": "one of that asset's states",
        "position": "string, where it sits in the frame"
      }
    ]
  },
  "last_frame": { "same shape as first_frame" },
  "delta": {
    "summary": "string, what changed between the two frames",
    "camera_move": "string, how the camera travelled, or 'static'",
    "subject_action": "string, the single continuous action the subject performs"
  }
}"""


def json_frames_prompt(
    frame: FrameDelta,
    shot_body: str,
    asset_index: str,
    feedback: str | None = None,
    current_spec: str | None = None,
) -> str:
    retry = ""
    if feedback:
        retry = f"""
THE PREVIOUS PROMPT WAS REJECTED:
{feedback.strip()}

Fix every point above. Keep what was already correct.
"""

    previous = ""
    if current_spec:
        previous = f"""
CURRENT PROMPT TO IMPROVE OR REPLACE:
{current_spec.strip()}
"""

    return f"""You are the JSON Frame Prompt Writer for AI image generation.

Turn ONE shot's first frame, last frame, and delta into a single JSON document
that an image model can render twice: once for the first frame, once for the
last. Both frames are generated from the same document so they stay consistent.

SHOT:
- Ref: {frame.ref}
- Title: {frame.title}
- First frame: {frame.first_frame or 'not written'}
- Last frame: {frame.last_frame or 'not written'}
- Delta: {frame.delta or 'not written'}
{_delta_detail(frame)}

SHOT BODY:
{shot_body.strip() or 'No shot body available; work from the frame plan above.'}

AVAILABLE ASSETS (use these exact names, states, and angles - nothing else):
{asset_index.strip()}
{previous}{retry}
HARD RULES:
- `cast` is shared by both frames. Exactly one background for the whole shot.
  The same characters and props appear in first_frame and last_frame. Never add
  a character or prop to one frame that is missing from the other.
- Every asset name, state, and angle must come from the asset list above. Do not
  invent an asset, a state, or an angle.
- One shot is one continuous moment in one place. A character performs one
  continuous action, not a sequence of separate actions, and never moves between
  rooms or locations inside a single shot.

MOTION SCALE - this is what makes the animation work:
- The two frames must differ by a real, animatable change: a character crosses
  the room, a door swings open, a head turns and an expression changes, the
  camera pushes in past a foreground object.
- Good: first frame is an empty room, last frame has a character just inside the
  doorway they entered through. One continuous entrance.
- Too static: the two frames differ only by a blink, a finger twitch, or a
  described feeling with no visible change. If you cannot name what physically
  moved, the delta is too small.
- Too much: a character performing ten actions, or the shot travelling through
  several rooms or environments. That is many shots, not one.

OUTPUT CONTRACT:
- Return JSON only. No Markdown, no code fence, no commentary.
- `last_frame` must be written out in full, with the same shape as `first_frame`.
- Match this schema:
{_SCHEMA}
"""


def json_frames_judge_prompt(frame: FrameDelta, shot_body: str, spec_json: str) -> str:
    return f"""You are the JSON Frame Prompt Judge.

Score one shot's paired frame prompt. The two frames are rendered from this one
document and then animated between, so continuity and motion scale both matter.

SHOT:
- Ref: {frame.ref}
- Title: {frame.title}
- First frame: {frame.first_frame or 'not written'}
- Last frame: {frame.last_frame or 'not written'}
- Delta: {frame.delta or 'not written'}
{_delta_detail(frame)}

SHOT BODY:
{shot_body.strip() or 'No shot body available.'}

FRAME PROMPT JSON:
{spec_json.strip()}

JUDGE FOR:
- The frames match the shot's written first frame, last frame, and delta.
- Both frames read as the same place at two moments, not two different scenes.
- The change between frames is genuinely animatable: something physical moves,
  opens, turns, enters, or is revealed.
- The change is not a micro-movement. A blink, a twitch, or a purely emotional
  shift with no visible physical change is too small.
- The change is not too large. One continuous action in one location. A shot
  that implies many separate actions, or several rooms, is wrong.
- Character emotion and pose are visible and specific, not stated feelings.
- Background lighting and state suit the moment described in the shot.
- Camera description is concrete enough to reproduce.

OUTPUT CONTRACT:
- Start with exactly: VERDICT: PASS or VERDICT: RETRY
- Then write exactly: SCORE: 0-100
- Then write concise bullets.
- If RETRY, each bullet must be an actionable correction for the writer.
"""
