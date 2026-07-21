/**
 * Raw canvas layout state: where nodes sit, what is selected, what is folded.
 *
 * Undo (`useUndoStack`) and folder actions (`useFolderActions`) build on top of
 * this; `useCanvas` composes all three.
 */

import { useCallback, useRef, useState } from 'react';
import type { NodeChange, XYPosition } from '@xyflow/react';
import type { RunState } from '../api';
import type { FolderGroup, NodeDetail } from '../nodes';
import type { NodePositionMap } from '../lib/folderHit';

export type CanvasLayout = ReturnType<typeof useCanvasLayout>;

export function useCanvasLayout(run: RunState | null) {
  const [nodePositions, setNodePositions] = useState<NodePositionMap>({});
  const [folders, setFolders] = useState<FolderGroup[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(() => new Set());
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set());
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<NodeDetail | null>(null);
  const [flowResetKey, setFlowResetKey] = useState(0);

  // Pointer handlers are bound to `window` once, so they read live values
  // through refs rather than through stale closures.
  const refs = {
    nodePositions: useRef(nodePositions),
    folders: useRef(folders),
    selectedNodeIds: useRef(selectedNodeIds),
    collapsedNodeIds: useRef(collapsedNodeIds),
    run: useRef(run),
  };
  refs.nodePositions.current = nodePositions;
  refs.folders.current = folders;
  refs.selectedNodeIds.current = selectedNodeIds;
  refs.collapsedNodeIds.current = collapsedNodeIds;
  refs.run.current = run;

  const resetLayout = useCallback(() => {
    setNodePositions({});
    setFolders([]);
    setSelectedNodeIds(new Set());
    setCollapsedNodeIds(new Set());
    setDropTargetFolderId(null);
    setActiveDetail(null);
    setFlowResetKey((current) => current + 1);
  }, []);

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const moveNode = useCallback((nodeId: string, position: XYPosition) => {
    setNodePositions((current) => {
      const existing = current[nodeId];
      if (existing?.x === position.x && existing?.y === position.y) {
        return current;
      }
      return { ...current, [nodeId]: position };
    });
  }, []);

  /** Absorb React Flow's own position changes (fitView, programmatic moves). */
  const applyNodeChanges = useCallback((changes: NodeChange[]) => {
    setNodePositions((current) => {
      const next: NodePositionMap = { ...current };
      let changed = false;
      for (const change of changes) {
        if (change.type !== 'position' || !change.position) {
          continue;
        }
        const existing = current[change.id];
        if (existing?.x === change.position.x && existing?.y === change.position.y) {
          continue;
        }
        next[change.id] = change.position;
        changed = true;
      }
      return changed ? next : current;
    });
  }, []);

  return {
    nodePositions,
    folders,
    selectedNodeIds,
    collapsedNodeIds,
    dropTargetFolderId,
    activeDetail,
    flowResetKey,
    refs,
    setNodePositions,
    setFolders,
    setSelectedNodeIds,
    setDropTargetFolderId,
    setActiveDetail,
    resetLayout,
    toggleCollapse,
    moveNode,
    applyNodeChanges,
  };
}
