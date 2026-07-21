/**
 * HTTP plumbing.
 *
 * With no VITE_API_BASE configured the client tries each known port in turn and
 * remembers the one that answered, so the backend can run on 8000 or 8001
 * without the user configuring anything.
 */

const configuredApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '');
const API_BASES = configuredApiBase
  ? [configuredApiBase]
  : ['http://127.0.0.1:8000/api', 'http://127.0.0.1:8001/api'];

const REQUEST_TIMEOUT_MS = 3000;

let activeApiBase = API_BASES[0];

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function orderedApiBases(): string[] {
  return [activeApiBase, ...API_BASES.filter((base) => base !== activeApiBase)];
}

/** A dead port looks like a TypeError or an abort; an HTTP error does not. */
function isRetryableFetchError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown = null;

  for (const apiBase of orderedApiBases()) {
    try {
      const response = await fetchWithTimeout(`${apiBase}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
        ...init,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(text || response.statusText, response.status);
      }

      activeApiBase = apiBase;
      return response.json() as Promise<T>;
    } catch (caught) {
      if (!isRetryableFetchError(caught) || configuredApiBase) {
        throw caught;
      }
      lastError = caught;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not reach workflow API');
}

/** Direct link to an artifact, for opening in a new tab. */
export function artifactUrl(slug: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${activeApiBase}/runs/${slug}/artifacts/${encoded}`;
}
