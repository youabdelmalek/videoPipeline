"""Shot writer: expand one board video into a timed, generation-ready shot list.

Runs on the local model. The duration arithmetic is the part small models get
wrong most often, so a rejected attempt is retried with the specific failures
fed back in rather than failing the video outright.
"""

from __future__ import annotations

from pathlib import Path

from backend.models import MAX_SHOT_ATTEMPTS, SceneCard
from backend.prompts.shot_judge import shot_judge_prompt
from backend.prompts.shot_writer import shot_writer_prompt
from backend.runs.shots import shot_file, shot_file_body
from backend.stages.context import StageContext, run_llm_stage
from backend.utils.file_ops import write_text
from backend.utils.parser import extract_score, extract_verdict, parse_shot_cards, total_shot_seconds


def detail_video(
    ctx: StageContext,
    story_idea: str,
    story_pack: str,
    video: SceneCard,
    artifact_dir: Path,
) -> int:
    """Write one video's shot list to disk and return how many shots it holds."""
    feedback: str | None = None
    best_output = ""
    best_judge = ""
    best_score = -1
    best_attempt = 0
    last_issues = "the shot list did not meet the contract"

    for attempt in range(1, MAX_SHOT_ATTEMPTS + 1):
        label = f"VIDEO {video.index:02d} attempt {attempt}/{MAX_SHOT_ATTEMPTS}"
        ctx.log(f"{label}: designing shots for '{video.title}'")

        prompt = shot_writer_prompt(
            story_idea, story_pack, video.index, video.title, video.body, feedback
        )
        output = run_llm_stage(
            ctx,
            artifact_dir=artifact_dir,
            name=f"shot_writer_video_{video.index:02d}",
            title=f"Shot Writer - Video {video.index:02d}",
            prompt=prompt,
            attempt=attempt,
            stage="shot_writer",
        )

        judge_prompt = shot_judge_prompt(
            story_idea, story_pack, video.index, video.title, video.body, output
        )
        judge_output = run_llm_stage(
            ctx,
            artifact_dir=artifact_dir,
            name=f"shot_judge_video_{video.index:02d}",
            title=f"Shot Judge - Video {video.index:02d}",
            prompt=judge_prompt,
            attempt=attempt,
            stage="shot_judge",
        )
        verdict = extract_verdict(judge_output)
        score = extract_score(judge_output)
        if score > best_score:
            best_output = output
            best_judge = judge_output
            best_score = score
            best_attempt = attempt
        if verdict == "PASS":
            shots = parse_shot_cards(output)
            total = total_shot_seconds(shots)
            ctx.log(f"{label}: LLM judge accepted {len(shots)} parsed shots totalling {total}s")
            write_text(
                shot_file(ctx.workflow, video.index),
                shot_file_body(video.index, video.title, output),
            )
            write_text(ctx.workflow / "shot_judges" / f"video_{video.index:02d}.md", judge_output)
            return len(shots)

        last_issues = judge_output.strip() or "the LLM shot judge requested a retry"
        ctx.log(f"{label}: LLM judge returned {verdict or 'no verdict'} with score {score}")
        feedback = last_issues

    shots = parse_shot_cards(best_output)
    total = total_shot_seconds(shots)
    ctx.log(
        f"VIDEO {video.index:02d}: keeping best shot attempt {best_attempt} "
        f"with score {best_score}, {len(shots)} parsed shots totalling {total}s"
    )
    write_text(
        shot_file(ctx.workflow, video.index),
        shot_file_body(video.index, video.title, best_output),
    )
    write_text(ctx.workflow / "shot_judges" / f"video_{video.index:02d}.md", best_judge)
    return len(shots)


def clear_detailed_videos(workflow: Path, indexes: list[int]) -> None:
    """Drop the shot lists we are about to rewrite, so a failure cannot look like success."""
    for index in indexes:
        for rewritten in (False, True):
            try:
                shot_file(workflow, index, rewritten).unlink(missing_ok=True)
            except OSError:
                continue
