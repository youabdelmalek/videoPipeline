/** Turns run state + canvas state into the nodes and edges React Flow renders. */

import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { CollapsibleNodeData, NodeDetail } from '../nodes';
import { compactPositions, defaultNodePosition, nodeDimensions } from './layout';
import { WORKFLOW_EDGES, WORKFLOW_NODES, type NodeSpecContext } from './workflowNodes';

const SELECTED_CLASS = 'is-selected-by-app';

const Z_NODE = 20;
const Z_NODE_SELECTED = 30;

export type GraphCallbacks = {
  onToggleCollapse: (nodeId: string) => void;
  onOpenDetail: (detail: NodeDetail) => void;
};

export type BuildGraphOptions = NodeSpecContext & {
  /** When false, only the three primary nodes are drawn. */
  showAdvanced: boolean;
  collapsedNodeIds: Set<string>;
  nodePositions: Record<string, XYPosition>;
  selectedNodeIds: Set<string>;
  callbacks: GraphCallbacks;
};

/**
 * The drawn nodes a node feeds into, stepping over any that are hidden.
 *
 * The workflow is one long chain, so hiding the judges would leave the primary
 * nodes with no edges at all. Instead an edge into a hidden node is followed
 * through to the next drawn node, keeping the visible flow connected.
 */
function drawnTargets(
  from: string,
  drawnIds: Set<string>,
  outgoing: Map<string, string[]>,
  visited: Set<string> = new Set(),
): string[] {
  const found: string[] = [];
  for (const next of outgoing.get(from) ?? []) {
    if (visited.has(next)) {
      continue;
    }
    visited.add(next);
    if (drawnIds.has(next)) {
      found.push(next);
    } else {
      found.push(...drawnTargets(next, drawnIds, outgoing, visited));
    }
  }
  return found;
}

export function buildGraph(options: BuildGraphOptions): { nodes: Node[]; edges: Edge[] } {
  const { run, collapsedNodeIds, nodePositions, selectedNodeIds, callbacks } = options;

  const isSelected = (nodeId: string) => selectedNodeIds.has(nodeId);
  const collapsibleData = (nodeId: string): CollapsibleNodeData => ({
    nodeId,
    collapsed: collapsedNodeIds.has(nodeId),
    onToggleCollapse: callbacks.onToggleCollapse,
    onOpenDetail: callbacks.onOpenDetail,
  });

  const drawn = WORKFLOW_NODES.filter((spec) => options.showAdvanced || !spec.advanced);
  const drawnIds = new Set(drawn.map((spec) => spec.id));

  const compact = options.showAdvanced
    ? null
    : compactPositions(drawn.map((spec) => spec.id), collapsedNodeIds);

  const nodes: Node[] = drawn.map((spec) => ({
    id: spec.id,
    type: spec.type,
    position: nodePositions[spec.id] ?? compact?.[spec.id] ?? defaultNodePosition(spec.id),
    zIndex: isSelected(spec.id) ? Z_NODE_SELECTED : Z_NODE,
    className: isSelected(spec.id) ? SELECTED_CLASS : undefined,
    ...nodeDimensions(spec.id, collapsedNodeIds),
    data: { ...spec.data(options), ...collapsibleData(spec.id) },
  }));

  // `when` is applied first, so a bridged edge can never route through a link
  // the run state says should not exist.
  const live = WORKFLOW_EDGES.filter((edge) => edge.when?.(run) ?? true);
  const outgoing = new Map<string, string[]>();
  for (const edge of live) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const edges: Edge[] = drawn.flatMap((spec) =>
    drawnTargets(spec.id, drawnIds, outgoing).map((target) => ({
      id: `${spec.id}-${target}`,
      source: spec.id,
      target,
      animated: true,
    })),
  );

  return { nodes, edges };
}
