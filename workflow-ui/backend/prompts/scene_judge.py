"""Stage 3 prompt: judge the video batch and return PASS or RETRY."""

from __future__ import annotations

from backend.config import SCENE_JUDGE_PROMPT, workspace_path
from backend.models import (
    MAX_VIDEO_BEATS,
    MAX_VIDEO_BULLETS,
    MAX_VIDEO_CARD_WORDS,
    MIN_VIDEO_BEATS,
    MIN_VIDEO_BULLETS,
)
from backend.prompts.loader import load_source_prompt

_FALLBACK = "You are a strict judge for a short-form AI-video workflow."


def scene_judge_prompt(story_idea: str, story_pack: str, scenes_text: str) -> str:
    source_prompt = load_source_prompt(
        SCENE_JUDGE_PROMPT,
        {
            "story_description": story_idea,
            "story_detailer_output": scenes_text,
            "video_writer_output": scenes_text,
            "story_pack": story_pack,
        },
        _FALLBACK,
    )

    return f"""{source_prompt}

---

# WORKFLOW UI VIDEO JUDGE ADAPTER

The source judge prompt above was loaded from `{workspace_path(SCENE_JUDGE_PROMPT)}`.
For this Workflow UI run, these adapter rules override any earlier instruction that asks for JSON validation, scene-detailer schema checks, or one mini-episode.

You receive a SERIES PREMISE, a PACKED STORY, and a VIDEO WRITER OUTPUT.

Your job is to decide whether the video beat sections faithfully split the packed story into a coherent 8-12 video series.

IMPORTANT JUDGE CONTRACT FOR THIS UI PROTOTYPE:
- The video writer output is intentionally plain text, not JSON.
- It must contain {MIN_VIDEO_BULLETS}-{MAX_VIDEO_BULLETS} VIDEO sections, not one giant episode split into micro-scenes.
- Every VIDEO section must be one separate 60-90 second episode/video concept.
- Every VIDEO section must be self-contained: it needs its own hook, conflict, escalation, two twists, and payoff.
- Return RETRY if a video requires knowledge of an older video to make sense.
- Return RETRY if videos read as chronological chapters of one episode instead of standalone stories in the same larger mythology.
- Each section must use this heading format: VIDEO 01 - Short title.
- Each VIDEO section must contain {MIN_VIDEO_BEATS}-{MAX_VIDEO_BEATS} compact beat bullets, about 15 bullets per video.
- Each VIDEO section must clearly include Twist 1 and Twist 2 / Payoff. Return RETRY if any video has fewer than two major twist beats.
- Each VIDEO section must resolve its own local story while planting one continuity clue toward the bigger picture.
- Reject if bullets are labeled as SCENE, if the board is written as timed shot beats, or if the output is really one episode split into scenes.
- The output must be compact beat bullets, not paragraphs. Return RETRY if any section rambles, has giant lines, or exceeds roughly {MAX_VIDEO_CARD_WORDS} words.
- Return RETRY if a section has fewer than {MIN_VIDEO_BEATS} beat bullets, more than {MAX_VIDEO_BEATS}, or format drift after video 3 or video 5.
- Return RETRY if the answer contains runaway lists, repeated unrelated terms, huge comma chains, or obvious context collapse.
- If the SERIES PREMISE contains a reveal, protect that reveal across the batch.
- Every VIDEO before the finale must include hints, clues, or foreshadowing toward the reveal, but must not explicitly state, show, or identify the reveal.
- The explicit reveal is allowed only in the final VIDEO section. Return RETRY if the reveal happens before the finale, or if the final VIDEO does not clearly pay it off.
- For the Mouse Crime Boss premise, return RETRY if any pre-finale VIDEO uses obvious clue language tied to the answer: small, tiny, little, miniature, mouse, rat, rodent, cheese, crumbs, squeak, nibble, whisker, tail, paw, burrow, herbivore, seed, grain, vegetarian, or anything that points directly to a mouse-sized animal.
- For the Mouse Crime Boss premise, acceptable pre-finale clues are indirect and misdirecting: impossible supply-chain timing, unsigned orders, frightened predators, missing security footage, contradictory witness stories, strange accounting patterns, hidden devices, offscreen orders, shadows, or an unseen voice. The final VIDEO must explicitly reveal the feared boss is the tiny mouse.
- Judge premise fit, season/batch variety, visual hook quality, two twists per video, PG-13 safety, and readiness for shot expansion.
- Judge coverage of the packed story: the video sections should feel like a deliberate series split, not disconnected ideas or a shallow summary.

PLOT HOLES - CHECK THIS ON EVERY VIDEO, IT IS THE EASIEST THING TO MISS:
A video can have perfect formatting, two twists, and a protected reveal and still be broken. Formatting is not logic. Work through each video's bullets in order and apply these tests literally.
- SUPPORT TEST: for each twist beat, find the earlier bullet in the SAME video that makes it possible. If nothing earlier supports it, the twist arrives from nowhere.
- KNOWLEDGE TEST: a character acts on information that no earlier bullet gave them.
- LUCK TEST: a problem is solved by coincidence, good timing, or something that happens to be lying there.
- BLIND SPOT TEST: the video only works because someone fails to ask, look, or check the obvious thing.
- ABILITY TEST: a character does something no earlier bullet established they could do.
- STAKES TEST: nothing concrete and visible is lost if the character fails.
- CONTRADICTION TEST: a bullet conflicts with the PACKED STORY or with another video - names, timeline, location, who was present, or something already established as impossible.
- VILLAIN TEST: the antagonist's scheme only survives because everyone else is slow or careless.

For each hole you find, decide whether it is MAJOR or MINOR:
- MAJOR: the video's central action does not work without it. The story breaks.
- MINOR: one beat is thin or unsupported, but the video still stands up on a first viewing.

HOW TO REPORT A HOLE (this keeps you honest):
- Only flag a hole you can point at. Quote the exact bullet and name which test it failed.
- If you cannot quote a specific bullet, do not flag it. A vague feeling that something is "unclear" or "could be tighter" is NOT a hole and must not cause RETRY.
- Do not invent holes to look strict. A video whose beats each follow from an earlier beat passes this axis, even if it is simple.
- At least two of your CHECKS bullets must be about logic, saying which tests you ran and what you found.

SCORING - USE THE FULL 0-100 SCALE:
Start at 100 and deduct. Show no mercy on the first two; they are contract violations, not opinions.
- Broken output contract (wrong heading format, wrong VIDEO count, wrong bullet count, JSON, code fences, paragraphs instead of bullets): -25 each.
- Reveal leaked before the finale, banned clue language used, or the final VIDEO fails to pay the reveal off: -30.
- MAJOR plot hole: -15 each.
- MINOR plot hole: -5 each.
- Missing or weak twist, or a twist mechanism already used elsewhere on the board: -5 each.
- Videos not standalone, thin premise fit, poor batch variety, or shallow coverage of the packed story: -5 each.
Do not floor the score at a round number to justify a verdict. Add the deductions up honestly and report what you get.

VERDICT RULE - THIS DECIDES PASS OR RETRY:
- SCORE 80 or above: PASS.
- SCORE below 80: RETRY.
- Nothing else overrides this. A board with a couple of minor holes can and should PASS at 85 or 90.
- Report every hole you found in TARGETED FIXES even when the verdict is PASS. A passing board is allowed to still have notes on it, and the next stage uses them.

- Keep your judge response short: no more than 8 CHECKS bullets and 6 TARGETED FIXES bullets.
- Return plain text only.
- Every hole you flagged must appear in TARGETED FIXES, written as an instruction the writer can act on. Say what to change, not just what is wrong.
- Use this exact format:
VERDICT: PASS or RETRY
SCORE: a number from 0 to 100
CHECKS:
- short bullets
TARGETED FIXES:
- short bullets, or "None" if you found nothing to fix

SERIES IDEA OR EPISODE BRIEF:
{story_idea.strip()}

PACKED STORY:
{story_pack.strip()}

VIDEO WRITER OUTPUT:
{scenes_text.strip()}
"""
