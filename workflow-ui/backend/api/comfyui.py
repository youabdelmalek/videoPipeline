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
    GenerateComfyVideoRequest,
    GenerateComfyVideoResponse,
    UploadComfyImageRequest,
    UploadComfyImageResponse,
)

router = APIRouter()

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".avi"}
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
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
VIDEO_ASPECT_RATIO_LABELS: dict[AspectRatio, str] = {
    "1:1": "1:1 (Square)",
    "4:3": "4:3 (Standard)",
    "3:4": "3:4 (Portrait Standard)",
    "16:9": "16:9 (Widescreen)",
    "9:16": "9:16 (Portrait Widescreen)",
    "3:2": "3:2 (Photo)",
    "2:3": "2:3 (Portrait Photo)",
}


def ensure_input_dir() -> Path:
    IMAGE_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    return IMAGE_INPUT_DIR


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]


def image_url(request: Request, filename: str) -> str:
    return str(request.url_for("get_comfy_image", filename=filename))


def media_url(request: Request, filename: str) -> str:
    return str(request.url_for("get_comfy_media", filename=filename))


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
    return resolve_media_path(reference, IMAGE_EXTENSIONS, "Reference image")


def resolve_media_path(reference: str, extensions: set[str], label: str) -> Path:
    parsed = urlparse(reference.strip())
    name = Path(unquote(parsed.path if parsed.scheme else reference)).name
    if not name:
        raise HTTPException(status_code=400, detail=f"{label} is required")
    if Path(name).suffix.lower() not in extensions:
        raise HTTPException(status_code=400, detail=f"{label} must be a supported media file")
    path = ensure_input_dir() / name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"{label} not found in input folder: {name}")
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


def krea_identity_workflow(
    image_name: str,
    prompt: str,
    seed: int,
    steps: int,
    strength: float,
    aspect_ratio: AspectRatio = "1:1",
) -> dict[str, Any]:
    width, height = ASPECT_RATIO_DIMENSIONS[aspect_ratio]
    return {
        "73": {
            "class_type": "UNETLoader",
            "inputs": {"unet_name": "krea2_turbo_fp8_scaled.safetensors", "weight_dtype": "default"},
        },
        "74": {
            "class_type": "CLIPLoader",
            "inputs": {"clip_name": "qwen3vl_4b_fp8_scaled.safetensors", "type": "krea2", "device": "default"},
        },
        "75": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "108": {
            "class_type": "VAEEncode",
            "inputs": {"pixels": ["168", 0], "vae": ["75", 0]},
        },
        "109": {
            "class_type": "Krea2EditModelPatch",
            "inputs": {
                "ref_boost": 1,
                "ref_boost_a": 1,
                "fit_mode": "fit",
                "model": ["165", 0],
                "source_latent": ["108", 0],
                "vae": ["75", 0],
            },
        },
        "110": {
            "class_type": "Krea2EditGroundedEncode",
            "inputs": {
                "prompt": prompt,
                "grounding_px": 0,
                "system_prompt": "",
                "clip": ["74", 0],
                "image": ["168", 0],
            },
        },
        "112": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": 1,
                "sampler_name": "euler",
                "scheduler": "beta",
                "denoise": 1,
                "model": ["109", 0],
                "positive": ["110", 0],
                "negative": ["113", 0],
                "latent_image": ["126", 0],
            },
        },
        "113": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["110", 0]}},
        "126": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "145": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "ComfyUI/Krea2Edit", "images": ["163", 0]},
        },
        "163": {"class_type": "VAEDecode", "inputs": {"samples": ["112", 0], "vae": ["75", 0]}},
        "165": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "lora_name": "krea2_identity_edit_v1_2.safetensors",
                "strength_model": strength,
                "model": ["73", 0],
            },
        },
        "168": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
            "_meta": {"title": "Load Image 1 (person / main subject)"},
        },
    }


def krea_text_to_image_workflow(
    prompt: str,
    seed: int,
    steps: int,
    aspect_ratio: AspectRatio = "1:1",
) -> dict[str, Any]:
    width, height = ASPECT_RATIO_DIMENSIONS[aspect_ratio]
    return {
        "55": {
            "class_type": "UNETLoader",
            "inputs": {"unet_name": "krea2_turbo_fp8_scaled.safetensors", "weight_dtype": "default"},
        },
        "56": {
            "class_type": "CLIPLoader",
            "inputs": {"clip_name": "qwen3vl_4b_fp8_scaled.safetensors", "type": "krea2", "device": "default"},
        },
        "57": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "51": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["56", 0]},
        },
        "58": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["51", 0]}},
        "52": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "53": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": 1,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1,
                "model": ["55", 0],
                "positive": ["51", 0],
                "negative": ["58", 0],
                "latent_image": ["52", 0],
            },
        },
        "54": {"class_type": "VAEDecode", "inputs": {"samples": ["53", 0], "vae": ["57", 0]}},
        "29": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "Krea2_turbo", "images": ["54", 0]},
        },
    }


def video_reference_dimensions(aspect_ratio: AspectRatio) -> tuple[int, int]:
    width, height = ASPECT_RATIO_DIMENSIONS[aspect_ratio]
    reference_width = 1024
    reference_height = round(reference_width * height / width)
    return reference_width, max(2, reference_height - reference_height % 2)


def minimax_ref2va_workflow(
    character_image_name: str,
    background_image_name: str,
    prompt: str,
    duration_seconds: float,
    seed: int,
    steps: int,
    aspect_ratio: AspectRatio = "16:9",
) -> dict[str, Any]:
    background_width, background_height = video_reference_dimensions(aspect_ratio)
    return {
        "137": {
            "class_type": "LoadImage",
            "inputs": {"image": character_image_name},
            "_meta": {"title": "Load Image 1 (character)"},
        },
        "139": {
            "class_type": "LoadImage",
            "inputs": {"image": background_image_name},
            "_meta": {"title": "Load Image 2 (background)"},
        },
        "146": {
            "class_type": "ImageResizeKJv2",
            "inputs": {
                "width": 512,
                "height": 512,
                "upscale_method": "nearest-exact",
                "keep_proportion": "stretch",
                "pad_color": "0, 0, 0",
                "crop_position": "center",
                "divisible_by": 2,
                "device": "cpu",
                "image": ["137", 0],
            },
        },
        "147": {
            "class_type": "ImageResizeKJv2",
            "inputs": {
                "width": background_width,
                "height": background_height,
                "upscale_method": "nearest-exact",
                "keep_proportion": "stretch",
                "pad_color": "0, 0, 0",
                "crop_position": "center",
                "divisible_by": 2,
                "device": "cpu",
                "image": ["139", 0],
            },
        },
        "138": {
            "class_type": "PrimitiveStringMultiline",
            "inputs": {"value": prompt},
            "_meta": {"title": "Input Text (Prompt)"},
        },
        "115": {
            "class_type": "ResolutionSelector",
            "inputs": {
                "aspect_ratio": VIDEO_ASPECT_RATIO_LABELS[aspect_ratio],
                "megapixels": 0.4,
                "multiple": 32,
            },
            "_meta": {"title": "Resolution Selector (Size)"},
        },
        "119": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"},
        },
        "120": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"},
        },
        "141": {
            "class_type": "UnetLoaderGGUF",
            "inputs": {"unet_name": "MiniMax-H3-Ref2VA-Q3_K_M.gguf"},
        },
        "142": {
            "class_type": "CLIPLoaderGGUF",
            "inputs": {"clip_name": "qwen3vl_32b_minimax_h3-Q4_K_M.gguf", "type": "wan"},
        },
        "136": {
            "class_type": "MiniMaxH3ReferenceToVideo",
            "inputs": {
                "prompt": ["138", 0],
                "width": ["115", 0],
                "height": ["115", 1],
                "length": ["131", 1],
                "ref_image_size": "match",
                "clip": ["142", 0],
                "vae": ["119", 0],
                "audio_vae": ["120", 0],
                "ref_images.ref_image_0": ["146", 0],
                "ref_images.ref_image_1": ["147", 0],
            },
        },
        "131": {
            "class_type": "ComfyMathExpression",
            "inputs": {
                "expression": "max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17",
                "values.a": ["132", 0],
            },
        },
        "132": {
            "class_type": "PrimitiveFloat",
            "inputs": {"value": duration_seconds},
            "_meta": {"title": "Float (Duration seconds)"},
        },
        "123": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "124": {
            "class_type": "BasicScheduler",
            "inputs": {"scheduler": "simple", "steps": steps, "denoise": 1, "model": ["141", 0]},
        },
        "126": {
            "class_type": "BasicGuider",
            "inputs": {"model": ["141", 0], "conditioning": ["136", 0]},
        },
        "129": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "125": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["129", 0],
                "guider": ["126", 0],
                "sampler": ["123", 0],
                "sigmas": ["124", 0],
                "latent_image": ["156", 0],
            },
        },
        "122": {"class_type": "VAEDecode", "inputs": {"samples": ["154", 0], "vae": ["119", 0]}},
        "121": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["154", 0], "vae": ["120", 0]}},
        "153": {"class_type": "easy cleanGpuUsed", "inputs": {"anything": ["125", 0]}},
        "154": {"class_type": "easy clearCacheAll", "inputs": {"anything": ["153", 0]}},
        "155": {"class_type": "easy cleanGpuUsed", "inputs": {"anything": ["136", 1]}},
        "156": {"class_type": "easy clearCacheAll", "inputs": {"anything": ["155", 0]}},
        "157": {"class_type": "easy cleanGpuUsed", "inputs": {"anything": ["122", 0]}},
        "158": {"class_type": "easy clearCacheAll", "inputs": {"anything": ["157", 0]}},
        "151": {
            "class_type": "RTXVideoSuperResolution",
            "inputs": {"resize_type": "scale by multiplier", "resize_type.scale": 2, "quality": "ULTRA", "images": ["158", 0]},
        },
        "130": {
            "class_type": "CreateVideo",
            "inputs": {"fps": 24, "bit_depth": 8, "images": ["151", 0], "audio": ["121", 0]},
        },
        "92": {
            "class_type": "SaveVideo",
            "inputs": {"filename_prefix": "video/MiniMax_H3_Ref2VA", "format": "auto", "codec": "auto", "video": ["130", 0]},
        },
    }


def minimax_fl2v_workflow(
    first_frame_image_name: str,
    last_frame_image_name: str,
    prompt: str,
    duration_seconds: float,
    seed: int,
    steps: int,
    aspect_ratio: AspectRatio = "1:1",
) -> dict[str, Any]:
    return {
        "121": {
            "class_type": "LoadImage",
            "inputs": {"image": first_frame_image_name},
            "_meta": {"title": "Load Image 1 (first frame)"},
        },
        "125": {
            "class_type": "LoadImage",
            "inputs": {"image": last_frame_image_name},
            "_meta": {"title": "Load Image 2 (last frame)"},
        },
        "123": {
            "class_type": "ImageResizeKJv2",
            "inputs": {
                "width": 512,
                "height": 512,
                "upscale_method": "nvidia_rtx_vsr",
                "keep_proportion": "resize",
                "pad_color": "0, 0, 0",
                "crop_position": "center",
                "divisible_by": 2,
                "device": "cpu",
                "image": ["121", 0],
            },
            "_meta": {"title": "Resize Image v2 - 1"},
        },
        "124": {
            "class_type": "ImageResizeKJv2",
            "inputs": {
                "width": 512,
                "height": 512,
                "upscale_method": "nvidia_rtx_vsr",
                "keep_proportion": "resize",
                "pad_color": "0, 0, 0",
                "crop_position": "center",
                "divisible_by": 2,
                "device": "cpu",
                "image": ["125", 0],
            },
            "_meta": {"title": "Resize Image v2 - 2"},
        },
        "115": {
            "class_type": "ResolutionSelector",
            "inputs": {"aspect_ratio": VIDEO_ASPECT_RATIO_LABELS[aspect_ratio], "megapixels": 0.4, "multiple": 32},
        },
        "126": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"}},
        "127": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"}},
        "139": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "MiniMax-H3-FL2VA-Q3_K_M.gguf"}},
        "141": {
            "class_type": "CLIPLoaderGGUF",
            "inputs": {"clip_name": "qwen3vl_32b_minimax_h3-Q4_K_M.gguf", "type": "wan"},
        },
        "136": {
            "class_type": "MiniMaxH3ImageToVideo",
            "inputs": {
                "prompt": prompt,
                "width": ["115", 0],
                "height": ["115", 1],
                "length": ["137", 1],
                "clip": ["141", 0],
                "vae": ["126", 0],
                "first_frame": ["123", 0],
                "last_frame": ["124", 0],
            },
        },
        "137": {
            "class_type": "ComfyMathExpression",
            "inputs": {
                "expression": "max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17",
                "values.a": ["138", 0],
            },
        },
        "138": {
            "class_type": "PrimitiveFloat",
            "inputs": {"value": duration_seconds},
            "_meta": {"title": "Float (Duration seconds)"},
        },
        "130": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "131": {
            "class_type": "BasicScheduler",
            "inputs": {"scheduler": "simple", "steps": steps, "denoise": 1, "model": ["139", 0]},
        },
        "133": {"class_type": "BasicGuider", "inputs": {"model": ["139", 0], "conditioning": ["136", 0]}},
        "134": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "132": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["134", 0],
                "guider": ["133", 0],
                "sampler": ["130", 0],
                "sigmas": ["131", 0],
                "latent_image": ["136", 1],
            },
        },
        "129": {"class_type": "VAEDecode", "inputs": {"samples": ["132", 0], "vae": ["126", 0]}},
        "128": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["132", 0], "vae": ["127", 0]}},
        "135": {
            "class_type": "CreateVideo",
            "inputs": {"fps": 24, "bit_depth": 8, "images": ["129", 0], "audio": ["128", 0]},
        },
        "92": {
            "class_type": "SaveVideo",
            "inputs": {"filename_prefix": "video/MiniMax_H3_FL2V", "format": "auto", "codec": "auto", "video": ["135", 0]},
        },
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


def wait_for_output_video(server: str, prompt_id: str, timeout_seconds: int) -> dict[str, str]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        response = comfy_request("GET", f"{server}/history/{prompt_id}", timeout=30)
        history = response.json()
        job = history.get(prompt_id)
        if job:
            for node in job.get("outputs", {}).values():
                for key in ("videos", "gifs", "video"):
                    entries = node.get(key, [])
                    if isinstance(entries, dict):
                        entries = [entries]
                    if not isinstance(entries, list):
                        continue
                    for media in entries:
                        if isinstance(media, dict) and media.get("filename"):
                            return {
                                "filename": str(media.get("filename", "")),
                                "subfolder": str(media.get("subfolder", "")),
                                "type": str(media.get("type", "")),
                            }
            raise HTTPException(status_code=502, detail="ComfyUI finished without a video output")
        time.sleep(1)
    raise HTTPException(status_code=504, detail="Timed out waiting for ComfyUI")


def download_comfy_media(server: str, media: dict[str, str], out_path: Path) -> None:
    response = comfy_request("GET", f"{server}/view", params=media, timeout=120)
    out_path.write_bytes(response.content)


def download_comfy_image(server: str, image: dict[str, str], out_path: Path) -> None:
    download_comfy_media(server, image, out_path)


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


@router.get("/comfyui/media/{filename:path}", name="get_comfy_media")
def get_comfy_media(filename: str) -> FileResponse:
    path = resolve_media_path(filename, MEDIA_EXTENSIONS, "Media file")
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.post("/comfyui/generate", response_model=GenerateComfyImageResponse)
def generate_comfy_image(request: Request, body: GenerateComfyImageRequest) -> GenerateComfyImageResponse:
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    server = COMFYUI_SERVER
    seed = body.seed if body.seed is not None else int(time.time() * 1000) % 2_147_483_647
    reference_path: Path | None = None
    comfy_image_name = ""
    if body.workflow != "text_to_image":
        reference_path = resolve_image_path(body.reference_image)
        comfy_image_name = upload_to_comfy(server, reference_path)
    if body.workflow == "identity":
        workflow = krea_identity_workflow(comfy_image_name, prompt, seed, body.steps, body.strength, body.aspect_ratio)
    elif body.workflow == "text_to_image":
        workflow = krea_text_to_image_workflow(prompt, seed, body.steps, body.aspect_ratio)
    else:
        workflow = krea_style_workflow(comfy_image_name, prompt, seed, body.steps, body.strength, body.aspect_ratio)
    prompt_id = queue_prompt(server, workflow)
    output_image = wait_for_output_image(server, prompt_id, body.timeout_seconds)

    prefix = {
        "identity": "krea2_identity",
        "text_to_image": "krea2_text_to_image",
        "style": "krea2_style",
    }[body.workflow]
    out_name = f"{prefix}_{timestamp()}.png"
    out_path = ensure_input_dir() / out_name
    download_comfy_image(server, output_image, out_path)
    return GenerateComfyImageResponse(
        url=image_url(request, out_name),
        filename=out_name,
        reference_image=reference_path.name if reference_path else "",
        aspect_ratio=body.aspect_ratio,
        prompt_id=prompt_id,
        seed=seed,
    )


@router.post("/comfyui/generate-video", response_model=GenerateComfyVideoResponse)
def generate_comfy_video(request: Request, body: GenerateComfyVideoRequest) -> GenerateComfyVideoResponse:
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    if body.workflow == "ref2va":
        character_path = resolve_image_path(body.character_image)
        background_path = resolve_image_path(body.background_image)
    else:
        character_path = resolve_image_path(body.first_frame)
        background_path = resolve_image_path(body.last_frame)

    server = COMFYUI_SERVER
    seed = body.seed if body.seed is not None else int(time.time() * 1000) % 2_147_483_647
    first_image_name = upload_to_comfy(server, character_path)
    second_image_name = upload_to_comfy(server, background_path)
    if body.workflow == "ref2va":
        workflow = minimax_ref2va_workflow(
            first_image_name,
            second_image_name,
            prompt,
            body.duration_seconds,
            seed,
            body.steps,
            body.aspect_ratio,
        )
    else:
        workflow = minimax_fl2v_workflow(
            first_image_name,
            second_image_name,
            prompt,
            body.duration_seconds,
            seed,
            body.steps,
            body.aspect_ratio,
        )

    prompt_id = queue_prompt(server, workflow)
    output_video = wait_for_output_video(server, prompt_id, body.timeout_seconds)
    suffix = Path(output_video["filename"]).suffix.lower() or ".mp4"
    out_name = f"minimax_{body.workflow}_{timestamp()}{suffix}"
    out_path = ensure_input_dir() / out_name
    download_comfy_media(server, output_video, out_path)
    return GenerateComfyVideoResponse(
        url=media_url(request, out_name),
        filename=out_name,
        workflow=body.workflow,
        aspect_ratio=body.aspect_ratio,
        duration_seconds=body.duration_seconds,
        prompt_id=prompt_id,
        seed=seed,
    )
