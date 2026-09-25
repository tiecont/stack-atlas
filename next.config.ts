import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/\\[\\[\\.\\.\\.slug\\]\\]': ['./public/generated-site/**/*.html'],
  },
};

export default nextConfig;
