import { ApiError } from '@/lib/api/client';

export interface AdminContentErrorView {
  title: string;
  message: string;
  loginHref?: string;
}

export function describeAdminContentError(error: unknown, action: string): AdminContentErrorView {
  if (!(error instanceof ApiError)) {
    return {
      title: 'Request failed',
      message: 'The service could not be reached. Check the connection and try again.',
    };
  }

  switch (error.status) {
    case 401:
      return {
        title: 'Sign in required',
        message: 'Your session is missing or expired.',
        loginHref: '/login/',
      };
    case 403:
      return {
        title: 'Access denied',
        message: `Your account cannot ${action}. The API denied this request.`,
      };
    case 404:
      return {
        title: 'Content not found',
        message: 'The requested content or revision no longer exists.',
      };
    case 409:
      return {
        title: 'Content conflict',
        message:
          error.problem.detail ||
          'The content identity or lifecycle changed. Reload and try again.',
      };
    default:
      if (error.status >= 500) {
        return {
          title: 'Service unavailable',
          message: 'The API could not complete this request. Try again shortly.',
        };
      }
      return {
        title: error.problem.title || 'Request failed',
        message: error.problem.detail || `The API rejected the request (${error.status}).`,
      };
  }
}
