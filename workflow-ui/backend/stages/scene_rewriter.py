"""Stage 4: polish the approved batch so each card reads standalone."""

from __future__ import annotations

from pathlib import Path

from backend.prompts.scene_rewriter import scene_rewriter_prompt
from backend.stages.context import StageContext, run_llm_stage
from backend.utils.file_ops import write_text


def rewrite_scenes(
    ctx: StageContext,
    story_idea: str,
    story_pack: str,
    scenes_text: str,
    judge_output: str,
    artifact_dir: Path,
    attempt: int,
) -> str:
    """Rewrite the approved videos after the LLM judge has accepted the board."""
    prompt = scene_rewriter_prompt(story_idea, story_pack, scenes_text, judge_output)
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name="scene_rewriter",
        title="Scene Rewriter",
        prompt=prompt,
        attempt=attempt,
    )

    write_text(ctx.workflow / "rewritten_scenes.md", output)
    return output


def clear_rewritten_scenes(path: Path) -> None:
    """Drop a stale rewrite so the UI never shows a final cut that no longer applies."""
    try:
        (path / "workflow_ui" / "rewritten_scenes.md").unlink(missing_ok=True)
    except OSError:
        return
