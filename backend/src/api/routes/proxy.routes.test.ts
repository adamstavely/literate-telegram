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

// A registered API whose host is a public IP literal, so net-guard classifies
// it without a DNS lookup (no network in tests).
function apiEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    type: 'api',
    name: 'Pet API',
    slug: 'pet-api',
    baseUrl: 'https://8.8.8.8/v1',
    visibility: 'public',
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;
let lastFetch: { url: string; init: RequestInit | undefined } | null = null;

function stubFetch(status = 200, bodyStr = '{"ok":true}'): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    lastFetch = { url: String(input), init };
    return new Response(bodyStr, { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('POST /api/proxy', () => {
  beforeEach(() => {
    restoreEs();
    lastFetch = null;
  });
  afterEach(() => {
    restoreEs();
    globalThis.fetch = originalFetch;
  });

  test('401 without auth', async () => {
    const res = await request(app).post('/api/proxy').send({ entryId: 'entry-1', method: 'GET', path: '/pets' });
    assert.equal(res.status, 401);
  });

  test('404 when the entry does not exist', async () => {
    stubEs('get', async () => {
      const e = new Error('not found') as Error & { statusCode: number };
      e.statusCode = 404;
      throw e;
    });
    const res = await request(app).post('/api/proxy').set(AUTH).send({ entryId: 'nope', method: 'GET', path: '/pets' });
    assert.equal(res.status, 404);
  });

  test('422 when the entry has no baseUrl', async () => {
    stubEs('get', async () => ({ _source: apiEntry({ baseUrl: undefined }) }));
    const res = await request(app).post('/api/proxy').set(AUTH).send({ entryId: 'entry-1', method: 'GET', path: '/pets' });
    assert.equal(res.status, 422);
  });

  test('400 when the path is absolute (host retarget attempt)', async () => {
    stubEs('get', async () => ({ _source: apiEntry() }));
    const res = await request(app)
      .post('/api/proxy')
      .set(AUTH)
      .send({ entryId: 'entry-1', method: 'GET', path: 'http://evil.example.com/x' });
    assert.equal(res.status, 400);
  });

  test('400 when the API baseUrl resolves to a private/loopback host (SSRF guard)', async () => {
    stubEs('get', async () => ({ _source: apiEntry({ baseUrl: 'https://127.0.0.1/v1' }) }));
    const res = await request(app).post('/api/proxy').set(AUTH).send({ entryId: 'entry-1', method: 'GET', path: '/pets' });
    assert.equal(res.status, 400);
  });

  test('forwards the request, passes back the upstream response, and never logs credentials', async () => {
    stubEs('get', async () => ({ _source: apiEntry() }));
    const auditDocs: Array<{ document?: { metadata?: Record<string, unknown> } }> = [];
    stubEs('index', async (args: { document?: { metadata?: Record<string, unknown> } }) => {
      auditDocs.push(args);
      return {};
    });
    stubFetch(200, '{"id":"p1"}');

    const res = await request(app)
      .post('/api/proxy')
      .set(AUTH)
      .send({
        entryId: 'entry-1',
        method: 'POST',
        path: '/pets',
        body: '{"name":"rex"}',
        headers: { Authorization: 'Bearer sk_secret', 'X-Evil': '1' },
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 200);
    assert.equal(res.body.body, '{"id":"p1"}');

    // The upstream call targeted the stored baseUrl host, with only allowlisted headers.
    assert.ok(lastFetch);
    assert.equal(lastFetch!.url, 'https://8.8.8.8/v1/pets');
    const sentHeaders = lastFetch!.init?.headers as Record<string, string>;
    assert.equal(sentHeaders['Authorization'], 'Bearer sk_secret');
    assert.equal(sentHeaders['Content-Type'], 'application/json');
    assert.equal(sentHeaders['X-Evil'], undefined); // non-allowlisted header dropped

    // The audit record must not contain the credential.
    const serialized = JSON.stringify(auditDocs);
    assert.ok(!serialized.includes('sk_secret'), 'audit must not contain the credential');
  });

  test('GraphQL (empty path) targets the base URL exactly, with no trailing slash', async () => {
    stubEs('get', async () => ({ _source: apiEntry({ style: 'GraphQL', baseUrl: 'https://8.8.8.8/graphql' }) }));
    stubEs('index', async () => ({}));
    stubFetch(200, '{"data":{}}');

    const res = await request(app)
      .post('/api/proxy')
      .set(AUTH)
      .send({ entryId: 'entry-1', method: 'POST', path: '', body: '{"query":"{ me { id } }"}' });

    assert.equal(res.status, 200);
    assert.ok(lastFetch);
    assert.equal(lastFetch!.url, 'https://8.8.8.8/graphql');
  });
});
