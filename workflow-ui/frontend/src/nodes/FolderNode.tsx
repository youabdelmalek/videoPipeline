import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { FolderOpen, Trash2 } from 'lucide-react';
import type { FolderNodeData } from './types';

export function FolderNode({ data }: NodeProps<Node<FolderNodeData>>) {
  return (
    <section className={`node node-folder ${data.isDropTarget ? 'is-drop-target' : ''}`} onMouseDown={(event) => {
      if ((event.target as HTMLElement).closest('button, a, input, textarea')) {
        return;
      }
      event.preventDefault();
      data.onStartNodeDrag(data.folder.id, event.clientX, event.clientY);
    }}>
      <Handle type="source" position={Position.Right} />
      <div className="node-header node-drag-handle">
        <div>
          <div className="node-kicker">Folder</div>
          <h2>{data.folder.title}</h2>
        </div>
        <div className="node-header-actions">
          <button className="open-button nodrag nopan" type="button" onClick={() => data.onExpandFolder(data.folder.id)} title="Expand folder" aria-label="Expand folder">
            <FolderOpen size={14} />
          </button>
          <button className="delete-button nodrag nopan" type="button" onClick={() => data.onDeleteFolder(data.folder.id)} title="Delete folder" aria-label="Delete folder">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="folder-count">{data.folder.childNodeIds.length} cards</p>
      <ul className="folder-list">
        {data.childLabels.slice(0, 5).map((label) => (
          <li key={label}>{label}</li>
        ))}
        {data.childLabels.length > 5 ? <li>+ {data.childLabels.length - 5} more</li> : null}
      </ul>
    </section>
  );
}
