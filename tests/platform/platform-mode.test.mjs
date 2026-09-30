import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWebPlatform } from '../../lib/platform/config.ts';
import { platformRouteDecision } from '../../lib/platform/routes.ts';

test('platform config allows only learner and admin, with a development learner fallback', () => {
  assert.equal(parseWebPlatform(' admin ', 'production'), 'admin');
  assert.equal(parseWebPlatform('learner', 'production'), 'learner');
  assert.equal(parseWebPlatform(undefined, 'development'), 'learner');
  assert.throws(() => parseWebPlatform(undefined, 'production'), /STACK_ATLAS_WEB_PLATFORM/);
  assert.throws(() => parseWebPlatform('editor', 'production'), /STACK_ATLAS_WEB_PLATFORM/);
  assert.throws(() => parseWebPlatform('editor', 'development'), /STACK_ATLAS_WEB_PLATFORM/);
});

test('learner and admin routes are isolated at the server boundary', () => {
  assert.deepEqual(platformRouteDecision('learner', '/'), { kind: 'next' });
  assert.deepEqual(platformRouteDecision('learner', '/articles/systems/overview/'), {
    kind: 'next',
  });
  assert.deepEqual(platformRouteDecision('learner', '/topics/backend/'), { kind: 'next' });
  assert.deepEqual(platformRouteDecision('learner', '/paths/platform/'), { kind: 'next' });
  assert.deepEqual(platformRouteDecision('learner', '/admin/content/'), { kind: 'not-found' });
  assert.deepEqual(platformRouteDecision('learner', '/admin/private.css'), { kind: 'not-found' });

  assert.deepEqual(platformRouteDecision('admin', '/'), {
    kind: 'redirect',
    destination: '/admin/',
  });
  assert.deepEqual(platformRouteDecision('admin', '/admin/'), { kind: 'next' });
  assert.deepEqual(platformRouteDecision('admin', '/admin/content/'), { kind: 'next' });
  assert.deepEqual(platformRouteDecision('admin', '/articles/'), { kind: 'not-found' });
  assert.deepEqual(platformRouteDecision('admin', '/articles/a/b.json'), { kind: 'not-found' });
  assert.deepEqual(platformRouteDecision('admin', '/paths/platform/'), { kind: 'not-found' });
  assert.deepEqual(platformRouteDecision('admin', '/unknown-shared-asset.svg'), {
    kind: 'not-found',
  });
  assert.deepEqual(platformRouteDecision('admin', '/api/search/'), { kind: 'not-found' });
  assert.deepEqual(platformRouteDecision('admin', '/sitemap.xml'), { kind: 'not-found' });
  assert.deepEqual(platformRouteDecision('admin', '/robots.txt'), { kind: 'not-found' });
});

test('auth routes, public assets, and health are shared by both runtimes', () => {
  for (const platform of ['learner', 'admin']) {
    assert.deepEqual(platformRouteDecision(platform, '/api/healthz/'), { kind: 'next' });
    assert.deepEqual(platformRouteDecision(platform, '/login/'), { kind: 'next' });
    assert.deepEqual(platformRouteDecision(platform, '/account/'), { kind: 'next' });
    assert.deepEqual(platformRouteDecision(platform, '/icon.svg'), { kind: 'next' });
    assert.deepEqual(platformRouteDecision(platform, '/_next/static/app.css'), { kind: 'next' });
  }
});
