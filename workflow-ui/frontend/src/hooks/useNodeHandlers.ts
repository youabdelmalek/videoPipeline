/** Handlers React Flow calls directly: node clicks and pane clicks. */

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import type { CanvasLayout } from './useCanvasLayout';

const INTERACTIVE_SELECTOR = 'button, a, input, textarea';

type Deps = {
  layout: CanvasLayout;
};

export function useNodeHandlers({ layout }: Deps) {
  const { setSelectedNodeIds } = layout;

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

  return {
    onNodeClick,
    onPaneClick: () => setSelectedNodeIds(new Set()),
  };
}
