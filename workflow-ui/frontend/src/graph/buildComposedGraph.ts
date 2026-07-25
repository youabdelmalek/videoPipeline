/** Turns a composed workflow definition into the nodes and edges React Flow renders. */

import type { Edge, Node } from '@xyflow/react';
import type { PortCheck, PortInfo, StageInfo, WorkflowDefinition } from '../api';

const COL_GAP = 80;
const ROW_GAP = 60;
const INPUT_SIZE = { initialWidth: 380, initialHeight: 340 };
const STAGE_SIZE = { initialWidth: 340, initialHeight: 260 };

export type ComposedGraphOptions = {
  workflow: WorkflowDefinition;
  stagesById: Record<string, StageInfo>;
  ports: PortInfo[];
  checks: Record<string, PortCheck | null>;
  unsatisfied: Record<string, string[]>;
  portLabel: (port: string) => string;
  onPortChange: (nodeId: string, port: string) => void;
  onTextChange: (nodeId: string, text: string) => void;
  onRemove: (nodeId: string) => void;
};

/**
 * Inputs in a left column, stages in a right column.
 *
 * Deliberately simple: the cards are not draggable, so the layout only has to
 * keep every node visible and its handles reachable.
 */
export function buildComposedGraph(options: ComposedGraphOptions): { nodes: Node[]; edges: Edge[] } {
  const { workflow, stagesById } = options;

  const inputs = workflow.nodes.filter((node) => node.kind === 'input');
  const stages = workflow.nodes.filter((node) => node.kind === 'stage');

  const nodes: Node[] = [];

  inputs.forEach((node, index) => {
    nodes.push({
      id: node.id,
      type: 'composerInput',
      position: { x: 0, y: index * (INPUT_SIZE.initialHeight + ROW_GAP) },
      ...INPUT_SIZE,
      data: {
        nodeId: node.id,
        port: node.port,
        text: node.text,
        ports: options.ports,
        check: options.checks[node.id] ?? null,
        onPortChange: options.onPortChange,
        onTextChange: options.onTextChange,
        onRemove: options.onRemove,
      },
    });
  });

  stages.forEach((node, index) => {
    const stage = stagesById[node.stage];
    if (!stage) {
      return;
    }
    nodes.push({
      id: node.id,
      type: 'composerStage',
      position: {
        x: INPUT_SIZE.initialWidth + COL_GAP,
        y: index * (STAGE_SIZE.initialHeight + ROW_GAP),
      },
      ...STAGE_SIZE,
      data: {
        nodeId: node.id,
        stage,
        unsatisfied: options.unsatisfied[node.id] ?? [],
        portLabel: options.portLabel,
        onRemove: options.onRemove,
      },
    });
  });

  const edges: Edge[] = workflow.edges.map((edge) => ({
    id: `${edge.source}:${edge.source_handle}->${edge.target}:${edge.target_handle}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.source_handle || null,
    targetHandle: edge.target_handle || null,
    animated: true,
  }));

  return { nodes, edges };
}
