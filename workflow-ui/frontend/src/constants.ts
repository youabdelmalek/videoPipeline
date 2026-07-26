export const DEFAULT_MODEL = 'VladimirGav/gemma4-26b-16GB-VRAM';
export const DEFAULT_VISION_MODEL = 'qwen2.5vl:3b';
export const QWEN_35_VISION_MODEL = 'qwen3.5:9b-q8_0';
export const VISION_MODEL_NAMES = [DEFAULT_VISION_MODEL, QWEN_35_VISION_MODEL] as const;

/**
 * Every pass runs locally. Kimi K3 is disabled backend-side
 * (backend/services/kimi.py), so 'ollama' is the only accepted provider.
 */
export const DEFAULT_BOARD_PROVIDER = 'ollama';

/** The shot rewriter is optional and also local. */
export const DEFAULT_SHOT_PROVIDER = 'ollama';

/** Shown until `GET /api/models` answers; mirrors ALLOWED_MODELS in backend/models.py. */
export const FALLBACK_MODELS = [
  { name: 'gemma4:12b', label: 'Gemma 4 12B (small)', size_bytes: 0, installed: true },
  { name: DEFAULT_MODEL, label: 'Gemma 4 26B 16GB (default)', size_bytes: 0, installed: true },
  { name: 'qwen3.5:9b', label: 'Qwen 3.5 9B (small)', size_bytes: 0, installed: true },
  { name: 'acidos/Qwen3.6-27B-IQ4_XS', label: 'Qwen 3.6 27B IQ4_XS (16GB)', size_bytes: 0, installed: true },
  { name: DEFAULT_VISION_MODEL, label: 'Qwen 2.5 VL 3B (vision)', size_bytes: 0, installed: true },
  { name: QWEN_35_VISION_MODEL, label: 'Qwen 3.5 9B Q8 (vision)', size_bytes: 0, installed: true },
];

export const STARTER_PROMPT =
  'The Mouse Crime Boss\nCats, foxes, and wolves obey an unseen mastermind controlling the city food supply. The reveal: the feared boss is a tiny mouse.';

/** How often the UI re-checks a running job. */
export const JOB_POLL_INTERVAL_MS = 1800;
