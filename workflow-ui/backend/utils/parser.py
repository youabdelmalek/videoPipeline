import re
from backend.models import FrameDelta, SceneCard, ShotCard

def parse_scene_cards(text: str) -> list[SceneCard]:
    pattern = re.compile(r"(?im)^\s*(?:#{1,3}\s*)?(?:VIDEO|SCENE)\s+(\d{1,2})\s*(?:[-:–]\s*(.*))?$")
    matches = list(pattern.finditer(text))
    cards: list[SceneCard] = []

    for position, match in enumerate(matches):
        start = match.end()
        end = matches[position + 1].start() if position + 1 < len(matches) else len(text)
        index = int(match.group(1))
        title = (match.group(2) or f"Scene {index:02d}").strip()
        body = text[start:end].strip()
        cards.append(SceneCard(index=index, title=title, body=body))

    if cards:
        return sorted(cards, key=lambda card: card.index)

    bullet_pattern = re.compile(r"(?im)^\s*[-*]\s*(?:VIDEO\s+)?(\d{1,2})\s*(?:[-:.)–]\s*)(.+?)\s*$")
    for match in bullet_pattern.finditer(text):
        index = int(match.group(1))
        content = match.group(2).strip()
        title = f"Video {index:02d}"
        body = content
        title_match = re.match(r"(.{3,70}?)\s*:\s*(.+)", content)
        if title_match:
            title = title_match.group(1).strip()
            body = title_match.group(2).strip()
        cards.append(SceneCard(index=index, title=title, body=body))

    return sorted(cards, key=lambda card: card.index)


#: "SHOT 03 - 7s - Boss reaches for the ledger"
_SHOT_HEADING = re.compile(
    r"(?im)^\s*(?:#{1,3}\s*)?SHOT\s+(\d{1,2})\s*[-:–]\s*(\d{1,2})\s*s(?:ec|econds)?\s*(?:[-:–]\s*(.*))?$"
)


def parse_shot_cards(text: str) -> list[ShotCard]:
    """Split a shot list into its individual shots, in written order."""
    matches = list(_SHOT_HEADING.finditer(text))
    shots: list[ShotCard] = []

    for position, match in enumerate(matches):
        start = match.end()
        end = matches[position + 1].start() if position + 1 < len(matches) else len(text)
        index = int(match.group(1))
        shots.append(
            ShotCard(
                index=index,
                seconds=int(match.group(2)),
                title=(match.group(3) or f"Shot {index:02d}").strip(),
                body=text[start:end].strip(),
            )
        )

    return shots


def total_shot_seconds(shots: list[ShotCard]) -> int:
    return sum(shot.seconds for shot in shots)


#: "V08S05 - The Heavy Choice" - one frame plan block per shot.
_FRAME_HEADING = re.compile(r"(?im)^\s*(?:#{1,3}\s*)?(V\d{1,2}S\d{1,2})\s*(?:[-:–]\s*(.*))?$")


def _labelled_line(body: str, label: str) -> str:
    """The text after `- <label>:` in a frame block, or ''."""
    match = re.search(rf"(?im)^\s*[-*]?\s*{label}\s*:\s*(.+?)\s*$", body)
    return match.group(1).strip() if match else ""


def parse_frame_deltas(text: str) -> list[FrameDelta]:
    """Split a frame plan into one record per shot, in written order.

    Tolerates the extra `- Shot title:` line the model sometimes adds, and
    skips blocks that have neither a first nor a last frame.
    """
    matches = list(_FRAME_HEADING.finditer(text or ""))
    frames: list[FrameDelta] = []

    for position, match in enumerate(matches):
        start = match.end()
        end = matches[position + 1].start() if position + 1 < len(matches) else len(text)
        body = text[start:end].strip()

        first = _labelled_line(body, "First frame")
        last = _labelled_line(body, "Last frame")
        if not first and not last:
            continue

        ref = match.group(1).upper()
        title = (match.group(2) or "").strip() or _labelled_line(body, "Shot title") or ref
        frames.append(
            FrameDelta(
                ref=ref,
                title=title,
                first_frame=first,
                last_frame=last,
                delta=_labelled_line(body, "Delta"),
            )
        )

    return frames


def extract_verdict(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(r"(?im)^\s*VERDICT\s*:\s*(PASS|RETRY)\b", text)
    return match.group(1).upper() if match else None


def extract_score(text: str | None) -> int:
    if not text:
        return 0
    match = re.search(r"(?im)^\s*SCORE\s*:\s*(\d{1,3})(?:\s*/\s*100)?\b", text)
    if not match:
        return 0
    return max(0, min(100, int(match.group(1))))
