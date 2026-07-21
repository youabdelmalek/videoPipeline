/** Turns run state + canvas state into the nodes and edges React Flow renders. */

import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { CollapsibleNodeData, NodeDetail } from '../nodes';
import { defaultNodePosition, nodeDimensions } from './layout';
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

  const nodes: Node[] = drawn.map((spec) => ({
    id: spec.id,
    type: spec.type,
    position: nodePositions[spec.id] ?? defaultNodePosition(spec.id, run),
    zIndex: isSelected(spec.id) ? Z_NODE_SELECTED : Z_NODE,
    className: isSelected(spec.id) ? SELECTED_CLASS : undefined,
    ...nodeDimensions(spec.id, collapsedNodeIds),
    data: { ...spec.data(options), ...collapsibleData(spec.id) },
  }));

  // An edge to a node that is not drawn - advanced while the toggle is off -
  // would dangle, so it is dropped with its endpoint.
  const edges: Edge[] = WORKFLOW_EDGES.filter(
    (edge) => (edge.when?.(run) ?? true) && drawnIds.has(edge.source) && drawnIds.has(edge.target),
  ).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, animated: true }));

  return { nodes, edges };
}
