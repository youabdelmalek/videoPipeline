import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, RefreshCw, Trash2 } from 'lucide-react';
import type { ThinkingLevel } from '../api';
import type { FlexiblePromptLoopNodeData } from './types';
import { useDraftValue } from './useDraftValue';

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  off: 'Off',
  on: 'On',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function OutputBlock({
  data,
  label,
  handle,
  value,
  placeholder,
}: {
  data: FlexiblePromptLoopNodeData;
  label: string;
  handle: string;
  value: string;
  placeholder: string;
}) {
  return (
    <div className="output-block prompt-loop-output">
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

export function FlexiblePromptLoopNode({ data }: NodeProps<Node<FlexiblePromptLoopNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [prompt, setPrompt] = useDraftValue(data.prompt, (value) => data.onChange(data.nodeId, { prompt: value }));
  const [judgePrompt, setJudgePrompt] = useDraftValue(data.judgePrompt, (value) => data.onChange(data.nodeId, { judgePrompt: value }));
  const [fixerPrompt, setFixerPrompt] = useDraftValue(data.fixerPrompt, (value) => data.onChange(data.nodeId, { fixerPrompt: value }));
  const selectedModel = data.models.find((model) => model.name === data.model);
  const thinkingLevels = selectedModel?.thinking_levels ?? [];

  function handleModelChange(model: string) {
    const nextModel = data.models.find((entry) => entry.name === model);
    const nextThinkingLevels = nextModel?.thinking_levels ?? [];
    const thinking = nextThinkingLevels.includes(data.thinking) ? data.thinking : 'off';
    data.onChange(data.nodeId, { model, thinking });
  }

  return (
    <section className="node flexible-node prompt-loop-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Prompt judge loop</div>
          <input className="node-title-input nodrag nopan" value={name} onChange={(event) => setName(event.target.value)} aria-label="Node name" />
        </div>
        <button className="delete-button nodrag nopan" type="button" onClick={() => data.onRemove(data.nodeId)} title="Remove node" aria-label="Remove node">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="prompt-loop-pipeline" aria-label="Judge, JSON extractors, fixer, and retry sequence">
        <span>Judge</span>
        <span>Score JSON</span>
        <span>Prompt JSON</span>
        <span>Fixes JSON</span>
        <span>Fixer agent</span>
        <span>Loop</span>
      </div>

      <div className="node-grid two">
        <label>
          Order
          <input className="nodrag nopan" type="number" value={data.order} onChange={(event) => data.onChange(data.nodeId, { order: Number(event.target.value) || 0 })} />
        </label>
        <label>
          Model
          <select className="nodrag nopan" value={data.model} onChange={(event) => handleModelChange(event.target.value)}>
            {data.models.map((model) => <option key={model.name} value={model.name} disabled={!model.installed}>{model.label}</option>)}
          </select>
        </label>
        <label>
          Pass threshold
          <input className="nodrag nopan" type="number" min="0" max="100" value={data.threshold} onChange={(event) => data.onChange(data.nodeId, { threshold: Number(event.target.value) || 0 })} />
        </label>
        <label>
          Max retries
          <input className="nodrag nopan" type="number" min="0" max="10" value={data.maxRetries} onChange={(event) => data.onChange(data.nodeId, { maxRetries: Number(event.target.value) || 0 })} />
        </label>
        {thinkingLevels.length > 1 ? (
          <label>
            Thinking
            <select className="nodrag nopan" value={data.thinking} onChange={(event) => data.onChange(data.nodeId, { thinking: event.target.value as ThinkingLevel })}>
              {thinkingLevels.map((level) => <option key={level} value={level}>{THINKING_LABELS[level]}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <div className="prompt-loop-input">
        <Handle className={data.pendingSourceNodeId ? 'is-link-target' : ''} type="target" position={Position.Left} id="prompt" onClick={() => data.onPickInput(data.nodeId, 'prompt')} />
        <label>
          Candidate prompt
          <textarea className="output-box nodrag nopan" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Prompt from the enhancer" />
        </label>
      </div>

      <label>
        Judge prompt
        <textarea className="prompt-box nodrag nopan" value={judgePrompt} onChange={(event) => setJudgePrompt(event.target.value)} />
      </label>

      <label>
        Fixer agent prompt
        <textarea className="prompt-box nodrag nopan" value={fixerPrompt} onChange={(event) => setFixerPrompt(event.target.value)} />
      </label>

      <div className="if-run-row">
        <button className="run-node-button nodrag nopan" type="button" onClick={() => data.onRun(data.nodeId)} disabled={data.running}>
          {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
          Run judge loop
        </button>
        <RefreshCw size={14} aria-hidden="true" />
        {data.status ? <span className="if-status">{data.status}</span> : null}
      </div>

      <div className="prompt-loop-summary">
        <strong>Latest score</strong><span>{data.score || '-'}</span>
        <strong>Judge passes</strong><span>{data.attempts}</span>
      </div>

      <OutputBlock data={data} label="Approved prompt" handle="approvedPrompt" value={data.approvedPrompt} placeholder="Prompt passed to image generation" />
      <OutputBlock data={data} label="Score (JSON extractor)" handle="score" value={data.score} placeholder="0-100" />
      <OutputBlock data={data} label="Fixes (JSON extractor)" handle="fixes" value={data.fixes} placeholder="[ ]" />
      <OutputBlock data={data} label="Attempts" handle="attempts" value={String(data.attempts)} placeholder="0" />
      <OutputBlock data={data} label="Loop trace" handle="trace" value={data.trace} placeholder="Judge and fixer passes" />
    </section>
  );
}