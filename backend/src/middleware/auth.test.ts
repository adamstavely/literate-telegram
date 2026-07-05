process.env['NODE_ENV'] = 'development';
process.env['ALLOW_MOCK_AUTH'] = 'true';
process.env['OIDC_ISSUER'] = 'https://test.example.com';
process.env['OIDC_AUDIENCE'] = 'https://api.test.example.com';
process.env['OIDC_JWKS_URI'] = 'https://test.example.com/.well-known/jwks.json';

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { requireAuth, requireAdmin, optionalAuth } from './auth.js';
import { normalizeRoles, hasRole } from './roles.js';

describe('roles', () => {
  test('normalizeRoles lowercases string roles', () => {
    assert.deepEqual(normalizeRoles(['Admin', 'USER']), ['admin', 'user']);
  });

  test('hasRole is case-insensitive', () => {
    assert.equal(hasRole({ sub: '1', roles: ['Admin'] }, 'admin'), true);
    assert.equal(hasRole({ sub: '1', roles: ['user'] }, 'admin'), false);
  });
});

function testApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.id = 'test-corr';
    next();
  });
  app.get('/protected', requireAuth, (req: Request, res: Response) => {
    res.json({ sub: req.user?.sub });
  });
  app.get('/admin', requireAuth, requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/optional', optionalAuth, (req: Request, res: Response) => {
    res.json({ authenticated: !!req.user });
  });
  return app;
}

describe('auth middleware', () => {
  beforeEach(() => {});
  afterEach(() => {});

  test('requireAuth returns 401 without Authorization header', async () => {
    const res = await request(testApp()).get('/protected');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Unauthorized');
  });

  test('requireAuth returns 401 for non-Bearer header', async () => {
    const res = await request(testApp())
      .get('/protected')
      .set('Authorization', 'Basic abc');
    assert.equal(res.status, 401);
  });

  test('requireAuth accepts mock-token when ALLOW_MOCK_AUTH is true', async () => {
    const res = await request(testApp())
      .get('/protected')
      .set('Authorization', 'Bearer mock-token');
    assert.equal(res.status, 200);
    assert.equal(res.body.sub, 'dev-user-1');
  });

  test('requireAuth returns 401 for invalid token', async () => {
    const res = await request(testApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-jwt');
    assert.equal(res.status, 401);
  });

  test('requireAdmin returns 403 for non-admin mock user would need custom token — mock is admin', async () => {
    const res = await request(testApp())
      .get('/admin')
      .set('Authorization', 'Bearer mock-token');
    assert.equal(res.status, 200);
  });

  test('optionalAuth continues without user on missing header', async () => {
    const res = await request(testApp()).get('/optional');
    assert.equal(res.status, 200);
    assert.equal(res.body.authenticated, false);
  });

  test('optionalAuth continues without user on invalid token', async () => {
    const res = await request(testApp())
      .get('/optional')
      .set('Authorization', 'Bearer bad-token');
    assert.equal(res.status, 200);
    assert.equal(res.body.authenticated, false);
  });
});

describe('requireAdmin with non-admin user', () => {
  test('returns 403 when user lacks admin role', () => {
    const app = express();
    app.use((req, _res, next) => {
      req.id = 'test-corr';
      req.user = { sub: 'u1', roles: ['user'] };
      next();
    });
    app.get('/', requireAdmin, (_req, res) => res.json({ ok: true }));

    return request(app).get('/').then((res) => {
      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'Forbidden');
    });
  });

  test('accepts Admin role case-insensitively via normalized roles', () => {
    const app = express();
    app.use((req, _res, next) => {
      req.id = 'test-corr';
      req.user = { sub: 'a1', roles: ['Admin'] };
      next();
    });
    app.get('/', requireAdmin, (_req, res) => res.json({ ok: true }));

    return request(app).get('/').then((res) => {
      assert.equal(res.status, 200);
    });
  });
});
