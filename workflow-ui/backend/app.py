"""FastAPI entry point for the Workflow UI.

    python -m uvicorn app:app --app-dir workflow-ui/backend --reload --port 8000

Layout:
    config.py     paths and settings
    models.py     request/response schemas and tuning constants
    runs/         run folders on disk
    prompts/      one module per prompt
    stages/       one module per workflow step
    pipelines/    jobs that chain stages together
    api/          HTTP routes
"""

from __future__ import annotations

import sys
from pathlib import Path

# Must happen before any `backend.*` import: uvicorn loads this file as the
# top-level module `app`, so workflow-ui/ is not on sys.path yet.
WORKFLOW_UI_DIR = Path(__file__).resolve().parents[1]
if str(WORKFLOW_UI_DIR) not in sys.path:
    sys.path.insert(0, str(WORKFLOW_UI_DIR))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from backend.api import jobs_router, models_router, runs_router  # noqa: E402
from backend.config import CORS_ORIGINS  # noqa: E402
from backend.models import DEFAULT_MODEL  # noqa: E402

app = FastAPI(title="Series Workflow UI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": DEFAULT_MODEL}


app.include_router(runs_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(models_router, prefix="/api")
