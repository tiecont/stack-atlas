(() => {
  class ApiError extends Error {
    constructor(status, problem) {
      super(problem.detail || problem.title || `HTTP ${status}`);
      this.name = 'ApiError';
      this.status = status;
      this.problem = problem;
    }
  }

  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  const createClient = ({baseUrl, fetchImpl = globalThis.fetch?.bind(globalThis)} = {}) => {
    if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
      throw new TypeError('An API base URL is required.');
    }
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('A Fetch-compatible function is required.');
    }

    const base = new URL(baseUrl, globalThis.location?.origin || 'http://localhost');
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
      throw new TypeError('The API base URL must be HTTP or HTTPS and cannot contain credentials.');
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';

    const request = async (path, options = {}) => {
      if (typeof path !== 'string' || path.startsWith('//')) {
        throw new TypeError('API paths must be relative to the configured base URL.');
      }
      const url = new URL(path.replace(/^\/+/, ''), base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
        throw new TypeError('API paths cannot escape the configured base URL.');
      }

      const headers = new Headers(options.headers || {});
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json, application/problem+json');
      }
      let body;
      if (options.body !== undefined) {
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      const response = await fetchImpl(url.toString(), {
        method: options.method || 'GET',
        headers,
        body,
        signal: options.signal,
        credentials: options.credentials || 'include',
      });

      if (!response.ok) {
        const contentType = response.headers?.get('content-type') || '';
        let payload;
        if (contentType.toLowerCase().includes('application/problem+json')) {
          try {
            payload = await response.json();
          } catch {
            payload = undefined;
          }
        }
        const supplied = isRecord(payload) ? payload : {};
        const problem = {
          ...supplied,
          type: typeof supplied.type === 'string' ? supplied.type : 'about:blank',
          title: typeof supplied.title === 'string' ? supplied.title : response.statusText || `HTTP ${response.status}`,
          status: response.status,
        };
        throw new ApiError(response.status, problem);
      }

      if (response.status === 204) return null;
      return response.json();
    };

    return Object.freeze({
      request,
      get: (path, options) => request(path, {...options, method: 'GET'}),
      post: (path, body, options) => request(path, {...options, method: 'POST', body}),
      put: (path, body, options) => request(path, {...options, method: 'PUT', body}),
      delete: (path, options) => request(path, {...options, method: 'DELETE'}),
    });
  };

  window.StackAtlasApi = Object.freeze({ApiError, createClient});
})();
