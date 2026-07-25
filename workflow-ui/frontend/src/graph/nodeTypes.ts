import type { Node } from '@xyflow/react';
import {
  AggregateNode,
  ArtifactNode,
  AssetCatalogNode,
  BoardRewriterNode,
  FlexibleAgentNode,
  FlexibleIfNode,
  FlexibleJsonNode,
  FlexibleSplitNode,
  FlexibleTextNode,
  InputNode,
  JsonAssetsNode,
  JsonFramesNode,
  JudgeNode,
  PromptNode,
  SceneNode,
  ShotRewriterNode,
  ShotsListNode,
  StageNode,
  VideoDetailerNode,
  VideoListNode,
} from '../nodes';

/** Maps a node's `type` to the component that renders it. */
export const nodeTypes = {
  prompt: PromptNode,
  scene: SceneNode,
  aggregate: AggregateNode,
  assetCatalog: AssetCatalogNode,
  jsonAssets: JsonAssetsNode,
  jsonFrames: JsonFramesNode,
  boardRewriter: BoardRewriterNode,
  videoList: VideoListNode,
  shotsList: ShotsListNode,
  videoDetailer: VideoDetailerNode,
  shotRewriter: ShotRewriterNode,
  judge: JudgeNode,
  artifacts: ArtifactNode,
  composerInput: InputNode,
  composerStage: StageNode,
  flexibleAgent: FlexibleAgentNode,
  flexibleIf: FlexibleIfNode,
  flexibleJson: FlexibleJsonNode,
  flexibleSplit: FlexibleSplitNode,
  flexibleText: FlexibleTextNode,
};

const MINIMAP_COLORS: Record<string, string> = {
  prompt: '#116466',
  scene: '#cc8a1f',
  aggregate: '#2d2922',
  assetCatalog: '#7c5b2c',
  jsonAssets: '#3f6f8f',
  jsonFrames: '#2f5f7f',
  boardRewriter: '#6b4f9f',
  videoList: '#cc8a1f',
  shotsList: '#2f7f6a',
  videoDetailer: '#1f6f5c',
  shotRewriter: '#8a4f7d',
  judge: '#a83b45',
  artifacts: '#4b6f9f',
  composerInput: '#7c5b2c',
  composerStage: '#116466',
  flexibleAgent: '#116466',
  flexibleIf: '#8a4f7d',
  flexibleJson: '#8a6f2f',
  flexibleSplit: '#2f7f6a',
  flexibleText: '#7c5b2c',
};

const MINIMAP_FALLBACK = '#6f685d';

export function minimapNodeColor(node: Node): string {
  return (node.type && MINIMAP_COLORS[node.type]) || MINIMAP_FALLBACK;
}
