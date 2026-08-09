import type {
  ArtifactEntry,
  PortCheck,
  PortInfo,
  StageInfo,
  AssetCatalogGroup,
  BoardProvider,
  DetailedVideo,
  JsonAssetSpec,
  JsonFrameSpec,
  ModelOption,
  SceneCard,
  ShotProvider,
  ThinkingLevel,
} from '../api';
import type { PickableVideo } from './VideoPicker';

export type NodeDetail = {
  kicker: string;
  title: string;
  body: string;
  /**
   * Shot lists to browse instead of `body`. When set, the detail panel renders a
   * video picker and the full text of whichever videos are picked.
   */
  videos?: DetailedVideo[];
};

export type CollapsibleNodeData = {
  nodeId: string;
  collapsed: boolean;
  onToggleCollapse: (nodeId: string) => void;
  onOpenDetail: (detail: NodeDetail) => void;
};

export type PromptNodeData = CollapsibleNodeData & {
  prompt: string;
  model: string;
  models: ModelOption[];
  /** Set when Ollama could not be listed; shown under the picker. */
  modelsNotice: string | null;
  runSlug: string | null;
  disabled: boolean;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onGenerate: () => void;
};

export type SceneNodeData = CollapsibleNodeData & {
  scene: SceneCard;
  /** How many shots have been split from this video, or null if it has not run. */
  shotCount: number | null;
  disabled: boolean;
  /** Runs the shot splitter for this one video. */
  onSplitShots: () => void;
};

/** One row of the video list: a board video plus how far it has been taken. */
export type VideoListRow = {
  index: number;
  title: string;
  /** How many shots have been split from this video, or null if it has not run. */
  shotCount: number | null;
};

export type VideoListNodeData = CollapsibleNodeData & {
  videos: VideoListRow[];
  promptText?: string;
  /** Full board text, shown when the node's detail panel is opened. */
  boardText: string;
  /** True once the board rewriter has run. */
  polished: boolean;
  disabled: boolean;
  onSplitVideo: (videoIndex: number) => void;
  onSplitAll: () => void;
  onRewriteBoard: () => void;
};

export type ShotsListNodeData = CollapsibleNodeData & {
  videos: DetailedVideo[];
  promptText?: string;
  /** Every shot list joined, for the detail panel. */
  shotsText: string;
};

export type AssetCatalogNodeData = CollapsibleNodeData & {
  groups: AssetCatalogGroup[];
  promptText?: string;
  text: string | null;
  judgeVerdict: string | null;
  disabled: boolean;
  onBuildCatalog: () => void;
  onRegenerateAsset: (itemId: string) => void;
};

export type JsonAssetsNodeData = CollapsibleNodeData & {
  specs: JsonAssetSpec[];
  promptText?: string;
  text: string | null;
  judgeVerdict: string | null;
  disabled: boolean;
  onBuildJsonAssets: () => void;
  onRegenerateJsonAsset: (itemId: string) => void;
};

export type JsonFramesNodeData = CollapsibleNodeData & {
  frames: JsonFrameSpec[];
  promptText?: string;
  text: string | null;
  judgeVerdict: string | null;
  disabled: boolean;
  onBuildJsonFrames: () => void;
  onRegenerateJsonFrame: (shotRef: string) => void;
};

export type AggregateNodeData = CollapsibleNodeData & {
  kicker?: string;
  title: string;
  inputText?: string;
  text: string;
  downloadable?: boolean;
};

export type JudgeNodeData = CollapsibleNodeData & {
  text: string | null;
  verdict: string | null;
  disabled: boolean;
  onJudge: () => void;
};

export type BoardRewriterNodeData = CollapsibleNodeData & {
  text: string | null;
  provider: BoardProvider;
  disabled: boolean;
  onProviderChange: (provider: BoardProvider) => void;
  onRewrite: () => void;
};

/** Shared by the two shot nodes: pick videos, then run a job over them. */
type VideoSelectionNodeData = CollapsibleNodeData & {
  text: string | null;
  videos: PickableVideo[];
  selected: Set<number>;
  disabled: boolean;
  onToggleVideo: (index: number) => void;
  onSelectVideos: (indexes: number[]) => void;
};

export type VideoDetailerNodeData = VideoSelectionNodeData & {
  /** Which board the shots are being expanded from, for the node heading. */
  sourceLabel: string;
  detailed: DetailedVideo[];
  onDetail: () => void;
};

export type ShotRewriterNodeData = VideoSelectionNodeData & {
  provider: ShotProvider;
  polished: DetailedVideo[];
  onProviderChange: (provider: ShotProvider) => void;
  onRewriteShots: () => void;
};

export type ArtifactNodeData = CollapsibleNodeData & {
  slug: string | null;
  artifacts: ArtifactEntry[];
};


// Composed-workflow nodes. These are not collapsible: they are editors, not
// output panes, so they carry their own callbacks rather than CollapsibleNodeData.
export type InputNodeData = {
  nodeId: string;
  port: string;
  text: string;
  ports: PortInfo[];
  /** Latest structural check, or null while it is in flight. */
  check: PortCheck | null;
  onPortChange: (nodeId: string, port: string) => void;
  onTextChange: (nodeId: string, text: string) => void;
  onRemove: (nodeId: string) => void;
};

export type StageNodeData = {
  nodeId: string;
  stage: StageInfo;
  /** Input ports nothing is linked to yet. */
  unsatisfied: string[];
  portLabel: (port: string) => string;
  onRemove: (nodeId: string) => void;
};

export type FlexibleInput = {
  id: string;
  name: string;
  value: string;
};

export type FlexibleAgentNodeData = {
  nodeId: string;
  name: string;
  order: number;
  prompt: string;
  model: string;
  thinking: ThinkingLevel;
  models: ModelOption[];
  inputs: FlexibleInput[];
  output: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleAgentPatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onAddInput: (nodeId: string) => void;
  onRemoveInput: (nodeId: string, inputId: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleAgentPatch = {
  name: string;
  order: number;
  prompt: string;
  model: string;
  thinking: ThinkingLevel;
  output: string;
};

export type FlexiblePromptLoopNodeData = {
  nodeId: string;
  name: string;
  order: number;
  prompt: string;
  judgePrompt: string;
  fixerPrompt: string;
  model: string;
  thinking: ThinkingLevel;
  models: ModelOption[];
  threshold: number;
  maxRetries: number;
  score: string;
  fixes: string;
  approvedPrompt: string;
  attempts: number;
  trace: string;
  status: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexiblePromptLoopPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexiblePromptLoopPatch = {
  name: string;
  order: number;
  prompt: string;
  judgePrompt: string;
  fixerPrompt: string;
  model: string;
  thinking: ThinkingLevel;
  threshold: number;
  maxRetries: number;
  score: string;
  fixes: string;
  approvedPrompt: string;
  attempts: number;
  trace: string;
  status: string;
};

export type FlexibleTextNodeData = {
  nodeId: string;
  name: string;
  order: number;
  text: string;
  hasInput: boolean;
  hasOutput: boolean;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleTextPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleTextPatch = {
  name: string;
  order: number;
  text: string;
  hasInput: boolean;
  hasOutput: boolean;
};

export type FlexibleIfNodeData = {
  nodeId: string;
  name: string;
  order: number;
  input1: string;
  input2: string;
  condition: string;
  prompt: string;
  output1: string;
  output2: string;
  status: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleIfPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleIfPatch = {
  name: string;
  order: number;
  input1: string;
  input2: string;
  condition: string;
  prompt: string;
  output1: string;
  output2: string;
  status: string;
};

export type FlexibleSplitNodeData = {
  nodeId: string;
  name: string;
  order: number;
  input: string;
  delimiter: string;
  count: number;
  outputs: string[];
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleSplitPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleSplitPatch = {
  name: string;
  order: number;
  input: string;
  delimiter: string;
  count: number;
  outputs: string[];
};

export type FlexibleImageUploadNodeData = {
  nodeId: string;
  name: string;
  order: number;
  outputUrl: string;
  outputName: string;
  status: string;
  imageInputDir: string;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageUploadPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onUploadImage: (nodeId: string, file: File) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageUploadPatch = {
  name: string;
  order: number;
  outputUrl: string;
  outputName: string;
  status: string;
};

export type FlexibleImageDisplayNodeData = {
  nodeId: string;
  name: string;
  order: number;
  imageUrl: string;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageDisplayPatch>) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageDisplayPatch = {
  name: string;
  order: number;
  imageUrl: string;
};

export type FlexibleImageGenerateNodeData = {
  nodeId: string;
  name: string;
  order: number;
  prompt: string;
  inputs: FlexibleInput[];
  referenceImage: string;
  seed: string;
  steps: number;
  strength: number;
  outputUrl: string;
  outputName: string;
  status: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageGeneratePatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onAddInput: (nodeId: string) => void;
  onRemoveInput: (nodeId: string, inputId: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageGeneratePatch = {
  name: string;
  order: number;
  prompt: string;
  referenceImage: string;
  seed: string;
  steps: number;
  strength: number;
  outputUrl: string;
  outputName: string;
  status: string;
};

export type FlexibleImageTextNodeData = {
  nodeId: string;
  name: string;
  order: number;
  prompt: string;
  model: string;
  models: ModelOption[];
  imageUrl: string;
  inputs: FlexibleInput[];
  output: string;
  status: string;
  running: boolean;
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleImageTextPatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onAddInput: (nodeId: string) => void;
  onRemoveInput: (nodeId: string, inputId: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleImageTextPatch = {
  name: string;
  order: number;
  prompt: string;
  model: string;
  imageUrl: string;
  output: string;
  status: string;
};

export type FlexibleWorkflowInputNodeData = {
  nodeId: string;
  name: string;
  order: number;
  value: string;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleWorkflowInputPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleWorkflowInputPatch = {
  name: string;
  order: number;
  value: string;
};

export type FlexibleWorkflowOutputNodeData = {
  nodeId: string;
  name: string;
  order: number;
  value: string;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleWorkflowOutputPatch>) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleWorkflowOutputPatch = {
  name: string;
  order: number;
  value: string;
};

/** One saved workflow, for the workflow node's picker. */
export type WorkflowOption = {
  name: string;
};

export type FlexibleWorkflowNodeData = {
  nodeId: string;
  name: string;
  order: number;
  workflowName: string;
  inputs: FlexibleInput[];
  outputs: { name: string; value: string }[];
  status: string;
  running: boolean;
  workflowOptions: WorkflowOption[];
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleWorkflowPatch>) => void;
  onInputChange: (nodeId: string, inputId: string, patch: Partial<FlexibleInput>) => void;
  onPickWorkflow: (nodeId: string, workflowName: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleWorkflowPatch = {
  name: string;
  order: number;
  status: string;
};

export type FlexibleForEachNodeData = {
  nodeId: string;
  name: string;
  order: number;
  items: string;
  workflowName: string;
  output: string;
  threshold: number;
  maxAttempts: number;
  retryWith: 'result' | 'input';
  score: string;
  note: string;
  iterations: number;
  attempts: number;
  trace: string;
  status: string;
  running: boolean;
  workflowOptions: WorkflowOption[];
  pendingSourceNodeId: string | null;
  pendingSourceHandleId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleForEachPatch>) => void;
  onPickWorkflow: (nodeId: string, workflowName: string) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleForEachPatch = {
  name: string;
  order: number;
  items: string;
  workflowName: string;
  threshold: number;
  maxAttempts: number;
  retryWith: 'result' | 'input';
  output: string;
  score: string;
  note: string;
  iterations: number;
  attempts: number;
  trace: string;
  status: string;
};

export type FlexibleJsonNodeData = {
  nodeId: string;
  name: string;
  order: number;
  input: string;
  path: string;
  output: string;
  error: string | null;
  pendingSourceNodeId: string | null;
  onChange: (nodeId: string, patch: Partial<FlexibleJsonPatch>) => void;
  onPickOutput: (nodeId: string, handleId: string) => void;
  onPickInput: (nodeId: string, handleId: string) => void;
  onRun: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
};

export type FlexibleJsonPatch = {
  name: string;
  order: number;
  input: string;
  path: string;
  output: string;
  error: string | null;
};
