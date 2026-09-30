import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../lib/api/client.ts';
import { describeAdminContentError } from '../../features/admin-content/admin-content-errors.ts';

test('admin content errors map API Problem Details statuses to actionable states', () => {
  const cases = [
    [401, 'Sign in required'],
    [403, 'Access denied'],
    [404, 'Content not found'],
    [409, 'Content conflict'],
    [503, 'Service unavailable'],
  ];

  for (const [status, title] of cases) {
    const error = new ApiError(status, {
      type: 'about:blank',
      title: 'API title',
      status,
      detail: 'API detail',
    });
    assert.equal(describeAdminContentError(error, 'create content').title, title);
  }
});

test('conflict Problem Details and sign-in navigation are preserved', () => {
  const conflict = new ApiError(409, {
    type: 'about:blank',
    title: 'Conflict',
    status: 409,
    detail: 'The slug is already in use.',
  });
  assert.equal(
    describeAdminContentError(conflict, 'create content').message,
    'The slug is already in use.',
  );

  const unauthenticated = new ApiError(401, {
    type: 'about:blank',
    title: 'Unauthorized',
    status: 401,
  });
  assert.equal(describeAdminContentError(unauthenticated, 'view content').loginHref, '/login/');
});
