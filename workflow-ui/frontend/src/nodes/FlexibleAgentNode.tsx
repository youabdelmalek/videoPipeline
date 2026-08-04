import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Plus, Trash2, X } from 'lucide-react';
import type { ThinkingLevel } from '../api';
import { DEFAULT_THINKING_LEVEL } from '../constants';
import type { FlexibleAgentNodeData } from './types';
import { useDraftValue } from './useDraftValue';

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  off: 'Off',
  on: 'On',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function AgentInputRow({
  data,
  input,
}: {
  data: FlexibleAgentNodeData;
  input: FlexibleAgentNodeData['inputs'][number];
}) {
  const [name, setName] = useDraftValue(input.name, (value) => data.onInputChange(data.nodeId, input.id, { name: value }));
  const [value, setValue] = useDraftValue(input.value, (next) => data.onInputChange(data.nodeId, input.id, { value: next }));

  return (
    <div className="input-row">
      <Handle
        className={data.pendingSourceNodeId ? 'is-link-target' : ''}
        type="target"
        position={Position.Left}
        id={input.id}
        onClick={() => data.onPickInput(data.nodeId, input.id)}
      />
      <input
        className="nodrag nopan"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Input name"
      />
      <input
        className="nodrag nopan"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="String value"
        aria-label={`${name} value`}
      />
      <button
        className="icon-button nodrag nopan"
        type="button"
        onClick={() => data.onRemoveInput(data.nodeId, input.id)}
        title="Remove input"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function FlexibleAgentNode({ data }: NodeProps<Node<FlexibleAgentNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [prompt, setPrompt] = useDraftValue(data.prompt, (value) => data.onChange(data.nodeId, { prompt: value }));
  const [output, setOutput] = useDraftValue(data.output, (value) => data.onChange(data.nodeId, { output: value }));
  const updateNodeInternals = useUpdateNodeInternals();
  const selectedModel = data.models.find((model) => model.name === data.model);
  const thinkingLevels = selectedModel?.thinking_levels ?? [];

  function handleModelChange(model: string) {
    const nextModel = data.models.find((entry) => entry.name === model);
    const nextThinkingLevels = nextModel?.thinking_levels ?? [];
    const thinking = nextThinkingLevels.includes(data.thinking) ? data.thinking : DEFAULT_THINKING_LEVEL;
    data.onChange(data.nodeId, { model, thinking });
  }

  // Adding or removing inputs adds and removes handles; React Flow must
  // re-measure them or their edges anchor to stale positions.
  useEffect(() => {
    updateNodeInternals(data.nodeId);
  }, [data.nodeId, data.inputs.length, updateNodeInternals]);

  return (
    <section className="node flexible-node agent-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">LLM agent</div>
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
          Model
          <select
            className="nodrag nopan"
            value={data.model}
            onChange={(event) => handleModelChange(event.target.value)}
          >
            {data.models.map((model) => (
              <option key={model.name} value={model.name} disabled={!model.installed}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        {thinkingLevels.length > 1 ? (
          <label>
            Thinking
            <select
              className="nodrag nopan"
              value={data.thinking}
              onChange={(event) => data.onChange(data.nodeId, { thinking: event.target.value as ThinkingLevel })}
            >
              {thinkingLevels.map((level) => (
                <option key={level} value={level}>
                  {THINKING_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <label>
        Prompt
        <textarea
          className="prompt-box nodrag nopan"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Explain the agent. Reference inputs with ${input1}, ${outline}, etc."
        />
      </label>

      <div className="input-editor">
        <div className="row-title">
          <span>Inputs</span>
          <button className="icon-button nodrag nopan" type="button" onClick={() => data.onAddInput(data.nodeId)} title="Add input">
            <Plus size={14} />
          </button>
        </div>
        {data.inputs.map((input) => <AgentInputRow key={input.id} data={data} input={input} />)}
      </div>

      <div className="output-block">
        <div className="row-title">
          <span>Output</span>
          <button className="run-node-button nodrag nopan" type="button" onClick={() => data.onRun(data.nodeId)} disabled={data.running}>
            {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
            Run
          </button>
        </div>
        <textarea
          className="output-box nodrag nopan"
          value={output}
          onChange={(event) => setOutput(event.target.value)}
          placeholder="LLM output"
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
