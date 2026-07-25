import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { Play, Trash2 } from 'lucide-react';
import type { FlexibleSplitNodeData } from './types';
import { useDraftValue } from './useDraftValue';

const MIN_OUTPUTS = 1;
const MAX_OUTPUTS = 20;

export function FlexibleSplitNode({ data }: NodeProps<Node<FlexibleSplitNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [delimiter, setDelimiter] = useDraftValue(data.delimiter, (value) => data.onChange(data.nodeId, { delimiter: value }));
  const [input, setInput] = useDraftValue(data.input, (value) => data.onChange(data.nodeId, { input: value }));
  const updateNodeInternals = useUpdateNodeInternals();

  // Changing the output count adds and removes handles; React Flow must
  // re-measure them or their edges anchor to stale positions.
  useEffect(() => {
    updateNodeInternals(data.nodeId);
  }, [data.nodeId, data.count, updateNodeInternals]);

  const sourceClass = (handle: string) =>
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === handle ? 'is-link-source' : '';

  const outputs = Array.from({ length: data.count }, (_, index) => data.outputs[index] ?? '');

  return (
    <section className="node flexible-node split-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Split</div>
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
          Delimiter
          <input
            className="nodrag nopan"
            value={delimiter}
            onChange={(event) => setDelimiter(event.target.value)}
            placeholder="e.g. , or \n"
          />
        </label>
      </div>

      <div className="input-editor">
        <div className="row-title">
          <span>Inputs</span>
        </div>
        <div className="input-row if-input-row">
          <Handle
            className={data.pendingSourceNodeId ? 'is-link-target' : ''}
            type="target"
            position={Position.Left}
            id="count"
            onClick={() => data.onPickInput(data.nodeId, 'count')}
          />
          <span className="if-port-name">outputs</span>
          <input
            className="nodrag nopan"
            type="number"
            min={MIN_OUTPUTS}
            max={MAX_OUTPUTS}
            value={data.count}
            onChange={(event) => {
              const next = Math.round(Number(event.target.value) || MIN_OUTPUTS);
              data.onChange(data.nodeId, { count: Math.min(MAX_OUTPUTS, Math.max(MIN_OUTPUTS, next)) });
            }}
            aria-label="Number of outputs"
          />
        </div>
      </div>

      <div className="text-pass-block">
        <Handle
          className={data.pendingSourceNodeId ? 'is-link-target' : ''}
          type="target"
          position={Position.Left}
          id="input"
          onClick={() => data.onPickInput(data.nodeId, 'input')}
        />
        <label>
          Input
          <textarea
            className="output-box nodrag nopan"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Text to split by the delimiter"
          />
        </label>
      </div>

      <div className="if-run-row">
        <button className="run-node-button nodrag nopan" type="button" onClick={() => data.onRun(data.nodeId)}>
          <Play size={14} />
          Split
        </button>
      </div>

      <div className="split-outputs">
        {outputs.map((value, index) => {
          const handleId = `output${index + 1}`;
          return (
            <div className="output-block split-output" key={handleId}>
              <div className="row-title">
                <span>Output {index + 1}</span>
              </div>
              <textarea
                className="output-box nodrag nopan"
                value={value}
                readOnly
                placeholder={`Part ${index + 1}`}
              />
              <Handle
                className={sourceClass(handleId)}
                type="source"
                position={Position.Right}
                id={handleId}
                onClick={() => data.onPickOutput(data.nodeId, handleId)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
