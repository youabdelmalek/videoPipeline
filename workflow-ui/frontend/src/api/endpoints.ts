/** One function per backend endpoint. */

import { request } from './client';
import type {
  BoardProvider,
  JobState,
  ModelList,
  PortCheck,
  RunState,
  RunSummary,
  ShotProvider,
  StageCatalog,
  WorkflowDefinition,
  FlexibleLlmResponse,
} from './types';
import type { SavedWorkflow, WorkflowLibrary } from '../lib/engine';

/** The local models the backend will accept, annotated with what is pulled. */
export async function fetchModels(): Promise<ModelList> {
  return request<ModelList>('/models');
}

export async function createRun(prompt: string): Promise<RunState> {
  const data = await request<{ run: RunState }>('/runs', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  return data.run;
}

export async function fetchRun(slug: string): Promise<RunState> {
  return request<RunState>(`/runs/${slug}`);
}

export async function fetchRuns(): Promise<RunSummary[]> {
  const data = await request<{ runs: RunSummary[] }>('/runs');
  return data.runs;
}

export async function deleteRun(slug: string): Promise<{ deleted: string }> {
  return request<{ deleted: string }>(`/runs/${slug}`, { method: 'DELETE' });
}

export async function generateScenes(slug: string, model: string): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/generate-scenes`, {
    method: 'POST',
    body: JSON.stringify({ model }),
  });
  return data.job;
}

export async function judgeScenes(slug: string, model: string): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/judge-scenes`, {
    method: 'POST',
    body: JSON.stringify({ model }),
  });
  return data.job;
}

/** Blank `model` tells the backend to use that provider's default. */
export async function rewriteBoard(
  slug: string,
  provider: BoardProvider,
  model = '',
): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/rewrite-board`, {
    method: 'POST',
    body: JSON.stringify({ provider, model }),
  });
  return data.job;
}

/** An empty `videoIndexes` tells the backend to act on every video. */
export async function detailVideos(
  slug: string,
  model: string,
  videoIndexes: number[],
): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/detail-videos`, {
    method: 'POST',
    body: JSON.stringify({ model, video_indexes: videoIndexes }),
  });
  return data.job;
}

/** An empty `videoIndexes` tells the backend to polish every detailed video. */
export async function rewriteShots(
  slug: string,
  provider: ShotProvider,
  videoIndexes: number[],
  model = '',
): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/rewrite-shots`, {
    method: 'POST',
    body: JSON.stringify({ provider, model, video_indexes: videoIndexes }),
  });
  return data.job;
}

/** Blank `itemId` runs extractor -> judge -> detailer; otherwise regenerates one detail. */
export async function buildAssetCatalog(
  slug: string,
  model: string,
  itemId = '',
): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/asset-catalog`, {
    method: 'POST',
    body: JSON.stringify({ model, item_id: itemId }),
  });
  return data.job;
}

/** Blank `itemId` specs every catalog asset; otherwise re-specs just that one. */
export async function buildJsonAssets(
  slug: string,
  model: string,
  itemId = '',
): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/json-assets`, {
    method: 'POST',
    body: JSON.stringify({ model, item_id: itemId }),
  });
  return data.job;
}

/** Blank `shotRef` writes every planned shot; otherwise just that one shot. */
export async function buildJsonFrames(
  slug: string,
  model: string,
  shotRef = '',
): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/json-frames`, {
    method: 'POST',
    body: JSON.stringify({ model, shot_ref: shotRef }),
  });
  return data.job;
}

export async function fetchJob(jobId: string): Promise<JobState> {
  return request<JobState>(`/jobs/${jobId}`);
}

/** The stage and port contracts the composer renders handles from. */
export async function fetchStages(): Promise<StageCatalog> {
  return request<StageCatalog>('/stages');
}

/** Structural check on pasted text. Writes nothing. */
export async function validatePort(port: string, text: string): Promise<PortCheck> {
  return request<PortCheck>('/validate', {
    method: 'POST',
    body: JSON.stringify({ port, text }),
  });
}

export async function fetchWorkflow(slug: string): Promise<WorkflowDefinition> {
  const data = await request<{ workflow: WorkflowDefinition }>(`/runs/${slug}/workflow`);
  return data.workflow;
}

export async function saveWorkflow(
  slug: string,
  workflow: WorkflowDefinition,
): Promise<WorkflowDefinition> {
  const data = await request<{ workflow: WorkflowDefinition }>(`/runs/${slug}/workflow`, {
    method: 'PUT',
    body: JSON.stringify(workflow),
  });
  return data.workflow;
}

export async function runWorkflow(slug: string, model: string): Promise<JobState> {
  const data = await request<{ job: JobState }>(`/runs/${slug}/run-workflow`, {
    method: 'POST',
    body: JSON.stringify({ model }),
  });
  return data.job;
}

export async function runFlexibleLlm(
  prompt: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await request<FlexibleLlmResponse>(
    '/llm',
    {
      method: 'POST',
      body: JSON.stringify({ prompt, model }),
      signal,
    },
    10 * 60 * 1000,
  );
  return data.output;
}

export async function fetchFlexibleWorkflowLibrary(): Promise<WorkflowLibrary> {
  const data = await request<{ library: WorkflowLibrary }>('/flexible-workflows');
  return data.library;
}

export async function saveFlexibleWorkflow(name: string, workflow: SavedWorkflow): Promise<WorkflowLibrary> {
  const data = await request<{ library: WorkflowLibrary }>(`/flexible-workflows/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify({ workflow }),
  });
  return data.library;
}

export async function deleteFlexibleWorkflow(name: string): Promise<{ deleted: string }> {
  return request<{ deleted: string }>(`/flexible-workflows/${encodeURIComponent(name)}`, { method: 'DELETE' });
}
