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

  test('returns 409 when the slug is held by a different entry at approval time', async () => {
    stubEs('search', async () => pendingSearchHit());
    // Policy get for enforcement; slug-lock get returns a lock owned by someone else.
    stubEs('get', async (args: { index?: string }) =>
      String(args.index).includes('slug-locks')
        ? { _source: { entryId: 'a-different-entry' } }
        : { _source: DEFAULT_POLICY_DOCUMENT },
    );
    // claimSlug create() conflicts (slug already locked).
    stubEs('create', async () => {
      const e = new Error('conflict') as Error & { statusCode: number };
      e.statusCode = 409;
      throw e;
    });

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already exists/);
  });

  test('returns 409 when registry slug reservation is held by another entry', async () => {
    stubEs('search', async () => pendingSearchHit());
    stubEs('create', async (args: { index?: string }) => {
      if (String(args.index).includes('registry-slugs')) {
        const e = new Error('conflict') as Error & { statusCode: number };
        e.statusCode = 409;
        throw e;
      }
      return {};
    });
    stubEs('get', async (args: { index?: string }) => {
      if (String(args.index).includes('registry-slugs')) {
        return { _source: { entryId: 'other-entry' } };
      }
      if (String(args.index).includes('slug-locks')) {
        return { _source: { entryId: 'entry-1' } };
      }
      return { _source: DEFAULT_POLICY_DOCUMENT };
    });

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already exists/);
  });

  test('leaves pending untouched when registry publish fails (registry-first ordering)', async () => {
    const updateCalls: Array<{ doc: Record<string, unknown> }> = [];

    stubEs('search', async () => pendingSearchHit());
    stubEs('get', async () => ({ _source: DEFAULT_POLICY_DOCUMENT }));
    stubEs('create', async () => ({})); // claimSlug succeeds (entry owns its slug)
    stubEs('update', async (args: { doc: Record<string, unknown> }) => {
      updateCalls.push(args);
      return {};
    });
    stubEs('index', async () => {
      throw new Error('registry publish failed');
    });

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 500);
    // Registry is published before the pending flip, so a publish failure must
    // leave the pending doc untouched (never flipped to 'approved') — safe and
    // re-approvable, no divergence to roll back.
    assert.ok(
      !updateCalls.some((c) => c.doc['status'] === 'approved'),
      'pending must not be flipped to approved when publish fails',
    );
  });

  test('rolls back the published registry doc when the pending flip fails', async () => {
    const deleteCalls: Array<{ index?: string; id?: string }> = [];

    stubEs('search', async () => pendingSearchHit());
    // Policy read for enforcement; the post-failure recheck reads the pending
    // doc back and finds it still 'pending' (no concurrent approver won).
    stubEs('get', async (args: { index?: string }) =>
      String(args.index).includes('pending')
        ? { _source: { status: 'pending' } }
        : { _source: DEFAULT_POLICY_DOCUMENT },
    );
    stubEs('create', async () => ({})); // claimSlug succeeds
    stubEs('index', async () => ({})); // registry publish succeeds
    stubEs('update', async () => {
      throw new Error('transient flip failure'); // non-conflict error
    });
    stubEs('delete', async (args: { index?: string; id?: string }) => {
      deleteCalls.push(args);
      return {};
    });

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 500);
    // The just-published registry doc is an orphan (flip never landed, and the
    // recheck confirmed no concurrent approve won) — it must be deleted.
    assert.ok(
      deleteCalls.some((c) => String(c.index).includes('registry') && c.id === 'entry-1'),
      'orphaned registry doc must be rolled back',
    );
  });

  test('surfaces reconciliation when the registry rollback also fails', async () => {
    stubEs('search', async () => pendingSearchHit());
    stubEs('get', async (args: { index?: string }) =>
      String(args.index).includes('pending')
        ? { _source: { status: 'pending' } }
        : { _source: DEFAULT_POLICY_DOCUMENT },
    );
    stubEs('create', async () => ({}));
    // index() is used both for the registry publish (must succeed) and for the
    // reconciliation audit record written on rollback exhaustion.
    stubEs('index', async () => ({}));
    stubEs('update', async () => {
      throw new Error('transient flip failure');
    });
    stubEs('delete', async () => {
      throw new Error('elasticsearch unavailable'); // rollback can never complete
    });

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 500);
    assert.equal(res.body.reconciliation, 'required');
    assert.equal(res.body.entryId, 'entry-1');
  });

  test('returns success when the pending flip failed transiently but approval landed', async () => {
    stubEs('search', async () => pendingSearchHit());
    stubEs('get', async (args: { index?: string }) =>
      String(args.index).includes('pending')
        ? { _source: { status: 'approved' } }
        : { _source: DEFAULT_POLICY_DOCUMENT },
    );
    stubEs('create', async () => ({}));
    stubEs('index', async () => ({}));
    stubEs('update', async () => {
      throw new Error('transient flip failure');
    });

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'approved');
  });

  test('keeps the registry doc when a concurrent approver already won', async () => {
    const deleteCalls: Array<{ index?: string; id?: string }> = [];

    stubEs('search', async () => pendingSearchHit());
    // The recheck finds the pending doc already 'approved' — a concurrent
    // approver won, so their identical registry doc must stay.
    stubEs('get', async (args: { index?: string }) =>
      String(args.index).includes('pending')
        ? { _source: { status: 'approved' } }
        : { _source: DEFAULT_POLICY_DOCUMENT },
    );
    stubEs('create', async () => ({}));
    stubEs('index', async () => ({}));
    stubEs('update', async () => {
      const err = new Error('version conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });
    stubEs('delete', async (args: { index?: string; id?: string }) => {
      deleteCalls.push(args);
      return {};
    });

    const res = await request(app)
      .put('/api/pending/pending-1/approve')
      .set(AUTH)
      .send({});

    assert.equal(res.status, 409);
    assert.ok(
      !deleteCalls.some((c) => String(c.index).includes('registry')),
      'a concurrently-approved registry doc must not be deleted',
    );
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

  test('removes an orphaned registry doc on reject (defense in depth)', async () => {
    const deleteCalls: Array<{ index?: string; id?: string }> = [];

    stubEs('search', async () => pendingSearchHit());
    stubEs('update', async () => ({})); // flip to rejected succeeds
    stubEs('get', async (args: { index?: string }) =>
      String(args.index).includes('registry')
        ? { _source: { createdAt: pendingEntry.submittedAt } }
        : { _source: DEFAULT_POLICY_DOCUMENT },
    );
    stubEs('delete', async (args: { index?: string; id?: string }) => {
      deleteCalls.push(args);
      return {}; // an orphan existed and was deleted
    });

    const res = await request(app)
      .put('/api/pending/pending-1/reject')
      .set(AUTH)
      .send({ reason: 'Does not meet quality bar for publication.' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'rejected');
    assert.ok(
      deleteCalls.some((c) => String(c.index).includes('registry') && c.id === 'entry-1'),
      'reject must clean up any orphaned registry doc for the entry',
    );
  });

  test('does not delete a pre-existing registry doc when rejecting an edit-style pending entry', async () => {
    const deleteCalls: Array<{ index?: string; id?: string }> = [];

    stubEs('search', async () => pendingSearchHit());
    stubEs('update', async () => ({}));
    stubEs('get', async (args: { index?: string }) =>
      String(args.index).includes('registry')
        ? { _source: { createdAt: '2020-01-01T00:00:00.000Z' } }
        : { _source: DEFAULT_POLICY_DOCUMENT },
    );
    stubEs('delete', async (args: { index?: string; id?: string }) => {
      deleteCalls.push(args);
      return {};
    });

    const res = await request(app)
      .put('/api/pending/pending-1/reject')
      .set(AUTH)
      .send({ reason: 'Does not meet quality bar for publication.' });

    assert.equal(res.status, 200);
    assert.ok(
      !deleteCalls.some((c) => String(c.index).includes('registry')),
      'reject must not delete a registry doc that predates the pending submission',
    );
  });
});
