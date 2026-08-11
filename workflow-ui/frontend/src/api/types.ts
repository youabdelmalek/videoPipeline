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

export type GenerateComfyImageRequest = {
  prompt: string;
  reference_image: string;
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
