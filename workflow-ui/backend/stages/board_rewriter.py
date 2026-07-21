"""Board rewriter: sharpen twists, humour, and logic on the video bullet board.

Runs at the end of every generation, and on demand from the node. It writes to
its own file, so the original `scenes.md` draft is always preserved for
comparison.
"""

from __future__ import annotations

from pathlib import Path

from backend.prompts.board_rewriter import board_rewriter_prompt
from backend.stages.context import StageContext, run_llm_stage
from backend.utils.file_ops import write_text

BOARD_FILENAME = "rewritten_board.md"


def rewrite_board(
    ctx: StageContext,
    story_idea: str,
    story_pack: str,
    board_text: str,
    artifact_dir: Path,
    provider: str,
    model: str,
) -> str:
    ctx.log(f"Rewriting the video bullet board with {provider} ({model})")
    prompt = board_rewriter_prompt(story_idea, story_pack, board_text)

    output = run_llm_stage(
        ctx,
        artifact_dir=artifact_dir,
        name="board_rewriter",
        title="Board Rewriter",
        prompt=prompt,
        attempt=1,
        provider=provider,
        model=model,
    )

    ctx.log("Received rewritten board")
    write_text(ctx.workflow / BOARD_FILENAME, output)
    return output


def clear_rewritten_board(path: Path) -> None:
    """Drop a stale board so the UI never shows a rewrite of an older draft."""
    try:
        (path / "workflow_ui" / BOARD_FILENAME).unlink(missing_ok=True)
    except OSError:
        return
