import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { FlexibleTextNodeData } from './types';
import { useDraftValue } from './useDraftValue';

export function FlexibleTextNode({ data }: NodeProps<Node<FlexibleTextNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [text, setText] = useDraftValue(data.text, (value) => data.onChange(data.nodeId, { text: value }));

  return (
    <section className="node flexible-node text-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Text</div>
          <input
            className="node-title-input nodrag nopan"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Node name"
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

      <div className="node-grid three">
        <label>
          Order
          <input
            className="nodrag nopan"
            type="number"
            value={data.order}
            onChange={(event) => data.onChange(data.nodeId, { order: Number(event.target.value) || 0 })}
          />
        </label>
        <label className="check-label">
          <input
            className="nodrag nopan"
            type="checkbox"
            checked={data.hasInput}
            onChange={(event) => data.onChange(data.nodeId, { hasInput: event.target.checked })}
          />
          Input
        </label>
        <label className="check-label">
          <input
            className="nodrag nopan"
            type="checkbox"
            checked={data.hasOutput}
            onChange={(event) => data.onChange(data.nodeId, { hasOutput: event.target.checked })}
          />
          Output
        </label>
      </div>

      <div className="text-pass-block">
        {data.hasInput ? (
          <Handle
            className={data.pendingSourceNodeId ? 'is-link-target' : ''}
            type="target"
            position={Position.Left}
            id="input"
            onClick={() => data.onPickInput(data.nodeId, 'input')}
          />
        ) : null}
        <textarea
          className="output-box nodrag nopan"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type, paste, or edit text"
        />
        {data.hasOutput ? (
          <Handle
            className={data.pendingSourceNodeId === data.nodeId ? 'is-link-source' : ''}
            type="source"
            position={Position.Right}
            id="output"
            onClick={() => data.onPickOutput(data.nodeId, 'output')}
          />
        ) : null}
      </div>
    </section>
  );
}
