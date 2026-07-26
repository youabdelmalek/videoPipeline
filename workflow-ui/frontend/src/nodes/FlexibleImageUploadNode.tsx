import { useRef } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Trash2, Upload } from 'lucide-react';
import type { FlexibleImageUploadNodeData } from './types';
import { useDraftValue } from './useDraftValue';

export function FlexibleImageUploadNode({ data }: NodeProps<Node<FlexibleImageUploadNodeData>>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useDraftValue(data.name, (value) => data.onChange(data.nodeId, { name: value }));
  const sourceClass =
    data.pendingSourceNodeId === data.nodeId && data.pendingSourceHandleId === 'output' ? 'is-link-source' : '';

  return (
    <section className="node flexible-node image-upload-node">
      <div className="node-header">
        <div>
          <div className="node-kicker">Upload image</div>
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
          Folder
          <input className="nodrag nopan" value={data.imageInputDir || 'input'} readOnly aria-label="Image folder" />
        </label>
      </div>

      <button
        className="image-upload-button nodrag nopan"
        type="button"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={15} />
        Upload
      </button>
      <input
        ref={fileInputRef}
        className="nodrag nopan"
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            data.onUploadImage(data.nodeId, file);
          }
          event.currentTarget.value = '';
        }}
      />

      <div className="image-preview">
        {data.outputUrl ? <img src={data.outputUrl} alt="Uploaded" /> : <span>Upload</span>}
      </div>

      <div className="output-block image-url-output">
        <div className="row-title">
          <span>Image URL</span>
          {data.outputName ? <span>{data.outputName}</span> : null}
        </div>
        <textarea className="output-box nodrag nopan" value={data.outputUrl} readOnly placeholder="Uploaded image URL" />
        {data.status ? <small className="workflow-status">{data.status}</small> : null}
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
