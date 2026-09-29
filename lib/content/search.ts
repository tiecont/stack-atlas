import { loadCatalog } from './loader.ts';

export type SearchKind = 'article' | 'topic' | 'path';
export type SearchResult = {
  id: string;
  title: string;
  description: string;
  url: string;
  kind: SearchKind;
  label: string;
  domain?: string;
  tags?: string[];
};

export function searchCatalog(query: string, kind: SearchKind | 'all' = 'all', limit = 20): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const catalog = loadCatalog();
  const results: Array<SearchResult & { score: number }> = [];
  for (const article of catalog.articles) {
    const searchable = `${article.title} ${article.description} ${article.bodyText} ${article.domain} ${article.tags.join(' ')}`.toLocaleLowerCase();
    if (kind !== 'all' && kind !== 'article' || !searchable.includes(normalized)) continue;
    const title = article.title.toLocaleLowerCase();
    results.push({
      id: article.id, title: article.title, description: article.description,
      url: article.url, kind: 'article', label: 'Article', domain: article.domain,
      tags: article.tags, score: title === normalized ? 3 : title.includes(normalized) ? 2 : 0,
    });
  }
  for (const topic of catalog.topics) {
    if (kind !== 'all' && kind !== 'topic') continue;
    if (`${topic.title} ${topic.description}`.toLocaleLowerCase().includes(normalized)) {
      results.push({ id: topic.id, title: topic.title, description: topic.description, url: `/topics/${topic.id}/`, kind: 'topic', label: 'Topic', score: topic.title.toLocaleLowerCase().includes(normalized) ? 2 : 0 });
    }
  }
  for (const learningPath of catalog.paths) {
    if (kind !== 'all' && kind !== 'path') continue;
    if (`${learningPath.title} ${learningPath.description}`.toLocaleLowerCase().includes(normalized)) {
      results.push({ id: learningPath.id, title: learningPath.title, description: learningPath.description, url: `/paths/${learningPath.id}/`, kind: 'path', label: 'Learning path', score: learningPath.title.toLocaleLowerCase().includes(normalized) ? 2 : 0 });
    }
  }
  return results.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, limit)
    .map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'score')) as SearchResult);
}
