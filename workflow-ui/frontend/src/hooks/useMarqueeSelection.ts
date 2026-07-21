/**
 * Drag-select on empty canvas.
 *
 * Selection is resolved against the rendered DOM boxes, which keeps it correct
 * at any zoom level without converting every node's size by hand.
 */

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { CanvasLayout } from './useCanvasLayout';

const NON_MARQUEE_SELECTOR =
  '.react-flow__node, button, a, input, textarea, .react-flow__controls, .react-flow__minimap';

export type SelectionBox = { startX: number; startY: number; currentX: number; currentY: number };

export function useMarqueeSelection(layout: CanvasLayout) {
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const { setSelectedNodeIds } = layout;

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const start = startRef.current;
      if (!start) {
        return;
      }
      setSelectionBox({ startX: start.x, startY: start.y, currentX: event.clientX, currentY: event.clientY });
    }

    function handleMouseUp(event: MouseEvent) {
      const start = startRef.current;
      if (!start) {
        return;
      }

      const box = {
        left: Math.min(start.x, event.clientX),
        right: Math.max(start.x, event.clientX),
        top: Math.min(start.y, event.clientY),
        bottom: Math.max(start.y, event.clientY),
      };

      const selectedIds = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right >= box.left && rect.left <= box.right && rect.bottom >= box.top && rect.top <= box.bottom;
        })
        .map((element) => element.dataset.id)
        .filter((nodeId): nodeId is string => Boolean(nodeId));

      setSelectedNodeIds(new Set(selectedIds));
      startRef.current = null;
      setSelectionBox(null);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  /** Left-press on empty canvas starts a marquee and clears the selection. */
  function onCanvasMouseDown(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest(NON_MARQUEE_SELECTOR)) {
      return;
    }
    startRef.current = { x: event.clientX, y: event.clientY };
    setSelectionBox({
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
    });
    setSelectedNodeIds(new Set());
  }

  return { selectionBox, onCanvasMouseDown };
}
