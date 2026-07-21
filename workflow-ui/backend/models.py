import time
from dataclasses import dataclass, field
from typing import Any, Literal
from pydantic import BaseModel, Field

DEFAULT_MODEL = "VladimirGav/gemma4-26b-16GB-VRAM"

#: The local models offered in the UI, in picker order. Anything else that is
#: installed stays hidden; `GET /api/models` intersects this with `ollama list`.
ALLOWED_MODELS: tuple[tuple[str, str], ...] = (
    ("gemma4:12b", "Gemma 4 12B (small)"),
    ("VladimirGav/gemma4-26b-16GB-VRAM", "Gemma 4 26B 16GB (default)"),
    ("qwen3.5:9b", "Qwen 3.5 9B (small)"),
    ("acidos/Qwen3.6-27B-IQ4_XS", "Qwen 3.6 27B IQ4_XS (16GB)"),
)
MIN_VIDEO_BULLETS = 8
MAX_VIDEO_BULLETS = 12
MIN_VIDEO_BEATS = 12
MAX_VIDEO_BEATS = 16
MAX_VIDEO_CARD_WORDS = 260
MAX_TOTAL_VIDEO_WORDS = 3600

# Kimi K3 is disabled (see services/kimi.py), so every pass runs on Ollama.
# Kept as a plain string so this module stays free of service imports.
BOARD_REWRITER_PROVIDER = "ollama"

# Shot breakdown: one board video becomes a flexible 60-90 second shot list.
# Counts and durations are judged by the LLM shot judge, not hard parser gates.
TARGET_SHOTS = 16
MIN_SHOTS = 14
MAX_SHOTS = 20
MIN_VIDEO_SECONDS = 60
MAX_VIDEO_SECONDS = 90

# The opening and closing windows that decide whether a short-form video is
# watched and remembered. Both are written as high-impact shots.
HIGH_IMPACT_SECONDS = 10
HIGH_IMPACT_SHOTS = 2
MAX_SHOT_FIELD_CHARS = 200
#: Retries per video when the LLM shot judge requests a revision.
MAX_SHOT_ATTEMPTS = 3
MAX_BEST_OF_ATTEMPTS = 3
#: A best-of run stops as soon as the judge scores above this, keeping the
#: remaining attempts. Set it to 100 to always use the full attempt budget.
EARLY_STOP_SCORE = 95

# The shot rewriter is the second polish pass; same provider vocabulary as the board.
SHOT_REWRITER_PROVIDER = "ollama"


JobStatus = Literal["queued", "running", "done", "error"]

@dataclass
class Job:
    id: str
    stage: str
    run_slug: str
    status: JobStatus = "queued"
    message: str = "Queued"
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    events: list[str] = field(default_factory=list)


class CreateRunRequest(BaseModel):
    prompt: str = Field(min_length=8)


class GenerateScenesRequest(BaseModel):
    model: str = DEFAULT_MODEL


class JudgeScenesRequest(BaseModel):
    model: str = DEFAULT_MODEL


class RewriteBoardRequest(BaseModel):
    #: "kimi" is rejected while the provider is disabled; add it back here to re-enable.
    provider: Literal["ollama"] = BOARD_REWRITER_PROVIDER
    #: Blank means "use that provider's default model".
    model: str = ""


class DetailVideosRequest(BaseModel):
    model: str = DEFAULT_MODEL
    #: Board videos to expand. Empty means every video on the board.
    video_indexes: list[int] = Field(default_factory=list)


class RewriteShotsRequest(BaseModel):
    #: "kimi" is rejected while the provider is disabled; add it back here to re-enable.
    provider: Literal["ollama"] = SHOT_REWRITER_PROVIDER
    #: Blank means "use that provider's default model".
    model: str = ""
    #: Detailed videos to polish. Empty means every video that has a shot list.
    video_indexes: list[int] = Field(default_factory=list)


class BuildAssetCatalogRequest(BaseModel):
    model: str = DEFAULT_MODEL
    #: Blank means run the full extractor -> judge -> detailer chain.
    #: Set to one item id to regenerate only that item's description.
    item_id: str = ""


class BuildJsonAssetsRequest(BaseModel):
    model: str = DEFAULT_MODEL
    #: Blank means spec every catalog asset.
    #: Set to one item id to regenerate only that asset's spec.
    item_id: str = ""


class BuildJsonFramesRequest(BaseModel):
    model: str = DEFAULT_MODEL
    #: Blank means every shot in the frame plan.
    #: Set to one shot ref ("V01S03") to regenerate just that shot's prompt.
    shot_ref: str = ""


class ModelOption(BaseModel):
    """One local model the UI may offer."""

    name: str
    label: str
    size_bytes: int = 0
    #: False when the model is in ALLOWED_MODELS but not pulled yet.
    installed: bool = True


class ListModelsResponse(BaseModel):
    models: list[ModelOption]
    default: str = DEFAULT_MODEL
    #: None when Ollama answered; an error string when it could not be reached.
    unreachable: str | None = None


class SceneCard(BaseModel):
    index: int
    title: str
    body: str


class ShotCard(BaseModel):
    index: int
    seconds: int
    title: str
    body: str


class DetailedVideo(BaseModel):
    """One board video expanded into a shot list."""

    index: int
    title: str
    text: str
    shots: list[ShotCard]
    total_seconds: int


# JSON asset specs: every asset is drawn from several angles and in several
# states, so a later image stage can render any shot without re-deciding a look.
MIN_ASSET_ANGLES = 4
MIN_ASSET_STATES = 2


AssetTheme = Literal["background", "prop", "character"]


class AssetCatalogItem(BaseModel):
    id: str
    theme: AssetTheme
    name: str
    evidence: str = ""
    shot_refs: list[str] = Field(default_factory=list)
    detail: str = ""


class AssetCatalogGroup(BaseModel):
    theme: AssetTheme
    title: str
    items: list[AssetCatalogItem]


class FrameDelta(BaseModel):
    """One shot's entry in the frame plan: where it starts, ends, and how."""

    ref: str
    title: str
    first_frame: str = ""
    last_frame: str = ""
    delta: str = ""


class JsonFrameSpec(BaseModel):
    """One `<shot_ref>_frame_prompt.json` file, as served to the UI."""

    ref: str
    title: str
    filename: str
    spec: dict[str, Any] = Field(default_factory=dict)
    #: The shared cast, hoisted for the node's one-line summary.
    background: str = ""
    characters: list[str] = Field(default_factory=list)


class JsonAssetSpec(BaseModel):
    """One `<name>_asset_specification.json` file, as served to the UI."""

    id: str
    name: str
    theme: AssetTheme
    filename: str
    #: The spec document itself, kept opaque so prompt changes need no migration.
    spec: dict[str, Any] = Field(default_factory=dict)
    angle_count: int = 0
    state_count: int = 0


class ArtifactEntry(BaseModel):
    label: str
    path: str
    workspace_path: str


class RunSummary(BaseModel):
    slug: str
    prompt_title: str
    updated_at: float
    has_workflow_ui: bool
    scenes_count: int
    judge_verdict: str | None


class RunResponse(BaseModel):
    slug: str
    prompt: str
    agent_inputs: dict[str, str]
    enhanced_prompt_text: str | None
    story_pack_text: str | None
    small_stories_text: str | None
    story_judge_text: str | None
    story_judge_verdict: str | None
    separator_judge_text: str | None
    separator_judge_verdict: str | None
    scenes_text: str | None
    rewritten_board_text: str | None
    rewritten_scenes_text: str | None
    judge_text: str | None
    judge_verdict: str | None
    scenes: list[SceneCard]
    rewritten_board: list[SceneCard]
    rewritten_scenes: list[SceneCard]
    detailed_videos: list[DetailedVideo]
    shot_judge_text: str | None
    shot_judge_verdict: str | None
    rewritten_shots: list[DetailedVideo]
    asset_catalog_text: str | None
    asset_judge_text: str | None
    asset_judge_verdict: str | None
    asset_detailer_text: str | None
    asset_catalog: list[AssetCatalogGroup]
    json_assets_text: str | None
    json_assets_judge_text: str | None
    json_assets_judge_verdict: str | None
    json_assets: list[JsonAssetSpec]
    frame_deltas_text: str | None
    frame_judge_text: str | None
    frame_judge_verdict: str | None
    json_frames_text: str | None
    json_frames_judge_text: str | None
    json_frames_judge_verdict: str | None
    json_frames: list[JsonFrameSpec]
    artifacts: list[ArtifactEntry]


class JobResponse(BaseModel):
    id: str
    stage: str
    run_slug: str
    status: JobStatus
    message: str
    error: str | None
    created_at: float
    updated_at: float
    events: list[str]


class CreateRunResponse(BaseModel):
    run: RunResponse


class StartJobResponse(BaseModel):
    job: JobResponse


class ListRunsResponse(BaseModel):
    runs: list[RunSummary]


class DeleteRunResponse(BaseModel):
    deleted: str
