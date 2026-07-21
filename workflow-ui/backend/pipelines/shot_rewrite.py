"""The "Rewrite Shots" job: polish selected shot lists on the local Ollama model."""

from __future__ import annotations

import time

from backend.jobs import update_job
from backend.runs.paths import run_dir
from backend.runs.shots import load_detailed_videos
from backend.runs.store import story_idea_path
from backend.services.llm import default_model_for
from backend.stages import StageContext, clear_rewritten_shots, rewrite_video_shots
from backend.utils.file_ops import read_optional

_NO_STORY_PACK = "No packed story artifact found. Work from the series idea and the shot list only."


def run_shot_rewrite_job(
    job_id: str, slug: str, model: str, provider: str, video_indexes: list[int]
) -> None:
    try:
        used_model = model or default_model_for(provider)
        path = run_dir(slug)
        ctx = StageContext(job_id=job_id, slug=slug, path=path, model=used_model, provider=provider)

        story_idea = read_optional(story_idea_path(path))
        if not story_idea:
            raise RuntimeError("Missing story idea")

        available = load_detailed_videos(ctx.workflow)
        if not available:
            raise RuntimeError("Detail some videos before rewriting their shots")

        story_pack = read_optional(ctx.workflow / "story_pack.md") or _NO_STORY_PACK
        wanted = set(video_indexes)
        selected = [video for video in available if not wanted or video.index in wanted]
        if not selected:
            have = ", ".join(str(video.index) for video in available)
            raise RuntimeError(f"None of the selected videos have a shot list. Detailed: {have}")

        clear_rewritten_shots(ctx.workflow, [video.index for video in selected])
        artifact_dir = ctx.workflow / "shot_rewrites" / f"rewrite_{int(time.time())}"

        failures: list[str] = []
        polished = 0
        for position, video in enumerate(selected, start=1):
            ctx.log(f"Video {position}/{len(selected)}: polishing VIDEO {video.index:02d}")
            try:
                rewrite_video_shots(
                    ctx, story_idea, story_pack, video, artifact_dir, provider, used_model
                )
                polished += 1
            except Exception as exc:  # noqa: BLE001 - one bad polish must not sink the batch.
                ctx.log(f"VIDEO {video.index:02d} polish failed: {exc}")
                failures.append(f"VIDEO {video.index:02d}: {exc}")

        if polished == 0:
            raise RuntimeError("No shot lists were rewritten. " + " | ".join(failures))

        message = f"Rewrote {polished}/{len(selected)} shot lists with {provider} ({used_model})"
        if failures:
            update_job(job_id, "done", f"{message}; {len(failures)} failed", " | ".join(failures))
            return
        update_job(job_id, "done", message)
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Shot rewriter failed", str(exc))
