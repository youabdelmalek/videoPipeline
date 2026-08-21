"""Thin client for the local Ollama HTTP API."""

from __future__ import annotations

import requests

from backend.utils.file_ops import strip_thinking

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"

_TEMPERATURE = 0.75
_CONTEXT_TOKENS = 8192
# Explicitly request full layer offload and a larger prompt batch. Ollama
# still falls back to its normal placement if the available VRAM is too low.
_GPU_OPTIONS = {
    "num_gpu": -1,
    "num_batch": 512,
}


def ollama_installed_models(timeout_seconds: int = 10) -> list[dict[str, object]]:
    """Every model `ollama list` would show, as {name, size_bytes} entries.

    Raises on a dead daemon so callers can tell "Ollama is down" from "no models".
    """
    response = requests.get(OLLAMA_TAGS_URL, timeout=timeout_seconds)
    response.raise_for_status()

    models = response.json().get("models") or []
    return [
        {"name": entry["name"], "size_bytes": int(entry.get("size") or 0)}
        for entry in models
        if isinstance(entry, dict) and entry.get("name")
    ]


def ollama_generate(
    model: str,
    prompt: str,
    timeout_seconds: int = 900,
    think: bool | str = False,
) -> str:
    """Run one completion and return its text, minus any <think> block."""
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "think": think,
            "options": {
                "temperature": _TEMPERATURE,
                "num_ctx": _CONTEXT_TOKENS,
                **_GPU_OPTIONS,
            },
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()

    text = response.json().get("response")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Ollama returned an empty response")
    return strip_thinking(text)


def ollama_generate_with_images(
    model: str,
    prompt: str,
    images: list[str],
    timeout_seconds: int = 900,
    think: bool | str = False,
) -> str:
    """Run one multimodal completion with base64-encoded images."""
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": prompt,
            "images": images,
            "stream": False,
            "think": think,
            "options": {
                "temperature": _TEMPERATURE,
                "num_ctx": _CONTEXT_TOKENS,
                **_GPU_OPTIONS,
            },
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()

    text = response.json().get("response")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Ollama returned an empty response")
    return strip_thinking(text)


def ollama_unload_model(model: str, timeout_seconds: int = 60) -> None:
    """Ask Ollama to drop the model from memory (keep_alive=0)."""
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "keep_alive": 0,
            "stream": False,
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()
