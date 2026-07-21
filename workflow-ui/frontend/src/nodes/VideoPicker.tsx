/** Checkbox list for choosing which videos a shot job should act on. */

export type PickableVideo = {
  index: number;
  title: string;
  /** Shown on the right of the row, e.g. "12 shots / 84s". */
  note?: string;
};

type Props = {
  videos: PickableVideo[];
  selected: Set<number>;
  disabled: boolean;
  emptyHint: string;
  onToggle: (index: number) => void;
  onSelectAll: (indexes: number[]) => void;
};

export function VideoPicker({ videos, selected, disabled, emptyHint, onToggle, onSelectAll }: Props) {
  if (!videos.length) {
    return <p className="video-picker-empty">{emptyHint}</p>;
  }

  const allIndexes = videos.map((video) => video.index);
  const allSelected = allIndexes.every((index) => selected.has(index));

  return (
    <div className="video-picker">
      <div className="video-picker-toolbar">
        <span>
          {selected.size} of {videos.length} selected
        </span>
        <button
          className="nodrag nopan link-button"
          type="button"
          disabled={disabled}
          onClick={() => onSelectAll(allSelected ? [] : allIndexes)}
        >
          {allSelected ? 'Clear' : 'Select all'}
        </button>
      </div>
      <ul className="video-picker-list nodrag nowheel">
        {videos.map((video) => (
          <li key={video.index}>
            <label>
              <input
                type="checkbox"
                checked={selected.has(video.index)}
                disabled={disabled}
                onChange={() => onToggle(video.index)}
              />
              <span className="video-picker-index">{String(video.index).padStart(2, '0')}</span>
              <span className="video-picker-title">{video.title}</span>
              {video.note ? <span className="video-picker-note">{video.note}</span> : null}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
