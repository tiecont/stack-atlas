import type { NextConfig } from 'next';
import { loadCatalog } from './lib/content/loader';
import { buildLegacyRedirects } from './lib/content/redirects';
import { buildPublicContentRedirects } from './lib/public-content-redirects';
import { exampleRuntimeFiles, examples } from './lib/examples/registry';
import { labRuntimeFiles, labs } from './lib/labs/registry';
import { unregisteredRuntimeFiles } from './lib/public-content-files';

const labFiles = labRuntimeFiles();
const exampleFiles = exampleRuntimeFiles();
const privateLabFiles = unregisteredRuntimeFiles('labs', labs);
const privateExampleFiles = unregisteredRuntimeFiles('examples', examples);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || '',
  outputFileTracingIncludes: {
    '/': ['./content/**/*.yaml', './content/**/*.html'],
    '/topics': ['./content/**/*.yaml', './content/**/*.html'],
    '/topics/*': ['./content/**/*.yaml', './content/**/*.html'],
    '/paths': ['./content/**/*.yaml', './content/**/*.html'],
    '/paths/*': ['./content/**/*.yaml', './content/**/*.html'],
    '/articles': ['./content/**/*.yaml', './content/**/*.html'],
    '/articles/*': ['./content/**/*.yaml', './content/**/*.html'],
    '/api/search': ['./content/**/*.yaml', './content/**/*.html'],
    '/sitemap.xml': ['./content/**/*.yaml', './content/**/*.html'],
    '/robots.txt': ['./content/site.yaml'],
    '/labs/*': labFiles,
    '/labs/*/files/*': labFiles,
    '/examples/*': exampleFiles,
    '/examples/*/files/*': exampleFiles,
  },
  outputFileTracingExcludes: {
    '/labs/*': privateLabFiles,
    '/labs/*/files/*': privateLabFiles,
    '/examples/*': privateExampleFiles,
    '/examples/*/files/*': privateExampleFiles,
  },
  async redirects() {
    const articleRedirects = buildLegacyRedirects(loadCatalog());
    const assetRedirects = buildPublicContentRedirects();
    return [...articleRedirects, ...assetRedirects].map((redirect) => ({
      source: redirect.source,
      destination: redirect.destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
