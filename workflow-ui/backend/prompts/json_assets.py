"""Prompts that turn one catalog asset description into a JSON generation spec."""

from __future__ import annotations

from backend.models import MIN_ASSET_ANGLES, MIN_ASSET_STATES, AssetCatalogItem

_SCHEMA = """{
  "name": "string, the asset name exactly as given",
  "theme": "background | prop | character",
  "art_style": {
    "medium": "string, e.g. 2D cel animation, 3D stylized render, gouache matte painting",
    "line": "string, line weight and treatment, or 'none' for lineless",
    "shading": "string, how light and shadow are rendered",
    "color_palette": ["#RRGGBB", "#RRGGBB"],
    "texture": "string, surface treatment and grain",
    "influences": "string, visual references that pin the look",
    "negative": "string, what must never appear in a render of this asset"
  },
  "detailed_description": "string, 80-150 words of purely visual description",
  "angles": [
    {
      "id": "short-slug",
      "label": "string, e.g. Front Orthographic",
      "camera": "string, camera position and height relative to the asset",
      "lens": "string, focal length and perspective character",
      "framing": "string, how much of the asset fills the frame",
      "description": "string, what is visible and readable from this angle"
    }
  ],
  "states": [
    {
      "id": "short-slug",
      "label": "string, e.g. Day",
      "description": "string, the full visual read of the asset in this state",
      "visual_deltas": ["string, one concrete difference from the base state"],
      "shot_refs": ["V01S03"]
    }
  ],
  "continuity_rules": ["string, what must stay identical in every render"],
  "shot_refs": ["V01S03"]
}"""


def json_assets_prompt(
    story_idea: str,
    all_shots: str,
    item: AssetCatalogItem,
    feedback: str | None = None,
    current_spec: str | None = None,
) -> str:
    retry = ""
    if feedback:
        retry = f"""
THE PREVIOUS SPEC WAS REJECTED:
{feedback.strip()}

Fix every point above. Keep what was already correct.
"""

    previous = ""
    if current_spec:
        previous = f"""
CURRENT SPEC TO IMPROVE OR REPLACE:
{current_spec.strip()}
"""

    refs = ", ".join(item.shot_refs) if item.shot_refs else "No shot refs listed"
    return f"""You are the JSON Asset Specifier for an AI-video workflow.

Convert ONE asset's prose description into a strict JSON generation spec that an
image model can consume directly. The spec pins the art style, gives several
camera angles, and enumerates the distinct states the asset appears in.

SERIES PREMISE:
{story_idea.strip()}

ALL SHOTS:
{all_shots.strip()}

ASSET TO SPECIFY:
- Theme: {item.theme}
- Name: {item.name}
- Evidence: {item.evidence}
- Shot refs: {refs}

EXISTING PROSE DESCRIPTION:
{(item.detail or item.evidence).strip()}
{previous}{retry}
RULES:
- The art style must be identical in spirit across every asset in this series, so
  describe the series look, not a look invented for this one asset.
- Provide at least {MIN_ASSET_ANGLES} angles. Cover the asset from genuinely
  different directions, not {MIN_ASSET_ANGLES} near-copies of a front view.
- Provide at least {MIN_ASSET_STATES} states. A state is a meaningful visual
  variation the shots actually call for: day / night, happy / sad, open / closed,
  clean / damaged, powered / dark, worn / pristine.
- Ground every state in the shot list. Cite the shots that need it in shot_refs.
- Describe only what is visible. No backstory, no personality, no plot.
- Do not invent assets, locations, or characters that are not in the shots.

OUTPUT CONTRACT:
- Return JSON only. No Markdown, no code fence, no commentary before or after.
- Match this shape exactly:
{_SCHEMA}
"""


def json_assets_judge_prompt(
    story_idea: str,
    all_shots: str,
    item: AssetCatalogItem,
    spec_json: str,
) -> str:
    return f"""You are the JSON Asset Specification Judge.

Check whether this JSON spec is a faithful, usable generation spec for the asset.

SERIES PREMISE:
{story_idea.strip()}

ALL SHOTS:
{all_shots.strip()}

ASSET:
- Theme: {item.theme}
- Name: {item.name}

PROSE DESCRIPTION IT MUST MATCH:
{(item.detail or item.evidence).strip()}

SPEC JSON:
{spec_json.strip()}

JUDGE FOR:
- At least {MIN_ASSET_ANGLES} angles, and they are genuinely different viewpoints.
- At least {MIN_ASSET_STATES} states, each one a real visual variation the shots need.
- Every state is supported by the shot list, not invented.
- The art style block is concrete enough that two renders would match.
- The detailed description contradicts neither the prose description nor the shots.
- Only visible traits are described. No backstory or personality leaked in.
- continuity_rules capture what must never drift between renders.

OUTPUT CONTRACT:
- Start with exactly: VERDICT: PASS or VERDICT: RETRY
- Then write exactly: SCORE: 0-100
- Then write concise bullets.
- If RETRY, each bullet must be an actionable correction for the specifier.
"""
