import type { SearchKind, SearchResult } from '@/lib/content/search';

export function parseSearchResponse(value: unknown): SearchResult[] {
  if (!isRecord(value) || !Array.isArray(value['results'])) {
    throw new TypeError('Search response must contain a results list.');
  }

  const results: SearchResult[] = [];
  for (const item of value['results']) {
    const result = parseSearchResult(item);
    if (!result) throw new TypeError('Search response contains an invalid result.');
    results.push(result);
  }
  return results;
}

function parseSearchResult(value: unknown): SearchResult | null {
  if (!isRecord(value)) return null;
  const id = value['id'];
  const title = value['title'];
  const description = value['description'];
  const url = value['url'];
  const kind = value['kind'];
  const label = value['label'];
  const domain = value['domain'];
  const tags = value['tags'];
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    typeof url !== 'string' ||
    (kind !== 'article' && kind !== 'topic' && kind !== 'path') ||
    typeof label !== 'string' ||
    (domain !== undefined && typeof domain !== 'string') ||
    (tags !== undefined && !isStringArray(tags)) ||
    !isSafeSearchUrl(url, kind)
  ) {
    return null;
  }

  return {
    id,
    title,
    description,
    url,
    kind,
    label,
    ...(domain === undefined ? {} : { domain }),
    ...(tags === undefined ? {} : { tags }),
  };
}

function isSafeSearchUrl(value: string, kind: SearchKind): boolean {
  const routePrefix = {
    article: '/articles/',
    topic: '/topics/',
    path: '/paths/',
  }[kind];
  if (!value.startsWith(routePrefix) || value.startsWith('//') || value.includes('\\')) {
    return false;
  }
  try {
    const parsed = new URL(value, 'https://stack-atlas.invalid');
    return (
      parsed.origin === 'https://stack-atlas.invalid' && parsed.pathname.startsWith(routePrefix)
    );
  } catch {
    return false;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
