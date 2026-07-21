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
import type { SelectionBox } from '../hooks/useMarqueeSelection';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.4;
/** Pan with the middle mouse button only, leaving left-drag for marquee select. */
const PAN_BUTTONS = [1];

type Props = {
  resetKey: number;
  nodes: Node[];
  edges: Edge[];
  selectionBox: SelectionBox | null;
  onNodesChange: (changes: NodeChange[]) => void;
  onNodeDrag: (event: unknown, node: Node) => void;
  onNodeDragStop: (event: unknown, node: Node) => void;
  onNodeClick: (event: ReactMouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onMouseDownCapture: (event: ReactMouseEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
};

export function WorkflowCanvas({
  resetKey,
  nodes,
  edges,
  selectionBox,
  onMouseDownCapture,
  onContextMenu,
  ...flowHandlers
}: Props) {
  return (
    <section className="canvas-wrap" onMouseDownCapture={onMouseDownCapture} onContextMenu={onContextMenu}>
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
      {selectionBox ? (
        <div
          className="selection-box"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX),
            top: Math.min(selectionBox.startY, selectionBox.currentY),
            width: Math.abs(selectionBox.currentX - selectionBox.startX),
            height: Math.abs(selectionBox.currentY - selectionBox.startY),
          }}
        />
      ) : null}
    </section>
  );
}
