import re
from pathlib import Path

def read_optional(path: Path) -> str | None:
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")

def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + "\n", encoding="utf-8")

def markdown_artifact(title: str, body: str, metadata: dict[str, str] | None = None) -> str:
    fence = "~~~" if "```" in body else "```"
    lines = [f"# {title}", ""]
    if metadata:
        for key, value in metadata.items():
            lines.append(f"- {key}: {value}")
        lines.append("")
    lines.extend([f"{fence}text", body.strip(), fence])
    return "\n".join(lines)

def write_llm_artifact(
    path: Path,
    title: str,
    body: str,
    model: str,
    slug: str,
    attempt: int,
    stage: str,
    provider: str = "ollama",
) -> None:
    write_text(
        path,
        markdown_artifact(
            title,
            body,
            {
                "Run": slug,
                "Stage": stage,
                "Attempt": str(attempt),
                "Provider": provider,
                "Model": model,
            },
        ),
    )

def strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
