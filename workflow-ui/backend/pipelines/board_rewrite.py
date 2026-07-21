"""The "Rewrite Board" job: one pass over the video bullet board, on demand."""

from __future__ import annotations

import time

from backend.jobs import update_job
from backend.runs.paths import run_dir
from backend.runs.store import story_idea_path
from backend.services.llm import default_model_for
from backend.stages import StageContext, rewrite_board
from backend.utils.file_ops import read_optional

_NO_STORY_PACK = "No packed story artifact found. Improve the board against the series idea only."


def run_board_rewrite_job(job_id: str, slug: str, model: str, provider: str) -> None:
    try:
        used_model = model or default_model_for(provider)
        path = run_dir(slug)
        ctx = StageContext(job_id=job_id, slug=slug, path=path, model=used_model, provider=provider)

        story_idea = read_optional(story_idea_path(path))
        board_text = read_optional(ctx.workflow / "scenes.md")
        story_pack = read_optional(ctx.workflow / "story_pack.md") or _NO_STORY_PACK
        if not story_idea:
            raise RuntimeError("Missing story idea")
        if not board_text:
            raise RuntimeError("Generate videos before rewriting the board")

        artifact_dir = ctx.workflow / "board_rewrites" / f"rewrite_{int(time.time())}"
        rewrite_board(ctx, story_idea, story_pack, board_text, artifact_dir, provider, used_model)

        update_job(job_id, "done", f"Video bullet board rewritten with {provider} ({used_model})")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Board rewriter failed", str(exc))
