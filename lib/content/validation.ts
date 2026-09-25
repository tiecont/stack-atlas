import { existsSync } from 'node:fs';
import path from 'node:path';
import { analyzeArticleHtml } from './html.ts';
import { buildLegacyRedirects, validateLegacyRedirects } from './redirects.ts';
import { ROOT, orderedModules, pathSequence } from './loader.ts';
import type { Article, Catalog } from './types.ts';

const difficultyValues = new Set(['beginner', 'intermediate', 'advanced', 'all', 'unspecified']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function duplicateIds(label: string, records: Array<{ id: string }>, errors: string[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) duplicates.add(record.id);
    seen.add(record.id);
  }
  if (duplicates.size) errors.push(`Duplicate ${label} IDs: ${[...duplicates].sort().join(', ')}`);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateArticleLinks(article: Article, catalog: Catalog, errors: string[]): void {
  const links = analyzeArticleHtml(article.bodyHtml).links;
  for (const { href } of links) {
    let url: URL;
    try {
      url = new URL(href, `https://stack-atlas.invalid${article.url}`);
    } catch {
      errors.push(`${article.metadata_file}: invalid link ${JSON.stringify(href)}`);
      continue;
    }
    if (url.origin !== 'https://stack-atlas.invalid') continue;
    if (url.hash && (url.pathname === article.url || href.startsWith('#'))) {
      if (!article.bodyIds.has(decodeURIComponent(url.hash.slice(1)))) {
        errors.push(`${article.metadata_file}: missing fragment ${JSON.stringify(url.hash.slice(1))}`);
      }
    }
    if (!url.pathname || url.pathname === '/') continue;
    if (catalog.articleByUrl.has(url.pathname) || catalog.topicById.has(url.pathname.split('/')[2]) && url.pathname.startsWith('/topics/')) continue;
    if (catalog.pathById.has(url.pathname.split('/')[2]) && url.pathname.startsWith('/paths/')) continue;
    if (url.pathname === '/articles/' || url.pathname === '/topics/' || url.pathname === '/paths/' || url.pathname === '/about/') continue;
    const redirectRoutes = new Set<string>();
    try {
      buildLegacyRedirects(catalog).forEach(item => redirectRoutes.add(item.source));
    } catch {
      // Redirect validation reports malformed metadata separately.
    }
    if (redirectRoutes.has(url.pathname)) continue;
    const localFile = path.resolve(ROOT, `.${decodeURIComponent(url.pathname)}`);
    if (localFile.startsWith(path.join(ROOT, 'labs') + path.sep) || localFile.startsWith(path.join(ROOT, 'examples') + path.sep)) {
      if (existsSync(localFile) && !localFile.endsWith(path.sep)) continue;
    }
    if (url.pathname === '/tests/kubernetes/version-matrix.yaml' && existsSync(path.join(ROOT, 'tests/kubernetes/version-matrix.yaml'))) continue;
    errors.push(`${article.metadata_file}: broken local link ${JSON.stringify(href)}`);
  }
}

export function validateCatalog(catalog: Catalog): string[] {
  const errors: string[] = [];
  duplicateIds('topic', catalog.topics, errors);
  duplicateIds('category', catalog.categories, errors);
  duplicateIds('learning path', catalog.paths, errors);
  duplicateIds('article', catalog.articles, errors);

  for (const [label, records, needsDescription] of [
    ['topic', catalog.topics, true],
    ['category', catalog.categories, false],
    ['learning path', catalog.paths, true],
  ] as const) {
    for (const item of records) {
      if (!item.id || !item.title) errors.push(`${label} is missing an ID or title`);
      if (needsDescription && !('description' in item && item.description)) errors.push(`${label} ${item.id}: missing description`);
      if (item.id && !slugPattern.test(item.id)) errors.push(`${label} has invalid ID ${JSON.stringify(item.id)}`);
    }
  }

  const articleIds = new Set(catalog.articleById.keys());
  const articleUrls = new Set<string>();
  const placements = new Map<string, string[]>();
  for (const learningPath of catalog.paths) {
    const moduleIds = new Set<string>();
    const moduleOrders = new Set<number>();
    for (const pathModule of learningPath.modules) {
      if (!pathModule.id || moduleIds.has(pathModule.id)) errors.push(`${learningPath.id}: missing or duplicate module ID ${JSON.stringify(pathModule.id)}`);
      moduleIds.add(pathModule.id);
      if (!Number.isInteger(pathModule.order) || pathModule.order < 1 || moduleOrders.has(pathModule.order)) {
        errors.push(`${learningPath.id}/${pathModule.id}: invalid or duplicate module order ${JSON.stringify(pathModule.order)}`);
      }
      moduleOrders.add(pathModule.order);
      if (!catalog.topicById.has(pathModule.domain)) errors.push(`${learningPath.id}/${pathModule.id}: unknown domain ${JSON.stringify(pathModule.domain)}`);
      if (!catalog.categoryById.has(pathModule.category)) errors.push(`${learningPath.id}/${pathModule.id}: unknown category ${JSON.stringify(pathModule.category)}`);
      if (!Array.isArray(pathModule.article_ids)) {
        errors.push(`${learningPath.id}/${pathModule.id}: article_ids must be a list`);
        continue;
      }
      if (new Set(pathModule.article_ids).size !== pathModule.article_ids.length) errors.push(`${learningPath.id}/${pathModule.id}: duplicate article placement`);
      for (const articleId of pathModule.article_ids) {
        const key = `${learningPath.id}\0${articleId}`;
        placements.set(key, [...(placements.get(key) ?? []), pathModule.id]);
        if (!articleIds.has(articleId)) errors.push(`${learningPath.id}/${pathModule.id}: unknown article ${JSON.stringify(articleId)}`);
      }
    }
  }

  const legacyOwners = new Map<string, string>();
  for (const article of catalog.articles) {
    const required = ['id', 'title', 'description', 'domain', 'status', 'url', 'source'] as const;
    for (const field of required) if (!article[field]) errors.push(`${article.metadata_file}: missing ${field}`);
    if (article.schema_version !== 1) errors.push(`${article.metadata_file}: unsupported schema_version ${JSON.stringify(article.schema_version)}`);
    if (article.type !== 'article') errors.push(`${article.metadata_file}: type must be 'article'`);
    if (article.status !== 'published') errors.push(`${article.metadata_file}: only published articles can enter the catalog`);
    if (!catalog.topicById.has(article.domain)) errors.push(`${article.metadata_file}: unknown domain ${JSON.stringify(article.domain)}`);
    if (article.category && !catalog.categoryById.has(article.category)) errors.push(`${article.metadata_file}: unknown category ${JSON.stringify(article.category)}`);
    if (!difficultyValues.has(article.difficulty)) errors.push(`${article.metadata_file}: invalid difficulty ${JSON.stringify(article.difficulty)}`);
    if (!existsSync(path.join(ROOT, article.source))) errors.push(`${article.metadata_file}: missing source file ${article.source}`);
    if (!article.url.startsWith('/articles/') || !article.url.endsWith('/') || article.url.includes('..')) {
      errors.push(`${article.metadata_file}: canonical article URL must look like /articles/domain/slug/`);
    }
    if (articleUrls.has(article.url)) errors.push(`Duplicate article URL: ${article.url}`);
    articleUrls.add(article.url);
    if (article.url.split('/').length !== 5 || article.url.split('/')[2] !== article.domain) {
      errors.push(`${article.metadata_file}: canonical article URL does not match its domain`);
    }
    for (const field of ['tags', 'learning_paths', 'prerequisites', 'related', 'labs', 'legacy_urls'] as const) {
      if (!Array.isArray(article[field])) errors.push(`${article.metadata_file}: ${field} must be a list`);
    }
    for (const dateField of ['created_at', 'updated_at'] as const) {
      if (article[dateField] !== undefined && !isIsoDate(article[dateField])) errors.push(`${article.metadata_file}: ${dateField} must use YYYY-MM-DD`);
    }
    if (article.review !== undefined) {
      if (!article.review || typeof article.review !== 'object' || Array.isArray(article.review)) errors.push(`${article.metadata_file}: review must be an object`);
      else if (article.review.last_reviewed !== undefined && !isIsoDate(article.review.last_reviewed)) errors.push(`${article.metadata_file}: review.last_reviewed must use YYYY-MM-DD`);
    }
    for (const lab of article.labs) {
      const labPath = path.resolve(ROOT, 'labs', lab);
      if (!labPath.startsWith(path.join(ROOT, 'labs') + path.sep) || !existsSync(path.join(labPath, 'README.md'))) {
        errors.push(`${article.metadata_file}: unknown lab ${JSON.stringify(lab)}`);
      }
    }
    for (const source of article.legacy_urls) {
      const owner = legacyOwners.get(source);
      if (owner && owner !== article.id) errors.push(`Legacy URL ${source} is assigned to both ${owner} and ${article.id}`);
      legacyOwners.set(source, article.id);
    }
    for (const relation of ['prerequisites', 'related'] as const) {
      for (const ref of article[relation]) {
        if (!articleIds.has(ref)) errors.push(`${article.id}: unknown ${relation} article ${JSON.stringify(ref)}`);
        if (ref === article.id && relation === 'prerequisites') errors.push(`${article.id}: an article cannot be its own prerequisite`);
      }
    }
    const membershipKeys = new Set<string>();
    for (const membership of article.learning_paths) {
      if (!membership || typeof membership !== 'object') {
        errors.push(`${article.id}: invalid learning path membership ${JSON.stringify(membership)}`);
        continue;
      }
      const key = `${membership.path_id}\0${membership.module_id}`;
      if (membershipKeys.has(key)) errors.push(`${article.id}: duplicate learning path membership ${key.replace('\0', '/')}`);
      membershipKeys.add(key);
      const learningPath = catalog.pathById.get(membership.path_id);
      const pathModule = learningPath?.modules.find(item => item.id === membership.module_id);
      if (!learningPath) errors.push(`${article.id}: unknown learning path ${JSON.stringify(membership.path_id)}`);
      else if (!membership.module_id || !pathModule) errors.push(`${article.id}: unknown module ${JSON.stringify(membership.module_id)} in ${membership.path_id}`);
      else if (!pathModule.article_ids.includes(article.id)) errors.push(`${article.id}: module ${pathModule.id} in ${learningPath.id} does not reference this article`);
    }
    validateArticleLinks(article, catalog, errors);
  }

  for (const [key, moduleIds] of placements) {
    const [pathId, articleId] = key.split('\0');
    if (moduleIds.length > 1) errors.push(`${pathId}: article ${articleId} is placed more than once`);
    const article = catalog.articleById.get(articleId);
    if (article && !article.learning_paths.some(item => item.path_id === pathId && item.module_id === moduleIds[0])) {
      errors.push(`${articleId}: path ${pathId} references it without matching article membership`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitPrerequisite = (id: string, trail: string[]) => {
    if (visiting.has(id)) {
      errors.push(`Prerequisite cycle: ${[...trail, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of catalog.articleById.get(id)?.prerequisites ?? []) {
      if (articleIds.has(prerequisite)) visitPrerequisite(prerequisite, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const article of catalog.articles) visitPrerequisite(article.id, []);

  errors.push(...validateLegacyRedirects(catalog));
  for (const learningPath of catalog.paths) {
    if (new Set(pathSequence(learningPath)).size !== pathSequence(learningPath).length) {
      errors.push(`${learningPath.id}: path sequence contains duplicate articles`);
    }
    orderedModules(learningPath);
  }
  return [...new Set(errors)];
}
