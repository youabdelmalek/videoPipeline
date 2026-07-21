"""Prompts for the current end-to-end story-to-frame workflow."""

from __future__ import annotations

from backend.models import MAX_SHOTS, MAX_VIDEO_BULLETS, MIN_SHOTS, MIN_VIDEO_BULLETS


def prompt_enhancer_prompt(user_prompt: str) -> str:
    return f"""You are the Prompt Enhancer Agent.

Turn the user's raw idea into a vivid production brief for a short-form series.
Make it light, funny, scandalous, absurd, and emotionally messy without losing
the user's core premise.

RAW USER PROMPT:
{user_prompt.strip()}

ENHANCE FOR:
- animal-people society with clear power dynamics
- romantic mess, love triangles, betrayals, rumors, status games, and public scandals
- multiple twists per story, including one huge unnatural twist that feels shocking but earned
- comedy from serious characters reacting to absurd situations
- visual specificity: places, props, character types, costumes, recurring symbols
- a larger mystery that can be watched as standalone short videos or as one big story

OUTPUT:
Plain text only. Write a detailed enhanced prompt with sections:
ENHANCED PREMISE
TONE
WORLD
CHARACTER DRAMA
SCANDALS AND LOVE TRIANGLES
TWIST ENGINE
VISUAL MOTIFS
FINALE PROMISE
"""


def small_story_generator_prompt(
    enhanced_prompt: str,
    previous_story: str | None = None,
    judge_feedback: str | None = None,
) -> str:
    retry = ""
    if previous_story or judge_feedback:
        retry = f"""
PREVIOUS STORY TO IMPROVE:
{(previous_story or '').strip()}

JUDGE FEEDBACK:
{(judge_feedback or '').strip()}

Improve the weak parts while keeping the strongest story material.
"""

    return f"""You are the Small Story Generator Agent.

Create multiple small scandal-comedy stories that build into one full season
story. Each small story must be fun alone, but together they reveal a bigger
truth.

ENHANCED PROMPT:
{enhanced_prompt.strip()}
{retry}
REQUIREMENTS:
- Write 8-12 small stories.
- Every small story has a hook, absurd scandal, love/loyalty complication, Twist 1, Twist 2, and a payoff.
- The small stories must connect into one full story arc with escalating stakes.
- Use animal-people behavior as social logic, not decoration.
- Include a huge unnatural twist near the end that reframes the whole season.
- Keep the explicit final reveal protected until the finale section.

OUTPUT:
Plain text only. No JSON. Use sections:
FULL STORY ARC
SMALL STORY 01 - Title
...
FINALE
"""


def story_judge_prompt(enhanced_prompt: str, story_text: str) -> str:
    return f"""You are the Story Judge Agent.

Score the story candidate. This workflow keeps the best score from five tries,
so never fail the job. Judge honestly and give useful feedback.

ENHANCED PROMPT:
{enhanced_prompt.strip()}

STORY CANDIDATE:
{story_text.strip()}

JUDGE FOR:
- Light, funny, scandalous tone.
- Love triangles, betrayals, rumors, absurd animal-people society.
- Multiple twists in each small story.
- A huge unnatural twist that is shocking but earned.
- Strong full-story arc built from standalone small stories.
- Reveal protection and finale payoff.
- Visual richness for later video and shot agents.

OUTPUT FORMAT:
VERDICT: PASS or RETRY
SCORE: 0-100
CHECKS:
- concise bullets
TARGETED FIXES:
- concise bullets
"""


def story_separator_prompt(
    enhanced_prompt: str,
    full_story: str,
    previous_board: str | None = None,
    judge_feedback: str | None = None,
) -> str:
    retry = ""
    if previous_board or judge_feedback:
        retry = f"""
PREVIOUS SEPARATION:
{(previous_board or '').strip()}

JUDGE FEEDBACK:
{(judge_feedback or '').strip()}
"""

    return f"""You are the Story Separator Agent.

Separate the full story into standalone short videos. Each video can be watched
alone, but watching every video reveals the bigger story.

ENHANCED PROMPT:
{enhanced_prompt.strip()}

FULL STORY:
{full_story.strip()}
{retry}
REQUIREMENTS:
- Write {MIN_VIDEO_BULLETS}-{MAX_VIDEO_BULLETS} VIDEO sections.
- Every VIDEO has its own hook, scandal, character conflict, Twist 1, Twist 2 / Payoff, and standalone payoff.
- Every VIDEO plants one clue for the larger story without requiring previous videos.
- The final VIDEO pays off the huge unnatural twist.
- Keep titles specific and funny.

OUTPUT:
Plain text only. Use headings: VIDEO 01 - Short title
Under each heading, write compact bullets.
"""


def separator_judge_prompt(enhanced_prompt: str, full_story: str, board_text: str) -> str:
    return f"""You are the Separator Judge Agent.

Score this separated video board. This workflow keeps the best score from five
tries and continues with the best result.

ENHANCED PROMPT:
{enhanced_prompt.strip()}

FULL STORY:
{full_story.strip()}

VIDEO BOARD:
{board_text.strip()}

JUDGE FOR:
- {MIN_VIDEO_BULLETS}-{MAX_VIDEO_BULLETS} standalone videos.
- Each video is watchable alone but contributes to one bigger story.
- No video depends on previous-video knowledge.
- Strong scandal/comedy/love-triangle/animal-person dynamics.
- Multiple twists and a final huge unnatural payoff.
- Clear enough structure for shot generation.

OUTPUT FORMAT:
VERDICT: PASS or RETRY
SCORE: 0-100
CHECKS:
- concise bullets
TARGETED FIXES:
- concise bullets
"""


def frame_delta_prompt(
    all_shots: str,
    asset_catalog: str,
    previous_output: str | None = None,
    judge_feedback: str | None = None,
    asset_states: str | None = None,
    required_refs: list[str] | None = None,
) -> str:
    coverage = ""
    if required_refs:
        coverage = f"""
YOU MUST WRITE AN ENTRY FOR EVERY ONE OF THESE {len(required_refs)} SHOTS:
{" ".join(required_refs)}

Write them in this order. Do not stop early, do not skip a shot, and do not
summarise. If you are running long, keep each entry shorter - but every shot
above must appear.
"""

    states = ""
    if asset_states and asset_states.strip():
        states = f"""
ASSET STATES:
Each asset below has a fixed set of states. Whenever one of these assets is
visible in a frame, name the state you mean, like "Vault Door (closed)". Use only
the states listed here; if the shot does not call for a specific state, use the
first one.
{asset_states.strip()}
"""

    retry = ""
    if previous_output or judge_feedback:
        retry = f"""
PREVIOUS FRAME PLAN:
{(previous_output or '').strip()}

JUDGE FEEDBACK:
{(judge_feedback or '').strip()}
"""
    return f"""You are the Shot Frame Delta Agent.

For every shot, write a short first-frame description, last-frame description,
and delta. Use only the character names, places, and props from the asset list.
Do not create new characters, places, or props.

ALL SHOTS:
{all_shots.strip()}

ASSET LIST:
{asset_catalog.strip()}
{states}{coverage}{retry}
OUTPUT:
Plain text only. For every shot:
V01S01 - Shot title
- First frame: one concise visual description.
- Last frame: one concise visual description.
- Delta: what changes between first and last frame.
"""


def frame_delta_judge_prompt(all_shots: str, asset_catalog: str, frame_plan: str) -> str:
    return f"""You are the Frame Delta Judge Agent.

Score the frame plan. This workflow keeps the best score from five tries.

ALL SHOTS:
{all_shots.strip()}

ASSET LIST:
{asset_catalog.strip()}

FRAME PLAN:
{frame_plan.strip()}

JUDGE FOR:
- Every shot has first frame, last frame, and delta.
- It uses character names, places, and props from the asset list.
- It does not invent new characters, places, or props.
- The first and last frames reflect the shot action.
- Deltas are small, filmable changes.
- Continuity stays consistent across shots.

OUTPUT FORMAT:
VERDICT: PASS or RETRY
SCORE: 0-100
CHECKS:
- concise bullets
TARGETED FIXES:
- concise bullets
"""
