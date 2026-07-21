import type { JobState } from '../api';
import { formatRunTime } from '../lib/format';

/** Most recent progress lines shown under the run summary. */
const VISIBLE_EVENTS = 6;

export function ProcessingPanel({ job }: { job: JobState | null }) {
  const events = job?.events ?? [];

  return (
    <div className="processing-panel">
      <div className="processing-head">
        <span className="eyebrow">Ollama Processing</span>
        <strong>{job ? `${job.status}: ${job.message}` : 'Idle'}</strong>
        {job ? <small>Updated {formatRunTime(job.updated_at)}</small> : null}
      </div>
      {events.length ? (
        <ol className="processing-log">
          {events.slice(-VISIBLE_EVENTS).map((event, index) => (
            <li key={`${event}-${index}`}>{event}</li>
          ))}
        </ol>
      ) : (
        <p className="processing-empty">
          Start generation or judging to see Ollama request/response progress here.
        </p>
      )}
    </div>
  );
}
