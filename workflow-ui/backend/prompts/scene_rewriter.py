"""Stage 4 prompt: polish the approved batch for standalone readability."""

from __future__ import annotations

from backend.models import (
    MAX_TOTAL_VIDEO_WORDS,
    MAX_VIDEO_BEATS,
    MAX_VIDEO_CARD_WORDS,
    MIN_VIDEO_BEATS,
    MIN_VIDEO_BULLETS,
)
from backend.utils.parser import parse_scene_cards


def scene_rewriter_prompt(story_idea: str, story_pack: str, scenes_text: str, judge_output: str) -> str:
    expected_count = len(parse_scene_cards(scenes_text)) or MIN_VIDEO_BULLETS
    return f"""You are the final coherence rewriter for a short-form AI-video series workflow.

The video judge has already approved this batch. Your job is not to invent a new season; your job is to polish the approved videos so every final card is coherent, understandable, and ready to appear in the UI.

SERIES PREMISE:
{story_idea.strip()}

PACKED STORY:
{story_pack.strip()}

JUDGE APPROVAL:
{judge_output.strip()}

APPROVED VIDEO DRAFTS:
{scenes_text.strip()}

REWRITE GOALS:
- Make each video understandable when viewed alone: clear hook, conflict, escalation, Twist 1, Twist 2 / Payoff, standalone payoff, and continuity clue.
- Preserve the approved story logic, titles, reveal timing, PG-13 tone, and all important continuity clues.
- Improve causal clarity and plain-language readability. Remove ambiguous pronouns, missing motivations, and unclear payoffs.
- Keep the series coherent as a batch while keeping every video self-contained.
- Do not add extra videos, remove videos, merge videos, or split videos.
- Do not reveal protected finale information early. If the premise protects a reveal, keep the explicit reveal only in the final video.
- If the protected reveal is the Mouse Crime Boss, remove obvious pre-finale hints tied to size, species, diet, habitat, body parts, or animal-coded sounds. Before the finale, do not use small, tiny, little, miniature, mouse, rat, rodent, cheese, crumbs, squeak, nibble, whisker, tail, paw, burrow, herbivore, seed, grain, vegetarian, or similar clue words.

OUTPUT CONTRACT:
- Return plain text only. Do not output JSON. Do not use Markdown code fences.
- Write exactly {expected_count} VIDEO sections, preserving the same numbering and order as the approved draft.
- Use this exact heading format for every section: VIDEO 01 - Short title
- Under each heading, write {MIN_VIDEO_BEATS}-{MAX_VIDEO_BEATS} compact beat bullets.
- Each bullet must be one short line under 18 words.
- Every section must include clearly labeled Twist 1, Twist 2 / Payoff, Standalone payoff, and Continuity clue beats.
- Keep each video section under {MAX_VIDEO_CARD_WORDS} words and the whole answer under {MAX_TOTAL_VIDEO_WORDS} words.
"""
