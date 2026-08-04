import time
from dataclasses import dataclass, field
from typing import Any, Literal
from pydantic import BaseModel, Field

ThinkingLevel = Literal["off", "on", "low", "medium", "high"]
DEFAULT_MODEL = "VladimirGav/gemma4-26b-16GB-VRAM"
DEFAULT_VISION_MODEL = "gemma4:12b"
DEFAULT_THINKING_LEVEL: ThinkingLevel = "off"


@dataclass(frozen=True)
class ModelCatalogEntry:
    name: str
    label: str
    vision: bool = False
    thinking_levels: tuple[ThinkingLevel, ...] = ()


MODEL_CATALOG: tuple[ModelCatalogEntry, ...] = (
    ModelCatalogEntry(
        "vaultbox/qwen3.5-uncensored:9b",
        "Qwen 3.5 Uncensored 9B",
        vision=True,
        thinking_levels=("off", "on"),
    ),
    ModelCatalogEntry("devstral-small-2:24b", "Devstral Small 2 24B", vision=True),
    ModelCatalogEntry(
        "gpt-oss:20b",
        "GPT-OSS 20B",
        thinking_levels=("off", "low", "medium", "high"),
    ),
    ModelCatalogEntry(
        "VladimirGav/gemma4-26b-16GB-VRAM",
        "Gemma 4 26B 16GB (default)",
        thinking_levels=("off", "on"),
    ),
    ModelCatalogEntry(
        "gemma4:12b",
        "Gemma 4 12B",
        vision=True,
        thinking_levels=("off", "on"),
    ),
    ModelCatalogEntry(
        "qwen3.5:9b",
        "Qwen 3.5 9B",
        vision=True,
        thinking_levels=("off", "on"),
    ),
)

ALLOWED_MODELS: tuple[tuple[str, str], ...] = tuple(
    (entry.name, entry.label) for entry in MODEL_CATALOG
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
    vision: bool = False
    thinking_levels: list[ThinkingLevel] = Field(default_factory=list)


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


# Composable workflows: ports are the artifacts that move between stages, and a
# workflow is a hand-linked graph of pasted inputs and stages.
class PortCheck(BaseModel):
    """Structural verification of one pasted input: does it parse, how many items."""

    ok: bool
    #: Items found - videos, shots, specs - so the UI can show "8 videos".
    count: int = 0
    summary: str = ""
    errors: list[str] = Field(default_factory=list)


class PortInfo(BaseModel):
    id: str
    label: str
    hint: str


class StageInfo(BaseModel):
    id: str
    label: str
    description: str
    inputs: list[str]
    outputs: list[str]


class StagesResponse(BaseModel):
    stages: list[StageInfo]
    ports: list[PortInfo]


class ValidatePortRequest(BaseModel):
    port: str
    text: str = ""


class WorkflowNode(BaseModel):
    id: str
    #: "input" for a pasted text box, "stage" for something that runs.
    kind: Literal["input", "stage"]
    #: Set on input nodes: which port the pasted text is.
    port: str = ""
    #: Set on stage nodes: which stage runs.
    stage: str = ""
    text: str = ""
    position: dict[str, float] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    source: str
    target: str
    source_handle: str = ""
    target_handle: str = ""


class WorkflowDefinition(BaseModel):
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)


class WorkflowResponse(BaseModel):
    workflow: WorkflowDefinition


class FlexibleWorkflowFile(BaseModel):
    name: str
    workflow: dict[str, Any] = Field(default_factory=dict)


class FlexibleWorkflowLibraryResponse(BaseModel):
    library: dict[str, Any] = Field(default_factory=dict)


class SaveFlexibleWorkflowRequest(BaseModel):
    workflow: dict[str, Any] = Field(default_factory=dict)


class DeleteFlexibleWorkflowResponse(BaseModel):
    deleted: str


class RunWorkflowRequest(BaseModel):
    model: str = DEFAULT_MODEL


class FlexibleLlmRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str = DEFAULT_MODEL
    thinking: ThinkingLevel = DEFAULT_THINKING_LEVEL


class FlexibleLlmResponse(BaseModel):
    output: str


class FlexibleImageLlmRequest(BaseModel):
    prompt: str = Field(min_length=1)
    image_url: str = Field(min_length=1)
    model: str = DEFAULT_VISION_MODEL


class FlexibleImageLlmResponse(BaseModel):
    output: str


class ComfyImageInfo(BaseModel):
    name: str
    url: str
    size_bytes: int
    updated_at: float


class ComfyImageListResponse(BaseModel):
    images: list[ComfyImageInfo] = Field(default_factory=list)
    input_dir: str


class UploadComfyImageRequest(BaseModel):
    filename: str = Field(min_length=1)
    #: Browser uploads arrive as a data URL so FastAPI does not need multipart parsing.
    data_url: str = Field(min_length=1)


class UploadComfyImageResponse(BaseModel):
    image: ComfyImageInfo


class GenerateComfyImageRequest(BaseModel):
    prompt: str = Field(min_length=1)
    #: A filename from the image input folder, or a URL returned by this API.
    reference_image: str = Field(min_length=1)
    #: None means the backend chooses a fresh timestamp-derived seed.
    seed: int | None = None
    steps: int = Field(default=8, ge=1, le=150)
    strength: float = Field(default=1.0, ge=0.0, le=2.0)
    timeout_seconds: int = Field(default=900, ge=5, le=3600)


class GenerateComfyImageResponse(BaseModel):
    url: str
    filename: str
    reference_image: str
    prompt_id: str
    seed: int


class FrameDeltaDetail(BaseModel):
    """What actually moves between the two frames, split by what is moving.

    The frame writer fills these four separately so a later video stage is told
    the performance, the staging, and the camera as distinct instructions rather
    than one sentence that mixes them.
    """

    emotion: str = ""
    character_movement: str = ""
    background_movement: str = ""
    camera_movement: str = ""

    def lines(self) -> list[str]:
        return [
            f"{label}: {value}"
            for label, value in (
                ("Emotion", self.emotion),
                ("Character movement", self.character_movement),
                ("Background movement", self.background_movement),
                ("Camera movement", self.camera_movement),
            )
            if value.strip()
        ]


class FrameDelta(BaseModel):
    """One shot's entry in the frame plan: where it starts, ends, and how."""

    ref: str
    title: str
    first_frame: str = ""
    last_frame: str = ""
    #: One-line summary of the change; `detail` carries the breakdown.
    delta: str = ""
    detail: FrameDeltaDetail = Field(default_factory=FrameDeltaDetail)
    #: What the describer and asset picker decided, kept for the UI and results.
    description: str = ""
    emotion: str = ""
    assets: dict[str, Any] = Field(default_factory=dict)


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
