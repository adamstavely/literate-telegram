import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { rateLimit } from 'express-rate-limit';
import { rateLimitIdentityKey, perReplicaLimit } from './rate-limit.js';

describe('rateLimitIdentityKey', () => {
  test('prefers authenticated user sub over IP', () => {
    assert.equal(
      rateLimitIdentityKey({ user: { sub: 'user-1' }, ip: '10.0.0.1' }),
      'user:user-1',
    );
  });

  test('falls back to IP when unauthenticated', () => {
    assert.equal(rateLimitIdentityKey({ ip: '192.168.1.5' }), 'ip:192.168.1.5');
  });

  test('uses unknown when IP is missing', () => {
    assert.equal(rateLimitIdentityKey({}), 'ip:unknown');
  });
});

describe('perReplicaLimit', () => {
  test('returns at least 1 and floors the cluster max', () => {
    assert.equal(perReplicaLimit(200), 200);
    assert.equal(perReplicaLimit(10), 10);
    assert.equal(perReplicaLimit(1), 1);
  });
});

describe('ingestRateLimiter pattern', () => {
  test('returns 429 after the per-IP budget is exhausted', async () => {
    const app = express();
    app.use(express.json());
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 1,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.post('/ingest', limiter, (_req, res) => {
      res.status(202).json({ ok: true });
    });

    const agent = request(app);
    assert.equal((await agent.post('/ingest').send({})).status, 202);
    const limited = await agent.post('/ingest').send({});
    assert.equal(limited.status, 429);
  });
});
