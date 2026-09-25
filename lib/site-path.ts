const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

export function sitePath(url: string): string {
  if (!basePath || !url.startsWith('/') || url === basePath || url.startsWith(`${basePath}/`))
    return url;
  return `${basePath}${url}`;
}
