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
import { PendingEntry, RegistryEntry } from '../../types/index.js';

const AUTH = { Authorization: 'Bearer mock-token' };

const pendingEntry: PendingEntry = {
  id: 'pending-1',
  entry: {
    id: 'entry-1',
    type: 'skill',
    name: 'Queued Skill',
    slug: 'queued-skill',
    publisher: 'anthropic.com',
    verified: false,
    summary: 'A skill waiting for review in the moderation queue.',
    description: 'This skill is pending admin approval before publication.',
    installs: 0,
    sensitivity: 'public',
    categories: ['Developer Tools'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    triggers: ['when asked'],
    tokens: 100,
  } as RegistryEntry,
  submittedBy: 'user-1',
  submittedAt: '2026-01-01T00:00:00.000Z',
  status: 'pending',
  risk: 'low',
  flags: [],
};

function pendingSearchHit(entry = pendingEntry, seqNo = 1, primaryTerm = 1) {
  return {
    hits: {
      hits: [{
        _id: 'es-doc-1',
        _source: entry,
        _seq_no: seqNo,
        _primary_term: primaryTerm,
      }],
    },
  };
}

describe('PUT /api/pending/:id/approve', () => {
  beforeEach(() => {
    restoreEs();
    resetPolicyCache();
  });
  afterEach(() => restoreEs());

  test('returns 409 when policy blocks without override', async () => {
    const policy = structuredClone(DEFAULT_POLICY_DOCUMENT);
    const noSandbox = policy.rules.find((r) => r.id === 'no-sandbox');
    assert.ok(noSandbox);
    noSandbox!.action = 'block';

    const risky = structuredClone(pendingEntry);
    risky.entry = {
      ...risky.entry,
      type: 'server',
      transports: ['stdio'],
      auth: 'OAuth 2.1',
      clients: ['Claude'],
      license: 'MIT',
      source: 'https://example.com',
      tools: [],
    } as RegistryEntry;
    risky.risk = 'high';

    stubEs('search', async () => pendingSearchHit(risky));
    stubEs('get', async () => ({ _source: policy }));

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'Policy Block');
  });

  test('returns 422 when override reason is too short', async () => {
    const policy = structuredClone(DEFAULT_POLICY_DOCUMENT);
    const noSandbox = policy.rules.find((r) => r.id === 'no-sandbox');
    assert.ok(noSandbox);
    noSandbox!.action = 'block';

    const risky = structuredClone(pendingEntry);
    risky.entry = {
      ...risky.entry,
      type: 'server',
      transports: ['stdio'],
      auth: 'OAuth 2.1',
      clients: ['Claude'],
      license: 'MIT',
      source: 'https://example.com',
      tools: [],
    } as RegistryEntry;
    risky.risk = 'high';

    stubEs('search', async () => pendingSearchHit(risky));
    stubEs('get', async () => ({ _source: policy }));

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({ override: true, overrideReason: 'too short' });

    assert.equal(res.status, 422);
    assert.match(res.body.message, /at least 10 characters/);
  });

  test('returns 409 when slug is already taken at approval time', async () => {
    stubEs('search', async () => pendingSearchHit());
    stubEs('get', async () => ({ _source: DEFAULT_POLICY_DOCUMENT }));
    stubEs('count', async () => ({ count: 1 }));
    stubEs('exists', async () => false);

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already exists/);
  });

  test('compensates pending status when registry publish fails', async () => {
    const updateCalls: Array<{ doc: Record<string, unknown> }> = [];

    stubEs('search', async () => pendingSearchHit());
    stubEs('get', async () => ({ _source: DEFAULT_POLICY_DOCUMENT }));
    stubEs('count', async () => ({ count: 0 }));
    stubEs('exists', async () => false);
    stubEs('create', async () => ({}));
    stubEs('update', async (args: { doc: Record<string, unknown> }) => {
      updateCalls.push(args);
      return {};
    });
    stubEs('index', async () => {
      throw new Error('registry publish failed');
    });
    stubEs('delete', async () => ({}));

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 500);
    const rollback = updateCalls.find((c) => c.doc['status'] === 'pending');
    assert.ok(rollback, 'expected pending rollback update');
  });
});

describe('PUT /api/pending/:id/reject', () => {
  beforeEach(() => {
    restoreEs();
    resetPolicyCache();
  });
  afterEach(() => restoreEs());

  test('returns 422 when reason is too short', async () => {
    const res = await request(app)
      .put('/api/pending/pending-1/reject')
      .set(AUTH)
      .send({ reason: 'short' });

    assert.equal(res.status, 422);
  });

  test('returns 409 on optimistic-lock conflict', async () => {
    stubEs('search', async () => pendingSearchHit());
    stubEs('update', async () => {
      const err = new Error('version conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });

    const res = await request(app)
      .put('/api/pending/pending-1/reject')
      .set(AUTH)
      .send({ reason: 'Does not meet quality bar for publication.' });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /modified concurrently/);
  });
});
