import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import type { BoardProvider } from '../api';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { BoardRewriterNodeData } from './types';

// Kimi K3 is disabled (backend/services/kimi.py); local models only.
const PROVIDER_OPTIONS: { value: BoardProvider; label: string }[] = [
  { value: 'ollama', label: 'Local (Ollama)' },
];

const EMPTY_HINT = 'Run this to sharpen twists, humor, and logic across every video.';

export function BoardRewriterNode({ data }: NodeProps<Node<BoardRewriterNodeData>>) {
  const providerLabel = PROVIDER_OPTIONS.find((option) => option.value === data.provider)?.label ?? data.provider;

  return (
    <section className={`node node-board-rewriter ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="node-kicker">Board Rewriter</div>
          <h2>{providerLabel}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="board rewriter"
            detail={{
              kicker: 'Board Rewriter',
              title: 'Improved Video Bullet Board',
              body: data.text || EMPTY_HINT,
            }}
          />
          <CollapseToggle data={data} label="board rewriter" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">{data.text ? 'Board improved.' : 'Not run yet.'}</p>
      ) : (
        <>
          <div className="node-actions">
            <select
              className="nodrag nopan"
              value={data.provider}
              onChange={(event) => data.onProviderChange(event.target.value as BoardProvider)}
              aria-label="Board rewriter model"
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onRewrite}
              disabled={data.disabled}
              title="Rewrite the video bullet board"
            >
              <Sparkles size={16} />
              Rewrite Board
            </button>
          </div>
          <pre>{data.text || EMPTY_HINT}</pre>
        </>
      )}
    </section>
  );
}
