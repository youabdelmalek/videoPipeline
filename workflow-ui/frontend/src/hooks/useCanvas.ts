/**
 * Everything the canvas needs, assembled from the focused hooks in this folder.
 * App only ever talks to this.
 */

import { useCallback } from 'react';
import type { RunState } from '../api';
import { useCanvasLayout } from './useCanvasLayout';
import { useEscapeKey } from './useHotkeys';
import { useNodeHandlers } from './useNodeHandlers';

export function useCanvas(run: RunState | null) {
  const layout = useCanvasLayout(run);
  const nodeHandlers = useNodeHandlers({ layout });

  useEscapeKey(Boolean(layout.activeDetail), () => layout.setActiveDetail(null));

  // resetLayout is stable, so this stays stable too.
  const reset = useCallback(() => {
    layout.resetLayout();
  }, []);

  return {
    ...layout,
    ...nodeHandlers,
    reset,
  };
}
