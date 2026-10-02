import { NextResponse } from 'next/server';
import { searchCatalog, type SearchKind } from '@/lib/content/search';
import {
  searchPublishedContent,
  type PublishedContentSearchItem,
} from '@/features/content/public-content.service';

const kinds = new Set<string>(['all', 'article', 'topic', 'path']);

function isSearchKind(value: string): value is SearchKind | 'all' {
  return kinds.has(value);
}

type PublishedSearch = (query: string) => Promise<PublishedContentSearchItem[]>;

export function createSearchHandler(searchArticles: PublishedSearch = searchPublishedContent) {
  return async function GET(request: Request) {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const requestedKind = url.searchParams.get('kind') ?? 'all';
    if (query.length > 160)
      return NextResponse.json({ error: 'Search query is too long.' }, { status: 400 });
    if (!isSearchKind(requestedKind))
      return NextResponse.json({ error: 'Unknown result type.' }, { status: 400 });

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return NextResponse.json(
        { results: [] },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
      );
    }

    try {
      const articleResults =
        requestedKind === 'topic' || requestedKind === 'path'
          ? []
          : (await searchArticles(normalizedQuery)).map(toSearchResult);
      const taxonomyResults =
        requestedKind === 'article'
          ? []
          : [...searchCatalog(normalizedQuery, 'topic'), ...searchCatalog(normalizedQuery, 'path')];
      const results = [...articleResults, ...taxonomyResults]
        .sort(
          (left, right) =>
            resultScore(right, normalizedQuery) - resultScore(left, normalizedQuery) ||
            left.title.localeCompare(right.title),
        )
        .slice(0, 20);

      return NextResponse.json(
        { results },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
      );
    } catch {
      return NextResponse.json(
        { error: 'Search is temporarily unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  };
}

function toSearchResult(item: PublishedContentSearchItem) {
  return {
    id: item.contentKey.startsWith('article:')
      ? item.contentKey.slice('article:'.length)
      : item.contentId,
    title: item.title,
    description: item.description,
    url: `/${item.slug}/`,
    kind: 'article' as const,
    label: 'Article',
    domain: item.slug.split('/')[1],
  };
}

function resultScore(result: { title: string; description: string }, query: string): number {
  const title = result.title.toLocaleLowerCase();
  const normalized = query.toLocaleLowerCase();
  if (title === normalized) return 3;
  if (title.includes(normalized)) return 2;
  if (result.description.toLocaleLowerCase().includes(normalized)) return 1;
  return 0;
}

export const GET = createSearchHandler();
