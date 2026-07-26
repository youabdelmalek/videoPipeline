import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Trash2 } from 'lucide-react';
import type { FlexibleForEachNodeData } from './types';
import { useDraftValue } from './useDraftValue';

export function FlexibleForEachNode({ data }: NodeProps<Node<FlexibleForEachNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [items, setItems] = useDraftValue(data.items, (value) => data.onChange(data.nodeId, { items: value }));

  return (
    <section className="node flexible-node loop-node foreach-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">For each</div>
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
        <label>
          Workflow
          <select
            className="nodrag nopan"
            value={data.workflowName}
            onChange={(event) => data.onPickWorkflow(data.nodeId, event.target.value)}
            aria-label="Body workflow"
          >
            <option value="">Pick a workflow</option>
            {data.workflowOptions.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-pass-block">
        <Handle
          className={data.pendingSourceNodeId ? 'is-link-target' : ''}
          type="target"
          position={Position.Left}
          id="items"
          onClick={() => data.onPickInput(data.nodeId, 'items')}
        />
        <label>
          Items
          <textarea
            className="output-box nodrag nopan"
            value={items}
            onChange={(event) => setItems(event.target.value)}
            placeholder='["one", "two"] or one item per line'
          />
        </label>
      </div>

      <div className="if-run-row">
        <button
          className="run-node-button nodrag nopan"
          type="button"
          onClick={() => data.onRun(data.nodeId)}
          disabled={data.running || !data.workflowName}
        >
          {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
          Run loop
        </button>
        {data.status ? <small className="workflow-status">{data.status}</small> : null}
      </div>

      <div className="output-block foreach-output">
        <div className="row-title">
          <span>Output list</span>
          <span>{data.iterations} item(s)</span>
        </div>
        <textarea className="output-box nodrag nopan" value={data.output} readOnly placeholder="[]" />
        <Handle
          className={data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === 'output' ? 'is-link-source' : ''}
          type="source"
          position={Position.Right}
          id="output"
          onClick={() => data.onPickOutput(data.nodeId, 'output')}
        />
      </div>
    </section>
  );
}
