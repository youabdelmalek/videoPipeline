import { ClipboardList, Eye, EyeOff, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import type { JobState, RunSummary } from '../api';

type Props = {
  runs: RunSummary[];
  currentSlug: string | null;
  job: JobState | null;
  busy: boolean;
  onLoadRun: (slug: string) => void;
  onDeleteRun: () => void;
  onReset: () => void;
  /** Whether the judge and the other advanced nodes are drawn. */
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
};

function runOptionLabel(run: RunSummary): string {
  const verdict = run.judge_verdict ? `, ${run.judge_verdict}` : '';
  return `${run.slug} (${run.scenes_count} videos${verdict})`;
}

export function TopBar({
  runs,
  currentSlug,
  job,
  busy,
  onLoadRun,
  onDeleteRun,
  onReset,
  showAdvanced,
  onToggleAdvanced,
}: Props) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">Local Ollama Workflow</span>
      </div>
      <div className="topbar-actions">
        <div className="run-manager">
          <label htmlFor="run-select">Runs</label>
          <select
            id="run-select"
            value={currentSlug ?? ''}
            onChange={(event) => onLoadRun(event.target.value)}
            disabled={busy || !runs.length}
          >
            <option value="" disabled>
              {runs.length ? 'Select run' : 'No runs'}
            </option>
            {runs.map((item) => (
              <option key={item.slug} value={item.slug}>
                {runOptionLabel(item)}
              </option>
            ))}
          </select>
          <button
            className="delete-runs-button"
            type="button"
            onClick={onDeleteRun}
            disabled={busy || !currentSlug}
            title="Delete selected run"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
        <button
          className="reset-button"
          type="button"
          onClick={onToggleAdvanced}
          title={
            showAdvanced
              ? 'Hide the judge and the other advanced nodes'
              : 'Show the judge and the other advanced nodes (they run either way)'
          }
          aria-pressed={showAdvanced}
        >
          {showAdvanced ? <EyeOff size={16} /> : <Eye size={16} />}
          {showAdvanced ? 'Hide judge' : 'Show judge'}
        </button>
        <button className="reset-button" type="button" onClick={onReset} disabled={busy} title="Reset canvas">
          <RotateCcw size={16} />
          Reset
        </button>
        <div className="status-pill">
          {busy ? <Loader2 className="spin" size={16} /> : <ClipboardList size={16} />}
          {job ? `${job.stage}: ${job.message}` : 'Ready'}
        </div>
      </div>
    </header>
  );
}
