import { useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { ShotsListNodeData } from './types';

const EMPTY_HINT = 'No shots yet. Use "Generate shots" on a video, or queue them all.';

/**
 * Every split video, as a nested list: one row per video, expanding into that
 * video's shot titles. Open the node's detail panel to pick videos and read the
 * full shot text.
 *
 * Which rows are open is local UI state - it must survive the run refreshes that
 * arrive while a split is running.
 */
export function ShotsListNode({ data }: NodeProps<Node<ShotsListNodeData>>) {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());

  const toggle = (index: number) =>
    setOpenIndexes((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) {
        next.add(index);
      }
      return next;
    });

  const { videos } = data;
  const totalShots = videos.reduce((sum, video) => sum + video.shots.length, 0);
  const title = videos.length
    ? `${videos.length} ${videos.length === 1 ? 'video' : 'videos'} - ${totalShots} shots`
    : 'Shots';

  return (
    <section className={`node node-shots-list ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div
        className="node-header node-drag-handle"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) {
            return;
          }
          event.preventDefault();
          data.onStartNodeDrag(data.nodeId, event.clientX, event.clientY);
        }}
      >
        <div>
          <div className="node-kicker">Shot Splitter</div>
          <h2>{title}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="shot list"
            detail={{
              kicker: 'Video To Shots',
              title,
              body: [
                data.promptText ? `PROMPT\n\n${data.promptText}` : '',
                data.shotsText ? `OUTPUT\n\n${data.shotsText}` : '',
              ].filter(Boolean).join('\n\n---\n\n') || EMPTY_HINT,
              videos,
            }}
          />
          <CollapseToggle data={data} label="shot list" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">
          {videos.length ? `${videos.length} videos / ${totalShots} shots.` : 'Not run yet.'}
        </p>
      ) : (
        <>
          <div className="agent-io agent-io-compact">
            <section>
              <h3>Prompt</h3>
              <pre>{data.promptText || 'Prompt not saved yet.'}</pre>
            </section>
            <section>
              <h3>Output</h3>
              <pre>{data.shotsText || EMPTY_HINT}</pre>
            </section>
          </div>
          {videos.length ? (
            <ul className="shot-table">
              {videos.map((video) => {
                const open = openIndexes.has(video.index);
                return (
                  <li key={video.index}>
                    <button
                      className="nodrag nopan shot-table-row"
                      type="button"
                      onClick={() => toggle(video.index)}
                      aria-expanded={open}
                      title={`${open ? 'Hide' : 'Show'} shots for video ${video.index}`}
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="video-row-index">{String(video.index).padStart(2, '0')}</span>
                      <span className="video-row-title">{video.title}</span>
                      <span className="video-row-badge">
                        {video.shots.length} / {video.total_seconds}s
                      </span>
                    </button>
                    {open ? (
                      <ol className="shot-strip">
                        {video.shots.map((shot) => (
                          <li key={shot.index}>
                            <span className="shot-strip-index">
                              {String(shot.index).padStart(2, '0')} - {shot.seconds}s
                            </span>
                            <span className="shot-strip-title">{shot.title}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="collapsed-summary">{EMPTY_HINT}</p>
          )}
        </>
      )}
    </section>
  );
}
