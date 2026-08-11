import type { ModelOption } from './api';

export const DEFAULT_MODEL = 'VladimirGav/gemma4-26b-16GB-VRAM';
export const DEFAULT_VISION_MODEL = 'gemma4:12b';
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
  'vaultbox/qwen3.5-uncensored:9b',
  'devstral-small-2:24b',
  'gemma4:12b',
  'qwen3.5:9b',
] as const;

/** Shown until `GET /api/models` answers. */
export const FALLBACK_MODELS: ModelOption[] = [
  {
    name: 'vaultbox/qwen3.5-uncensored:9b',
    label: 'Qwen 3.5 Uncensored 9B',
    size_bytes: 0,
    installed: true,
    vision: true,
    thinking_levels: ['off', 'on'],
  },
  {
    name: 'devstral-small-2:24b',
    label: 'Devstral Small 2 24B',
    size_bytes: 0,
    installed: true,
    vision: true,
    thinking_levels: [],
  },
  {
    name: 'gpt-oss:20b',
    label: 'GPT-OSS 20B',
    size_bytes: 0,
    installed: true,
    vision: false,
    thinking_levels: ['off', 'low', 'medium', 'high'],
  },
  {
    name: DEFAULT_MODEL,
    label: 'Gemma 4 26B 16GB (default)',
    size_bytes: 0,
    installed: true,
    vision: false,
    thinking_levels: ['off', 'on'],
  },
  {
    name: DEFAULT_VISION_MODEL,
    label: 'Gemma 4 12B',
    size_bytes: 0,
    installed: true,
    vision: true,
    thinking_levels: ['off', 'on'],
  },
  {
    name: 'qwen3.5:9b',
    label: 'Qwen 3.5 9B',
    size_bytes: 0,
    installed: true,
    vision: true,
    thinking_levels: ['off', 'on'],
  },
];
