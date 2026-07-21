"""Endpoints that start background jobs and report their progress.

Each entry in `_JOB_STAGES` is one button in the UI. To add a workflow step,
write a pipeline function and add it here.
"""

from __future__ import annotations

from typing import Callable

from fastapi import APIRouter, HTTPException

from backend.jobs import create_job, job_response, lookup_job, submit
from backend.models import (
    BuildAssetCatalogRequest,
    BuildJsonAssetsRequest,
    BuildJsonFramesRequest,
    DetailVideosRequest,
    GenerateScenesRequest,
    JobResponse,
    JudgeScenesRequest,
    RewriteBoardRequest,
    RewriteShotsRequest,
    StartJobResponse,
)
from backend.pipelines import (
    run_asset_catalog_job,
    run_board_rewrite_job,
    run_detail_videos_job,
    run_generate_job,
    run_json_assets_job,
    run_json_frames_job,
    run_judge_job,
    run_shot_rewrite_job,
)
from backend.runs.paths import run_dir

router = APIRouter()

_JOB_STAGES: dict[str, Callable[..., None]] = {
    "scene_writer_judge": run_generate_job,
    "scene_judge": run_judge_job,
    "board_rewriter": run_board_rewrite_job,
    "video_detailer": run_detail_videos_job,
    "shot_rewriter": run_shot_rewrite_job,
    "asset_catalog": run_asset_catalog_job,
    "json_assets": run_json_assets_job,
    "json_frames": run_json_frames_job,
}


def _start(stage: str, slug: str, *args: object) -> StartJobResponse:
    """Queue a stage. Extra args are forwarded to the pipeline function."""
    if not run_dir(slug).exists():
        raise HTTPException(status_code=404, detail="Run not found")
    job = create_job(stage, slug)
    submit(_JOB_STAGES[stage], job.id, slug, *args)
    return StartJobResponse(job=job_response(job))


@router.post("/runs/{slug}/generate-scenes", response_model=StartJobResponse)
def generate_scenes(slug: str, request: GenerateScenesRequest) -> StartJobResponse:
    return _start("scene_writer_judge", slug, request.model)


@router.post("/runs/{slug}/judge-scenes", response_model=StartJobResponse)
def judge_scenes(slug: str, request: JudgeScenesRequest) -> StartJobResponse:
    return _start("scene_judge", slug, request.model)


@router.post("/runs/{slug}/rewrite-board", response_model=StartJobResponse)
def rewrite_board(slug: str, request: RewriteBoardRequest) -> StartJobResponse:
    return _start("board_rewriter", slug, request.model, request.provider)


@router.post("/runs/{slug}/detail-videos", response_model=StartJobResponse)
def detail_videos(slug: str, request: DetailVideosRequest) -> StartJobResponse:
    return _start("video_detailer", slug, request.model, request.video_indexes)


@router.post("/runs/{slug}/rewrite-shots", response_model=StartJobResponse)
def rewrite_shots(slug: str, request: RewriteShotsRequest) -> StartJobResponse:
    return _start("shot_rewriter", slug, request.model, request.provider, request.video_indexes)


@router.post("/runs/{slug}/asset-catalog", response_model=StartJobResponse)
def build_asset_catalog(slug: str, request: BuildAssetCatalogRequest) -> StartJobResponse:
    return _start("asset_catalog", slug, request.model, request.item_id)


@router.post("/runs/{slug}/json-assets", response_model=StartJobResponse)
def build_json_assets(slug: str, request: BuildJsonAssetsRequest) -> StartJobResponse:
    return _start("json_assets", slug, request.model, request.item_id)


@router.post("/runs/{slug}/json-frames", response_model=StartJobResponse)
def build_json_frames(slug: str, request: BuildJsonFramesRequest) -> StartJobResponse:
    return _start("json_frames", slug, request.model, request.shot_ref)


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str) -> JobResponse:
    job = lookup_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_response(job)
