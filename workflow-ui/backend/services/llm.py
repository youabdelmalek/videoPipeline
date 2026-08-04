"""Model provider dispatch.

Every stage goes through `llm_generate`, so a stage can be pointed at a
different provider by changing one argument. Add a provider by writing a client
module and registering it in `_GENERATORS`.
"""

from __future__ import annotations

from typing import Callable

from backend.models import DEFAULT_MODEL, DEFAULT_THINKING_LEVEL, DEFAULT_VISION_MODEL, ThinkingLevel
from backend.services.kimi import KIMI_ENABLED, KIMI_MODEL, kimi_generate
from backend.services.ollama import ollama_generate, ollama_generate_with_images

OLLAMA = "ollama"
KIMI = "kimi"

_GENERATORS: dict[str, Callable[..., str]] = {
    OLLAMA: ollama_generate,
}

DEFAULT_MODELS: dict[str, str] = {
    OLLAMA: DEFAULT_MODEL,
}

# Kimi stays out of the registry while disabled, so `llm_generate("kimi", ...)`
# fails with the "unknown provider" error before any HTTP call is built.
if KIMI_ENABLED:
    _GENERATORS[KIMI] = kimi_generate
    DEFAULT_MODELS[KIMI] = KIMI_MODEL


def known_providers() -> list[str]:
    return sorted(_GENERATORS)


def default_model_for(provider: str) -> str:
    return DEFAULT_MODELS.get(provider, DEFAULT_MODEL)


def _ollama_think_value(level: ThinkingLevel) -> bool | str:
    if level == "off":
        return False
    if level == "on":
        return True
    return level


def llm_generate(
    provider: str,
    model: str,
    prompt: str,
    thinking: ThinkingLevel = DEFAULT_THINKING_LEVEL,
) -> str:
    generate = _GENERATORS.get(provider)
    if generate is None:
        raise RuntimeError(
            f"Unknown model provider '{provider}'. Expected one of: {', '.join(known_providers())}."
        )
    selected_model = model or default_model_for(provider)
    if provider == OLLAMA:
        return ollama_generate(
            model=selected_model,
            prompt=prompt,
            think=_ollama_think_value(thinking),
        )
    return generate(model=selected_model, prompt=prompt)


def llm_generate_with_images(provider: str, model: str, prompt: str, images: list[str]) -> str:
    if provider != OLLAMA:
        raise RuntimeError("Image prompts are only supported through Ollama.")
    return ollama_generate_with_images(model=model or DEFAULT_VISION_MODEL, prompt=prompt, images=images)
