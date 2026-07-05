process.env['NODE_ENV'] = 'development';
process.env['ALLOW_MOCK_AUTH'] = 'true';
process.env['OIDC_ISSUER'] = 'https://test.example.com';
process.env['OIDC_AUDIENCE'] = 'https://api.test.example.com';
process.env['OIDC_JWKS_URI'] = 'https://test.example.com/.well-known/jwks.json';

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../app.js';
import { stubEs, restoreEs } from '../../test/mock-es.js';

const AUTH = { Authorization: 'Bearer mock-token' };

describe('GET /api/notifications', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/notifications');
    assert.equal(res.status, 401);
  });

  test('returns notifications for authenticated user', async () => {
    stubEs('search', async (params: { index?: string }) => {
      if (params.index === 'interop-notification-reads') {
        return { hits: { hits: [] } };
      }
      return {
        hits: {
          total: { value: 1 },
          hits: [{
            _id: 'es-1',
            _source: {
              id: 'n1',
              userId: 'dev-user-1',
              type: 'info',
              title: 'Hello',
              body: 'World',
              read: false,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          }],
        },
      };
    });

    const res = await request(app).get('/api/notifications').set(AUTH);
    assert.equal(res.status, 200);
    assert.equal(res.body.hits.length, 1);
    assert.equal(res.body.hits[0].id, 'n1');
  });
});

describe('PUT /api/notifications/:id/read', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns 404 for unknown notification', async () => {
    stubEs('search', async () => ({ hits: { hits: [] } }));

    const res = await request(app)
      .put('/api/notifications/missing/read')
      .set(AUTH);

    assert.equal(res.status, 404);
  });
});
