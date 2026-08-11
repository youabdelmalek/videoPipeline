/** One function per backend endpoint. */

import { request } from './client';
import type {
  ComfyImageInfo,
  ComfyImageListResponse,
  GenerateComfyImageRequest,
  GenerateComfyImageResponse,
  GenerateComfyVideoRequest,
  GenerateComfyVideoResponse,
  ModelList,
  ThinkingLevel,
  FlexibleImageLlmResponse,
  FlexibleLlmResponse,
  UploadComfyImageResponse,
} from './types';
import type { SavedWorkflow, WorkflowLibrary } from '../lib/engine';

/** The local models the backend will accept, annotated with what is pulled. */
export async function fetchModels(): Promise<ModelList> {
  return request<ModelList>('/models');
}

export async function runFlexibleLlm(
  prompt: string,
  model: string,
  signal?: AbortSignal,
  thinking: ThinkingLevel = 'off',
): Promise<string> {
  const data = await request<FlexibleLlmResponse>(
    '/llm',
    {
      method: 'POST',
      body: JSON.stringify({ prompt, model, thinking }),
      signal,
    },
    10 * 60 * 1000,
  );
  return data.output;
}

export async function runFlexibleImageLlm(
  prompt: string,
  imageUrl: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await request<FlexibleImageLlmResponse>(
    '/image-llm',
    {
      method: 'POST',
      body: JSON.stringify({ prompt, image_url: imageUrl, model }),
      signal,
    },
    10 * 60 * 1000,
  );
  return data.output;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read image file'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

export async function fetchComfyImages(): Promise<ComfyImageListResponse> {
  return request<ComfyImageListResponse>('/comfyui/images');
}

export async function uploadComfyImage(file: File): Promise<ComfyImageInfo> {
  const dataUrl = await readFileAsDataUrl(file);
  const data = await request<UploadComfyImageResponse>(
    '/comfyui/images',
    {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, data_url: dataUrl }),
    },
    2 * 60 * 1000,
  );
  return data.image;
}

export async function generateComfyImage(
  requestBody: GenerateComfyImageRequest,
  signal?: AbortSignal,
): Promise<GenerateComfyImageResponse> {
  return request<GenerateComfyImageResponse>(
    '/comfyui/generate',
    {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal,
    },
    (requestBody.timeout_seconds ?? 900) * 1000 + 30 * 1000,
  );
}

export async function generateComfyVideo(
  requestBody: GenerateComfyVideoRequest,
  signal?: AbortSignal,
): Promise<GenerateComfyVideoResponse> {
  return request<GenerateComfyVideoResponse>(
    '/comfyui/generate-video',
    {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal,
    },
    (requestBody.timeout_seconds ?? 1800) * 1000 + 30 * 1000,
  );
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

export async function saveWorkflowLog(
  workflowName: string,
  runName: string,
  content: string,
): Promise<{ filename: string }> {
  return request<{ filename: string }>('/logs', {
    method: 'POST',
    body: JSON.stringify({ workflow_name: workflowName, run_name: runName, content }),
  });
}
