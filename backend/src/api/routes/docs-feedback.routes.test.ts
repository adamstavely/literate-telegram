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
import { DOCS_VISITOR_COOKIE } from '../../services/docs-feedback.js';

describe('docs feedback API', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('GET /api/docs/feedback/session sets visitor cookie', async () => {
    const res = await request(app).get('/api/docs/feedback/session');
    assert.equal(res.status, 200);
    assert.equal(res.body.ready, true);
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie?.some((c: string) => c.startsWith(`${DOCS_VISITOR_COOKIE}=`)));
  });

  test('POST /api/docs/feedback returns 400 without visitor cookie', async () => {
    const res = await request(app)
      .post('/api/docs/feedback')
      .send({ pagePath: '/docs/overview', helpful: 'yes' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /session/i);
  });

  test('POST /api/docs/feedback rejects non-docs paths', async () => {
    const session = await request(app).get('/api/docs/feedback/session');
    const cookie = session.headers['set-cookie'];

    const res = await request(app)
      .post('/api/docs/feedback')
      .set('Cookie', cookie)
      .send({ pagePath: '/browse', helpful: 'yes' });

    assert.equal(res.status, 400);
  });

  test('POST /api/docs/feedback records helpful vote', async () => {
    stubEs('create', async () => ({ result: 'created' }));

    const session = await request(app).get('/api/docs/feedback/session');
    const cookie = session.headers['set-cookie'];

    const res = await request(app)
      .post('/api/docs/feedback')
      .set('Cookie', cookie)
      .send({
        pagePath: '/docs/overview',
        helpful: 'yes',
        pageTitle: 'Overview',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
  });

  test('POST /api/docs/feedback returns 409 on duplicate', async () => {
    stubEs('create', async () => {
      const err = new Error('version conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });

    const session = await request(app).get('/api/docs/feedback/session');
    const cookie = session.headers['set-cookie'];

    const res = await request(app)
      .post('/api/docs/feedback')
      .set('Cookie', cookie)
      .send({ pagePath: '/docs/overview', helpful: 'no', message: 'Needs examples' });

    assert.equal(res.status, 409);
    assert.match(res.body.error, /already submitted/i);
  });
});
