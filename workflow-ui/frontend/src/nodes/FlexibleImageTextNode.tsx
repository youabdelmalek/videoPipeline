import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Plus, Trash2, X } from 'lucide-react';
import type { FlexibleImageTextNodeData } from './types';
import { useDraftValue } from './useDraftValue';

function ImageTextInputRow({
  data,
  input,
}: {
  data: FlexibleImageTextNodeData;
  input: FlexibleImageTextNodeData['inputs'][number];
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

export function FlexibleImageTextNode({ data }: NodeProps<Node<FlexibleImageTextNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [prompt, setPrompt] = useDraftValue(data.prompt, (value) => data.onChange(data.nodeId, { prompt: value }));
  const [imageUrl, setImageUrl] = useDraftValue(data.imageUrl, (value) => data.onChange(data.nodeId, { imageUrl: value }));
  const [output, setOutput] = useDraftValue(data.output, (value) => data.onChange(data.nodeId, { output: value }));
  const updateNodeInternals = useUpdateNodeInternals();
  const sourceClass =
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === 'output' ? 'is-link-source' : '';

  useEffect(() => {
    updateNodeInternals(data.nodeId);
  }, [data.nodeId, data.inputs.length, updateNodeInternals]);

  return (
    <section className="node flexible-node image-text-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Image text</div>
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
            onChange={(event) => data.onChange(data.nodeId, { model: event.target.value })}
          >
            {data.models.map((model) => (
              <option key={model.name} value={model.name} disabled={!model.installed}>
                {model.label}
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
          placeholder="Describe this image using ${input1}"
        />
      </label>

      <div className="input-editor">
        <div className="row-title">
          <span>Inputs</span>
          <button className="icon-button nodrag nopan" type="button" onClick={() => data.onAddInput(data.nodeId)} title="Add input">
            <Plus size={14} />
          </button>
        </div>
        {data.inputs.map((input) => <ImageTextInputRow key={input.id} data={data} input={input} />)}
      </div>

      <div className="text-pass-block image-text-url">
        <Handle
          className={data.pendingSourceNodeId ? 'is-link-target' : ''}
          type="target"
          position={Position.Left}
          id="image"
          onClick={() => data.onPickInput(data.nodeId, 'image')}
        />
        <label>
          Image URL
          <textarea
            className="output-box nodrag nopan"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="Link an upload or generated image URL"
          />
        </label>
      </div>

      <div className="output-block image-text-output">
        <div className="row-title">
          <span>Output</span>
          <button
            className="run-node-button nodrag nopan"
            type="button"
            onClick={() => data.onRun(data.nodeId)}
            disabled={data.running || !prompt.trim() || !imageUrl.trim()}
          >
            {data.running ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
            Run
          </button>
        </div>
        <textarea
          className="output-box nodrag nopan"
          value={output}
          onChange={(event) => setOutput(event.target.value)}
          placeholder="Image description or judgment"
        />
        {data.status ? <span className="workflow-status">{data.status}</span> : null}
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
