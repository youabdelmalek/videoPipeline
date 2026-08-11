"""Image reference and ComfyUI generation endpoints for flexible workflows."""

from __future__ import annotations

import base64
import mimetypes
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import requests
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from backend.config import COMFYUI_SERVER, IMAGE_INPUT_DIR, workspace_path
from backend.models import (
    AspectRatio,
    ComfyImageInfo,
    ComfyImageListResponse,
    GenerateComfyImageRequest,
    GenerateComfyImageResponse,
    UploadComfyImageRequest,
    UploadComfyImageResponse,
)

router = APIRouter()

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
MIME_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
}
MAX_UPLOAD_BYTES = 40 * 1024 * 1024
ASPECT_RATIO_DIMENSIONS: dict[AspectRatio, tuple[int, int]] = {
    "1:1": (1024, 1024),
    "4:3": (1024, 768),
    "3:4": (768, 1024),
    "16:9": (1152, 648),
    "9:16": (648, 1152),
    "3:2": (1152, 768),
    "2:3": (768, 1152),
}


def ensure_input_dir() -> Path:
    IMAGE_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    return IMAGE_INPUT_DIR


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]


def image_url(request: Request, filename: str) -> str:
    return str(request.url_for("get_comfy_image", filename=filename))


def image_info(request: Request, path: Path) -> ComfyImageInfo:
    stat = path.stat()
    return ComfyImageInfo(
        name=path.name,
        url=image_url(request, path.name),
        size_bytes=stat.st_size,
        updated_at=stat.st_mtime,
    )


def display_path(path: Path) -> str:
    try:
        return workspace_path(path)
    except ValueError:
        return str(path)


def safe_stem(value: str) -> str:
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip(".-_")
    return stem[:80] or "reference"


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    header, separator, payload = data_url.partition(",")
    if not separator:
        raise HTTPException(status_code=400, detail="Upload must be a data URL")
    match = re.match(r"data:([^;]+);base64$", header)
    if not match:
        raise HTTPException(status_code=400, detail="Upload must be base64-encoded image data")
    mime_type = match.group(1).lower()
    if not mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload must be an image")
    try:
        data = base64.b64decode(payload, validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Upload contains invalid base64 data") from exc
    if not data:
        raise HTTPException(status_code=400, detail="Upload is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Upload is larger than 40 MB")
    return data, mime_type


def upload_filename(original: str, mime_type: str) -> str:
    suffix = Path(original).suffix.lower()
    if suffix not in IMAGE_EXTENSIONS:
        suffix = MIME_EXTENSIONS.get(mime_type, ".png")
    return f"{safe_stem(Path(original).stem)}_{timestamp()}{suffix}"


def resolve_image_path(reference: str) -> Path:
    parsed = urlparse(reference.strip())
    name = Path(unquote(parsed.path if parsed.scheme else reference)).name
    if not name:
        raise HTTPException(status_code=400, detail="Reference image is required")
    if Path(name).suffix.lower() not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Reference image must be an image file")
    path = ensure_input_dir() / name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"Reference image not found in input folder: {name}")
    return path


def comfy_request(method: str, url: str, **kwargs: Any) -> requests.Response:
    try:
        response = requests.request(method, url, **kwargs)
        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"ComfyUI request failed: {exc}") from exc


def upload_to_comfy(server: str, image_path: Path) -> str:
    with image_path.open("rb") as handle:
        response = comfy_request(
            "POST",
            f"{server}/upload/image",
            files={"image": (image_path.name, handle, "application/octet-stream")},
            timeout=60,
        )
    name = response.json().get("name")
    if not isinstance(name, str) or not name:
        raise HTTPException(status_code=502, detail="ComfyUI upload did not return an image name")
    return name


def krea_style_workflow(
    image_name: str,
    prompt: str,
    seed: int,
    steps: int,
    strength: float,
    aspect_ratio: AspectRatio = "1:1",
) -> dict[str, Any]:
    width, height = ASPECT_RATIO_DIMENSIONS[aspect_ratio]
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {"unet_name": "krea2_turbo_fp8_scaled.safetensors", "weight_dtype": "default"},
        },
        "2": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "lora_name": "krea2_style_reference.safetensors",
                "strength_model": strength,
                "model": ["1", 0],
            },
        },
        "3": {"class_type": "Krea2OstrisEditModelPatch", "inputs": {"model": ["2", 0], "kv_cache": False}},
        "4": {
            "class_type": "CLIPLoader",
            "inputs": {"clip_name": "qwen3vl_4b_fp8_scaled.safetensors", "type": "krea2", "device": "default"},
        },
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "6": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "7": {
            "class_type": "TextEncodeKrea2OstrisEdit",
            "inputs": {"clip": ["4", 0], "prompt": prompt, "vae": ["5", 0], "image1": ["6", 0]},
        },
        "8": {"class_type": "TextEncodeKrea2OstrisEdit", "inputs": {"clip": ["4", 0], "prompt": ""}},
        "9": {"class_type": "EmptySD3LatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "10": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "beta",
                "denoise": 1.0,
                "model": ["3", 0],
                "positive": ["7", 0],
                "negative": ["8", 0],
                "latent_image": ["9", 0],
            },
        },
        "11": {"class_type": "VAEDecode", "inputs": {"samples": ["10", 0], "vae": ["5", 0]}},
        "12": {"class_type": "SaveImage", "inputs": {"images": ["11", 0], "filename_prefix": "Krea2StyleRef"}},
    }


def queue_prompt(server: str, workflow: dict[str, Any]) -> str:
    payload = {"prompt": workflow, "client_id": safe_stem(f"workflow-ui-{timestamp()}")}
    response = comfy_request("POST", f"{server}/prompt", json=payload, timeout=60)
    prompt_id = response.json().get("prompt_id")
    if not isinstance(prompt_id, str) or not prompt_id:
        raise HTTPException(status_code=502, detail="ComfyUI did not return a prompt id")
    return prompt_id


def wait_for_output_image(server: str, prompt_id: str, timeout_seconds: int) -> dict[str, str]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        response = comfy_request("GET", f"{server}/history/{prompt_id}", timeout=30)
        history = response.json()
        job = history.get(prompt_id)
        if job:
            output_image: dict[str, str] | None = None
            for node in job.get("outputs", {}).values():
                for image in node.get("images", []):
                    output_image = {
                        "filename": str(image.get("filename", "")),
                        "subfolder": str(image.get("subfolder", "")),
                        "type": str(image.get("type", "")),
                    }
            if output_image and output_image["filename"]:
                return output_image
            raise HTTPException(status_code=502, detail="ComfyUI finished without an image output")
        time.sleep(1)
    raise HTTPException(status_code=504, detail="Timed out waiting for ComfyUI")


def download_comfy_image(server: str, image: dict[str, str], out_path: Path) -> None:
    response = comfy_request("GET", f"{server}/view", params=image, timeout=120)
    out_path.write_bytes(response.content)


@router.get("/comfyui/images", response_model=ComfyImageListResponse)
def list_comfy_images(request: Request) -> ComfyImageListResponse:
    image_dir = ensure_input_dir()
    images = [
        image_info(request, path)
        for path in sorted(image_dir.iterdir(), key=lambda item: item.stat().st_mtime, reverse=True)
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return ComfyImageListResponse(images=images, input_dir=display_path(image_dir))


@router.post("/comfyui/images", response_model=UploadComfyImageResponse)
def upload_comfy_image(request: Request, body: UploadComfyImageRequest) -> UploadComfyImageResponse:
    data, mime_type = decode_data_url(body.data_url)
    path = ensure_input_dir() / upload_filename(body.filename, mime_type)
    path.write_bytes(data)
    return UploadComfyImageResponse(image=image_info(request, path))


@router.get("/comfyui/images/{filename:path}", name="get_comfy_image")
def get_comfy_image(filename: str) -> FileResponse:
    path = resolve_image_path(filename)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.post("/comfyui/generate", response_model=GenerateComfyImageResponse)
def generate_comfy_image(request: Request, body: GenerateComfyImageRequest) -> GenerateComfyImageResponse:
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    reference_path = resolve_image_path(body.reference_image)
    server = COMFYUI_SERVER
    seed = body.seed if body.seed is not None else int(time.time() * 1000) % 2_147_483_647
    comfy_image_name = upload_to_comfy(server, reference_path)
    workflow = krea_style_workflow(comfy_image_name, prompt, seed, body.steps, body.strength, body.aspect_ratio)
    prompt_id = queue_prompt(server, workflow)
    output_image = wait_for_output_image(server, prompt_id, body.timeout_seconds)

    out_name = f"krea2_style_{timestamp()}.png"
    out_path = ensure_input_dir() / out_name
    download_comfy_image(server, output_image, out_path)
    return GenerateComfyImageResponse(
        url=image_url(request, out_name),
        filename=out_name,
        reference_image=reference_path.name,
        aspect_ratio=body.aspect_ratio,
        prompt_id=prompt_id,
        seed=seed,
    )
