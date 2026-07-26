import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { FlexibleImageDisplayNodeData } from './types';
import { useDraftValue } from './useDraftValue';

export function FlexibleImageDisplayNode({ data }: NodeProps<Node<FlexibleImageDisplayNodeData>>) {
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const [imageUrl, setImageUrl] = useDraftValue(data.imageUrl, (value) => data.onChange(data.nodeId, { imageUrl: value }));

  return (
    <section className="node flexible-node image-display-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Display image</div>
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

      <div className="text-pass-block">
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
            placeholder="Link or paste an image URL"
          />
        </label>
      </div>

      <div className="image-preview image-display-preview">
        {imageUrl ? <img src={imageUrl} alt="Display" /> : <span>Image</span>}
      </div>
    </section>
  );
}
