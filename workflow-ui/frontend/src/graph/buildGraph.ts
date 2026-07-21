/** Turns run state + canvas state into the nodes and edges React Flow renders. */

import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { RunState } from '../api';
import type { CollapsibleNodeData, FolderGroup, NodeDetail } from '../nodes';
import { defaultNodePosition, folderFallbackPosition, nodeDimensions, nodeLabel } from './layout';
import { WORKFLOW_EDGES, WORKFLOW_NODES, type NodeSpecContext } from './workflowNodes';

const DRAG_HANDLE = '.node-drag-handle';
const SELECTED_CLASS = 'is-selected-by-app';

const Z_NODE = 20;
const Z_NODE_SELECTED = 30;
const Z_FOLDER = 1;
const Z_FOLDER_DROP_TARGET = 2;

export type GraphCallbacks = {
  onToggleCollapse: (nodeId: string) => void;
  onOpenDetail: (detail: NodeDetail) => void;
  onStartNodeDrag: (nodeId: string, clientX: number, clientY: number) => void;
  onExpandFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
};

export type BuildGraphOptions = NodeSpecContext & {
  /** When false, only the three primary nodes are drawn. */
  showAdvanced: boolean;
  collapsedNodeIds: Set<string>;
  nodePositions: Record<string, XYPosition>;
  folders: FolderGroup[];
  selectedNodeIds: Set<string>;
  dropTargetFolderId: string | null;
  callbacks: GraphCallbacks;
};

export function buildGraph(options: BuildGraphOptions): { nodes: Node[]; edges: Edge[] } {
  const { run, collapsedNodeIds, nodePositions, selectedNodeIds, dropTargetFolderId, callbacks } = options;

  const folders = Array.isArray(options.folders) ? options.folders : [];
  // Nodes inside a folder are represented by the folder itself, not drawn.
  const foldered = new Set(folders.flatMap((folder) => folder.childNodeIds));

  const isSelected = (nodeId: string) => selectedNodeIds.has(nodeId);
  const collapsibleData = (nodeId: string): CollapsibleNodeData => ({
    nodeId,
    collapsed: collapsedNodeIds.has(nodeId),
    onToggleCollapse: callbacks.onToggleCollapse,
    onOpenDetail: callbacks.onOpenDetail,
    onStartNodeDrag: callbacks.onStartNodeDrag,
  });

  const drawn = WORKFLOW_NODES.filter(
    (spec) => (options.showAdvanced || !spec.advanced) && !foldered.has(spec.id),
  );
  const drawnIds = new Set(drawn.map((spec) => spec.id));

  const nodes: Node[] = drawn.map((spec) => ({
    id: spec.id,
    type: spec.type,
    position: nodePositions[spec.id] ?? defaultNodePosition(spec.id, run),
    zIndex: isSelected(spec.id) ? Z_NODE_SELECTED : Z_NODE,
    className: isSelected(spec.id) ? SELECTED_CLASS : undefined,
    dragHandle: DRAG_HANDLE,
    ...nodeDimensions(spec.id, collapsedNodeIds),
    data: { ...spec.data(options), ...collapsibleData(spec.id) },
  }));

  // An edge to a node that is not drawn - foldered, or advanced while the
  // toggle is off - would dangle, so it is dropped with its endpoint.
  const edges: Edge[] = WORKFLOW_EDGES.filter(
    (edge) => (edge.when?.(run) ?? true) && drawnIds.has(edge.source) && drawnIds.has(edge.target),
  ).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, animated: true }));

  folders.forEach((folder, index) => {
    nodes.push({
      id: folder.id,
      type: 'folder',
      position: nodePositions[folder.id] ?? folderFallbackPosition(index),
      zIndex: folder.id === dropTargetFolderId ? Z_FOLDER_DROP_TARGET : Z_FOLDER,
      className: isSelected(folder.id) ? SELECTED_CLASS : undefined,
      dragHandle: DRAG_HANDLE,
      ...nodeDimensions(folder.id, collapsedNodeIds),
      data: {
        folder,
        childLabels: folder.childNodeIds.map((nodeId) => nodeLabel(nodeId, run)),
        isDropTarget: folder.id === dropTargetFolderId,
        onStartNodeDrag: callbacks.onStartNodeDrag,
        onExpandFolder: callbacks.onExpandFolder,
        onDeleteFolder: callbacks.onDeleteFolder,
      },
    });
  });

  return { nodes, edges };
}
