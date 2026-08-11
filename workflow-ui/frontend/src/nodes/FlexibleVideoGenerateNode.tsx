import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { Film, Loader2, Plus, Play, Trash2, X } from 'lucide-react';
import { ASPECT_RATIO_OPTIONS, DEFAULT_ASPECT_RATIO, type AspectRatio } from '../constants';
import type { FlexibleVideoGenerateNodeData } from './types';
import { useDraftValue } from './useDraftValue';

function PromptInputRow({
  data,
  input,
}: {
  data: FlexibleVideoGenerateNodeData;
  input: FlexibleVideoGenerateNodeData['inputs'][number];
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

function ImageInput({
  data,
  id,
  label,
  value,
  onChange,
}: {
  data: FlexibleVideoGenerateNodeData;
  id: 'image1' | 'image2';
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="text-pass-block video-image-input">
      <Handle
        className={data.pendingSourceNodeId ? 'is-link-target' : ''}
        type="target"
        position={Position.Left}
        id={id}
        onClick={() => data.onPickInput(data.nodeId, id)}
      />
      <label>
        {label}
        <textarea
          className="output-box nodrag nopan"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Link or paste an image URL"
        />
      </label>
    </div>
  );
}

export function FlexibleVideoGenerateNode({ data }: NodeProps<Node<FlexibleVideoGenerateNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [prompt, setPrompt] = useDraftValue(data.prompt, (value) => data.onChange(data.nodeId, { prompt: value }));
  const [image1, setImage1] = useDraftValue(data.image1, (value) => data.onChange(data.nodeId, { image1: value }));
  const [image2, setImage2] = useDraftValue(data.image2, (value) => data.onChange(data.nodeId, { image2: value }));
  const aspectRatio = data.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const updateNodeInternals = useUpdateNodeInternals();
  const sourceClass =
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === 'output' ? 'is-link-source' : '';

  useEffect(() => {
    updateNodeInternals(data.nodeId);
  }, [data.nodeId, data.inputs.length, updateNodeInternals]);

  return (
    <section className="node flexible-node video-generate-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">{data.kicker}</div>
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

      <div className="node-grid">
        <label>
          Aspect ratio
          <select
            className="nodrag nopan"
            value={aspectRatio}
            onChange={(event) => data.onChange(data.nodeId, { aspectRatio: event.target.value as AspectRatio })}
          >
            {ASPECT_RATIO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Duration seconds
          <input
            className="nodrag nopan"
            type="number"
            min="0.1"
            max="60"
            step="1"
            value={data.durationSeconds}
            onChange={(event) => data.onChange(data.nodeId, { durationSeconds: Number(event.target.value) || 5 })}
          />
        </label>
      </div>

      <label>
        Prompt
        <textarea
          className="prompt-box nodrag nopan"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the motion"
        />
      </label>

      <div className="input-editor">
        <div className="row-title">
          <span>Prompt inputs</span>
          <button className="icon-button nodrag nopan" type="button" onClick={() => data.onAddInput(data.nodeId)} title="Add input">
            <Plus size={14} />
          </button>
        </div>
        {data.inputs.map((input) => <PromptInputRow key={input.id} data={data} input={input} />)}
      </div>

      <ImageInput data={data} id="image1" label={data.image1Label} value={image1} onChange={setImage1} />
      <ImageInput data={data} id="image2" label={data.image2Label} value={image2} onChange={setImage2} />

      <div className="if-run-row">
        <button
          className="run-node-button nodrag nopan"
          type="button"
          onClick={() => data.onRun(data.nodeId)}
          disabled={data.running || !prompt.trim() || !image1.trim() || !image2.trim()}
        >
          {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
          Generate video
        </button>
        {data.status ? <span className="if-status">{data.status}</span> : null}
      </div>

      <div className="output-block image-output video-output">
        <div className="row-title">
          <span><Film size={13} /> Output video</span>
          {data.outputName ? <span>{data.outputName}</span> : null}
        </div>
        <textarea className="output-box nodrag nopan" value={data.outputUrl} readOnly placeholder="Generated video URL" />
        <div className="image-preview video-preview">
          {data.outputUrl ? <video src={data.outputUrl} controls preload="metadata" /> : <span>Output</span>}
        </div>
        <Handle
          className={sourceClass}
          type="source"
          position={Position.Right}
          id="output"
          onClick={() => data.onPickOutput(data.nodeId, 'output')}
        />
      </div>
    </section>
  );
}
