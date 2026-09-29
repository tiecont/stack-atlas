import { loadCatalog } from '../lib/content/loader.ts';
import { validateCatalog } from '../lib/content/validation.ts';

try {
  const catalog = loadCatalog();
  const errors = validateCatalog(catalog);
  if (errors.length) {
    process.stderr.write(
      `Content validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`,
    );
    errors.forEach((error) => process.stderr.write(`  - ${error}\n`));
    process.exitCode = 1;
  } else {
    const legacyCount = catalog.articles.reduce(
      (sum, article) => sum + article.legacy_urls.length,
      0,
    );
    const moduleAliasCount = catalog.paths
      .flatMap((item) => item.modules)
      .reduce((sum, module) => sum + (module.legacy_index_urls?.length ?? 0), 0);
    process.stdout.write(
      `Validated ${catalog.articles.length} articles, ${catalog.topics.length} topics, ${catalog.paths.length} paths, ${legacyCount + moduleAliasCount} legacy redirects.\n`,
    );
  }
} catch (cause) {
  process.stderr.write(
    `Content loading failed: ${cause instanceof Error ? cause.message : String(cause)}\n`,
  );
  process.exitCode = 1;
}
