export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails,
  ) {
    super(problem.detail || problem.title || `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  method?: string;
  body?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function createApiClient(baseUrl: string) {
  if (!baseUrl.trim()) throw new TypeError('An API base URL is required.');

  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new TypeError('The API base URL must use HTTP or HTTPS and cannot contain credentials.');
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (typeof path !== 'string' || path.startsWith('//')) {
      throw new TypeError('API paths must be relative to the configured base URL.');
    }
    const url = new URL(path.replace(/^\/+/, ''), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new TypeError('API paths cannot escape the configured base URL.');
    }

    const headers = new Headers(options.headers);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json, application/problem+json');
    }
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      ...options,
      method: options.method || 'GET',
      headers,
      body,
      credentials: options.credentials ?? 'include',
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let payload: unknown;
      if (contentType.toLowerCase().includes('application/problem+json')) {
        try {
          payload = await response.json();
        } catch {
          payload = undefined;
        }
      }
      const supplied = isRecord(payload) ? payload : {};
      const problem: ProblemDetails = {
        ...supplied,
        type: typeof supplied.type === 'string' ? supplied.type : 'about:blank',
        title: typeof supplied.title === 'string'
          ? supplied.title
          : response.statusText || `HTTP ${response.status}`,
        status: response.status,
      };
      throw new ApiError(response.status, problem);
    }

    if (response.status === 204) return null as T;
    return await response.json() as T;
  }

  return Object.freeze({
    request,
    get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'POST', body }),
  });
}

export const api = createApiClient(
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1/',
);
