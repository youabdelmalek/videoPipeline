import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { FlexibleWorkflowOutputNodeData } from './types';
import { useDraftValue } from './useDraftValue';

/**
 * Exit point of a workflow. The node's name is the output's exposed name:
 * when this workflow runs as a node inside another workflow, whatever value
 * arrives here becomes that node's output under this name.
 */
export function FlexibleWorkflowOutputNode({ data }: NodeProps<Node<FlexibleWorkflowOutputNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));

  return (
    <section className="node flexible-node wf-output-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Workflow output</div>
          <input
            className="node-title-input nodrag nopan"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Output name"
          />
        </div>
        <button
          className="delete-button nodrag nopan"
          type="button"
          onClick={() => data.onRemove(data.nodeId)}
          title="Remove node"
          aria-label="Remove node"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="node-grid two">
        <label>
          Order
          <input
            className="nodrag nopan"
            type="number"
            value={data.order}
            onChange={(event) => data.onChange(data.nodeId, { order: Number(event.target.value) || 0 })}
          />
        </label>
      </div>

      <div className="text-pass-block">
        <Handle
          className={data.pendingSourceNodeId ? 'is-link-target' : ''}
          type="target"
          position={Position.Left}
          id="input"
          onClick={() => data.onPickInput(data.nodeId, 'input')}
        />
        <textarea
          className="output-box nodrag nopan"
          value={data.value}
          readOnly
          placeholder="Link a node here; its value becomes this workflow's output"
        />
      </div>
    </section>
  );
}
