import { createHash } from 'node:crypto';
import { ApiError, createApiClient } from '@/lib/api/client';
import { isContentBlock, parseContentDocumentV1 } from '@/features/content-renderer';
import type { ContentDocumentV1 } from '@/features/content-renderer';

const PUBLIC_CONTENT_REVALIDATE_SECONDS = 60;
const PUBLIC_CONTENT_TIMEOUT_MS = 3_500;
const MAX_PUBLIC_SEARCH_RESULTS = 20;
const CONTENT_SLUG_PATTERN = /^articles\/[a-z0-9-]+\/[a-z0-9-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublishedContent = {
  contentId: string;
  contentKey: string;
  contentType: 'article';
  slug: string;
  publishedRevisionId: string;
  document: ContentDocumentV1;
  seo: { title: string; description: string };
  publishedAt: string;
};

export type PublishedContentSearchItem = {
  contentId: string;
  contentKey: string;
  contentType: 'article';
  slug: string;
  publishedRevisionId: string;
  title: string;
  description: string;
  publishedAt: string;
};

export class PublicContentUnavailableError extends Error {
  constructor() {
    super('Published content is temporarily unavailable.');
    this.name = 'PublicContentUnavailableError';
  }
}

type ContentApiClient = Pick<ReturnType<typeof createApiClient>, 'get'>;

export function createPublicContentService(client: ContentApiClient) {
  async function getPublishedContent(slug: string): Promise<PublishedContent | null> {
    if (!isPublicArticleSlug(slug)) return null;

    let payload: unknown;
    try {
      payload = await client.get(`content/${encodeURIComponent(slug)}`, {
        cache: 'force-cache',
        next: {
          revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
          tags: ['published-content-v1', contentSlugCacheTag(slug)],
        },
        signal: AbortSignal.timeout(PUBLIC_CONTENT_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw new PublicContentUnavailableError();
    }

    const content = parsePublishedContent(payload);
    if (!content || content.slug !== slug) throw new PublicContentUnavailableError();
    return content;
  }

  async function searchPublishedContent(query: string): Promise<PublishedContentSearchItem[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    if (normalizedQuery.length > 160) throw new TypeError('Search query is too long.');

    const params = new URLSearchParams({ q: normalizedQuery });
    let payload: unknown;
    try {
      payload = await client.get(`content/search?${params}`, {
        cache: 'force-cache',
        next: {
          revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
          tags: ['published-content-search', searchQueryCacheTag(normalizedQuery)],
        },
        signal: AbortSignal.timeout(PUBLIC_CONTENT_TIMEOUT_MS),
      });
    } catch {
      throw new PublicContentUnavailableError();
    }

    const items = parsePublishedContentSearch(payload);
    if (!items) throw new PublicContentUnavailableError();
    return items;
  }

  return Object.freeze({ getPublishedContent, searchPublishedContent });
}

export function contentSlugCacheTag(slug: string): string {
  return `content-slug:${createHash('sha256').update(slug).digest('hex')}`;
}

function searchQueryCacheTag(query: string): string {
  return `content-search:${createHash('sha256').update(query).digest('hex')}`;
}

function isPublicArticleSlug(value: string): boolean {
  return value.length <= 255 && CONTENT_SLUG_PATTERN.test(value);
}

function parsePublishedContent(value: unknown): PublishedContent | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'contentId',
      'contentKey',
      'contentType',
      'slug',
      'publishedRevisionId',
      'document',
      'seo',
      'publishedAt',
    ]) ||
    typeof value['contentId'] !== 'string' ||
    !UUID_PATTERN.test(value['contentId']) ||
    !isBoundedString(value['contentKey'], 255) ||
    value['contentType'] !== 'article' ||
    typeof value['slug'] !== 'string' ||
    !isPublicArticleSlug(value['slug']) ||
    typeof value['publishedRevisionId'] !== 'string' ||
    !UUID_PATTERN.test(value['publishedRevisionId']) ||
    typeof value['publishedAt'] !== 'string' ||
    !isIsoDateTime(value['publishedAt']) ||
    !isRecord(value['seo']) ||
    !hasExactKeys(value['seo'], ['title', 'description'])
  ) {
    return null;
  }

  const document = parseContentDocumentV1(value['document']);
  if (!document || !document.blocks.every(isContentBlock)) return null;
  const title = value['seo']['title'];
  const description = value['seo']['description'];
  if (
    !isBoundedString(title, 160) ||
    !isBoundedString(description, 500) ||
    title !== document.title ||
    description !== document.description
  ) {
    return null;
  }

  return {
    contentId: value['contentId'],
    contentKey: value['contentKey'],
    contentType: 'article',
    slug: value['slug'],
    publishedRevisionId: value['publishedRevisionId'],
    document,
    seo: { title, description },
    publishedAt: value['publishedAt'],
  };
}

function parsePublishedContentSearch(value: unknown): PublishedContentSearchItem[] | null {
  if (!isRecord(value) || !hasExactKeys(value, ['items']) || !Array.isArray(value['items'])) {
    return null;
  }
  if (value['items'].length > MAX_PUBLIC_SEARCH_RESULTS) return null;

  const items: PublishedContentSearchItem[] = [];
  for (const item of value['items']) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [
        'contentId',
        'contentKey',
        'contentType',
        'slug',
        'publishedRevisionId',
        'title',
        'description',
        'publishedAt',
      ]) ||
      typeof item['contentId'] !== 'string' ||
      !UUID_PATTERN.test(item['contentId']) ||
      !isBoundedString(item['contentKey'], 255) ||
      item['contentType'] !== 'article' ||
      typeof item['slug'] !== 'string' ||
      !isPublicArticleSlug(item['slug']) ||
      typeof item['publishedRevisionId'] !== 'string' ||
      !UUID_PATTERN.test(item['publishedRevisionId']) ||
      !isBoundedString(item['title'], 160) ||
      !isBoundedString(item['description'], 500) ||
      typeof item['publishedAt'] !== 'string' ||
      !isIsoDateTime(item['publishedAt'])
    ) {
      return null;
    }
    items.push({
      contentId: item['contentId'],
      contentKey: item['contentKey'],
      contentType: 'article',
      slug: item['slug'],
      publishedRevisionId: item['publishedRevisionId'],
      title: item['title'],
      description: item['description'],
      publishedAt: item['publishedAt'],
    });
  }
  return items;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isIsoDateTime(value: string): boolean {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

const defaultApiBaseUrl =
  process.env['API_BASE_URL'] ||
  process.env['NEXT_PUBLIC_API_BASE_URL'] ||
  'http://localhost:3000/api/v1/';

const publicContentService = createPublicContentService(createApiClient(defaultApiBaseUrl));

export const getPublishedContent = publicContentService.getPublishedContent;
export const searchPublishedContent = publicContentService.searchPublishedContent;
