import type { Catalog, LegacyRedirect } from './types.ts';

const routePattern = /^\/season-\d{2}-[a-z0-9-]+\/[a-z0-9-]+\.html$/;
const indexPattern = /^\/season-\d{2}-[a-z0-9-]+\/index\.html$/;

export function buildLegacyRedirects(catalog: Catalog): LegacyRedirect[] {
  const redirects: LegacyRedirect[] = [];
  const seen = new Set<string>();
  for (const article of catalog.articles) {
    for (const source of article.legacy_urls) {
      if (!routePattern.test(source) || source.includes('..') || source.includes('\\')) {
        throw new Error(`${article.id}: invalid legacy article URL ${JSON.stringify(source)}`);
      }
      if (seen.has(source)) throw new Error(`Duplicate legacy route: ${source}`);
      seen.add(source);
      redirects.push({ source, destination: article.url, kind: 'article' });
    }
  }
  for (const learningPath of catalog.paths) {
    for (const pathModule of learningPath.modules) {
      for (const source of pathModule.legacy_index_urls ?? []) {
        if (!indexPattern.test(source) || source.includes('..') || source.includes('\\')) {
          throw new Error(`${learningPath.id}/${pathModule.id}: invalid legacy index URL ${JSON.stringify(source)}`);
        }
        if (seen.has(source)) throw new Error(`Duplicate legacy route: ${source}`);
        seen.add(source);
        redirects.push({
          source,
          destination: `/paths/${learningPath.id}/#module-${pathModule.id}`,
          kind: 'path-module',
        });
      }
    }
  }
  return redirects;
}

export function validateLegacyRedirects(catalog: Catalog): string[] {
  try {
    const redirects = buildLegacyRedirects(catalog);
    const canonicalPaths = new Set(catalog.articles.map(article => article.url));
    for (const redirect of redirects) {
      const destinationPath = redirect.destination.split('#', 1)[0];
      if (redirect.kind === 'article' && !canonicalPaths.has(destinationPath)) {
        return [`${redirect.source}: redirect target does not resolve to a canonical article: ${destinationPath}`];
      }
      if (redirect.kind === 'path-module') {
        const match = redirect.destination.match(/^\/paths\/([^/]+)\/#module-([a-z0-9-]+)$/);
        const path = match && catalog.pathById.get(match[1]);
        if (!path || !path.modules.some(pathModule => pathModule.id === match[2])) {
          return [`${redirect.source}: redirect target or module fragment does not exist: ${redirect.destination}`];
        }
      }
      if (redirects.some(other => other.source === destinationPath)) {
        return [`${redirect.source}: redirect target chains through another legacy route`];
      }
    }
    return [];
  } catch (cause) {
    return [cause instanceof Error ? cause.message : String(cause)];
  }
}
