process.env['NODE_ENV'] = 'development';
process.env['ALLOW_MOCK_AUTH'] = 'true';
process.env['OIDC_ISSUER'] = 'https://test.example.com';
process.env['OIDC_AUDIENCE'] = 'https://api.test.example.com';
process.env['OIDC_JWKS_URI'] = 'https://test.example.com/.well-known/jwks.json';

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../app.js';
import { DEFAULT_POLICY_DOCUMENT } from '../../data/default-policy.js';
import { resetPolicyCache } from '../../services/policy.js';
import { stubEs, restoreEs } from '../../test/mock-es.js';

const AUTH = { Authorization: 'Bearer mock-token' };

const validSkill = {
  type: 'skill',
  name: 'Test Skill',
  slug: 'test-skill',
  publisher: 'anthropic.com',
  summary: 'A helpful test skill for demonstrations',
  description: 'This skill provides helpful test guidance for agents in tests.',
  sensitivity: 'public',
  categories: ['Developer Tools'],
  triggers: ['when testing'],
  tokens: 100,
};

describe('POST /api/entries', () => {
  beforeEach(() => {
    restoreEs();
    resetPolicyCache();
  });

  afterEach(() => {
    restoreEs();
  });

  test('returns 409 when slug is already taken', async () => {
    stubEs('count', async () => ({ count: 1 }));
    stubEs('exists', async () => false);

    const res = await request(app)
      .post('/api/entries')
      .set(AUTH)
      .send(validSkill);

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already exists/);
  });

  test('returns 422 when submission violates a reject-level policy rule', async () => {
    const policy = structuredClone(DEFAULT_POLICY_DOCUMENT);
    const execRule = policy.rules.find((r) => r.id === 'arbitrary-exec');
    assert.ok(execRule);
    execRule!.action = 'reject';

    stubEs('get', async () => ({ _source: policy }));
    stubEs('count', async () => ({ count: 0 }));
    stubEs('exists', async () => false);

    const res = await request(app)
      .post('/api/entries')
      .set(AUTH)
      .send({
        type: 'tool',
        name: 'run',
        slug: 'run-tool',
        publisher: 'anthropic.com',
        summary: 'A tool that runs shell commands on the host',
        description: 'This tool can exec shell commands and eval arbitrary code.',
        sensitivity: 'public',
        categories: ['Developer Tools'],
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'Policy Violation');
    assert.ok(Array.isArray(res.body.blockedBy));
  });

  test('compensates registry write when pending record fails on auto-approve', async () => {
    const policy = structuredClone(DEFAULT_POLICY_DOCUMENT);
    policy.policy.autoApproveSkills = true;

    const deleteCalls: unknown[] = [];
    let indexCalls = 0;

    stubEs('get', async () => ({ _source: policy }));
    stubEs('count', async () => ({ count: 0 }));
    stubEs('exists', async () => false);
    stubEs('create', async () => ({}));
    stubEs('index', async (args: { index: string; id: string }) => {
      indexCalls++;
      if (indexCalls === 2) {
        throw new Error('pending index failed');
      }
      return { _id: args.id };
    });
    stubEs('delete', async (args: unknown) => {
      deleteCalls.push(args);
      return {};
    });

    const res = await request(app)
      .post('/api/entries')
      .set(AUTH)
      .send(validSkill);

    assert.equal(res.status, 500);
    assert.ok(deleteCalls.length >= 1, 'expected registry rollback delete');
  });
});

describe('GET /api/health/live', () => {
  test('returns 200 without Elasticsearch', async () => {
    const res = await request(app).get('/api/health/live');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });
});
