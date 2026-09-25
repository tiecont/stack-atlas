import type { NextConfig } from 'next';
import { loadCatalog } from './lib/content/loader';
import { buildLegacyRedirects } from './lib/content/redirects';

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
    '/labs/*': ['./labs/**/*'],
    '/examples/*': ['./examples/**/*'],
    '/tests/*': ['./tests/kubernetes/version-matrix.yaml'],
  },
  async redirects() {
    return buildLegacyRedirects(loadCatalog()).map((redirect) => ({
      source: redirect.source,
      destination: redirect.destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
