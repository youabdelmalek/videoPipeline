import type { ModelOption } from './api';

export const DEFAULT_MODEL = 'qwen3.8:27b';
export const DEFAULT_VISION_MODEL = 'qwen3.8:27b';
export const DEFAULT_THINKING_LEVEL = 'off' as const;
export const DEFAULT_ASPECT_RATIO = '1:1' as const;
export const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 - Square' },
  { value: '4:3', label: '4:3 - Landscape' },
  { value: '3:4', label: '3:4 - Portrait' },
  { value: '16:9', label: '16:9 - Widescreen' },
  { value: '9:16', label: '9:16 - Vertical' },
  { value: '3:2', label: '3:2 - Landscape' },
  { value: '2:3', label: '2:3 - Portrait' },
] as const;
export type AspectRatio = (typeof ASPECT_RATIO_OPTIONS)[number]['value'];
export const VISION_MODEL_NAMES = [
  'qwen3.8:27b',
  'smtek/Qwen3.8-27B:Q3_K_XL',
  'orcarouter/Qwen3.8-27B-Uncensored:q3_K_M',
] as const;

/** Shown until `GET /api/models` answers. */
export const FALLBACK_MODELS: ModelOption[] = [
  {
    name: 'qwen3.8:27b',
    label: 'Qwen 3.8 27B',
    size_bytes: 0,
    installed: true,
    vision: true,
    thinking_levels: ['off', 'on'],
  },
  {
    name: 'smtek/Qwen3.8-27B:Q3_K_XL',
    label: 'Qwen 3.8 27B Q3 K XL (GPU optimized)',
    size_bytes: 0,
    installed: true,
    vision: true,
    thinking_levels: ['off', 'on'],
  },
  {
    name: 'orcarouter/Qwen3.8-27B-Uncensored:q3_K_M',
    label: 'Qwen 3.8 27B Uncensored Q3 K M',
    size_bytes: 0,
    installed: true,
    vision: true,
    thinking_levels: ['off', 'on'],
  },
];
