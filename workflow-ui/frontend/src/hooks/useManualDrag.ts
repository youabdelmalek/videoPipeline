/**
 * Dragging nodes by their header.
 *
 * React Flow's built-in dragging is disabled (`nodesDraggable={false}`) so that
 * a whole multi-selection moves together and can be dropped onto a folder.
 */

import { useEffect, useRef } from 'react';
import { flowScale } from '../lib/flowGeometry';
import { folderUnderNode, isFolderId, type NodePositionMap } from '../lib/folderHit';
import type { CanvasLayout } from './useCanvasLayout';
import type { UndoSnapshot } from './useUndoStack';

/** Pixels a node must move before the drag is worth an undo entry. */
const DRAG_THRESHOLD = 0.5;

type ManualDragState = {
  primaryNodeId: string;
  nodeIds: string[];
  startClientX: number;
  startClientY: number;
  startPositions: NodePositionMap;
  undoSnapshot: UndoSnapshot;
};

type Deps = {
  layout: CanvasLayout;
  undo: { pushUndoSnapshot: (snapshot?: UndoSnapshot) => void; createUndoSnapshot: () => UndoSnapshot };
  addNodesToFolder: (folderId: string, nodeIds: string[]) => void;
};

export function useManualDrag({ layout, undo, addNodesToFolder }: Deps) {
  const dragRef = useRef<ManualDragState | null>(null);
  const { refs, setNodePositions, setDropTargetFolderId } = layout;

  useEffect(() => {
    const hitContext = () => ({
      folders: refs.folders.current,
      nodePositions: refs.nodePositions.current,
      collapsedNodeIds: refs.collapsedNodeIds.current,
    });

    /** Where every dragged node sits given the pointer's travel so far. */
    const positionsFor = (drag: ManualDragState, event: MouseEvent): NodePositionMap => {
      const scale = flowScale();
      const deltaX = (event.clientX - drag.startClientX) / scale;
      const deltaY = (event.clientY - drag.startClientY) / scale;
      return Object.fromEntries(
        drag.nodeIds.map((nodeId) => {
          const start = drag.startPositions[nodeId];
          return [nodeId, { x: start.x + deltaX, y: start.y + deltaY }];
        }),
      );
    };

    function handleMouseMove(event: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const positions = positionsFor(drag, event);
      setNodePositions((current) => ({ ...current, ...positions }));
      setDropTargetFolderId(folderUnderNode(drag.primaryNodeId, positions[drag.primaryNodeId], hitContext()));
    }

    function handleMouseUp(event: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const positions = positionsFor(drag, event);
      const targetFolderId = folderUnderNode(drag.primaryNodeId, positions[drag.primaryNodeId], hitContext());
      const moved = drag.nodeIds.some((nodeId) => {
        const start = drag.startPositions[nodeId];
        const next = positions[nodeId];
        return Math.abs(next.x - start.x) > DRAG_THRESHOLD || Math.abs(next.y - start.y) > DRAG_THRESHOLD;
      });

      if (moved || targetFolderId) {
        undo.pushUndoSnapshot(drag.undoSnapshot);
      }
      if (targetFolderId) {
        const children = drag.nodeIds.filter((nodeId) => !isFolderId(nodeId) && nodeId !== targetFolderId);
        addNodesToFolder(targetFolderId, children);
      }

      dragRef.current = null;
      setDropTargetFolderId(null);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  /** Called from a node header's mousedown. */
  function onStartNodeDrag(nodeId: string, clientX: number, clientY: number) {
    const selected = refs.selectedNodeIds.current;
    const nodeIds = selected.has(nodeId) && selected.size > 1 ? Array.from(selected) : [nodeId];
    const startPositions = Object.fromEntries(
      nodeIds.map((id) => [id, refs.nodePositions.current[id] ?? { x: 0, y: 0 }]),
    ) as NodePositionMap;

    dragRef.current = {
      primaryNodeId: nodeId,
      nodeIds,
      startClientX: clientX,
      startClientY: clientY,
      startPositions,
      undoSnapshot: undo.createUndoSnapshot(),
    };
  }

  return { onStartNodeDrag };
}
