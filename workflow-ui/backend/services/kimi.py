"""Client for Moonshot's Kimi K3 (OpenAI-compatible chat completions).

Docs: https://platform.kimi.ai/docs/guide/kimi-k3-quickstart
Plain HTTP is used so the backend needs no extra SDK dependency.

DISABLED: the workflow runs on local Ollama models only. This client is kept
intact but unregistered - flip `KIMI_ENABLED` to True (and re-add the "kimi"
option in the frontend nodes) to bring the paid passes back.
"""

from __future__ import annotations

import os

import requests

from backend.utils.file_ops import strip_thinking

#: Master switch. While False the provider is not registered in `llm.py`, the
#: API rejects "kimi" as a provider, and no request can reach Moonshot.
KIMI_ENABLED = False

KIMI_API_URL = "https://api.moonshot.ai/v1/chat/completions"
KIMI_MODEL = "kimi-k3"

# K3 always thinks; "max" is currently the only supported level.
_REASONING_EFFORT = "max"
# No read timeout: K3 thinks at max effort and a whole board can take a long time,
# so we wait as long as it needs. The connect timeout stays, so an unreachable API
# fails fast instead of parking a worker thread forever on a dead socket.
_CONNECT_TIMEOUT_SECONDS = 30
# The default is 131072. Our boards are short, so cap it well below that.
_MAX_COMPLETION_TOKENS = 32768
_ERROR_PREVIEW_CHARS = 300


def kimi_api_key() -> str:
    key = os.environ.get("MOONSHOT_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "MOONSHOT_API_KEY is not set. Copy .env.example to .env and add your Kimi key."
        )
    return key


def kimi_generate(model: str, prompt: str) -> str:
    """Run one completion and return the answer text. Waits as long as K3 needs."""
    if not KIMI_ENABLED:
        raise RuntimeError(
            "Kimi K3 is disabled; this workflow runs on local Ollama models only. "
            "Set KIMI_ENABLED = True in backend/services/kimi.py to re-enable it."
        )

    response = requests.post(
        KIMI_API_URL,
        headers={
            "Authorization": f"Bearer {kimi_api_key()}",
            "Content-Type": "application/json",
        },
        json={
            "model": model or KIMI_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "reasoning_effort": _REASONING_EFFORT,
            "max_completion_tokens": _MAX_COMPLETION_TOKENS,
            # temperature / top_p / penalties are fixed server-side for K3 and
            # must be omitted rather than sent.
        },
        timeout=(_CONNECT_TIMEOUT_SECONDS, None),
    )

    if response.status_code >= 400:
        # Surface the API's own message; it explains auth and quota failures.
        raise RuntimeError(f"Kimi API error {response.status_code}: {response.text[:_ERROR_PREVIEW_CHARS]}")

    choices = response.json().get("choices") or []
    if not choices:
        raise RuntimeError("Kimi returned no choices")

    # Read `content` only - `reasoning_content` holds the thinking trace.
    text = (choices[0].get("message") or {}).get("content")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Kimi returned an empty response")
    return strip_thinking(text)
