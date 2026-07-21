/**
 * Ctrl/Cmd+Z for canvas layout.
 *
 * A snapshot is exactly {positions, folders, selection}; any action that
 * changes those pushes one first.
 */

import { useCallback, useRef, useState } from 'react';
import { MAX_UNDO_SNAPSHOTS } from '../constants';
import type { FolderGroup } from '../nodes';
import type { NodePositionMap } from '../lib/folderHit';
import type { CanvasLayout } from './useCanvasLayout';

export type UndoSnapshot = {
  nodePositions: NodePositionMap;
  folders: FolderGroup[];
  selectedNodeIds: string[];
};

function cloneNodePositions(nodePositions: NodePositionMap): NodePositionMap {
  return Object.fromEntries(Object.entries(nodePositions).map(([id, position]) => [id, { ...position }]));
}

function cloneFolders(folders: FolderGroup[]): FolderGroup[] {
  return folders.map((folder) => ({ ...folder, childNodeIds: [...folder.childNodeIds] }));
}

export function useUndoStack(layout: CanvasLayout) {
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;

  const { refs, setNodePositions, setFolders, setSelectedNodeIds, setDropTargetFolderId } = layout;

  const createUndoSnapshot = useCallback(
    (): UndoSnapshot => ({
      nodePositions: cloneNodePositions(refs.nodePositions.current),
      folders: cloneFolders(refs.folders.current),
      selectedNodeIds: Array.from(refs.selectedNodeIds.current),
    }),
    [],
  );

  const pushUndoSnapshot = useCallback((snapshot?: UndoSnapshot) => {
    const next = snapshot ?? createUndoSnapshot();
    setUndoStack((current) => [...current.slice(-(MAX_UNDO_SNAPSHOTS - 1)), next]);
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (!snapshot) {
      return;
    }
    setNodePositions(cloneNodePositions(snapshot.nodePositions));
    setFolders(cloneFolders(snapshot.folders));
    setSelectedNodeIds(new Set(snapshot.selectedNodeIds));
    setDropTargetFolderId(null);
    setUndoStack((current) => current.slice(0, -1));
  }, []);

  const clearUndo = useCallback(() => setUndoStack([]), []);

  return { createUndoSnapshot, pushUndoSnapshot, undo, clearUndo };
}
