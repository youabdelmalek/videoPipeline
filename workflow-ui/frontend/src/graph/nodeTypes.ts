import type { Node } from '@xyflow/react';
import {
  AggregateNode,
  ArtifactNode,
  AssetCatalogNode,
  BoardRewriterNode,
  JsonAssetsNode,
  JsonFramesNode,
  JudgeNode,
  PromptNode,
  SceneNode,
  ShotRewriterNode,
  ShotsListNode,
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
};

const MINIMAP_FALLBACK = '#6f685d';

export function minimapNodeColor(node: Node): string {
  return (node.type && MINIMAP_COLORS[node.type]) || MINIMAP_FALLBACK;
}
