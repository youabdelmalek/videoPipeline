/**
 * Where each node sits and how big it is.
 *
 * Positions are only defaults: once the user drags a node its position is kept
 * in `nodePositions` and this file is no longer consulted for it.
 */

import type { XYPosition } from '@xyflow/react';
import type { RunState } from '../api';

const COLLAPSED_SIZE = { initialWidth: 240, initialHeight: 92 };
const PANEL_SIZE = { initialWidth: 430, initialHeight: 460 };
const ARTIFACTS_SIZE = { initialWidth: 430, initialHeight: 420 };
const PROMPT_SIZE = { initialWidth: 370, initialHeight: 270 };
const FOLDER_SIZE = { initialWidth: 300, initialHeight: 220 };
const CARD_SIZE = { initialWidth: 340, initialHeight: 196 };

const PANEL_IDS = new Set([
  'story-pack',
  'aggregate',
  'prompt-enhancer',
  'small-story-generator',
  'story-judge',
  'separator-judge',
  'shots-judge',
  'frame-deltas',
  'frame-delta-judge',
  'manual-video-judge',
  'board-rewriter',
  'asset-extraction-judge',
  'json-assets-judge',
  'json-frames-judge',
  'asset-detailer',
  'final-videos',
]);
/** Taller than a panel: a video list plus the output preview. */
const PICKER_SIZE = { initialWidth: 430, initialHeight: 560 };
const PICKER_IDS = new Set(['video-detailer', 'shot-rewriter']);

/** The two primary list nodes: a row per video, so they need room. */
const VIDEO_LIST_SIZE = { initialWidth: 460, initialHeight: 600 };
const SHOTS_LIST_SIZE = { initialWidth: 520, initialHeight: 640 };
const ASSET_CATALOG_SIZE = { initialWidth: 560, initialHeight: 640 };

const SCENE_COLUMN_WIDTH = 380;
const SCENE_ROW_HEIGHT = 250;
const SCENES_PER_COLUMN = 5;

export type NodeSize = { initialWidth: number; initialHeight: number };

export function nodeDimensions(nodeId: string, collapsedNodeIds: Set<string>): NodeSize {
  if (collapsedNodeIds.has(nodeId)) {
    return COLLAPSED_SIZE;
  }
  if (nodeId === 'prompt') {
    return PROMPT_SIZE;
  }
  if (nodeId === 'video-list') {
    return VIDEO_LIST_SIZE;
  }
  if (nodeId === 'shots-list') {
    return SHOTS_LIST_SIZE;
  }
  if (nodeId === 'asset-catalog' || nodeId === 'json-assets' || nodeId === 'json-frames') {
    return ASSET_CATALOG_SIZE;
  }
  if (PANEL_IDS.has(nodeId)) {
    return PANEL_SIZE;
  }
  if (PICKER_IDS.has(nodeId)) {
    return PICKER_SIZE;
  }
  if (nodeId === 'artifacts') {
    return ARTIFACTS_SIZE;
  }
  if (nodeId.startsWith('folder-')) {
    return FOLDER_SIZE;
  }
  return CARD_SIZE;
}

/** Grid position for the Nth card in a column-major block of scene cards. */
function cardGridPosition(index: number, originX: number): XYPosition {
  const column = index < SCENES_PER_COLUMN ? 0 : 1;
  const row = index % SCENES_PER_COLUMN;
  return { x: originX + column * SCENE_COLUMN_WIDTH, y: row * SCENE_ROW_HEIGHT };
}

/**
 * The primary workflow runs left to right and wraps onto a second row.
 */
export function defaultNodePosition(nodeId: string, run: RunState | null): XYPosition {
  switch (nodeId) {
    case 'prompt':
      return { x: 0, y: 180 };
    case 'prompt-enhancer':
      return { x: 430, y: 60 };
    case 'small-story-generator':
      return { x: 920, y: 60 };
    case 'story-judge':
      return { x: 1410, y: 60 };
    case 'video-list':
      return { x: 1900, y: 60 };
    case 'separator-judge':
      return { x: 2420, y: 60 };
    case 'shots-list':
      return { x: 0, y: 760 };
    case 'shots-judge':
      return { x: 580, y: 760 };
    case 'asset-catalog':
      return { x: 1070, y: 760 };
    case 'asset-extraction-judge':
      return { x: 1690, y: 760 };
    case 'json-assets':
      return { x: 2180, y: 760 };
    case 'json-assets-judge':
      return { x: 2800, y: 760 };
    case 'frame-deltas':
      return { x: 3290, y: 760 };
    case 'frame-delta-judge':
      return { x: 3780, y: 760 };
    case 'json-frames':
      return { x: 4270, y: 760 };
    case 'json-frames-judge':
      return { x: 4890, y: 760 };

    // Advanced row.
    case 'story-pack':
    case 'aggregate':
      return { x: 430, y: 760 };
    case 'manual-video-judge':
      return { x: 920, y: 760 };
    case 'board-rewriter':
      return { x: 1410, y: 760 };
    case 'video-detailer':
      return { x: 1900, y: 760 };
    case 'shot-rewriter':
      return { x: 2390, y: 760 };
    case 'asset-detailer':
      return { x: 3370, y: 760 };
    case 'final-videos':
      return { x: 2880, y: 760 };
    case 'artifacts':
      return { x: run?.scenes.length ? 2880 : 1520, y: 60 };
  }

  const finalSceneMatch = /^final-scene-(\d+)$/.exec(nodeId);
  if (finalSceneMatch) {
    return cardGridPosition(Number(finalSceneMatch[1]) - 1, 3370);
  }

  return { x: 0, y: 0 };
}

/** Fallback spot for a folder that has never been positioned. */
export function folderFallbackPosition(index: number): XYPosition {
  return { x: 760, y: 160 + index * 240 };
}

const STATIC_LABELS: Record<string, string> = {
  prompt: 'Prompt',
  'prompt-enhancer': 'Prompt Enhancer',
  'small-story-generator': 'Small Story Generator',
  'story-judge': 'Story Judge',
  'video-list': 'Videos',
  'separator-judge': 'Separator Judge',
  'shots-list': 'Shots',
  'shots-judge': 'Shots Judge',
  'asset-catalog': 'Asset Catalog',
  'json-assets': 'JsonAssets',
  'json-assets-judge': 'JsonAssets Judge',
  'frame-deltas': 'Frame Deltas',
  'frame-delta-judge': 'Frame Delta Judge',
  'json-frames': 'JsonFrames',
  'json-frames-judge': 'JsonFrames Judge',
  aggregate: 'Raw Video Bullet Board',
  'story-pack': 'Packed Story',
  'manual-video-judge': 'Manual Video Judge',
  'board-rewriter': 'Board Rewriter',
  'video-detailer': 'Video Detailer',
  'shot-rewriter': 'Shot Rewriter',
  'asset-extraction-judge': 'Asset Extraction Judge',
  'asset-detailer': 'Asset Detailer',
  'final-videos': 'Final Rewritten Videos',
  artifacts: 'Ollama Logs',
};

/** Human-readable name, used for the child list inside folder nodes. */
export function nodeLabel(nodeId: string, run: RunState | null): string {
  const staticLabel = STATIC_LABELS[nodeId];
  if (staticLabel) {
    return staticLabel;
  }

  const finalSceneMatch = /^final-scene-(\d+)$/.exec(nodeId);
  if (finalSceneMatch) {
    const index = Number(finalSceneMatch[1]);
    const title = run?.rewritten_scenes?.find((scene) => scene.index === index)?.title;
    return `Final Video ${String(index).padStart(2, '0')}${title ? ` - ${title}` : ''}`;
  }

  const sceneMatch = /^scene-(\d+)$/.exec(nodeId);
  if (sceneMatch) {
    const index = Number(sceneMatch[1]);
    const title = run?.scenes.find((scene) => scene.index === index)?.title;
    return `Video ${String(index).padStart(2, '0')}${title ? ` - ${title}` : ''}`;
  }

  return nodeId;
}
