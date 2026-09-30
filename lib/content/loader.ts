import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { analyzeArticleHtml } from './html.ts';
import { ROOT } from './catalog-utils.ts';
import { validateCatalog } from './validation.ts';
import type { Article, Catalog, Category, LearningPath, PathModule, Site, Topic } from './types.ts';

export { orderedModules, pathSequence } from './catalog-utils.ts';

type AuthoredPathModule = Omit<PathModule, 'articles'>;
type AuthoredPath = Omit<LearningPath, 'modules'> & { modules: AuthoredPathModule[] };
type ArticleMetadata = Pick<
  Article,
  'schema_version' | 'id' | 'title' | 'description' | 'type' | 'domain' | 'status' | 'url'
> & Partial<
  Pick<
    Article,
    | 'category'
    | 'tags'
    | 'difficulty'
    | 'learning_paths'
    | 'prerequisites'
    | 'related'
    | 'labs'
    | 'authors'
    | 'legacy_urls'
    | 'review'
    | 'created_at'
    | 'updated_at'
  >
>;

const CONTENT = path.join(process.cwd(), 'content');
let cachedCatalog: Catalog | undefined;

function readYaml<T>(
  relativePath: string,
  isExpected: (value: unknown) => value is T,
): T {
  const fullPath = path.join(CONTENT, relativePath);
  try {
    const value: unknown = parse(readFileSync(fullPath, 'utf8'));
    if (!isExpected(value)) throw new TypeError('YAML value has an invalid shape');
    return value;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Cannot read content/${relativePath}: ${detail}`, { cause });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSite(value: unknown): value is Site {
  return isRecord(value) &&
    hasString(value, 'name') &&
    hasString(value, 'description') &&
    hasString(value, 'language') &&
    hasString(value, 'base_url') &&
    hasString(value, 'base_path');
}

function isTopic(value: unknown): value is Topic {
  return isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'title') &&
    hasString(value, 'description') &&
    (value['status'] === undefined || typeof value['status'] === 'string');
}

function isCategory(value: unknown): value is Category {
  return isRecord(value) && hasString(value, 'id') && hasString(value, 'title');
}

function isCategoryList(value: unknown): value is Category[] {
  return Array.isArray(value) && value.every(isCategory);
}

function isAuthoredPathModule(value: unknown): value is AuthoredPathModule {
  return isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'title') &&
    typeof value['order'] === 'number' && Number.isFinite(value['order']) &&
    hasString(value, 'domain') &&
    hasString(value, 'category') &&
    isStringArray(value['article_ids']) &&
    (value['group'] === undefined || typeof value['group'] === 'string') &&
    (value['legacy_index_urls'] === undefined || isStringArray(value['legacy_index_urls']));
}

function isAuthoredPath(value: unknown): value is AuthoredPath {
  return isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'title') &&
    hasString(value, 'description') &&
    (value['status'] === undefined || typeof value['status'] === 'string') &&
    Array.isArray(value['modules']) && value['modules'].every(isAuthoredPathModule);
}

function isArticleMetadata(value: unknown): value is ArticleMetadata {
  if (
    !isRecord(value) ||
    typeof value['schema_version'] !== 'number' ||
    !Number.isInteger(value['schema_version']) ||
    value['schema_version'] < 1 ||
    !hasString(value, 'id') ||
    !hasString(value, 'title') ||
    !hasString(value, 'description') ||
    !hasString(value, 'type') ||
    !hasString(value, 'domain') ||
    !hasString(value, 'status') ||
    !hasString(value, 'url')
  ) return false;

  for (const key of ['category', 'difficulty', 'created_at', 'updated_at']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  }
  for (const key of ['tags', 'prerequisites', 'related', 'labs', 'authors', 'legacy_urls']) {
    if (value[key] !== undefined && !isStringArray(value[key])) return false;
  }
  if (value['learning_paths'] !== undefined) {
    if (!Array.isArray(value['learning_paths'])) return false;
    if (!value['learning_paths'].every((membership) =>
      isRecord(membership) && hasString(membership, 'path_id') && hasString(membership, 'module_id'),
    )) return false;
  }
  if (value['review'] !== undefined) {
    if (!isRecord(value['review'])) return false;
    if (
      value['review']['last_reviewed'] !== undefined &&
      typeof value['review']['last_reviewed'] !== 'string'
    ) return false;
  }
  return true;
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
  const site = readYaml('site.yaml', isSite);
  const topics = readdirSync(path.join(CONTENT, 'domains'))
    .filter(name => name.endsWith('.yaml')).sort()
    .map(name => readYaml(`domains/${name}`, isTopic));
  const categories = readYaml('categories.yaml', isCategoryList);
  const paths: LearningPath[] = readdirSync(path.join(CONTENT, 'paths'))
    .filter(name => name.endsWith('.yaml')).sort()
    .map(name => readYaml(`paths/${name}`, isAuthoredPath))
    .map(item => ({ ...item, modules: item.modules.map(pathModule => ({ ...pathModule, articles: [] })) }));
  const articles = filesNamed(path.join(CONTENT, 'articles'), 'article.yaml').map(fullPath => {
    const metadataFile = relative(fullPath);
    const directory = path.dirname(fullPath);
    const source = relative(path.join(directory, 'article.html'));
    const bodyHtml = readFileSync(path.join(directory, 'article.html'), 'utf8');
    const analysis = analyzeArticleHtml(bodyHtml);
    const metadataRelative = path.relative(CONTENT, fullPath).split(path.sep).join('/');
    const metadata = readYaml(metadataRelative, isArticleMetadata);
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
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(
      `Content validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n${errors.map((error) => `  - ${error}`).join('\n')}`,
    );
  }
  if (shouldCache) cachedCatalog = catalog;
  return catalog;
}

export function resetCatalogCache(): void {
  cachedCatalog = undefined;
}
