/** Creating, filling, dissolving, and deleting folder nodes. */

import { useCallback } from 'react';
import type { XYPosition } from '@xyflow/react';
import { defaultNodePosition, folderFallbackPosition } from '../graph/layout';
import type { CanvasLayout } from './useCanvasLayout';
import type { UndoSnapshot } from './useUndoStack';

type UndoApi = { pushUndoSnapshot: (snapshot?: UndoSnapshot) => void };

export function useFolderActions(layout: CanvasLayout, undo: UndoApi) {
  const { refs, setFolders, setNodePositions, setSelectedNodeIds, setDropTargetFolderId } = layout;
  const { pushUndoSnapshot } = undo;

  const createFolder = useCallback((childNodeIds: string[], position?: XYPosition) => {
    pushUndoSnapshot();
    const firstChild = childNodeIds[0];
    const folderPosition =
      position ??
      (firstChild
        ? refs.nodePositions.current[firstChild] ?? defaultNodePosition(firstChild, refs.run.current)
        : folderFallbackPosition(refs.folders.current.length));

    const folderId = `folder-${Date.now()}`;
    setFolders((current) => [
      ...current,
      { id: folderId, title: `Folder ${current.length + 1}`, childNodeIds },
    ]);
    setNodePositions((current) => ({ ...current, [folderId]: folderPosition }));
    setSelectedNodeIds(new Set([folderId]));
  }, []);

  /** Dissolve a folder, returning its children to the canvas. */
  const expandFolder = useCallback((folderId: string) => {
    pushUndoSnapshot();
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setSelectedNodeIds(new Set());
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    pushUndoSnapshot();
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setNodePositions((current) => {
      const next = { ...current };
      delete next[folderId];
      return next;
    });
    setSelectedNodeIds((current) => {
      const next = new Set(current);
      next.delete(folderId);
      return next;
    });
    setDropTargetFolderId((current) => (current === folderId ? null : current));
  }, []);

  /** Drop nodes into a folder and select it. Ignores duplicates. */
  const addNodesToFolder = useCallback((folderId: string, nodeIds: string[]) => {
    setFolders((current) =>
      current.map((folder) =>
        folder.id === folderId
          ? { ...folder, childNodeIds: Array.from(new Set([...folder.childNodeIds, ...nodeIds])) }
          : folder,
      ),
    );
    setSelectedNodeIds(new Set([folderId]));
  }, []);

  return { createFolder, expandFolder, deleteFolder, addNodesToFolder };
}
