import { loadCatalog } from './loader.ts';

export function getBasePath(): string {
  const configured = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || loadCatalog().site.base_path || '';
  if (!configured || configured === '/') return '';
  return `/${configured.split('/').filter(Boolean).join('/')}`;
}

export function withBasePath(url: string): string {
  const basePath = getBasePath();
  if (!basePath || !url.startsWith('/') || url === basePath || url.startsWith(`${basePath}/`)) return url;
  return `${basePath}${url}`;
}

export function canonicalUrl(pathname: string): string {
  const catalog = loadCatalog();
  const origin = process.env.SITE_URL || catalog.site.base_url;
  const path = withBasePath(pathname);
  return origin ? new URL(path, `${origin.replace(/\/$/, '')}/`).toString() : path;
}

export function siteOrigin(): string {
  const catalog = loadCatalog();
  return process.env.SITE_URL || catalog.site.base_url || 'https://tiecont.github.io';
}
