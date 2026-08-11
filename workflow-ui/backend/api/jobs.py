"""Endpoints that start background jobs and report their progress.

Each entry in `_JOB_STAGES` is one button in the UI. To add a workflow step,
write a pipeline function and add it here.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Callable
from urllib.parse import unquote, urlparse

import requests
from fastapi import APIRouter, HTTPException

from backend.config import IMAGE_INPUT_DIR
from backend.jobs import create_job, job_response, lookup_job, submit
from backend.models import (
    BuildAssetCatalogRequest,
    BuildJsonAssetsRequest,
    BuildJsonFramesRequest,
    DetailVideosRequest,
    GenerateScenesRequest,
    FlexibleImageLlmRequest,
    FlexibleImageLlmResponse,
    FlexibleLlmRequest,
    FlexibleLlmResponse,
    JobResponse,
    JudgeScenesRequest,
    RewriteBoardRequest,
    RewriteShotsRequest,
    RunWorkflowRequest,
    StartJobResponse,
)
from backend.services.llm import llm_generate, llm_generate_with_images

router = APIRouter()

MAX_IMAGE_BYTES = 40 * 1024 * 1024

_JOB_STAGES: dict[str, str] = {
    "scene_writer_judge": "backend.pipelines.generate:run_generate_job",
    "scene_judge": "backend.pipelines.judge:run_judge_job",
    "board_rewriter": "backend.pipelines.board_rewrite:run_board_rewrite_job",
    "video_detailer": "backend.pipelines.detail_videos:run_detail_videos_job",
    "shot_rewriter": "backend.pipelines.shot_rewrite:run_shot_rewrite_job",
    "asset_catalog": "backend.pipelines.asset_catalog:run_asset_catalog_job",
    "json_assets": "backend.pipelines.json_assets:run_json_assets_job",
    "json_frames": "backend.pipelines.json_frames:run_json_frames_job",
    "workflow": "backend.pipelines.workflow:run_workflow_job",
}


def _pipeline(stage: str) -> Callable[..., None]:
    from importlib import import_module

    module_path, _, attribute = _JOB_STAGES[stage].partition(":")
    return getattr(import_module(module_path), attribute)


def _start(stage: str, slug: str, *args: object) -> StartJobResponse:
    """Queue a stage. Extra args are forwarded to the pipeline function."""
    from backend.runs.paths import run_dir

    if not run_dir(slug).exists():
        raise HTTPException(status_code=404, detail="Run not found")
    job = create_job(stage, slug)
    submit(_pipeline(stage), job.id, slug, *args)
    return StartJobResponse(job=job_response(job))


def _image_bytes_from_url(image_url: str) -> bytes:
    parsed = urlparse(image_url.strip())
    if parsed.scheme in ("http", "https"):
        path = unquote(parsed.path)
        if "/comfyui/images/" in path:
            filename = Path(path.rsplit("/comfyui/images/", 1)[1]).name
            local_path = IMAGE_INPUT_DIR / filename
            if local_path.exists() and local_path.is_file():
                data = local_path.read_bytes()
                if len(data) > MAX_IMAGE_BYTES:
                    raise HTTPException(status_code=413, detail="Image is larger than 40 MB")
                return data
        try:
            response = requests.get(image_url, timeout=60)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise HTTPException(status_code=400, detail=f"Could not fetch image URL: {exc}") from exc
        data = response.content
    else:
        filename = Path(unquote(parsed.path or image_url)).name
        local_path = IMAGE_INPUT_DIR / filename
        if not local_path.exists() or not local_path.is_file():
            raise HTTPException(status_code=404, detail=f"Image not found in input folder: {filename}")
        data = local_path.read_bytes()

    if not data:
        raise HTTPException(status_code=400, detail="Image is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 40 MB")
    return data


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


@router.post("/runs/{slug}/run-workflow", response_model=StartJobResponse)
def run_workflow(slug: str, request: RunWorkflowRequest) -> StartJobResponse:
    """Seed the composed workflow's inputs, then run its stages in order."""
    return _start("workflow", slug, request.model)


@router.post("/llm", response_model=FlexibleLlmResponse)
def flexible_llm(request: FlexibleLlmRequest) -> FlexibleLlmResponse:
    """Run one freeform prompt through the selected local LLM."""
    return FlexibleLlmResponse(
        output=llm_generate("ollama", request.model, request.prompt, request.thinking)
    )


@router.post("/image-llm", response_model=FlexibleImageLlmResponse)
def flexible_image_llm(request: FlexibleImageLlmRequest) -> FlexibleImageLlmResponse:
    """Run one prompt against an image through a local multimodal Ollama model."""
    image_b64 = base64.b64encode(_image_bytes_from_url(request.image_url)).decode("ascii")
    return FlexibleImageLlmResponse(
        output=llm_generate_with_images("ollama", request.model, request.prompt, [image_b64])
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str) -> JobResponse:
    job = lookup_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_response(job)
