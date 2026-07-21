"""LLM judge for one video's shot list."""

from __future__ import annotations

from backend.models import MAX_SHOTS, MAX_VIDEO_SECONDS, MIN_SHOTS, MIN_VIDEO_SECONDS


def shot_judge_prompt(
    story_idea: str,
    story_pack: str,
    video_index: int,
    video_title: str,
    video_body: str,
    shot_list: str,
) -> str:
    return f"""You are the Shot List Judge for an AI-video workflow.

Judge whether ONE video's shot list is ready for image/video generation. Use
story logic and visual continuity, not brittle formatting tricks.

SERIES PREMISE:
{story_idea.strip()}

PACKED STORY:
{story_pack.strip()}

SOURCE VIDEO - VIDEO {video_index:02d} - {video_title.strip()}:
{video_body.strip()}

SHOT LIST TO JUDGE:
{shot_list.strip()}

WHAT A PASSING SHOT LIST NEEDS:
- It covers the source video's hook, conflict, escalation, Twist 1, Twist 2 / Payoff, standalone payoff, and continuity clue.
- It has roughly {MIN_SHOTS}-{MAX_SHOTS} shots and feels like a {MIN_VIDEO_SECONDS}-{MAX_VIDEO_SECONDS} second video.
- Shot durations may vary if the total pacing feels right.
- Every shot is one continuous camera setup with one location, one cast, and small renderable action.
- Each shot names visible characters, important props, background, camera, action, setting, and light clearly enough for generation.
- The sequence has strong visual variety: wide, medium, close, inserts, high/low angles, and a memorable first and last image.
- It does not invent plot that contradicts the source video or the packed story.

RETURN RETRY FOR:
- Missing or scrambled story beats.
- Too few or too many shots for a 60-90 second short.
- Shots that combine multiple cuts, locations, or big multi-step actions.
- Repeated near-identical frames that would generate boring footage.
- Continuity contradictions in character appearance, locations, props, time of day, or reveal protection.
- Missing camera/action/setting/light information often enough that generation would be unreliable.

OUTPUT CONTRACT:
- Start with exactly: VERDICT: PASS or VERDICT: RETRY
- Then write concise bullets.
- If RETRY, make each bullet a concrete instruction the shot writer can apply.
"""
