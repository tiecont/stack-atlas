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

export function normalizeProblem(
  payload: unknown,
  status: number,
  statusText: string,
): ProblemDetails {
  const supplied =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  return {
    ...supplied,
    type: typeof supplied.type === 'string' ? supplied.type : 'about:blank',
    title: typeof supplied.title === 'string' ? supplied.title : statusText || `HTTP ${status}`,
    status,
  };
}
