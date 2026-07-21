import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Wand2 } from 'lucide-react';
import type { ShotProvider } from '../api';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { ShotRewriterNodeData } from './types';
import { VideoPicker } from './VideoPicker';

// Kimi K3 is disabled (backend/services/kimi.py); local models only.
const PROVIDER_OPTIONS: { value: ShotProvider; label: string }[] = [
  { value: 'ollama', label: 'Local (Ollama)' },
];

const EMPTY_HINT = 'Optional. Polishes the camera work and visual detail of each shot list.';
const NO_VIDEOS_HINT = 'Detail some videos first, then choose which shot lists to polish.';

export function ShotRewriterNode({ data }: NodeProps<Node<ShotRewriterNodeData>>) {
  const providerLabel = PROVIDER_OPTIONS.find((option) => option.value === data.provider)?.label ?? data.provider;
  const polishedCount = data.polished.length;
  const summary = polishedCount
    ? `${polishedCount} shot list${polishedCount === 1 ? '' : 's'} polished.`
    : 'Not run yet.';

  return (
    <section className={`node node-shot-rewriter ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div
        className="node-header node-drag-handle"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest('button, a, input, textarea, select, label')) {
            return;
          }
          event.preventDefault();
          data.onStartNodeDrag(data.nodeId, event.clientX, event.clientY);
        }}
      >
        <div>
          <div className="node-kicker">Shot Rewriter</div>
          <h2>{providerLabel}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="polished shot lists"
            detail={{
              kicker: 'Shot Rewriter',
              title: 'Polished Shot Lists',
              body: data.text || EMPTY_HINT,
            }}
          />
          <CollapseToggle data={data} label="shot rewriter" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">{summary}</p>
      ) : (
        <>
          <VideoPicker
            videos={data.videos}
            selected={data.selected}
            disabled={data.disabled}
            emptyHint={NO_VIDEOS_HINT}
            onToggle={data.onToggleVideo}
            onSelectAll={data.onSelectVideos}
          />
          <div className="node-actions">
            <select
              className="nodrag nopan"
              value={data.provider}
              onChange={(event) => data.onProviderChange(event.target.value as ShotProvider)}
              aria-label="Shot rewriter model"
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
              onClick={data.onRewriteShots}
              disabled={data.disabled || !data.videos.length}
              title="Polish the selected shot lists"
            >
              <Wand2 size={16} />
              {data.selected.size ? `Polish ${data.selected.size}` : 'Polish All'}
            </button>
          </div>
          <pre>{data.text || EMPTY_HINT}</pre>
        </>
      )}
    </section>
  );
}
