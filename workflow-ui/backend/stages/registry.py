"""What each stage consumes and produces, and how to run it.

One source of truth for the whole feature: the API serves this to the canvas so
port names are never written twice, and the workflow runner uses it to order
stages and to tell you what a stage is still missing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from backend.models import StageInfo


@dataclass(frozen=True)
class StageContract:
    id: str
    label: str
    description: str
    #: Port ids this stage reads before it can run.
    inputs: tuple[str, ...]
    #: Port ids this stage writes.
    outputs: tuple[str, ...]
    #: Import path of the job, resolved lazily to keep this module import-cheap.
    job: str
    #: Extra positional arguments the job takes after (job_id, slug, model).
    extra_args: tuple[object, ...] = field(default_factory=tuple)


STAGES: dict[str, StageContract] = {
    stage.id: stage
    for stage in (
        StageContract(
            "prompt_enhancer", "Prompt Enhancer",
            "Expands a story idea into a fuller prompt.",
            ("story_idea",), ("enhanced_prompt",),
            "backend.pipelines.solo:run_prompt_enhancer_job",
        ),
        StageContract(
            "small_stories", "Small Story Generator",
            "Writes the connected small stories, judged best-of-N.",
            ("enhanced_prompt",), ("story",),
            "backend.pipelines.solo:run_small_stories_job",
        ),
        StageContract(
            "story_separator", "Video Splitter",
            "Splits the story into standalone videos.",
            ("enhanced_prompt", "story"), ("video_board",),
            "backend.pipelines.solo:run_story_separator_job",
        ),
        StageContract(
            "board_rewriter", "Board Rewriter",
            "Polishes the video board in one pass.",
            ("story_idea", "video_board"), ("video_board",),
            "backend.pipelines.board_rewrite:run_board_rewrite_job",
            ("ollama",),
        ),
        StageContract(
            "video_detailer", "Shots Splitter",
            "Expands each video into a timed shot list.",
            ("story_idea", "video_board"), ("shots",),
            "backend.pipelines.detail_videos:run_detail_videos_job",
            ([],),
        ),
        StageContract(
            "asset_catalog", "Asset Catalog",
            "Extracts and describes backgrounds, props, and characters.",
            ("story_idea", "shots"), ("asset_catalog",),
            "backend.pipelines.asset_catalog:run_asset_catalog_job",
            ("",),
        ),
        StageContract(
            "json_assets", "JsonAssets",
            "Turns each catalog asset into a JSON generation spec.",
            ("story_idea", "shots", "asset_catalog"), ("asset_specs",),
            "backend.pipelines.json_assets:run_json_assets_job",
            ("",),
        ),
        StageContract(
            "frame_deltas", "First / Last Frame + Delta",
            "Describer, asset picker, and frame writer, per shot.",
            ("shots", "asset_specs"), ("frame_plan",),
            "backend.pipelines.solo:run_frame_deltas_job",
        ),
        StageContract(
            "json_frames", "JsonFrames",
            "Writes a first/last frame JSON image prompt for every shot.",
            ("frame_plan", "asset_specs", "shots"), ("frame_prompts",),
            "backend.pipelines.json_frames:run_json_frames_job",
            ("",),
        ),
    )
}

#: `asset_catalog` is produced as a side effect of seeding assets, so a pasted
#: `asset_specs` satisfies it too.
PORT_ALIASES: dict[str, tuple[str, ...]] = {"asset_catalog": ("asset_specs",)}


def resolve_job(stage_id: str) -> Callable[..., None]:
    """Import a stage's job on demand, so the registry stays free of cycles."""
    from importlib import import_module

    module_path, _, attribute = STAGES[stage_id].job.partition(":")
    return getattr(import_module(module_path), attribute)


def stage_infos() -> list[StageInfo]:
    return [
        StageInfo(
            id=stage.id,
            label=stage.label,
            description=stage.description,
            inputs=list(stage.inputs),
            outputs=list(stage.outputs),
        )
        for stage in STAGES.values()
    ]
