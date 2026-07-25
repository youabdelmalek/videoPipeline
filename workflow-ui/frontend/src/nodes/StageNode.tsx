import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { StageNodeData } from './types';

/**
 * One stage in a composed workflow, with a labelled handle per port.
 *
 * Handles carry `id={port}` so a link records which input it fed; the canvas
 * uses those ids to refuse a connection between mismatched ports.
 */
export function StageNode({ data }: NodeProps<Node<StageNodeData>>) {
  const { stage } = data;

  return (
    <section className={`node node-stage ${data.unsatisfied.length ? 'is-unsatisfied' : ''}`}>
      <div className="node-header">
        <div>
          <div className="node-kicker">Stage</div>
          <h2>{stage.label}</h2>
        </div>
        <div className="node-header-actions">
          <button
            className="delete-button nodrag nopan"
            type="button"
            onClick={() => data.onRemove(data.nodeId)}
            title="Remove this stage"
            aria-label="Remove this stage"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <p className="stage-description">{stage.description}</p>

      <div className="port-columns">
        <ul className="port-list">
          {stage.inputs.map((port) => (
            <li key={port} className={data.unsatisfied.includes(port) ? 'is-missing' : 'is-linked'}>
              {/* The row is the handle's offset parent, so React Flow's own
                  centring puts the dot on this port's line. */}
              <Handle type="target" position={Position.Left} id={port} />
              {data.portLabel(port)}
            </li>
          ))}
        </ul>
        <ul className="port-list is-outputs">
          {stage.outputs.map((port) => (
            <li key={port}>
              {data.portLabel(port)}
              <Handle type="source" position={Position.Right} id={port} />
            </li>
          ))}
        </ul>
      </div>

      {data.unsatisfied.length ? (
        <p className="port-check is-bad">Needs {data.unsatisfied.map(data.portLabel).join(', ')}</p>
      ) : null}
    </section>
  );
}
