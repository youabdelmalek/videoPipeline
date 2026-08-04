/** Shapes returned by the backend. Mirrors `backend/models.py`. */

export type SceneCard = {
  index: number;
  title: string;
  body: string;
};

export type VideoCard = SceneCard;

export type ArtifactEntry = {
  label: string;
  path: string;
  workspace_path: string;
};

/**
 * Which backend the board rewriter step runs on. Kimi K3 is disabled, so
 * 'ollama' is the only value the API accepts; see backend/services/kimi.py.
 */
export type BoardProvider = 'ollama';

export type ThinkingLevel = 'off' | 'on' | 'low' | 'medium' | 'high';

/** One local model offered in the model picker. */
export type ModelOption = {
  name: string;
  label: string;
  size_bytes: number;
  installed: boolean;
  vision: boolean;
  thinking_levels: ThinkingLevel[];
};

export type ModelList = {
  models: ModelOption[];
  default: string;
  /** Set when Ollama could not be reached; nothing is marked installed. */
  unreachable: string | null;
};

/** Which backend the shot rewriter step runs on. Same vocabulary as the board. */
export type ShotProvider = BoardProvider;

export type ShotCard = {
  index: number;
  seconds: number;
  title: string;
  body: string;
};

/** One board video expanded into a flexible 60-90 second shot list. */
export type DetailedVideo = {
  index: number;
  title: string;
  text: string;
  shots: ShotCard[];
  total_seconds: number;
};

export type AssetTheme = 'background' | 'prop' | 'character';

export type AssetCatalogItem = {
  id: string;
  theme: AssetTheme;
  name: string;
  evidence: string;
  shot_refs: string[];
  detail: string;
};

export type AssetCatalogGroup = {
  theme: AssetTheme;
  title: string;
  items: AssetCatalogItem[];
};

/** One `<name>_asset_specification.json` file produced by the JsonAssets node. */
export type JsonAssetSpec = {
  id: string;
  name: string;
  theme: AssetTheme;
  filename: string;
  spec: Record<string, unknown>;
  angle_count: number;
  state_count: number;
};

/** One `<shot_ref>_frame_prompt.json` file produced by the JsonFrames node. */
export type JsonFrameSpec = {
  ref: string;
  title: string;
  filename: string;
  spec: Record<string, unknown>;
  background: string;
  characters: string[];
};

export type RunState = {
  slug: string;
  prompt: string;
  agent_inputs: Record<string, string>;
  enhanced_prompt_text: string | null;
  story_pack_text: string | null;
  small_stories_text: string | null;
  story_judge_text: string | null;
  story_judge_verdict: string | null;
  separator_judge_text: string | null;
  separator_judge_verdict: string | null;
  scenes_text: string | null;
  rewritten_board_text?: string | null;
  rewritten_scenes_text?: string | null;
  judge_text: string | null;
  judge_verdict: string | null;
  scenes: SceneCard[];
  rewritten_board?: SceneCard[];
  rewritten_scenes?: SceneCard[];
  detailed_videos?: DetailedVideo[];
  shot_judge_text?: string | null;
  shot_judge_verdict?: string | null;
  rewritten_shots?: DetailedVideo[];
  asset_catalog_text?: string | null;
  asset_judge_text?: string | null;
  asset_judge_verdict?: string | null;
  asset_detailer_text?: string | null;
  asset_catalog?: AssetCatalogGroup[];
  json_assets_text?: string | null;
  json_assets_judge_text?: string | null;
  json_assets_judge_verdict?: string | null;
  json_assets?: JsonAssetSpec[];
  frame_deltas_text?: string | null;
  frame_judge_text?: string | null;
  frame_judge_verdict?: string | null;
  json_frames_text?: string | null;
  json_frames_judge_text?: string | null;
  json_frames_judge_verdict?: string | null;
  json_frames?: JsonFrameSpec[];
  artifacts: ArtifactEntry[];
};

export type RunSummary = {
  slug: string;
  prompt_title: string;
  updated_at: number;
  has_workflow_ui: boolean;
  scenes_count: number;
  judge_verdict: string | null;
};

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export type JobState = {
  id: string;
  stage: string;
  run_slug: string;
  status: JobStatus;
  message: string;
  error: string | null;
  created_at: number;
  updated_at: number;
  events: string[];
};

// Composable workflows: the stage/port contracts the backend serves, and the
// hand-linked graph the canvas saves back.
export type PortInfo = {
  id: string;
  label: string;
  hint: string;
};

export type StageInfo = {
  id: string;
  label: string;
  description: string;
  inputs: string[];
  outputs: string[];
};

export type StageCatalog = {
  stages: StageInfo[];
  ports: PortInfo[];
};

export type PortCheck = {
  ok: boolean;
  count: number;
  summary: string;
  errors: string[];
};

export type WorkflowNode = {
  id: string;
  kind: 'input' | 'stage';
  port: string;
  stage: string;
  text: string;
  position: { x?: number; y?: number };
};

export type WorkflowEdge = {
  source: string;
  target: string;
  source_handle: string;
  target_handle: string;
};

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type FlexibleLlmResponse = {
  output: string;
};

export type FlexibleImageLlmResponse = {
  output: string;
};

export type ComfyImageInfo = {
  name: string;
  url: string;
  size_bytes: number;
  updated_at: number;
};

export type ComfyImageListResponse = {
  images: ComfyImageInfo[];
  input_dir: string;
};

export type UploadComfyImageResponse = {
  image: ComfyImageInfo;
};

export type GenerateComfyImageRequest = {
  prompt: string;
  reference_image: string;
  seed?: number | null;
  steps?: number;
  strength?: number;
  timeout_seconds?: number;
};

export type GenerateComfyImageResponse = {
  url: string;
  filename: string;
  reference_image: string;
  prompt_id: string;
  seed: number;
};
