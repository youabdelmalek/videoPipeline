import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Play, Trash2 } from 'lucide-react';
import type { FlexibleJsonNodeData } from './types';
import { useDraftValue } from './useDraftValue';

export function FlexibleJsonNode({ data }: NodeProps<Node<FlexibleJsonNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [path, setPath] = useDraftValue(data.path, (value) => data.onChange(data.nodeId, { path: value }));
  const [input, setInput] = useDraftValue(data.input, (value) => data.onChange(data.nodeId, { input: value }));
  const [output, setOutput] = useDraftValue(data.output, (value) => data.onChange(data.nodeId, { output: value }));

  return (
    <section className={`node flexible-node json-node ${data.error ? 'has-error' : ''}`}>
      <div className="node-header">
        <div>
          <div className="node-kicker">JSON extract</div>
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
          Key path
          <input
            className="nodrag nopan"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="a.b"
          />
        </label>
      </div>

      <div className="json-input-block">
        <Handle
          className={data.pendingSourceNodeId ? 'is-link-target' : ''}
          type="target"
          position={Position.Left}
          id="input"
          onClick={() => data.onPickInput(data.nodeId, 'input')}
        />
        <label>
          Input JSON
          <textarea
            className="output-box nodrag nopan"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder='{"a":{"b":5}}'
          />
        </label>
      </div>

      {data.error ? <p className="json-node-error">{data.error}</p> : null}

      <div className="output-block">
        <div className="row-title">
          <span>Output</span>
          <button className="run-node-button nodrag nopan" type="button" onClick={() => data.onRun(data.nodeId)}>
            <Play size={14} />
            Run
          </button>
        </div>
        <textarea
          className="output-box nodrag nopan"
          value={output}
          onChange={(event) => setOutput(event.target.value)}
          placeholder="Extracted value"
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
