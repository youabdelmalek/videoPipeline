import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Trash2 } from 'lucide-react';
import type { FlexibleForEachNodeData } from './types';
import { useDraftValue } from './useDraftValue';

function OutputBlock({
  data,
  label,
  handle,
  value,
  placeholder,
}: {
  data: FlexibleForEachNodeData;
  label: string;
  handle: string;
  value: string;
  placeholder: string;
}) {
  return (
    <div className="output-block foreach-output">
      <div className="row-title">
        <span>{label}</span>
      </div>
      <textarea className="output-box nodrag nopan" value={value} readOnly placeholder={placeholder} />
      <Handle
        className={data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === handle ? 'is-link-source' : ''}
        type="source"
        position={Position.Right}
        id={handle}
        onClick={() => data.onPickOutput(data.nodeId, handle)}
      />
    </div>
  );
}

export function FlexibleForEachNode({ data }: NodeProps<Node<FlexibleForEachNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [items, setItems] = useDraftValue(data.items, (value) => data.onChange(data.nodeId, { items: value }));

  return (
    <section className="node flexible-node loop-node foreach-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Reusable loop</div>
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
          Body workflow
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

      <div className="node-grid three">
        <label>
          Threshold
          <input
            className="nodrag nopan"
            type="number"
            min={0}
            max={100}
            value={data.threshold}
            onChange={(event) => data.onChange(data.nodeId, { threshold: Number(event.target.value) || 0 })}
          />
        </label>
        <label>
          Max passes
          <input
            className="nodrag nopan"
            type="number"
            min={1}
            max={10}
            value={data.maxAttempts}
            onChange={(event) => data.onChange(data.nodeId, { maxAttempts: Number(event.target.value) || 1 })}
          />
        </label>
        <label>
          Retry with
          <select
            className="nodrag nopan"
            value={data.retryWith}
            onChange={(event) => data.onChange(data.nodeId, { retryWith: event.target.value as 'result' | 'input' })}
          >
            <option value="result">Workflow result</option>
            <option value="input">Original input</option>
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
          Input values
          <textarea
            className="output-box nodrag nopan"
            value={items}
            onChange={(event) => setItems(event.target.value)}
            placeholder='Link a value, JSON array/object, or one item per line'
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

      <div className="prompt-loop-summary">
        <div className="row-title">
          <span>Items</span>
          <span>{data.iterations}</span>
          <span>Passes</span>
          <span>{data.attempts}</span>
        </div>
      </div>

      <OutputBlock data={data} label="Result" handle="output" value={data.output} placeholder="Workflow result" />
      <OutputBlock data={data} label="Score (0-100)" handle="score" value={data.score} placeholder="Optional judge score" />
      <OutputBlock data={data} label="Judge note" handle="note" value={data.note} placeholder="Optional judge note" />
      <OutputBlock data={data} label="Pass count" handle="attempts" value={String(data.attempts)} placeholder="0" />
      <OutputBlock data={data} label="Loop trace" handle="trace" value={data.trace} placeholder="Workflow passes" />
    </section>
  );
}
