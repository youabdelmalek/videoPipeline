import { useState } from 'react';
import type { DetailedVideo } from '../api';

/**
 * The shot browser inside the detail panel: pick one or more videos and read
 * their full shot text. The node itself stays a plain list.
 */
export function ShotsDetail({ videos }: { videos: DetailedVideo[] }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(videos.map((video) => video.index)));

  const shown = videos.filter((video) => selected.has(video.index));

  return (
    <div className="detail-shots">
      <div className="video-filter">
        <select
          multiple
          size={Math.min(videos.length, 6)}
          value={[...selected].map(String)}
          onChange={(event) =>
            setSelected(new Set(Array.from(event.target.selectedOptions, (option) => Number(option.value))))
          }
          aria-label="Videos to show"
        >
          {videos.map((video) => (
            <option key={video.index} value={video.index}>
              {String(video.index).padStart(2, '0')} - {video.title} ({video.shots.length} shots)
            </option>
          ))}
        </select>
        <div className="video-filter-actions">
          <span>Ctrl-click or drag to pick several</span>
          <button
            className="icon-button"
            type="button"
            onClick={() => setSelected(new Set(videos.map((video) => video.index)))}
            disabled={shown.length === videos.length}
          >
            All
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={!shown.length}
          >
            None
          </button>
        </div>
      </div>
      {shown.length ? (
        shown.map((video) => (
          <section key={video.index}>
            <h3 className="detail-shots-heading">
              Video {String(video.index).padStart(2, '0')} - {video.title}
              <span className="video-row-badge">
                {video.shots.length} shots / {video.total_seconds}s
              </span>
            </h3>
            <pre className="detail-body">{video.text}</pre>
          </section>
        ))
      ) : (
        <p className="collapsed-summary">Select a video above to read its shots.</p>
      )}
    </div>
  );
}
