"""Filesystem layout and shared settings for the workflow backend."""

from __future__ import annotations

import os
from pathlib import Path

# Repo root (the folder holding runs/, createScenes/, workflow-ui/ ...).
ROOT = Path(__file__).resolve().parents[2]

RUNS_DIR = ROOT / "runs"
SAVED_WORKFLOWS_DIR = ROOT / "saved-workflows"


def _load_env_file(path: Path) -> None:
    """Read KEY=VALUE lines from .env.

    Hand-rolled so the backend needs no extra dependency. Real environment
    variables win, so exporting a key overrides the file.
    """
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(ROOT / ".env")

# Source prompt template authored outside the UI. It is optional: the judge
# prompt builder falls back to a built-in default when the file is missing.
SCENE_JUDGE_PROMPT = ROOT / "createScenes" / "sceneDetailerJudge.txt"

CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def workspace_path(path: Path) -> str:
    """Path relative to the repo root, for display in prompts and artifacts."""
    return path.relative_to(ROOT).as_posix()
