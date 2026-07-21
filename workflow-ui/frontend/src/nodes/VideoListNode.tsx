import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Layers, Scissors, Sparkles } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { VideoListNodeData } from './types';

const EMPTY_HINT = 'Run the prompt to split the story into videos.';

/** The board as a list of titles: one row per video, each able to run its own shot split. */
export function VideoListNode({ data }: NodeProps<Node<VideoListNodeData>>) {
  const { videos } = data;
  const title = videos.length ? `Videos (${videos.length})` : 'Videos';

  return (
    <section className={`node node-video-list ${data.collapsed ? 'is-collapsed' : ''}`}>
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
          <div className="node-kicker">Video Splitter{data.polished ? ' - rewritten' : ''}</div>
          <h2>{title}</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="video list"
            detail={{
              kicker: 'Story Separator',
              title,
              body: [
                data.promptText ? `PROMPT\n\n${data.promptText}` : '',
                data.boardText ? `OUTPUT\n\n${data.boardText}` : '',
              ].filter(Boolean).join('\n\n---\n\n') || EMPTY_HINT,
            }}
          />
          <CollapseToggle data={data} label="video list" />
        </div>
      </div>
      {data.collapsed ? (
        <p className="collapsed-summary">{videos.length ? `${videos.length} videos.` : 'Not run yet.'}</p>
      ) : (
        <>
          <div className="agent-io agent-io-compact">
            <section>
              <h3>Prompt</h3>
              <pre>{data.promptText || 'Prompt not saved yet.'}</pre>
            </section>
            <section>
              <h3>Output</h3>
              <pre>{data.boardText || EMPTY_HINT}</pre>
            </section>
          </div>
          {videos.length ? (
            <ol className="video-rows">
              {videos.map((video) => (
                <li key={video.index}>
                  <span className="video-row-index">{String(video.index).padStart(2, '0')}</span>
                  <span className="video-row-title" title={video.title}>
                    {video.title}
                  </span>
                  {video.shotCount === null ? null : (
                    <span className="video-row-badge">{video.shotCount} shots</span>
                  )}
                  <button
                    className="nodrag nopan icon-button"
                    type="button"
                    onClick={() => data.onSplitVideo(video.index)}
                    disabled={data.disabled}
                    title={`Generate shots for video ${video.index}`}
                  >
                    <Scissors size={14} />
                    {video.shotCount === null ? 'Generate shots' : 'Re-split'}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="collapsed-summary">{EMPTY_HINT}</p>
          )}
          <div className="node-actions node-actions-stacked">
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onSplitAll}
              disabled={data.disabled || !videos.length}
              title="Split every video into shots, one after another"
            >
              <Layers size={16} />
              Queue all shot splits
            </button>
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onRewriteBoard}
              disabled={data.disabled || !videos.length}
              title="Rewrite all videos in one pass"
            >
              <Sparkles size={16} />
              Full rewrite of {videos.length || 'all'} videos
            </button>
          </div>
        </>
      )}
    </section>
  );
}
