import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Plus, Trash2, X } from 'lucide-react';
import { ASPECT_RATIO_OPTIONS, DEFAULT_ASPECT_RATIO, type AspectRatio } from '../constants';
import type { FlexibleImageGenerateNodeData } from './types';
import { useDraftValue } from './useDraftValue';

function ImagePromptInputRow({
  data,
  input,
}: {
  data: FlexibleImageGenerateNodeData;
  input: FlexibleImageGenerateNodeData['inputs'][number];
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

export function FlexibleImageGenerateNode({ data }: NodeProps<Node<FlexibleImageGenerateNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [prompt, setPrompt] = useDraftValue(data.prompt, (value) => data.onChange(data.nodeId, { prompt: value }));
  const [referenceImage, setReferenceImage] = useDraftValue(
    data.referenceImage,
    (value) => data.onChange(data.nodeId, { referenceImage: value }),
  );
  const aspectRatio = data.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const updateNodeInternals = useUpdateNodeInternals();
  const sourceClass =
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === 'output' ? 'is-link-source' : '';

  useEffect(() => {
    updateNodeInternals(data.nodeId);
  }, [data.nodeId, data.inputs.length, updateNodeInternals]);

  return (
    <section className="node flexible-node image-generate-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">{data.kicker ?? 'Generate image Style Reference'}</div>
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
      </div>

      <label>
        Prompt
        <textarea
          className="prompt-box nodrag nopan"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Create an image of ${input1}"
        />
      </label>

      <div className="input-editor">
        <div className="row-title">
          <span>Inputs</span>
          <button className="icon-button nodrag nopan" type="button" onClick={() => data.onAddInput(data.nodeId)} title="Add input">
            <Plus size={14} />
          </button>
        </div>
        {data.inputs.map((input) => <ImagePromptInputRow key={input.id} data={data} input={input} />)}
      </div>

      <div className="text-pass-block">
        <Handle
          className={data.pendingSourceNodeId ? 'is-link-target' : ''}
          type="target"
          position={Position.Left}
          id="reference"
          onClick={() => data.onPickInput(data.nodeId, 'reference')}
        />
        <label>
          Reference URL
          <textarea
            className="output-box nodrag nopan"
            value={referenceImage}
            onChange={(event) => setReferenceImage(event.target.value)}
            placeholder="Link the upload node here"
          />
        </label>
      </div>

      <div className="if-run-row">
        <button
          className="run-node-button nodrag nopan"
          type="button"
          onClick={() => data.onRun(data.nodeId)}
          disabled={data.running || !prompt.trim() || !referenceImage.trim()}
        >
          {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
          Generate
        </button>
        {data.status ? <span className="if-status">{data.status}</span> : null}
      </div>

      <div className="output-block image-output">
        <div className="row-title">
          <span>Output URL</span>
          {data.outputName ? <span>{data.outputName}</span> : null}
        </div>
        <textarea className="output-box nodrag nopan" value={data.outputUrl} readOnly placeholder="Generated image URL" />
        <div className="image-preview image-output-preview">
          {data.outputUrl ? <img src={data.outputUrl} alt="Generated output" /> : <span>Output</span>}
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
