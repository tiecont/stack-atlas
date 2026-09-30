import type { WebPlatform } from './config';

export type PlatformRouteDecision =
  { kind: 'next' } | { kind: 'not-found' } | { kind: 'redirect'; destination: string };

const SHARED_AUTH_ROUTES = ['/login', '/register', '/account'];
const LEARNER_ROUTES = [
  '/articles',
  '/topics',
  '/paths',
  '/search',
  '/labs',
  '/examples',
  '/about',
  '/api/search',
  '/robots.txt',
  '/sitemap.xml',
];

function isAtOrBelow(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isSharedRoute(pathname: string): boolean {
  return (
    isAtOrBelow(pathname, '/_next') ||
    pathname === '/api/healthz' ||
    pathname === '/api/healthz/' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    SHARED_AUTH_ROUTES.some((route) => isAtOrBelow(pathname, route))
  );
}

export function platformRouteDecision(
  platform: WebPlatform,
  pathname: string,
): PlatformRouteDecision {
  if (platform === 'admin' && (pathname === '/robots.txt' || pathname === '/sitemap.xml')) {
    return { kind: 'not-found' };
  }

  if (platform === 'admin') {
    if (pathname === '/') return { kind: 'redirect', destination: '/admin/' };
    if (isAtOrBelow(pathname, '/admin')) return { kind: 'next' };
    if (LEARNER_ROUTES.some((route) => isAtOrBelow(pathname, route))) {
      return { kind: 'not-found' };
    }
    if (isSharedRoute(pathname)) return { kind: 'next' };
    return { kind: 'not-found' };
  }

  if (isAtOrBelow(pathname, '/admin')) return { kind: 'not-found' };
  if (isSharedRoute(pathname)) return { kind: 'next' };
  return { kind: 'next' };
}
