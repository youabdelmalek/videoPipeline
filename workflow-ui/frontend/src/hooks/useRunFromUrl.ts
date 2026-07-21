/** On first load, restore the run named in `?run=<slug>`. */

import { useEffect } from 'react';
import { fetchRun, fetchRuns, type RunState, type RunSummary } from '../api';

type Options = {
  adoptRun: (run: RunState) => void;
  setRuns: (runs: RunSummary[]) => void;
  refreshRuns: () => Promise<void>;
  clearError: () => void;
  /** The URL named a run that no longer exists. */
  onMissingRun: (slug: string) => void;
  onError: (message: string) => void;
};

export function useRunFromUrl({
  adoptRun,
  setRuns,
  refreshRuns,
  clearError,
  onMissingRun,
  onError,
}: Options) {
  useEffect(() => {
    const reportError = (caught: unknown) =>
      onError(caught instanceof Error ? caught.message : 'Could not load runs');

    const runSlug = new URLSearchParams(window.location.search).get('run');
    if (!runSlug) {
      refreshRuns().catch(reportError);
      return;
    }

    let cancelled = false;
    clearError();

    Promise.all([fetchRun(runSlug), fetchRuns()])
      .then(([nextRun, nextRuns]) => {
        if (cancelled) {
          return;
        }
        adoptRun(nextRun);
        setRuns(nextRuns);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        onMissingRun(runSlug);
        refreshRuns().catch(reportError);
      });

    return () => {
      cancelled = true;
    };
  }, []);
}
