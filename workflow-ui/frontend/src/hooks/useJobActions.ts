/**
 * Starting the background jobs. Each action creates the run first if the user
 * has only typed a prompt.
 */

import {
  buildAssetCatalog,
  buildJsonAssets,
  buildJsonFrames,
  createRun,
  detailVideos,
  generateScenes,
  judgeScenes,
  rewriteBoard,
  rewriteShots,
  type BoardProvider,
  type JobState,
  type RunState,
  type ShotProvider,
} from '../api';
import { messageFrom } from '../lib/errors';

type Options = {
  run: RunState | null;
  prompt: string;
  model: string;
  /** Provider for the board rewriter only; the other stages use Ollama. */
  boardProvider: BoardProvider;
  /** Provider for the shot rewriter only. */
  shotProvider: ShotProvider;
  /** Board videos to detail. Empty means every video. */
  detailSelection: Set<number>;
  /** Detailed videos to polish. Empty means every detailed video. */
  rewriteSelection: Set<number>;
  adoptRun: (run: RunState) => void;
  refreshRuns: () => Promise<void>;
  setJob: (job: JobState) => void;
  setError: (message: string | null) => void;
};

export function useJobActions(options: Options) {
  const {
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
  } = options;

  /** The current run, creating one from the prompt if there is none yet. */
  async function ensureRun(): Promise<RunState> {
    if (run) {
      return run;
    }
    const created = await createRun(prompt);
    adoptRun(created);
    await refreshRuns();
    return created;
  }

  async function startJob(start: (slug: string) => Promise<JobState>, failureMessage: string) {
    setError(null);
    try {
      const activeRun = await ensureRun();
      setJob(await start(activeRun.slug));
    } catch (caught) {
      setError(messageFrom(caught, failureMessage));
    }
  }

  return {
    generate: () => startJob((slug) => generateScenes(slug, model), 'Could not start video writer'),
    judge: () => startJob((slug) => judgeScenes(slug, model), 'Could not start video judge'),
    rewriteBoard: () =>
      startJob((slug) => rewriteBoard(slug, boardProvider), 'Could not start board rewriter'),
    detailVideos: () =>
      startJob(
        (slug) => detailVideos(slug, model, [...detailSelection]),
        'Could not start video detailer',
      ),
    /** Queue every board video for splitting; the backend works through them in order. */
    splitAllShots: () =>
      startJob((slug) => detailVideos(slug, model, []), 'Could not queue the shot splits'),
    /** Split one video into shots, straight from its row. */
    splitVideoShots: (videoIndex: number) =>
      startJob(
        (slug) => detailVideos(slug, model, [videoIndex]),
        `Could not split video ${videoIndex} into shots`,
      ),
    rewriteShots: () =>
      startJob(
        (slug) => rewriteShots(slug, shotProvider, [...rewriteSelection]),
        'Could not start shot rewriter',
      ),
    buildAssetCatalog: () =>
      startJob((slug) => buildAssetCatalog(slug, model), 'Could not start asset catalog'),
    regenerateAsset: (itemId: string) =>
      startJob(
        (slug) => buildAssetCatalog(slug, model, itemId),
        'Could not regenerate asset description',
      ),
    buildJsonAssets: () =>
      startJob((slug) => buildJsonAssets(slug, model), 'Could not start JsonAssets'),
    regenerateJsonAsset: (itemId: string) =>
      startJob(
        (slug) => buildJsonAssets(slug, model, itemId),
        'Could not regenerate the asset specification',
      ),
    buildJsonFrames: () =>
      startJob((slug) => buildJsonFrames(slug, model), 'Could not start JsonFrames'),
    regenerateJsonFrame: (shotRef: string) =>
      startJob(
        (slug) => buildJsonFrames(slug, model, shotRef),
        `Could not regenerate the frame prompt for ${shotRef}`,
      ),
  };
}
