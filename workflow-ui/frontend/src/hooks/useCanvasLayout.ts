/**
 * Raw canvas layout state: where nodes sit, what is selected, what is folded.
 *
 * `useCanvas` composes this with the click and marquee handlers. Node positions
 * come from `graph/layout.ts` and are only written back when React Flow itself
 * reports a change, since nodes are not draggable.
 */

import { useCallback, useState } from 'react';
import type { NodeChange, XYPosition } from '@xyflow/react';
import type { RunState } from '../api';
import type { NodeDetail } from '../nodes';

export type NodePositionMap = Record<string, XYPosition>;

export type CanvasLayout = ReturnType<typeof useCanvasLayout>;

export function useCanvasLayout(_run: RunState | null) {
  const [nodePositions, setNodePositions] = useState<NodePositionMap>({});
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(() => new Set());
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set());
  const [activeDetail, setActiveDetail] = useState<NodeDetail | null>(null);
  const [flowResetKey, setFlowResetKey] = useState(0);

  const resetLayout = useCallback(() => {
    setNodePositions({});
    setSelectedNodeIds(new Set());
    setCollapsedNodeIds(new Set());
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
    selectedNodeIds,
    collapsedNodeIds,
    activeDetail,
    flowResetKey,
    setSelectedNodeIds,
    setActiveDetail,
    resetLayout,
    toggleCollapse,
    applyNodeChanges,
  };
}
