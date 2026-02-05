export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  retry?: number;
  retryDelayMs?: number;
};

const DEFAULT_RETRY = 2;
const DEFAULT_RETRY_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getBaseUrl = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return envBase?.trim() ? envBase.replace(/\/$/, '') : '';
};

const shouldRetry = (status?: number) => {
  if (!status) return true;
  return status >= 500 || status === 408 || status === 429;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const { retry = DEFAULT_RETRY, retryDelayMs = DEFAULT_RETRY_DELAY_MS, headers, body, ...rest } = options;
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  for (let attempt = 0; attempt <= retry; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        const error = new ApiError('Request failed', response.status, payload);
        if (attempt < retry && shouldRetry(response.status)) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        throw error;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (attempt < retry) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Retry strategy exhausted.');
}
