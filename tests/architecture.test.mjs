import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('the web runtime and build scripts do not depend on Python or generated HTML', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const script of ['dev', 'build', 'test', 'content:validate']) {
    assert.doesNotMatch(packageJson.scripts[script], /python|PYTHONPATH|stack_atlas/i);
  }
  assert.equal(existsSync(new URL('../platform/stack_atlas', import.meta.url)), false);
  assert.equal(existsSync(new URL('../platform/templates', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/generated-site', import.meta.url)), false);
  assert.equal(existsSync(new URL('../dist', import.meta.url)), false);
  assert.equal(existsSync(new URL('../lib/generated-site.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/assets/legacy-runtime.js', import.meta.url)), false);
  assert.equal(
    existsSync(new URL('../platform/assets/scripts/api-client.js', import.meta.url)),
    false,
  );
});

test('Next owns styles and icons and the legacy runtime is not loaded', () => {
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /globals\.css/);
  assert.doesNotMatch(layout, /legacy-runtime|<Script/);
  assert.ok(existsSync(new URL('../app/site.css', import.meta.url)));
  assert.ok(existsSync(new URL('../app/tokens.css', import.meta.url)));
  assert.ok(existsSync(new URL('../app/icon.svg', import.meta.url)));
});

test('the delivery baseline includes Node 24, standalone Docker, CI, and pre-commit gates', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const nextConfig = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const preCommit = readFileSync(new URL('../.husky/pre-commit', import.meta.url), 'utf8');

  assert.match(packageJson.engines.node, />=24/);
  assert.match(nextConfig, /output: ['"]standalone['"]/);
  assert.match(dockerfile, /FROM node:24-alpine AS runner/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(compose, /healthcheck:/);
  assert.match(workflow, /npm run format:check/);
  assert.match(workflow, /npm run test:e2e/);
  assert.match(workflow, /docker\/build-push-action/);
  assert.match(preCommit, /lint-staged/);
  assert.match(preCommit, /test:precommit/);
});
