import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { minimapNodeColor, nodeTypes } from '../graph/nodeTypes';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.4;
/** Nodes are fixed, so both the left and middle buttons pan the canvas. */
const PAN_BUTTONS = [0, 1];

type Props = {
  resetKey: number;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onNodeClick: (event: ReactMouseEvent, node: Node) => void;
  onPaneClick: () => void;
};

export function WorkflowCanvas({ resetKey, nodes, edges, ...flowHandlers }: Props) {
  return (
    <section className="canvas-wrap">
      <ReactFlow
        key={resetKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        {...flowHandlers}
        nodesDraggable={false}
        panOnDrag={PAN_BUTTONS}
        fitView
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
      >
        <Background color="#d9d1c2" gap={28} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={minimapNodeColor}
          nodeStrokeColor="#2d2922"
          nodeStrokeWidth={2}
          nodeBorderRadius={6}
          maskColor="rgba(25, 23, 19, 0.08)"
        />
        <Controls />
      </ReactFlow>
    </section>
  );
}
