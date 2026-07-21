"""Prompts for extracting and detailing reusable visual assets from shots."""

from __future__ import annotations

from backend.models import AssetCatalogItem


def asset_extractor_prompt(story_idea: str, all_shots: str, feedback: str | None = None) -> str:
    retry = ""
    if feedback:
        retry = f"""
THE PREVIOUS EXTRACTION WAS REJECTED:
{feedback.strip()}

Fix those issues. Keep useful names, remove duplicates, and preserve evidence.
"""

    return f"""You are the Visual Asset Extractor for an AI-video workflow.

Read the complete shot list for all videos and extract the reusable visual
entities needed for consistent generation.

SERIES PREMISE:
{story_idea.strip()}

ALL SHOTS:
{all_shots.strip()}
{retry}
WHAT TO EXTRACT:
- Backgrounds: recurring locations, sets, rooms, exterior environments, vehicles-as-settings.
- Props: important handheld objects, clues, tools, documents, symbols, machines, set pieces.
- Characters: named or recurring characters, including species/type, role, wardrobe, marks.

RULES:
- Extract only visually important entities that appear in the shots.
- Merge duplicates under one strong, reusable name.
- Keep names short and specific, like "Vault Control Room", "Copper Courier Tube", "Tiny Mouse Boss".
- Include shot_refs for evidence using compact labels like "V01S03".
- Do not invent new story, characters, props, or locations.
- Capture enough items that a later detailer can keep the whole shot sequence coherent.

OUTPUT CONTRACT:
- Return JSON only. No Markdown, no code fence, no commentary.
- Shape:
{{
  "background": [
    {{"name": "string", "evidence": "one sentence why this matters", "shot_refs": ["V01S01"]}}
  ],
  "prop": [],
  "character": []
}}
"""


def asset_judge_prompt(story_idea: str, all_shots: str, extraction_json: str) -> str:
    return f"""You are the Visual Asset Extraction Judge.

Check whether the extracted backgrounds, props, and characters are coherent with
the complete shot list.

SERIES PREMISE:
{story_idea.strip()}

ALL SHOTS:
{all_shots.strip()}

EXTRACTION JSON:
{extraction_json.strip()}

JUDGE FOR:
- Important recurring backgrounds, props, and characters are present.
- Duplicates are merged instead of split into confusing near-copies.
- No invented items appear.
- Names are clear enough to be used as reusable visual references.
- Shot refs point to plausible supporting shots.

OUTPUT CONTRACT:
- Start with exactly: VERDICT: PASS or VERDICT: RETRY
- Then write exactly: SCORE: 0-100
- Then write concise bullets.
- If RETRY, each bullet must be an actionable correction for the extractor.
"""


def asset_detailer_prompt(
    story_idea: str,
    all_shots: str,
    item: AssetCatalogItem,
    current_detail: str | None = None,
) -> str:
    regenerate = ""
    if current_detail:
        regenerate = f"""
CURRENT DESCRIPTION TO IMPROVE OR REPLACE:
{current_detail.strip()}
"""

    refs = ", ".join(item.shot_refs) if item.shot_refs else "No shot refs listed"
    return f"""You are the Visual Asset Detailer for AI video generation.

Write a consistent, reusable visual description for ONE extracted asset. Use the
entire shot context so the description does not contradict later videos.

SERIES PREMISE:
{story_idea.strip()}

ALL SHOTS:
{all_shots.strip()}

ASSET TO DETAIL:
- Theme: {item.theme}
- Name: {item.name}
- Evidence: {item.evidence}
- Shot refs: {refs}
{regenerate}
OUTPUT CONTRACT:
- Return plain text only. No JSON. No Markdown table. No code fence.
- Start with one compact title line using the asset name.
- Then write 4-7 tight bullets.
- Describe only visible traits: form, scale, colors, materials, wardrobe, condition, props, lighting behavior, continuity rules.
- Include what must stay identical every time this asset appears.
- Include what may vary shot to shot only if the shots support that variation.
- Do not add backstory or invisible personality.
"""
