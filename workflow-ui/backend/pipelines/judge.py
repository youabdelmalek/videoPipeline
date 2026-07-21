"""The "Judge Again" job: re-judge the current scenes without regenerating them."""

from __future__ import annotations

import time

from backend.jobs import update_job
from backend.runs.paths import run_dir
from backend.runs.store import story_idea_path
from backend.stages import StageContext, clear_rewritten_scenes, judge_scenes_manually, rewrite_scenes
from backend.utils.file_ops import read_optional
from backend.utils.parser import extract_verdict

_NO_STORY_PACK = "No packed story artifact found. Judge against the series idea only."


def run_judge_job(job_id: str, slug: str, model: str) -> None:
    try:
        path = run_dir(slug)
        ctx = StageContext(job_id=job_id, slug=slug, path=path, model=model)

        story_idea = read_optional(story_idea_path(path))
        scenes_text = read_optional(ctx.workflow / "scenes.md")
        story_pack = read_optional(ctx.workflow / "story_pack.md") or _NO_STORY_PACK
        if not story_idea:
            raise RuntimeError("Missing story idea")
        if not scenes_text:
            raise RuntimeError("Generate videos before running the judge")

        manual_dir = ctx.workflow / "manual_judges" / f"judge_{int(time.time())}"
        output = judge_scenes_manually(ctx, story_idea, story_pack, scenes_text, manual_dir)

        if extract_verdict(output) == "PASS":
            ctx.log("Manual judge passed; rewriting final videos for coherence")
            rewrite_scenes(ctx, story_idea, story_pack, scenes_text, output, manual_dir, 1)
            update_job(job_id, "done", "Video judge passed and final videos were rewritten")
            return

        clear_rewritten_scenes(path)
        update_job(job_id, "done", "Video judge completed")
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Scene judge failed", str(exc))
