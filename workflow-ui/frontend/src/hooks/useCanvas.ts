/**
 * Everything the canvas needs, assembled from the focused hooks in this folder.
 * App only ever talks to this.
 */

import { useCallback } from 'react';
import type { RunState } from '../api';
import { useCanvasLayout } from './useCanvasLayout';
import { useFolderActions } from './useFolderActions';
import { useEscapeKey, useUndoHotkey } from './useHotkeys';
import { useManualDrag } from './useManualDrag';
import { useMarqueeSelection } from './useMarqueeSelection';
import { useNodeHandlers } from './useNodeHandlers';
import { useUndoStack } from './useUndoStack';

export function useCanvas(run: RunState | null) {
  const layout = useCanvasLayout(run);
  const undo = useUndoStack(layout);
  const folderActions = useFolderActions(layout, undo);

  const manualDrag = useManualDrag({ layout, undo, addNodesToFolder: folderActions.addNodesToFolder });
  const marquee = useMarqueeSelection(layout);
  const nodeHandlers = useNodeHandlers({ layout, undo, folderActions });

  useUndoHotkey(undo.undo);
  useEscapeKey(Boolean(layout.activeDetail), () => layout.setActiveDetail(null));

  // resetLayout and clearUndo are both stable, so this stays stable too.
  const reset = useCallback(() => {
    layout.resetLayout();
    undo.clearUndo();
  }, []);

  return {
    ...layout,
    ...folderActions,
    ...nodeHandlers,
    onStartNodeDrag: manualDrag.onStartNodeDrag,
    onCanvasMouseDown: marquee.onCanvasMouseDown,
    selectionBox: marquee.selectionBox,
    reset,
  };
}
