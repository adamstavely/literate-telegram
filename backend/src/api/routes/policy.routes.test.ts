process.env['NODE_ENV'] = 'development';
process.env['ALLOW_MOCK_AUTH'] = 'true';
process.env['OIDC_ISSUER'] = 'https://test.example.com';
process.env['OIDC_AUDIENCE'] = 'https://api.test.example.com';
process.env['OIDC_JWKS_URI'] = 'https://test.example.com/.well-known/jwks.json';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../app.js';
import { config } from '../../config/index.js';
import { DEFAULT_POLICY_DOCUMENT } from '../../data/default-policy.js';

const AUTH = { Authorization: 'Bearer mock-token' };

describe('PUT /api/policy', () => {
  test('returns 428 when OCC tokens omitted outside development', async () => {
    const prev = config.nodeEnv;
    config.nodeEnv = 'production';
    try {
      const { policy, rules, domains } = DEFAULT_POLICY_DOCUMENT;

      const res = await request(app)
        .put('/api/policy')
        .set(AUTH)
        .send({ policy, rules, domains });

      assert.equal(res.status, 428);
      assert.equal(res.body.error, 'Precondition Required');
    } finally {
      config.nodeEnv = prev;
    }
  });

  test('returns 428 when OCC tokens omitted in development', async () => {
    const { policy, rules, domains } = DEFAULT_POLICY_DOCUMENT;

    const res = await request(app)
      .put('/api/policy')
      .set(AUTH)
      .send({ policy, rules, domains });

    assert.equal(res.status, 428);
    assert.equal(res.body.error, 'Precondition Required');
  });
});
