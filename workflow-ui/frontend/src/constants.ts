import type { ModelOption } from './api';

export const DEFAULT_MODEL = 'VladimirGav/gemma4-26b-16GB-VRAM';
export const DEFAULT_VISION_MODEL = 'gemma4:12b';
export const DEFAULT_THINKING_LEVEL = 'off' as const;
export const VISION_MODEL_NAMES = [
  'vaultbox/qwen3.5-uncensored:9b',
  'devstral-small-2:24b',
  'gemma4:12b',
  'qwen3.5:9b',
] as const;

/**
 * Every pass runs locally. Kimi K3 is disabled backend-side
 * (backend/services/kimi.py), so 'ollama' is the only accepted provider.
 */
export const DEFAULT_BOARD_PROVIDER = 'ollama';

/** The shot rewriter is optional and also local. */
export const DEFAULT_SHOT_PROVIDER = 'ollama';

/** Shown until `GET /api/models` answers; mirrors ALLOWED_MODELS in backend/models.py. */
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

export const STARTER_PROMPT =
  'The Mouse Crime Boss\nCats, foxes, and wolves obey an unseen mastermind controlling the city food supply. The reveal: the feared boss is a tiny mouse.';

/** How often the UI re-checks a running job. */
export const JOB_POLL_INTERVAL_MS = 1800;
