import type {
  ArtifactEntry,
  AssetCatalogGroup,
  BoardProvider,
  DetailedVideo,
  JsonAssetSpec,
  JsonFrameSpec,
  ModelOption,
  SceneCard,
  ShotProvider,
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
  onStartNodeDrag: (nodeId: string, clientX: number, clientY: number) => void;
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

export type FolderGroup = {
  id: string;
  title: string;
  childNodeIds: string[];
};

export type FolderNodeData = {
  folder: FolderGroup;
  childLabels: string[];
  isDropTarget: boolean;
  onStartNodeDrag: (nodeId: string, clientX: number, clientY: number) => void;
  onExpandFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
};
