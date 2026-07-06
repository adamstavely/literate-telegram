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

const OAS3 = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Pet API', version: '1.0.0' },
  servers: [{ url: 'https://api.pets.example.com/v1' }],
  paths: {
    '/pets': { get: { summary: 'List pets', responses: { '200': { description: 'ok' } } } },
  },
});

describe('POST /api/apis/import', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('401 without auth', async () => {
    const res = await request(app).post('/api/apis/import').send({ spec: OAS3 });
    assert.equal(res.status, 401);
  });

  test('maps a pasted OpenAPI spec into a draft', async () => {
    stubEs('index', async () => ({})); // audit write
    const res = await request(app).post('/api/apis/import').set(AUTH).send({ spec: OAS3 });
    assert.equal(res.status, 200);
    assert.equal(res.body.draft.name, 'Pet API');
    assert.equal(res.body.draft.baseUrl, 'https://api.pets.example.com/v1');
    assert.equal(res.body.draft.endpoints.length, 1);
    assert.equal(res.body.draft.endpoints[0].method, 'GET');
  });

  test('400 when neither url nor spec is provided', async () => {
    const res = await request(app).post('/api/apis/import').set(AUTH).send({});
    assert.equal(res.status, 400);
  });

  test('400 when the spec URL resolves to a private/loopback address (SSRF guard)', async () => {
    const res = await request(app)
      .post('/api/apis/import')
      .set(AUTH)
      .send({ url: 'https://127.0.0.1/openapi.json' });
    assert.equal(res.status, 400);
  });

  test('400 for a non-https spec URL (https-only default)', async () => {
    const res = await request(app)
      .post('/api/apis/import')
      .set(AUTH)
      .send({ url: 'http://example.com/openapi.json' });
    assert.equal(res.status, 400);
  });
});
