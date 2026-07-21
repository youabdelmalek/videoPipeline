import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Scissors } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { SceneNodeData } from './types';

export function SceneNode({ data }: NodeProps<Node<SceneNodeData>>) {
  return (
    <article className={`node node-scene ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="scene-number">Video {String(data.scene.index).padStart(2, '0')}</div>
          <h2>{data.scene.title}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton data={data} label={`video ${data.scene.index}`} detail={{ kicker: `Video ${String(data.scene.index).padStart(2, '0')}`, title: data.scene.title, body: data.scene.body }} />
          <CollapseToggle data={data} label={`video ${data.scene.index}`} />
        </div>
      </div>
      {data.collapsed ? null : (
        <>
          <p>{data.scene.body}</p>
          <div className="node-actions">
            {data.shotCount === null ? null : (
              <span className="shot-summary">{data.shotCount} shots</span>
            )}
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onSplitShots}
              disabled={data.disabled}
              title={`Split video ${data.scene.index} into shots`}
            >
              <Scissors size={16} />
              {data.shotCount === null ? 'Split Shots' : 'Re-split'}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
