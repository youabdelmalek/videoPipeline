/** Handlers React Flow calls directly: clicks, its own drag events, context menu. */

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import { clientPointFromEvent, viewportToFlowPosition } from '../lib/flowGeometry';
import { folderIdAtClientPoint, folderUnderNode, isFolderId } from '../lib/folderHit';
import type { CanvasLayout } from './useCanvasLayout';
import type { UndoSnapshot } from './useUndoStack';

const INTERACTIVE_SELECTOR = 'button, a, input, textarea';

type Deps = {
  layout: CanvasLayout;
  undo: { pushUndoSnapshot: (snapshot?: UndoSnapshot) => void };
  folderActions: {
    createFolder: (nodeIds: string[], position?: { x: number; y: number }) => void;
    addNodesToFolder: (folderId: string, nodeIds: string[]) => void;
  };
};

export function useNodeHandlers({ layout, undo, folderActions }: Deps) {
  const { refs, moveNode, setSelectedNodeIds, setDropTargetFolderId } = layout;

  const hitContext = () => ({
    folders: refs.folders.current,
    nodePositions: refs.nodePositions.current,
    collapsedNodeIds: refs.collapsedNodeIds.current,
  });

  function onNodeDrag(_event: unknown, node: Node) {
    moveNode(node.id, node.position);
    setDropTargetFolderId(folderUnderNode(node.id, node.position, hitContext()));
  }

  function onNodeDragStop(event: unknown, node: Node) {
    // Prefer the folder under the pointer; fall back to box overlap.
    const pointer = clientPointFromEvent(event);
    const targetFolderId =
      (pointer ? folderIdAtClientPoint(pointer, refs.folders.current) : null) ??
      folderUnderNode(node.id, node.position, hitContext()) ??
      layout.dropTargetFolderId;

    onNodeDrag(event, node);
    if (!targetFolderId || isFolderId(node.id)) {
      setDropTargetFolderId(null);
      return;
    }

    undo.pushUndoSnapshot();
    folderActions.addNodesToFolder(targetFolderId, [node.id]);
    setDropTargetFolderId(null);
  }

  function onNodeClick(event: ReactMouseEvent, node: Node) {
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) {
      return;
    }

    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    setSelectedNodeIds((current) => {
      if (!additive) {
        return new Set([node.id]);
      }
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }

  /** Right-click makes a folder: from the selection when over a node, else empty. */
  function onCanvasContextMenu(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    const overNode = (event.target as HTMLElement).closest('.react-flow__node');
    const childNodeIds = overNode
      ? Array.from(refs.selectedNodeIds.current).filter((nodeId) => !isFolderId(nodeId))
      : [];
    folderActions.createFolder(childNodeIds, viewportToFlowPosition(event.clientX, event.clientY));
  }

  return {
    onNodeDrag,
    onNodeDragStop,
    onNodeClick,
    onCanvasContextMenu,
    onPaneClick: () => setSelectedNodeIds(new Set()),
  };
}
