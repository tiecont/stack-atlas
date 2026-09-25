import { ApiError, normalizeProblem } from './problem-details';

export { ApiError } from './problem-details';
export type { ProblemDetails } from './problem-details';

type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  method?: string;
  body?: unknown;
};

export function createApiClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  if (!baseUrl.trim()) throw new TypeError('An API base URL is required.');
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new TypeError('The API base URL must use HTTP or HTTPS and cannot contain credentials.');
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';

  async function request<T>(requestPath: string, options: RequestOptions = {}): Promise<T> {
    if (typeof requestPath !== 'string' || requestPath.startsWith('//')) {
      throw new TypeError('API paths must be relative to the configured base URL.');
    }
    const url = new URL(requestPath.replace(/^\/+/, ''), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new TypeError('API paths cannot escape the configured base URL.');
    }

    const headers = new Headers(options.headers);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json, application/problem+json');
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const response = await fetchImpl(url, {
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
      throw new ApiError(
        response.status,
        normalizeProblem(payload, response.status, response.statusText),
      );
    }
    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  }

  return Object.freeze({
    request,
    get: <T>(requestPath: string, options?: RequestOptions) =>
      request<T>(requestPath, { ...options, method: 'GET' }),
    post: <T>(requestPath: string, body?: unknown, options?: RequestOptions) =>
      request<T>(requestPath, { ...options, method: 'POST', body }),
    put: <T>(requestPath: string, body?: unknown, options?: RequestOptions) =>
      request<T>(requestPath, { ...options, method: 'PUT', body }),
    delete: <T>(requestPath: string, options?: RequestOptions) =>
      request<T>(requestPath, { ...options, method: 'DELETE' }),
  });
}

export const api = createApiClient(
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1/',
);
