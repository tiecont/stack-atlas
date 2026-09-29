import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { analyzeArticleHtml } from './html.ts';
import type { Article, Catalog, Category, LearningPath, PathModule, Site, Topic } from './types.ts';

export const ROOT = process.cwd();
const CONTENT = path.join(process.cwd(), 'content');
let cachedCatalog: Catalog | undefined;

function readYaml<T>(relativePath: string): T {
  const fullPath = path.join(CONTENT, relativePath);
  try {
    const value: unknown = parse(readFileSync(fullPath, 'utf8'));
    if (value === null || typeof value !== 'object') throw new TypeError('expected a YAML object or list');
    return value as T;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Cannot read content/${relativePath}: ${detail}`, { cause });
  }
}

function filesNamed(directory: string, filename: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesNamed(fullPath, filename);
    return entry.isFile() && entry.name === filename ? [fullPath] : [];
  }).sort();
}

function relative(fullPath: string): string {
  return path.relative(ROOT, fullPath).split(path.sep).join('/');
}

export function loadCatalog(): Catalog {
  const shouldCache = process.env.NODE_ENV !== 'development';
  if (shouldCache && cachedCatalog) return cachedCatalog;
  const site = readYaml<Site>('site.yaml');
  const topics = readdirSync(path.join(CONTENT, 'domains'))
    .filter(name => name.endsWith('.yaml')).sort()
    .map(name => readYaml<Topic>(`domains/${name}`));
  const categories = readYaml<Category[]>('categories.yaml');
  const paths = readdirSync(path.join(CONTENT, 'paths'))
    .filter(name => name.endsWith('.yaml')).sort()
    .map(name => readYaml<Omit<LearningPath, 'modules'> & { modules: Array<Omit<PathModule, 'articles'> & { articles?: Article[] }> }>(`paths/${name}`))
    .map(item => ({ ...item, modules: item.modules.map(pathModule => ({ ...pathModule, articles: [] })) })) as LearningPath[];
  const articles = filesNamed(path.join(CONTENT, 'articles'), 'article.yaml').map(fullPath => {
    const metadataFile = relative(fullPath);
    const directory = path.dirname(fullPath);
    const source = relative(path.join(directory, 'article.html'));
    const bodyHtml = readFileSync(path.join(directory, 'article.html'), 'utf8');
    const analysis = analyzeArticleHtml(bodyHtml);
    const metadataRelative = path.relative(CONTENT, fullPath).split(path.sep).join('/');
    const metadata = readYaml<Omit<Article, 'metadata_file' | 'source' | 'bodyHtml' | 'bodyText' | 'headings' | 'bodyIds'>>(metadataRelative);
    return {
      ...metadata,
      tags: metadata.tags ?? [],
      difficulty: metadata.difficulty ?? 'unspecified',
      learning_paths: metadata.learning_paths ?? [],
      prerequisites: metadata.prerequisites ?? [],
      related: metadata.related ?? [],
      labs: metadata.labs ?? [],
      legacy_urls: metadata.legacy_urls ?? [],
      metadata_file: metadataFile,
      source,
      bodyHtml,
      bodyText: analysis.text,
      headings: analysis.headings,
      bodyIds: analysis.ids,
    } satisfies Article;
  });
  const articleById = new Map(articles.map(article => [article.id, article]));
  for (const learningPath of paths) {
    for (const pathModule of learningPath.modules) {
      pathModule.articles = pathModule.article_ids.map(id => articleById.get(id)).filter((item): item is Article => !!item);
    }
  }
  const catalog: Catalog = {
    site,
    topics,
    categories,
    paths,
    articles,
    topicById: new Map(topics.map(topic => [topic.id, topic])),
    categoryById: new Map(categories.map(category => [category.id, category])),
    pathById: new Map(paths.map(learningPath => [learningPath.id, learningPath])),
    articleById,
    articleByUrl: new Map(articles.map(article => [article.url, article])),
  };
  if (shouldCache) cachedCatalog = catalog;
  return catalog;
}

export function resetCatalogCache(): void {
  cachedCatalog = undefined;
}

export function orderedModules(learningPath: LearningPath): PathModule[] {
  return [...learningPath.modules].sort((left, right) => left.order - right.order);
}

export function pathSequence(learningPath: LearningPath): Article[] {
  return orderedModules(learningPath).flatMap(pathModule => pathModule.articles);
}
