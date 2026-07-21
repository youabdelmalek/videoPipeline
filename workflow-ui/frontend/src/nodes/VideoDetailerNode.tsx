import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Clapperboard } from 'lucide-react';
import { CollapseToggle, OpenDetailButton } from './NodeButtons';
import type { VideoDetailerNodeData } from './types';
import { VideoPicker } from './VideoPicker';

const EMPTY_HINT = 'Pick videos and run this to break each one into a 14-20 shot list.';
const NO_VIDEOS_HINT = 'Generate the board first, then choose which videos to detail.';

export function VideoDetailerNode({ data }: NodeProps<Node<VideoDetailerNodeData>>) {
  const detailedCount = data.detailed.length;
  const summary = detailedCount
    ? `${detailedCount} video${detailedCount === 1 ? '' : 's'} detailed.`
    : 'Not run yet.';

  return (
    <section className={`node node-video-detailer ${data.collapsed ? 'is-collapsed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-header">
        <div>
          <div className="node-kicker">Video Detailer</div>
          <h2>Shot Lists ({data.sourceLabel})</h2>
        </div>
        <div className="node-header-actions">
          <OpenDetailButton
            data={data}
            label="shot lists"
            detail={{
              kicker: 'Video Detailer',
              title: 'Shot Lists',
              body: data.text || EMPTY_HINT,
            }}
          />
          <CollapseToggle data={data} label="video detailer" />
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
            <button
              className="nodrag nopan"
              type="button"
              onClick={data.onDetail}
              disabled={data.disabled || !data.videos.length}
              title="Break the selected videos into shots"
            >
              <Clapperboard size={16} />
              {data.selected.size ? `Detail ${data.selected.size} Video${data.selected.size === 1 ? '' : 's'}` : 'Detail All Videos'}
            </button>
          </div>
          <pre>{data.text || EMPTY_HINT}</pre>
        </>
      )}
    </section>
  );
}
