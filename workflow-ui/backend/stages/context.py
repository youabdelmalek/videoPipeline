"""Shared plumbing every pipeline stage uses.

A stage is a plain function that takes a `StageContext`, calls the model once
via `run_llm_stage`, and returns the model's text. Adding a stage means adding
one module next to this one - no changes to the job runner or the API.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from backend.jobs import update_job
from backend.runs.paths import workflow_dir
from backend.services.llm import OLLAMA, llm_generate
from backend.utils.file_ops import write_llm_artifact


@dataclass(frozen=True)
class StageContext:
    """Everything a stage needs to do its work and report progress."""

    job_id: str
    slug: str
    path: Path
    model: str
    #: Default provider for this job's stages; a stage may override it.
    provider: str = OLLAMA

    @property
    def workflow(self) -> Path:
        """runs/<slug>/workflow_ui - the durable output of the workflow."""
        return workflow_dir(self.path)

    @property
    def attempts_dir(self) -> Path:
        """Where per-attempt prompt/response transcripts are kept."""
        return self.workflow / "attempts"

    def attempt_dir(self, attempt: int) -> Path:
        return self.attempts_dir / f"attempt_{attempt:02d}"

    def log(self, message: str) -> None:
        """Push a progress line to the UI's processing panel."""
        update_job(self.job_id, "running", message)


def run_llm_stage(
    ctx: StageContext,
    *,
    artifact_dir: Path,
    name: str,
    title: str,
    prompt: str,
    attempt: int,
    stage: str | None = None,
    provider: str | None = None,
    model: str | None = None,
) -> str:
    """Save the prompt, call the model, save the response, return the response.

    `name` prefixes the artifact filenames (`<name>_input.md` /
    `<name>_output.md`); `stage` is recorded in the artifact metadata and
    defaults to `name`. `provider`/`model` override the job's defaults, which is
    how one stage can run on a different backend from the rest.
    """
    used_provider = provider or ctx.provider
    used_model = model or ctx.model
    stage_name = stage or name

    def save(suffix: str, heading: str, body: str) -> None:
        write_llm_artifact(
            artifact_dir / f"{name}_{suffix}.md",
            f"{title} {heading}",
            body,
            used_model,
            ctx.slug,
            attempt,
            stage_name,
            used_provider,
        )

    save("input", "Input", prompt)
    output = llm_generate(used_provider, used_model, prompt)
    save("output", "Output", output)
    return output
