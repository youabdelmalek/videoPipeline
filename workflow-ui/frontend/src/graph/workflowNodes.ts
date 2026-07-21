/**
 * Declarative description of the current workflow canvas.
 *
 * The visible lane mirrors the real pipeline:
 * prompt -> enhancer -> story generator -> story judge -> separator ->
 * separator judge -> shots -> shots judge -> assets -> asset judge ->
 * frame delta -> frame judge.
 */

import type { RunState } from '../api';
import type {
  AssetCatalogNodeData,
  BoardRewriterNodeData,
  CollapsibleNodeData,
  JsonAssetsNodeData,
  JsonFramesNodeData,
  JudgeNodeData,
  PromptNodeData,
  ShotRewriterNodeData,
  ShotsListNodeData,
  VideoDetailerNodeData,
  VideoListNodeData,
} from '../nodes';

export type NodeSpecContext = {
  run: RunState | null;
  promptData: Omit<PromptNodeData, keyof CollapsibleNodeData>;
  videoListData: Omit<VideoListNodeData, keyof CollapsibleNodeData>;
  shotsListData: Omit<ShotsListNodeData, keyof CollapsibleNodeData>;
  judgeData: Omit<JudgeNodeData, keyof CollapsibleNodeData>;
  boardRewriterData: Omit<BoardRewriterNodeData, keyof CollapsibleNodeData>;
  videoDetailerData: Omit<VideoDetailerNodeData, keyof CollapsibleNodeData>;
  shotRewriterData: Omit<ShotRewriterNodeData, keyof CollapsibleNodeData>;
  assetCatalogData: Omit<AssetCatalogNodeData, keyof CollapsibleNodeData>;
  jsonAssetsData: Omit<JsonAssetsNodeData, keyof CollapsibleNodeData>;
  jsonFramesData: Omit<JsonFramesNodeData, keyof CollapsibleNodeData>;
};

export type WorkflowNodeSpec = {
  id: string;
  type: string;
  advanced?: boolean;
  data: (ctx: NodeSpecContext) => Record<string, unknown>;
};

export type WorkflowEdgeSpec = {
  id: string;
  source: string;
  target: string;
  when?: (run: RunState | null) => boolean;
};

const inputFor = (run: RunState | null, ...stages: string[]) =>
  stages.map((stage) => run?.agent_inputs?.[stage]).find((text) => text?.trim()) ?? '';

const textNode = (
  kicker: string,
  title: string,
  text: string | null | undefined,
  inputText = '',
  downloadable = false,
) => ({
  kicker,
  title,
  inputText,
  text: text ?? '',
  downloadable,
});

export const WORKFLOW_NODES: WorkflowNodeSpec[] = [
  { id: 'prompt', type: 'prompt', data: (ctx) => ({ ...ctx.promptData }) },
  {
    id: 'prompt-enhancer',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode('Prompt Enhancer', 'Enhanced Prompt', ctx.run?.enhanced_prompt_text, inputFor(ctx.run, 'prompt_enhancer')),
  },
  {
    id: 'small-story-generator',
    type: 'aggregate',
    data: (ctx) =>
      textNode(
        'Small Story Generator',
        'Connected Small Stories',
        ctx.run?.small_stories_text,
        inputFor(ctx.run, 'small_story_generator'),
      ),
  },
  {
    id: 'story-judge',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode(
        'Story Judge',
        ctx.run?.story_judge_verdict ?? 'Best Of 5',
        ctx.run?.story_judge_text,
        inputFor(ctx.run, 'story_judge'),
        true,
      ),
  },
  { id: 'video-list', type: 'videoList', data: (ctx) => ({ ...ctx.videoListData }) },
  {
    id: 'separator-judge',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode(
        'Separator Judge',
        ctx.run?.separator_judge_verdict ?? 'Best Of 5',
        ctx.run?.separator_judge_text,
        inputFor(ctx.run, 'separator_judge'),
        true,
      ),
  },
  { id: 'shots-list', type: 'shotsList', data: (ctx) => ({ ...ctx.shotsListData }) },
  {
    id: 'shots-judge',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode(
        'Shots Judge',
        ctx.run?.shot_judge_verdict ?? 'Best Per Video',
        ctx.run?.shot_judge_text,
        inputFor(ctx.run, 'shot_judge'),
      ),
  },
  { id: 'asset-catalog', type: 'assetCatalog', data: (ctx) => ({ ...ctx.assetCatalogData }) },
  {
    id: 'asset-extraction-judge',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode(
        'Asset Judge',
        ctx.run?.asset_judge_verdict ?? 'Best Of 5',
        ctx.run?.asset_judge_text,
        inputFor(ctx.run, 'asset_judge'),
        true,
      ),
  },
  { id: 'json-assets', type: 'jsonAssets', data: (ctx) => ({ ...ctx.jsonAssetsData }) },
  {
    id: 'json-assets-judge',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode(
        'JsonAssets Judge',
        ctx.run?.json_assets_judge_verdict ?? 'Best Of 5',
        ctx.run?.json_assets_judge_text,
        inputFor(ctx.run, 'json_assets_judge'),
        true,
      ),
  },
  {
    id: 'frame-deltas',
    type: 'aggregate',
    data: (ctx) =>
      textNode(
        'Frame Delta Agent',
        'First / Last Frame + Delta',
        ctx.run?.frame_deltas_text,
        inputFor(ctx.run, 'frame_delta'),
      ),
  },
  {
    id: 'frame-delta-judge',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode(
        'Frame Delta Judge',
        ctx.run?.frame_judge_verdict ?? 'Best Of 5',
        ctx.run?.frame_judge_text,
        inputFor(ctx.run, 'frame_delta_judge'),
        true,
      ),
  },
  { id: 'json-frames', type: 'jsonFrames', data: (ctx) => ({ ...ctx.jsonFramesData }) },
  {
    id: 'json-frames-judge',
    type: 'aggregate',
    advanced: true,
    data: (ctx) =>
      textNode(
        'JsonFrames Judge',
        ctx.run?.json_frames_judge_verdict ?? 'Best Of 5',
        ctx.run?.json_frames_judge_text,
        inputFor(ctx.run, 'json_frames_judge'),
        true,
      ),
  },

  // Optional old/manual controls stay available only behind Show Judge for debugging.
  { id: 'manual-video-judge', type: 'judge', advanced: true, data: (ctx) => ({ ...ctx.judgeData }) },
  { id: 'board-rewriter', type: 'boardRewriter', advanced: true, data: (ctx) => ({ ...ctx.boardRewriterData }) },
  { id: 'video-detailer', type: 'videoDetailer', advanced: true, data: (ctx) => ({ ...ctx.videoDetailerData }) },
  { id: 'shot-rewriter', type: 'shotRewriter', advanced: true, data: (ctx) => ({ ...ctx.shotRewriterData }) },
];

export const WORKFLOW_EDGES: WorkflowEdgeSpec[] = [
  { id: 'prompt-prompt-enhancer', source: 'prompt', target: 'prompt-enhancer' },
  { id: 'prompt-enhancer-small-story-generator', source: 'prompt-enhancer', target: 'small-story-generator' },
  { id: 'small-story-generator-story-judge', source: 'small-story-generator', target: 'story-judge' },
  { id: 'story-judge-video-list', source: 'story-judge', target: 'video-list' },
  { id: 'video-list-separator-judge', source: 'video-list', target: 'separator-judge' },
  { id: 'separator-judge-shots-list', source: 'separator-judge', target: 'shots-list' },
  { id: 'shots-list-shots-judge', source: 'shots-list', target: 'shots-judge' },
  { id: 'shots-judge-asset-catalog', source: 'shots-judge', target: 'asset-catalog' },
  { id: 'asset-catalog-asset-extraction-judge', source: 'asset-catalog', target: 'asset-extraction-judge' },
  { id: 'asset-extraction-judge-json-assets', source: 'asset-extraction-judge', target: 'json-assets' },
  { id: 'json-assets-json-assets-judge', source: 'json-assets', target: 'json-assets-judge' },
  { id: 'json-assets-judge-frame-deltas', source: 'json-assets-judge', target: 'frame-deltas' },
  { id: 'frame-deltas-frame-delta-judge', source: 'frame-deltas', target: 'frame-delta-judge' },
  { id: 'frame-delta-judge-json-frames', source: 'frame-delta-judge', target: 'json-frames' },
  { id: 'json-frames-json-frames-judge', source: 'json-frames', target: 'json-frames-judge' },

  { id: 'manual-video-judge-board-rewriter', source: 'manual-video-judge', target: 'board-rewriter', when: (run) => Boolean(run?.scenes.length) },
  { id: 'board-rewriter-video-detailer', source: 'board-rewriter', target: 'video-detailer', when: (run) => Boolean(run?.scenes.length) },
  { id: 'video-detailer-shot-rewriter', source: 'video-detailer', target: 'shot-rewriter', when: (run) => Boolean(run?.detailed_videos?.length) },
];
