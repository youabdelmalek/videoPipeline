import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Trash2 } from 'lucide-react';
import type { FlexibleWorkflowNodeData } from './types';
import { useDraftValue } from './useDraftValue';

/**
 * A saved workflow embedded as one callable node: one input dot per Input
 * node inside it, one output dot per Output node. Running it executes every
 * node of the saved workflow strictly in order.
 */
export function FlexibleWorkflowNode({ data }: NodeProps<Node<FlexibleWorkflowNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const updateNodeInternals = useUpdateNodeInternals();

  // Handles come and go with the picked workflow; tell React Flow to re-measure
  // them or edges would anchor to stale positions (or not render at all).
  useEffect(() => {
    updateNodeInternals(data.nodeId);
  }, [data.nodeId, data.inputs.length, data.outputs.length, updateNodeInternals]);

  const sourceClass = (handle: string) =>
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === handle ? 'is-link-source' : '';

  return (
    <section className="node flexible-node workflow-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Workflow</div>
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
            aria-label="Saved workflow"
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

      {data.inputs.length ? (
        <div className="input-editor">
          <div className="row-title">
            <span>Inputs</span>
          </div>
          {data.inputs.map((input) => (
            <div className="input-row if-input-row" key={input.id}>
              <Handle
                className={data.pendingSourceNodeId ? 'is-link-target' : ''}
                type="target"
                position={Position.Left}
                id={input.id}
                onClick={() => data.onPickInput(data.nodeId, input.id)}
              />
              <span className="if-port-name">{input.name}</span>
              <input
                className="nodrag nopan"
                value={input.value}
                onChange={(event) => data.onInputChange(data.nodeId, input.id, { value: event.target.value })}
                placeholder="Value or link"
                aria-label={`${input.name} value`}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="if-run-row">
        <button
          className="run-node-button nodrag nopan"
          type="button"
          onClick={() => data.onRun(data.nodeId)}
          disabled={data.running || !data.workflowName}
        >
          {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
          Run workflow
        </button>
        {data.status ? <small className="workflow-status">{data.status}</small> : null}
      </div>

      {data.outputs.map((output) => {
        const handleId = `out-${output.name}`;
        return (
          <div className="output-block" key={output.name}>
            <div className="row-title">
              <span>{output.name}</span>
            </div>
            <textarea className="output-box nodrag nopan" value={output.value} readOnly placeholder="Workflow output" />
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
    </section>
  );
}
