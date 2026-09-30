import { NextResponse } from 'next/server';
import { searchCatalog, type SearchKind } from '@/lib/content/search';

const kinds = new Set<string>(['all', 'article', 'topic', 'path']);

function isSearchKind(value: string): value is SearchKind | 'all' {
  return kinds.has(value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const requestedKind = url.searchParams.get('kind') ?? 'all';
  if (query.length > 160)
    return NextResponse.json({ error: 'Search query is too long.' }, { status: 400 });
  if (!isSearchKind(requestedKind))
    return NextResponse.json({ error: 'Unknown result type.' }, { status: 400 });
  return NextResponse.json(
    { results: searchCatalog(query, requestedKind) },
    {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    },
  );
}
