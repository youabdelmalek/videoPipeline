"""Judge the video batch on demand and return a PASS/RETRY report."""

from __future__ import annotations

from pathlib import Path

from backend.prompts.scene_judge import scene_judge_prompt
from backend.stages.context import StageContext, run_llm_stage
from backend.utils.file_ops import write_text


def judge_scenes_manually(
    ctx: StageContext,
    story_idea: str,
    story_pack: str,
    scenes_text: str,
    artifact_dir: Path,
) -> str:
    """Judge on demand, when the user presses "Judge Again"."""
    ctx.log("Preparing manual video judge prompt")
    ctx.log(f"Ollama is judging video beat sections with {ctx.model}")
    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name="scene_judge",
        title="Manual Scene Judge",
        prompt=scene_judge_prompt(story_idea, story_pack, scenes_text),
        attempt=1,
        stage="scene_judge_manual",
    )
    write_text(ctx.workflow / "scene_judge.md", output)
    ctx.log("Received manual video judge response")
    return output
