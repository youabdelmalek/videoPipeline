import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Play, Trash2 } from 'lucide-react';
import type { FlexibleImageGenerateNodeData } from './types';
import { useDraftValue } from './useDraftValue';

export function FlexibleImageGenerateNode({ data }: NodeProps<Node<FlexibleImageGenerateNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [prompt, setPrompt] = useDraftValue(data.prompt, (value) => data.onChange(data.nodeId, { prompt: value }));
  const [referenceImage, setReferenceImage] = useDraftValue(
    data.referenceImage,
    (value) => data.onChange(data.nodeId, { referenceImage: value }),
  );
  const [seed, setSeed] = useDraftValue(data.seed, (value) => data.onChange(data.nodeId, { seed: value }));
  const updateNodeInternals = useUpdateNodeInternals();
  const sourceClass =
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === 'output' ? 'is-link-source' : '';

  useEffect(() => {
    updateNodeInternals(data.nodeId);
  }, [data.nodeId, updateNodeInternals]);

  return (
    <section className="node flexible-node image-generate-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Generate image</div>
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

      <div className="node-grid three">
        <label>
          Seed
          <input
            className="nodrag nopan"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder="auto"
          />
        </label>
        <label>
          Steps
          <input
            className="nodrag nopan"
            type="number"
            min={1}
            max={150}
            value={data.steps}
            onChange={(event) => data.onChange(data.nodeId, { steps: Number(event.target.value) || 8 })}
          />
        </label>
        <label>
          Strength
          <input
            className="nodrag nopan"
            type="number"
            min={0}
            max={2}
            step={0.05}
            value={data.strength}
            onChange={(event) => data.onChange(data.nodeId, { strength: Number(event.target.value) || 1 })}
          />
        </label>
      </div>

      <div className="text-pass-block">
        <Handle
          className={data.pendingSourceNodeId ? 'is-link-target' : ''}
          type="target"
          position={Position.Left}
          id="prompt"
          onClick={() => data.onPickInput(data.nodeId, 'prompt')}
        />
        <label>
          Prompt
          <textarea
            className="prompt-box nodrag nopan"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Link or type an image prompt"
          />
        </label>
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
