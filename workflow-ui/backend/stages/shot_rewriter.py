"""Shot rewriter: polish one already-detailed video on the configured provider."""

from __future__ import annotations

from pathlib import Path

from backend.models import DetailedVideo
from backend.prompts.shot_rewriter import shot_rewriter_prompt
from backend.runs.shots import shot_file, shot_file_body
from backend.stages.context import StageContext, run_llm_stage
from backend.utils.file_ops import write_text


def rewrite_video_shots(
    ctx: StageContext,
    story_idea: str,
    story_pack: str,
    video: DetailedVideo,
    artifact_dir: Path,
    provider: str,
    model: str,
) -> None:
    """Polish one shot list and write it to the rewritten folder."""
    ctx.log(f"VIDEO {video.index:02d}: polishing {len(video.shots)} shots with {provider} ({model})")

    prompt = shot_rewriter_prompt(
        story_idea,
        story_pack,
        video.index,
        video.title,
        video.text,
        len(video.shots),
        video.total_seconds,
    )
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name=f"shot_rewriter_video_{video.index:02d}",
        title=f"Shot Rewriter - Video {video.index:02d}",
        prompt=prompt,
        attempt=1,
        stage="shot_rewriter",
        provider=provider,
        model=model,
    )

    write_text(
        shot_file(ctx.workflow, video.index, rewritten=True),
        shot_file_body(video.index, video.title, output),
    )


def clear_rewritten_shots(workflow: Path, indexes: list[int]) -> None:
    """Drop stale polishes so the UI never shows a rewrite of an older shot list."""
    for index in indexes:
        try:
            shot_file(workflow, index, rewritten=True).unlink(missing_ok=True)
        except OSError:
            continue
