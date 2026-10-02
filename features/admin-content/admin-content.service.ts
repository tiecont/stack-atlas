import { api, ApiError, type createApiClient } from '@/lib/api/client';
import { isContentDocumentV1, type ContentDocumentV1 } from '@/features/content-renderer/types';

export const CONTENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type ApiTransport = Pick<ReturnType<typeof createApiClient>, 'get' | 'post'>;

export interface ContentItem {
  contentId: string;
  contentKey: string;
  slug: string;
  status: ContentStatus;
  latestRevisionId: string | null;
  latestRevisionNumber: number | null;
  publishedRevisionId: string | null;
  createdBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
}

export interface ContentRevisionSummary {
  contentId: string;
  revisionId: string;
  revisionNumber: number;
  checksumSha256: string;
  revisionCreatedBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface ContentRevision {
  contentId: string;
  contentKey: string;
  slug: string;
  status: ContentStatus;
  contentType: 'article';
  revisionId: string;
  revisionNumber: number;
  checksumSha256: string;
  revisionCreatedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
  document: ContentDocumentV1;
}

export interface ContentPage {
  items: ContentItem[];
  nextCursor: string | null;
}

export interface RevisionPage {
  items: ContentRevisionSummary[];
  nextCursor: string | null;
}

export interface CreateContentInput {
  contentKey: string;
  slug: string;
  document: ContentDocumentV1;
}

export interface AdminContentService {
  listContent(input?: {
    status?: ContentStatus;
    cursor?: string;
    limit?: number;
  }): Promise<ContentPage>;
  getContent(contentId: string): Promise<ContentItem>;
  listRevisions(contentId: string, cursor?: string): Promise<RevisionPage>;
  getRevision(contentId: string, revisionId: string): Promise<ContentRevision>;
  createContent(input: CreateContentInput): Promise<ContentRevision>;
  appendRevision(
    contentId: string,
    baseRevisionId: string,
    document: ContentDocumentV1,
  ): Promise<ContentRevision>;
}

const DEFAULT_PAGE_SIZE = 25;
const TITLE_LOOKUP_CONCURRENCY = 4;

export function createAdminContentService(client: ApiTransport = api): AdminContentService {
  async function getRevision(contentId: string, revisionId: string): Promise<ContentRevision> {
    const response = await client.get(
      `admin/content/${encodeURIComponent(contentId)}/revisions/${encodeURIComponent(revisionId)}`,
    );
    return parseContentRevision(response);
  }

  return {
    async listContent(input = {}): Promise<ContentPage> {
      const query = new URLSearchParams({ limit: String(input.limit ?? DEFAULT_PAGE_SIZE) });
      if (input.status) query.set('status', input.status);
      if (input.cursor) query.set('cursor', input.cursor);

      const response = parsePage(await client.get(`admin/content?${query.toString()}`));
      const items = await mapConcurrent(response.items, TITLE_LOOKUP_CONCURRENCY, async (item) => {
        if (!item.latestRevisionId) return { ...item, title: 'Untitled content' };
        const latest = await getRevision(item.contentId, item.latestRevisionId);
        return {
          ...item,
          title: latest.document.title,
          latestRevisionNumber: latest.revisionNumber,
        };
      });

      return { items, nextCursor: response.nextCursor };
    },

    async getContent(contentId): Promise<ContentItem> {
      const response = await client.get(`admin/content/${encodeURIComponent(contentId)}`);
      const item = parseContentItem(response);
      if (!item.latestRevisionId) return { ...item, title: 'Untitled content' };
      const latest = await getRevision(item.contentId, item.latestRevisionId);
      return {
        ...item,
        title: latest.document.title,
        latestRevisionNumber: latest.revisionNumber,
      };
    },

    async listRevisions(contentId, cursor): Promise<RevisionPage> {
      const query = new URLSearchParams({ limit: String(DEFAULT_PAGE_SIZE) });
      if (cursor) query.set('cursor', cursor);
      const response = parseRevisionPage(
        await client.get(
          `admin/content/${encodeURIComponent(contentId)}/revisions?${query.toString()}`,
        ),
      );
      return response;
    },

    getRevision,

    async createContent(input): Promise<ContentRevision> {
      return parseContentRevision(await client.post('admin/content', input));
    },

    async appendRevision(contentId, baseRevisionId, document): Promise<ContentRevision> {
      return parseContentRevision(
        await client.post(`admin/content/${encodeURIComponent(contentId)}/revisions`, {
          baseRevisionId,
          document,
        }),
      );
    },
  };
}

function parsePage(value: unknown): { items: ContentItem[]; nextCursor: string | null } {
  const record = asRecord(value, 'content list');
  if (!Array.isArray(record['items'])) throw new TypeError('Content list items must be an array.');
  return {
    items: record['items'].map(parseContentItem),
    nextCursor: nullableString(record['nextCursor'], 'content list nextCursor'),
  };
}

function parseRevisionPage(value: unknown): RevisionPage {
  const record = asRecord(value, 'revision list');
  if (!Array.isArray(record['items'])) throw new TypeError('Revision list items must be an array.');
  return {
    items: record['items'].map(parseRevisionSummary),
    nextCursor: nullableString(record['nextCursor'], 'revision list nextCursor'),
  };
}

function parseContentItem(value: unknown): ContentItem {
  const record = asRecord(value, 'content item');
  return {
    contentId: requiredString(record['contentId'], 'contentId'),
    contentKey: requiredString(record['contentKey'], 'contentKey'),
    slug: requiredString(record['slug'], 'slug'),
    status: contentStatus(record['status']),
    latestRevisionId: nullableString(record['latestRevisionId'], 'latestRevisionId'),
    latestRevisionNumber: null,
    publishedRevisionId: nullableString(record['publishedRevisionId'], 'publishedRevisionId'),
    createdBy: nullableString(record['createdBy'], 'createdBy'),
    archivedAt: nullableDate(record['archivedAt'], 'archivedAt'),
    archivedBy: nullableString(record['archivedBy'], 'archivedBy'),
    createdAt: dateString(record['createdAt'], 'createdAt'),
    updatedAt: dateString(record['updatedAt'], 'updatedAt'),
    title: 'Untitled content',
  };
}

function parseRevisionSummary(value: unknown): ContentRevisionSummary {
  const record = asRecord(value, 'revision summary');
  return {
    contentId: requiredString(record['contentId'], 'contentId'),
    revisionId: requiredString(record['revisionId'], 'revisionId'),
    revisionNumber: positiveInteger(record['revisionNumber'], 'revisionNumber'),
    checksumSha256: requiredString(record['checksumSha256'], 'checksumSha256'),
    revisionCreatedBy: nullableString(record['revisionCreatedBy'], 'revisionCreatedBy'),
    createdAt: dateString(record['createdAt'], 'createdAt'),
    publishedAt: nullableDate(record['publishedAt'], 'publishedAt'),
    publishedBy: nullableString(record['publishedBy'], 'publishedBy'),
  };
}

function parseContentRevision(value: unknown): ContentRevision {
  const record = asRecord(value, 'content revision');
  const document = record['document'];
  if (!isContentDocumentV1(document))
    throw new TypeError('Revision document is not Content Document V1.');
  if (record['contentType'] !== 'article') throw new TypeError('Content type is not supported.');
  return {
    contentId: requiredString(record['contentId'], 'contentId'),
    contentKey: requiredString(record['contentKey'], 'contentKey'),
    slug: requiredString(record['slug'], 'slug'),
    status: contentStatus(record['status']),
    contentType: 'article',
    revisionId: requiredString(record['revisionId'], 'revisionId'),
    revisionNumber: positiveInteger(record['revisionNumber'], 'revisionNumber'),
    checksumSha256: requiredString(record['checksumSha256'], 'checksumSha256'),
    revisionCreatedBy: nullableString(record['revisionCreatedBy'], 'revisionCreatedBy'),
    createdBy: nullableString(record['createdBy'], 'createdBy'),
    createdAt: dateString(record['createdAt'], 'createdAt'),
    publishedAt: nullableDate(record['publishedAt'], 'publishedAt'),
    publishedBy: nullableString(record['publishedBy'], 'publishedBy'),
    document,
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function dateString(value: unknown, field: string): string {
  const date = requiredString(value, field);
  if (!Number.isFinite(Date.parse(date))) throw new TypeError(`${field} must be a date string.`);
  return date;
}

function nullableDate(value: unknown, field: string): string | null {
  return value === null ? null : dateString(value, field);
}

function contentStatus(value: unknown): ContentStatus {
  if (typeof value !== 'string') throw new TypeError('Content status is not supported.');
  const status = CONTENT_STATUSES.find((allowed) => allowed === value);
  if (!status) throw new TypeError('Content status is not supported.');
  return status;
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer.`);
  }
  return value;
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await map(item);
    }
  });
  await Promise.all(workers);
  return results;
}

export function isPermissionDenied(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403;
}
