import time
from dataclasses import dataclass, field
from typing import Any, Literal
from pydantic import BaseModel, Field

ThinkingLevel = Literal["off", "on", "low", "medium", "high"]
AspectRatio = Literal["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"]
ImageGenerationWorkflow = Literal["style", "identity", "text_to_image"]
VideoGenerationWorkflow = Literal["ref2va", "fl2v", "ref2va_fast", "fl2v_fast"]
DEFAULT_MODEL = "gemma4:26b"
DEFAULT_VISION_MODEL = "qwen3.6:27b"
DEFAULT_THINKING_LEVEL: ThinkingLevel = "off"


@dataclass(frozen=True)
class ModelCatalogEntry:
    name: str
    label: str
    vision: bool = False
    thinking_levels: tuple[ThinkingLevel, ...] = ()


MODEL_CATALOG: tuple[ModelCatalogEntry, ...] = (
    ModelCatalogEntry(
        "qwen3.6:27b",
        "Qwen 3.6 27B",
        vision=True,
        thinking_levels=("off", "on"),
    ),
    ModelCatalogEntry(
        "gemma4:26b",
        "Gemma 4 26B",
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
BOARD_REWRITER_PROVIDER = "ollama"
TARGET_SHOTS = 16
MIN_SHOTS = 14
MAX_SHOTS = 20
MIN_VIDEO_SECONDS = 60
MAX_VIDEO_SECONDS = 90
HIGH_IMPACT_SECONDS = 10
HIGH_IMPACT_SHOTS = 2
MAX_SHOT_FIELD_CHARS = 200
MAX_SHOT_ATTEMPTS = 3
MAX_BEST_OF_ATTEMPTS = 3
EARLY_STOP_SCORE = 95
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
    provider: Literal["ollama"] = BOARD_REWRITER_PROVIDER
    model: str = ""


class DetailVideosRequest(BaseModel):
    model: str = DEFAULT_MODEL
    video_indexes: list[int] = Field(default_factory=list)


class RewriteShotsRequest(BaseModel):
    provider: Literal["ollama"] = SHOT_REWRITER_PROVIDER
    model: str = ""
    video_indexes: list[int] = Field(default_factory=list)


class BuildAssetCatalogRequest(BaseModel):
    model: str = DEFAULT_MODEL
    item_id: str = ""


class BuildJsonAssetsRequest(BaseModel):
    model: str = DEFAULT_MODEL
    item_id: str = ""


class BuildJsonFramesRequest(BaseModel):
    model: str = DEFAULT_MODEL
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
    index: int
    title: str
    text: str
    shots: list[ShotCard]
    total_seconds: int


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


class PortCheck(BaseModel):
    ok: bool
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
    kind: Literal["input", "stage"]
    port: str = ""
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


class WorkflowLogRequest(BaseModel):
    workflow_name: str = ""
    run_name: str = ""
    content: str = Field(min_length=1)


class WorkflowLogResponse(BaseModel):
    filename: str


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
    data_url: str = Field(min_length=1)


class UploadComfyImageResponse(BaseModel):
    image: ComfyImageInfo


class GenerateComfyImageRequest(BaseModel):
    prompt: str = Field(min_length=1)
    reference_image: str = ""
    workflow: ImageGenerationWorkflow = "style"
    aspect_ratio: AspectRatio = "1:1"
    seed: int | None = None
    steps: int = Field(default=8, ge=1, le=150)
    strength: float = Field(default=1.0, ge=0.0, le=2.0)
    timeout_seconds: int = Field(default=900, ge=5, le=3600)


class GenerateComfyImageResponse(BaseModel):
    url: str
    filename: str
    reference_image: str
    aspect_ratio: AspectRatio
    prompt_id: str
    seed: int


class GenerateComfyVideoRequest(BaseModel):
    prompt: str = Field(min_length=1)
    workflow: VideoGenerationWorkflow = "ref2va"
    character_image: str = ""
    background_image: str = ""
    first_frame: str = ""
    last_frame: str = ""
    aspect_ratio: AspectRatio = "16:9"
    duration_seconds: float = Field(default=5.0, ge=0.1, le=60.0)
    seed: int | None = None
    steps: int = Field(default=25, ge=1, le=150)
    timeout_seconds: int = Field(default=1800, ge=5, le=7200)


class GenerateComfyVideoResponse(BaseModel):
    url: str
    filename: str
    workflow: VideoGenerationWorkflow
    aspect_ratio: AspectRatio
    duration_seconds: float
    prompt_id: str
    seed: int


class FrameDeltaDetail(BaseModel):
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
    ref: str
    title: str
    first_frame: str = ""
    last_frame: str = ""
    delta: str = ""
    detail: FrameDeltaDetail = Field(default_factory=FrameDeltaDetail)
    description: str = ""
    emotion: str = ""
    assets: dict[str, Any] = Field(default_factory=dict)


class JsonFrameSpec(BaseModel):
    ref: str
    title: str
    filename: str
    spec: dict[str, Any] = Field(default_factory=dict)
    background: str = ""
    characters: list[str] = Field(default_factory=list)


class JsonAssetSpec(BaseModel):
    id: str
    name: str
    theme: AssetTheme
    filename: str
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
