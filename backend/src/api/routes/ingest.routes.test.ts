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

describe('POST /api/logs', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns 400 for invalid payload', async () => {
    const res = await request(app).post('/api/logs').send({ entries: [] });
    assert.equal(res.status, 400);
  });

  test('accepts valid client log batch', async () => {
    stubEs('bulk', async () => ({ errors: false, items: [] }));

    const res = await request(app)
      .post('/api/logs')
      .send({
        entries: [{
          level: 'info',
          message: 'hello',
          timestamp: new Date().toISOString(),
          url: '/browse',
          userAgent: 'test',
        }],
      });

    assert.equal(res.status, 202);
    assert.equal(res.body.accepted, 1);
  });
});

describe('POST /api/audit/client', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns 400 for invalid payload', async () => {
    const res = await request(app).post('/api/audit/client').send({ events: [] });
    assert.equal(res.status, 400);
  });

  test('accepts valid client audit batch', async () => {
    stubEs('bulk', async () => ({ errors: false, items: [] }));

    const res = await request(app)
      .post('/api/audit/client')
      .send({
        events: [{
          action: 'post',
          resource: 'entries',
          timestamp: new Date().toISOString(),
          pageUrl: '/register',
        }],
      });

    assert.equal(res.status, 202);
    assert.equal(res.body.accepted, 1);
  });
});
