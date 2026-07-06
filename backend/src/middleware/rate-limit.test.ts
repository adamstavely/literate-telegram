import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
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
