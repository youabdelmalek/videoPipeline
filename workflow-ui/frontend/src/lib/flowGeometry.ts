/**
 * Screen <-> canvas coordinate helpers.
 *
 * React Flow applies pan/zoom as a CSS transform on `.react-flow__viewport`, so
 * these read that transform directly rather than holding a store instance.
 */

import type { XYPosition } from '@xyflow/react';

export type Rect = { left: number; right: number; top: number; bottom: number };

function viewportTransform(): DOMMatrixReadOnly | null {
  const pane = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!pane) {
    return null;
  }
  const transform = getComputedStyle(pane).transform;
  if (!transform || transform === 'none') {
    return null;
  }
  return new DOMMatrixReadOnly(transform);
}

/** Current zoom level, or 1 when the canvas has not been transformed yet. */
export function flowScale(): number {
  return viewportTransform()?.a || 1;
}

/** Convert a screen point into canvas coordinates. */
export function viewportToFlowPosition(clientX: number, clientY: number): XYPosition {
  const wrapper = document.querySelector<HTMLElement>('.react-flow');
  if (!wrapper) {
    return { x: clientX, y: clientY };
  }

  const rect = wrapper.getBoundingClientRect();
  const matrix = viewportTransform();
  if (!matrix) {
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  return {
    x: (clientX - rect.left - matrix.m41) / matrix.a,
    y: (clientY - rect.top - matrix.m42) / matrix.d,
  };
}

/** Pull clientX/clientY off an event of unknown shape (React Flow passes `unknown`). */
export function clientPointFromEvent(event: unknown): { x: number; y: number } | null {
  const candidate = event as { clientX?: unknown; clientY?: unknown };
  if (typeof candidate.clientX === 'number' && typeof candidate.clientY === 'number') {
    return { x: candidate.clientX, y: candidate.clientY };
  }
  return null;
}

export function rectFromSize(position: XYPosition, width: number, height: number): Rect {
  return { left: position.x, right: position.x + width, top: position.y, bottom: position.y + height };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
}
