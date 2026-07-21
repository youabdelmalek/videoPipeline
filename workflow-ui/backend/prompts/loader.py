"""Helpers for the optional prompt templates stored outside the UI."""

from __future__ import annotations

from pathlib import Path


def prompt_template_text(path: Path) -> str:
    """Template contents, or an empty string when the file is absent."""
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def fill_prompt_template(template: str, replacements: dict[str, str]) -> str:
    """Substitute `{{key}}` placeholders."""
    text = template
    for key, value in replacements.items():
        text = text.replace(f"{{{{{key}}}}}", value.strip())
    return text.strip()


def load_source_prompt(path: Path, replacements: dict[str, str], fallback: str) -> str:
    """Filled template from `path`, falling back when it is missing or empty."""
    return fill_prompt_template(prompt_template_text(path), replacements) or fallback
