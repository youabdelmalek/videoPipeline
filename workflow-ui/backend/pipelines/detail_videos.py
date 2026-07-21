"""The "Detail Videos" job: expand selected board videos into shot lists."""

from __future__ import annotations

import time
from pathlib import Path

from backend.jobs import update_job
from backend.runs.paths import run_dir
from backend.runs.store import story_idea_path
from backend.stages import StageContext, clear_detailed_videos, detail_video
from backend.utils.file_ops import read_optional
from backend.utils.parser import parse_scene_cards

_NO_STORY_PACK = "No packed story artifact found. Work from the series idea and the video below only."


def source_board(workflow: Path) -> str:
    """The best board available: the polished one, else the judged draft."""
    return read_optional(workflow / "rewritten_board.md") or read_optional(workflow / "scenes.md") or ""


def run_detail_videos_job(job_id: str, slug: str, model: str, video_indexes: list[int]) -> None:
    try:
        path = run_dir(slug)
        ctx = StageContext(job_id=job_id, slug=slug, path=path, model=model)

        story_idea = read_optional(story_idea_path(path))
        if not story_idea:
            raise RuntimeError("Missing story idea")

        board_text = source_board(ctx.workflow)
        if not board_text:
            raise RuntimeError("Generate videos before detailing them")

        story_pack = read_optional(ctx.workflow / "story_pack.md") or _NO_STORY_PACK
        cards = parse_scene_cards(board_text)
        if not cards:
            raise RuntimeError("The board has no VIDEO sections to detail")

        wanted = set(video_indexes)
        selected = [card for card in cards if not wanted or card.index in wanted]
        if not selected:
            available = ", ".join(str(card.index) for card in cards)
            raise RuntimeError(f"None of the selected videos exist on the board. Available: {available}")

        clear_detailed_videos(ctx.workflow, [card.index for card in selected])
        artifact_dir = ctx.workflow / "shot_details" / f"detail_{int(time.time())}"

        failures: list[str] = []
        detailed = 0
        for position, card in enumerate(selected, start=1):
            ctx.log(f"Video {position}/{len(selected)}: starting VIDEO {card.index:02d}")
            try:
                detail_video(ctx, story_idea, story_pack, card, artifact_dir)
                detailed += 1
            except Exception as exc:  # noqa: BLE001 - one bad video must not sink the batch.
                ctx.log(f"VIDEO {card.index:02d} failed: {exc}")
                failures.append(f"VIDEO {card.index:02d}: {exc}")

        if detailed == 0:
            raise RuntimeError("No videos were detailed. " + " | ".join(failures))

        message = f"Detailed {detailed}/{len(selected)} videos into shot lists"
        if failures:
            update_job(job_id, "done", f"{message}; {len(failures)} failed", " | ".join(failures))
            return
        update_job(job_id, "done", message)
    except Exception as exc:  # noqa: BLE001 - surface job errors to the UI.
        update_job(job_id, "error", "Video detailer failed", str(exc))
