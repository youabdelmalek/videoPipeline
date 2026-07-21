/**
 * Where each node sits and how big it is.
 *
 * Nodes are not draggable, so these positions are the layout: `nodePositions`
 * only ever holds what React Flow itself reports back.
 */

import type { XYPosition } from '@xyflow/react';

const COLLAPSED_SIZE = { initialWidth: 240, initialHeight: 92 };
const PANEL_SIZE = { initialWidth: 430, initialHeight: 460 };
const ARTIFACTS_SIZE = { initialWidth: 430, initialHeight: 420 };
const PROMPT_SIZE = { initialWidth: 370, initialHeight: 270 };
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

/** Clears the second row, whose tallest cards (640px) start at y=760. */
const THIRD_ROW_Y = 1460;
/** Clears the third row, whose tallest cards (640px) start at THIRD_ROW_Y. */
const FOURTH_ROW_Y = 2160;

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
  return CARD_SIZE;
}

const COMPACT_COL_GAP = 60;
const COMPACT_ROW_GAP = 120;
/** Wrap the compact rows at roughly the width of the hand-tuned ones. */
const COMPACT_MAX_ROW_WIDTH = 3200;

/**
 * Positions for the primary-only view, flowed left to right and wrapped.
 *
 * With the judges hidden the hand-tuned table would leave a hole wherever one
 * used to sit, so that table is only used once Show Judge puts them back.
 */
export function compactPositions(
  nodeIds: string[],
  collapsedNodeIds: Set<string>,
): Record<string, XYPosition> {
  const positions: Record<string, XYPosition> = {};
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const nodeId of nodeIds) {
    const { initialWidth, initialHeight } = nodeDimensions(nodeId, collapsedNodeIds);
    if (x > 0 && x + initialWidth > COMPACT_MAX_ROW_WIDTH) {
      x = 0;
      y += rowHeight + COMPACT_ROW_GAP;
      rowHeight = 0;
    }
    positions[nodeId] = { x, y };
    x += initialWidth + COMPACT_COL_GAP;
    rowHeight = Math.max(rowHeight, initialHeight);
  }

  return positions;
}

/**
 * The primary workflow runs left to right and wraps onto a second row.
 */
export function defaultNodePosition(nodeId: string): XYPosition {
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
    // Third row: the JSON stages, wrapping back to the left margin.
    case 'json-assets':
      return { x: 0, y: THIRD_ROW_Y };
    case 'json-assets-judge':
      return { x: 620, y: THIRD_ROW_Y };
    case 'frame-deltas':
      return { x: 1110, y: THIRD_ROW_Y };
    case 'frame-delta-judge':
      return { x: 1600, y: THIRD_ROW_Y };
    case 'json-frames':
      return { x: 2090, y: THIRD_ROW_Y };
    case 'json-frames-judge':
      return { x: 2710, y: THIRD_ROW_Y };

    // Fourth row: the manual/legacy branch, below the main flow rather than on
    // top of the second row, where it used to overlap the shot and asset nodes.
    case 'manual-video-judge':
      return { x: 0, y: FOURTH_ROW_Y };
    case 'board-rewriter':
      return { x: 490, y: FOURTH_ROW_Y };
    case 'video-detailer':
      return { x: 980, y: FOURTH_ROW_Y };
    case 'shot-rewriter':
      return { x: 1470, y: FOURTH_ROW_Y };
  }

  return { x: 0, y: 0 };
}
