/**
 * The run being worked on and the job acting on it: loading, creating,
 * deleting, and kicking off generation or judging.
 */

import { useCallback, useState } from 'react';
import {
  deleteRun,
  fetchRun,
  fetchRuns,
  runWorkflow,
  type BoardProvider,
  type JobState,
  type RunState,
  type RunSummary,
  type ShotProvider,
} from '../api';
import {
  DEFAULT_BOARD_PROVIDER,
  DEFAULT_MODEL,
  DEFAULT_SHOT_PROVIDER,
  STARTER_PROMPT,
} from '../constants';
import { messageFrom } from '../lib/errors';
import { useJobActions } from './useJobActions';
import { useModels } from './useModels';
import { useJobPolling } from './useJobPolling';
import { useRunFromUrl } from './useRunFromUrl';

export function useWorkflowRun() {
  const [prompt, setPrompt] = useState(STARTER_PROMPT);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [boardProvider, setBoardProvider] = useState<BoardProvider>(DEFAULT_BOARD_PROVIDER);
  const [shotProvider, setShotProvider] = useState<ShotProvider>(DEFAULT_SHOT_PROVIDER);
  // Empty means "all", which is what both shot endpoints expect.
  const [detailSelection, setDetailSelection] = useState<Set<number>>(new Set());
  const [rewriteSelection, setRewriteSelection] = useState<Set<number>>(new Set());
  const [run, setRun] = useState<RunState | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const { models, modelsNotice } = useModels();

  const busy = job?.status === 'queued' || job?.status === 'running';

  const refreshRuns = useCallback(async () => {
    setRuns(await fetchRuns());
  }, []);

  /** Video numbers differ between runs, so a stale selection must not carry over. */
  const clearSelections = useCallback(() => {
    setDetailSelection(new Set());
    setRewriteSelection(new Set());
  }, []);

  /** Make `nextRun` the active run and put its slug in the URL. */
  const adoptRun = useCallback(
    (nextRun: RunState) => {
      setRun(nextRun);
      setPrompt(nextRun.prompt || STARTER_PROMPT);
      setJob(null);
      clearSelections();
      window.history.replaceState(null, '', `?run=${encodeURIComponent(nextRun.slug)}`);
    },
    [clearSelections],
  );

  const reset = useCallback(() => {
    setRun(null);
    setJob(null);
    setError(null);
    setRunMessage(null);
    setPrompt(STARTER_PROMPT);
    setModel(DEFAULT_MODEL);
    clearSelections();
    window.history.replaceState(null, '', window.location.pathname);
  }, [clearSelections]);

  const toggleIn = (setSelection: (update: (previous: Set<number>) => Set<number>) => void) => {
    return (index: number) =>
      setSelection((previous) => {
        const next = new Set(previous);
        if (!next.delete(index)) {
          next.add(index);
        }
        return next;
      });
  };

  useRunFromUrl({
    adoptRun,
    setRuns,
    refreshRuns,
    clearError: () => setError(null),
    onMissingRun: (slug) => {
      reset();
      setRunMessage(`Run ${slug} was not found. Showing the default workflow.`);
    },
    onError: setError,
  });

  useJobPolling({
    job,
    setJob,
    onJobFinished: async (slug) => {
      setRun(await fetchRun(slug));
      await refreshRuns();
    },
    // Plain setRun, not adoptRun: a mid-job refresh must not reset the prompt box
    // or the video selections the user made before pressing the button.
    onJobProgress: async (slug) => {
      setRun(await fetchRun(slug));
    },
    onJobLost: () => setRunMessage('Previous job was cleared after backend restart.'),
    onError: setError,
  });

  const {
    generate,
    judge,
    rewriteBoard,
    detailVideos,
    splitAllShots,
    splitVideoShots,
    rewriteShots,
    buildAssetCatalog,
    regenerateAsset,
    buildJsonAssets,
    regenerateJsonAsset,
    buildJsonFrames,
    regenerateJsonFrame,
  } = useJobActions({
    run,
    prompt,
    model,
    boardProvider,
    shotProvider,
    detailSelection,
    rewriteSelection,
    adoptRun,
    refreshRuns,
    setJob,
    setError,
  });

  /** Seed the composed workflow's inputs and run its stages. */
  async function runComposedWorkflow() {
    setError(null);
    if (!run?.slug) {
      setError('Create or load a run before running a composed workflow');
      return;
    }
    try {
      setJob(await runWorkflow(run.slug, model));
    } catch (caught) {
      setError(messageFrom(caught, 'Could not start the workflow'));
    }
  }

  async function loadRun(slug: string) {
    setError(null);
    setRunMessage(null);
    try {
      adoptRun(await fetchRun(slug));
    } catch (caught) {
      setError(messageFrom(caught, `Could not load run ${slug}`));
    }
  }

  async function deleteSelectedRun() {
    setError(null);
    setRunMessage(null);
    if (!run?.slug) {
      setRunMessage('Select a run to delete.');
      return;
    }
    if (!window.confirm(`Delete run "${run.slug}"? This removes its folder from runs/.`)) {
      return;
    }

    try {
      const result = await deleteRun(run.slug);
      await refreshRuns();
      reset();
      setRunMessage(`Deleted run ${result.deleted}.`);
    } catch (caught) {
      setError(messageFrom(caught, 'Could not delete selected run'));
    }
  }

  return {
    prompt,
    setPrompt,
    model,
    setModel,
    models,
    modelsNotice,
    run,
    runs,
    job,
    error,
    runMessage,
    busy,
    loadRun,
    runComposedWorkflow,
    deleteSelectedRun,
    reset,
    generate,
    judge,
    boardProvider,
    setBoardProvider,
    rewriteBoard,
    shotProvider,
    setShotProvider,
    detailSelection,
    toggleDetailVideo: toggleIn(setDetailSelection),
    selectDetailVideos: (indexes: number[]) => setDetailSelection(new Set(indexes)),
    detailVideos,
    splitAllShots,
    splitVideoShots,
    rewriteSelection,
    toggleRewriteVideo: toggleIn(setRewriteSelection),
    selectRewriteVideos: (indexes: number[]) => setRewriteSelection(new Set(indexes)),
    rewriteShots,
    buildAssetCatalog,
    regenerateAsset,
    buildJsonAssets,
    regenerateJsonAsset,
    buildJsonFrames,
    regenerateJsonFrame,
  };
}
