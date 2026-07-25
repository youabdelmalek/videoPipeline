import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Trash2 } from 'lucide-react';
import type { FlexibleIfNodeData } from './types';
import { useDraftValue } from './useDraftValue';

export function FlexibleIfNode({ data }: NodeProps<Node<FlexibleIfNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [condition, setCondition] = useDraftValue(data.condition, (value) => data.onChange(data.nodeId, { condition: value }));
  const [prompt, setPrompt] = useDraftValue(data.prompt, (value) => data.onChange(data.nodeId, { prompt: value }));
  const [input1, setInput1] = useDraftValue(data.input1, (value) => data.onChange(data.nodeId, { input1: value }));
  const [input2, setInput2] = useDraftValue(data.input2, (value) => data.onChange(data.nodeId, { input2: value }));

  const sourceClass = (handle: string) =>
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === handle ? 'is-link-source' : '';

  return (
    <section className="node flexible-node if-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">If</div>
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
        Condition
        <textarea
          className="nodrag nopan if-condition"
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          placeholder={'${input1} == 5   ·   ${input1} > 5   ·   ${input1} == "fail"'}
        />
      </label>

      <div className="input-editor">
        <div className="row-title">
          <span>Inputs</span>
        </div>
        <div className="input-row if-input-row">
          <Handle
            className={data.pendingSourceNodeId ? 'is-link-target' : ''}
            type="target"
            position={Position.Left}
            id="input1"
            onClick={() => data.onPickInput(data.nodeId, 'input1')}
          />
          <span className="if-port-name">input1</span>
          <input
            className="nodrag nopan"
            value={input1}
            onChange={(event) => setInput1(event.target.value)}
            placeholder="Value the condition tests"
            aria-label="input1 value"
          />
        </div>
        <div className="input-row if-input-row">
          <Handle
            className={data.pendingSourceNodeId ? 'is-link-target' : ''}
            type="target"
            position={Position.Left}
            id="input2"
            onClick={() => data.onPickInput(data.nodeId, 'input2')}
          />
          <span className="if-port-name">input2</span>
          <input
            className="nodrag nopan"
            value={input2}
            onChange={(event) => setInput2(event.target.value)}
            placeholder="Payload passed to the outputs"
            aria-label="input2 value"
          />
        </div>
      </div>

      <div className="if-run-row">
        <button
          className="run-node-button nodrag nopan"
          type="button"
          onClick={() => data.onRun(data.nodeId)}
          disabled={data.running}
        >
          {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
          Evaluate
        </button>
        {data.status ? <span className="if-status">{data.status}</span> : null}
      </div>

      <div className="output-block if-output is-success">
        <div className="row-title">
          <span>Output 1 · success</span>
        </div>
        <textarea
          className="output-box nodrag nopan"
          value={data.output1}
          readOnly
          placeholder="Passes input2 through on success"
        />
        <Handle
          className={sourceClass('output1')}
          type="source"
          position={Position.Right}
          id="output1"
          onClick={() => data.onPickOutput(data.nodeId, 'output1')}
        />
      </div>

      <div className="output-block if-output is-retry">
        <div className="row-title">
          <span>Output 2 · retry</span>
        </div>
        <label className="if-prompt-label">
          Prompt (sent with input2)
          <textarea
            className="prompt-box nodrag nopan"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Fix the problem in: ${input2}"
          />
        </label>
        <textarea
          className="output-box nodrag nopan"
          value={data.output2}
          readOnly
          placeholder="input2 + prompt, sent onward when the condition fails"
        />
        <Handle
          className={sourceClass('output2')}
          type="source"
          position={Position.Right}
          id="output2"
          onClick={() => data.onPickOutput(data.nodeId, 'output2')}
        />
      </div>
    </section>
  );
}
