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
  const supplied = isRecord(payload) ? payload : {};
  return {
    ...supplied,
    type: typeof supplied.type === 'string' ? supplied.type : 'about:blank',
    title: typeof supplied.title === 'string' ? supplied.title : statusText || `HTTP ${status}`,
    status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
