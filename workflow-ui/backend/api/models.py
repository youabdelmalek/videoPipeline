"""Endpoint listing the local models the workflow may run on."""

from __future__ import annotations

from backend.models import ALLOWED_MODELS, DEFAULT_MODEL, ListModelsResponse, ModelOption
from backend.services.ollama import ollama_installed_models

from fastapi import APIRouter

router = APIRouter()


def _bare(name: str) -> str:
    """`ollama list` reports "foo:latest" for an untagged pull; we store "foo"."""
    return name[: -len(":latest")] if name.endswith(":latest") else name


@router.get("/models", response_model=ListModelsResponse)
def get_models() -> ListModelsResponse:
    """The curated allowlist, annotated with what is actually pulled locally.

    Models stay listed when Ollama is down so the picker never goes empty; the
    `unreachable` field tells the UI why nothing is marked installed.
    """
    try:
        sizes = {_bare(str(entry["name"])): int(entry["size_bytes"]) for entry in ollama_installed_models()}
        unreachable = None
    except Exception as caught:  # noqa: BLE001 - any transport failure is the same to the UI
        sizes = {}
        unreachable = f"Could not reach Ollama: {caught}"

    return ListModelsResponse(
        models=[
            ModelOption(
                name=name,
                label=label,
                size_bytes=sizes.get(name, 0),
                installed=name in sizes,
            )
            for name, label in ALLOWED_MODELS
        ],
        default=DEFAULT_MODEL,
        unreachable=unreachable,
    )
