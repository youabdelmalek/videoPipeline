/**
 * Polls a queued/running job until it finishes, refreshing the run as it goes.
 *
 * Each generate attempt overwrites `scenes.md` and `scene_judge.md` on disk, so
 * refreshing mid-job is what makes every retry visible on the canvas instead of
 * only the final one.
 */

import { useEffect } from 'react';
import { ApiError, fetchJob, type JobState } from '../api';
import { JOB_POLL_INTERVAL_MS } from '../constants';

type Options = {
  job: JobState | null;
  setJob: (job: JobState | null) => void;
  onJobFinished: (slug: string) => Promise<void> | void;
  /** Called while the job is still running, whenever it reports new progress. */
  onJobProgress: (slug: string) => Promise<void> | void;
  /** The backend forgot this job (it restarted); drop it quietly. */
  onJobLost: () => void;
  onError: (message: string) => void;
};

export function useJobPolling({
  job,
  setJob,
  onJobFinished,
  onJobProgress,
  onJobLost,
  onError,
}: Options) {
  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const nextJob = await fetchJob(job.id);
        setJob(nextJob);
        if (!nextJob.run_slug) {
          return;
        }

        if (nextJob.status === 'done' || nextJob.status === 'error') {
          await onJobFinished(nextJob.run_slug);
          return;
        }

        // Only refetch when the stage actually moved on; the run payload is large
        // and most ticks land between two writes with nothing new to show.
        if (nextJob.updated_at !== job.updated_at) {
          await onJobProgress(nextJob.run_slug);
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) {
          setJob(null);
          onJobLost();
          return;
        }
        onError(caught instanceof Error ? caught.message : 'Could not refresh job status');
      }
    }, JOB_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [job]);
}
