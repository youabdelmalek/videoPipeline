/** The local Ollama models the backend will accept, loaded once on mount. */

import { useEffect, useState } from 'react';
import { fetchModels, type ModelOption } from '../api';
import { FALLBACK_MODELS } from '../constants';

export function useModels() {
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [modelsNotice, setModelsNotice] = useState<string | null>(null);

  // No cancellation guard: under StrictMode the effect runs twice, and discarding
  // the first response left the picker stuck on FALLBACK_MODELS when the second
  // request lost its race. The list is immutable, so a late setState is harmless.
  useEffect(() => {
    fetchModels()
      .then((list) => {
        setModels(list.models);
        setModelsNotice(list.unreachable);
      })
      // A dead backend already surfaces elsewhere; keep the fallback list usable.
      .catch(() => undefined);
  }, []);

  return { models, modelsNotice };
}
