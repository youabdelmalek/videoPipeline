"""Stages for the current prompt-to-frame workflow."""

from __future__ import annotations

from pathlib import Path

from backend.prompts.full_workflow import (
    prompt_enhancer_prompt,
    separator_judge_prompt,
    small_story_generator_prompt,
    story_judge_prompt,
    story_separator_prompt,
)
from backend.stages.context import StageContext, run_llm_stage


def enhance_prompt(ctx: StageContext, user_prompt: str, artifact_dir: Path) -> str:
    ctx.log("Prompt enhancer: adding story fuel")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name="prompt_enhancer",
        title="Prompt Enhancer",
        prompt=prompt_enhancer_prompt(user_prompt),
        attempt=1,
        stage="prompt_enhancer",
    )


def generate_small_stories(
    ctx: StageContext,
    enhanced_prompt: str,
    artifact_dir: Path,
    attempt: int,
    previous_story: str | None,
    judge_feedback: str | None,
) -> str:
    ctx.log(f"Small story generator attempt {attempt}: building connected stories")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"small_story_generator_attempt_{attempt:02d}",
        title="Small Story Generator",
        prompt=small_story_generator_prompt(enhanced_prompt, previous_story, judge_feedback),
        attempt=attempt,
        stage="small_story_generator",
    )


def judge_story(ctx: StageContext, enhanced_prompt: str, story_text: str, artifact_dir: Path, attempt: int) -> str:
    ctx.log(f"Story judge attempt {attempt}: scoring story")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"story_judge_attempt_{attempt:02d}",
        title="Story Judge",
        prompt=story_judge_prompt(enhanced_prompt, story_text),
        attempt=attempt,
        stage="story_judge",
    )


def separate_story(
    ctx: StageContext,
    enhanced_prompt: str,
    full_story: str,
    artifact_dir: Path,
    attempt: int,
    previous_board: str | None,
    judge_feedback: str | None,
) -> str:
    ctx.log(f"Story separator attempt {attempt}: making standalone videos")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"story_separator_attempt_{attempt:02d}",
        title="Story Separator",
        prompt=story_separator_prompt(enhanced_prompt, full_story, previous_board, judge_feedback),
        attempt=attempt,
        stage="story_separator",
    )


def judge_separator(
    ctx: StageContext,
    enhanced_prompt: str,
    full_story: str,
    board_text: str,
    artifact_dir: Path,
    attempt: int,
) -> str:
    ctx.log(f"Separator judge attempt {attempt}: scoring video board")
    return run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"separator_judge_attempt_{attempt:02d}",
        title="Separator Judge",
        prompt=separator_judge_prompt(enhanced_prompt, full_story, board_text),
        attempt=attempt,
        stage="separator_judge",
    )
