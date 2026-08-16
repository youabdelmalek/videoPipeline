/** Shapes returned by the backend. Mirrors `backend/models.py`. */

export type ThinkingLevel = 'off' | 'on' | 'low' | 'medium' | 'high';

/** One local model offered in the model picker. */
import type { AspectRatio } from '../constants';

export type ModelOption = {
  name: string;
  label: string;
  size_bytes: number;
  installed: boolean;
  vision: boolean;
  thinking_levels: ThinkingLevel[];
};

export type ModelList = {
  models: ModelOption[];
  default: string;
  /** Set when Ollama could not be reached; nothing is marked installed. */
  unreachable: string | null;
};

export type FlexibleLlmResponse = {
  output: string;
};

export type FlexibleImageLlmResponse = {
  output: string;
};

export type ComfyImageInfo = {
  name: string;
  url: string;
  size_bytes: number;
  updated_at: number;
};

export type ComfyImageListResponse = {
  images: ComfyImageInfo[];
  input_dir: string;
};

export type UploadComfyImageResponse = {
  image: ComfyImageInfo;
};

export type ImageGenerationWorkflow = 'style' | 'identity' | 'text_to_image';
export type VideoGenerationWorkflow = 'ref2va' | 'fl2v' | 'ref2va_fast' | 'fl2v_fast';

export type GenerateComfyImageRequest = {
  prompt: string;
  reference_image: string;
  workflow?: ImageGenerationWorkflow;
  aspect_ratio?: AspectRatio;
  seed?: number | null;
  steps?: number;
  strength?: number;
  timeout_seconds?: number;
};

export type GenerateComfyImageResponse = {
  url: string;
  filename: string;
  reference_image: string;
  aspect_ratio: AspectRatio;
  prompt_id: string;
  seed: number;
};

export type GenerateComfyVideoRequest = {
  prompt: string;
  workflow: VideoGenerationWorkflow;
  character_image?: string;
  background_image?: string;
  first_frame?: string;
  last_frame?: string;
  aspect_ratio?: AspectRatio;
  duration_seconds?: number;
  seed?: number | null;
  steps?: number;
  timeout_seconds?: number;
};

export type GenerateComfyVideoResponse = {
  url: string;
  filename: string;
  workflow: VideoGenerationWorkflow;
  aspect_ratio: AspectRatio;
  duration_seconds: number;
  prompt_id: string;
  seed: number;
};
