import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { FlexibleWorkflowInputNodeData } from './types';
import { useDraftValue } from './useDraftValue';

/**
 * Entry point of a workflow. The node's name is the input's exposed name:
 * when this workflow runs as a node inside another workflow, the parent
 * injects a value here by that name.
 */
export function FlexibleWorkflowInputNode({ data }: NodeProps<Node<FlexibleWorkflowInputNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [value, setValue] = useDraftValue(data.value, (next) => data.onChange(data.nodeId, { value: next }));

  return (
    <section className="node flexible-node wf-input-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Workflow input</div>
          <input
            className="node-title-input nodrag nopan"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Input name"
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
        <textarea
          className="output-box nodrag nopan"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Value used when running here. Overridden when this workflow runs as a node."
        />
        <Handle
          className={data.pendingSourceNodeId === data.nodeId ? 'is-link-source' : ''}
          type="source"
          position={Position.Right}
          id="output"
          onClick={() => data.onPickOutput(data.nodeId, 'output')}
        />
      </div>
    </section>
  );
}
