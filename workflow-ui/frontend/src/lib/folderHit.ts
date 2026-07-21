/** Hit-testing a dragged node against folder nodes, to decide the drop target. */

import type { XYPosition } from '@xyflow/react';
import { folderFallbackPosition, nodeDimensions } from '../graph/layout';
import type { FolderGroup } from '../nodes';
import { rectFromSize, rectsOverlap } from './flowGeometry';

export type NodePositionMap = Record<string, XYPosition>;

export type FolderHitContext = {
  folders: FolderGroup[];
  nodePositions: NodePositionMap;
  collapsedNodeIds: Set<string>;
};

function nodeRect(nodeId: string, position: XYPosition, collapsedNodeIds: Set<string>) {
  const { initialWidth, initialHeight } = nodeDimensions(nodeId, collapsedNodeIds);
  return rectFromSize(position, initialWidth, initialHeight);
}

/** The folder a node at `position` would drop into, or null. */
export function folderIdForNodePosition(
  nodeId: string,
  position: XYPosition,
  ctx: FolderHitContext,
): string | null {
  const draggedRect = nodeRect(nodeId, position, ctx.collapsedNodeIds);

  const targetFolder = ctx.folders.find((folder, index) => {
    const folderPosition = ctx.nodePositions[folder.id] ?? folderFallbackPosition(index);
    return rectsOverlap(draggedRect, nodeRect(folder.id, folderPosition, ctx.collapsedNodeIds));
  });

  return targetFolder?.id ?? null;
}

/** As above, but a folder is never dropped into another folder. */
export function folderUnderNode(
  nodeId: string,
  position: XYPosition,
  ctx: FolderHitContext,
): string | null {
  return isFolderId(nodeId) ? null : folderIdForNodePosition(nodeId, position, ctx);
}

/** The folder directly under a screen point, using the rendered DOM boxes. */
export function folderIdAtClientPoint(
  point: { x: number; y: number },
  folders: FolderGroup[],
): string | null {
  const match = folders.find((folder) => {
    const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${folder.id}"]`);
    const box = element?.getBoundingClientRect();
    return (
      !!box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
    );
  });
  return match?.id ?? null;
}

export function isFolderId(nodeId: string): boolean {
  return nodeId.startsWith('folder-');
}
