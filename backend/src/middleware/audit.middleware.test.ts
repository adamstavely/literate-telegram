process.env['NODE_ENV'] = 'development';
process.env['ALLOW_MOCK_AUTH'] = 'true';
process.env['OIDC_ISSUER'] = 'https://test.example.com';
process.env['OIDC_AUDIENCE'] = 'https://api.test.example.com';
process.env['OIDC_JWKS_URI'] = 'https://test.example.com/.well-known/jwks.json';

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { auditMiddleware, auditAction } from './audit.js';
import { stubEs, restoreEs } from '../test/mock-es.js';

function runMiddleware(
  req: Partial<Request> & { semanticAuditRecorded?: boolean },
  resStatus = 201,
): Promise<{ indexed: number }> {
  return new Promise((resolve) => {
    let indexed = 0;
    stubEs('index', async () => {
      indexed += 1;
      return {};
    });

    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = resStatus;

    auditMiddleware(req as Request, res as Response, () => {
      res.emit('finish');
      resolve({ indexed });
    });
  });
}

describe('auditMiddleware', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('writes a generic audit event for mutating requests', async () => {
    const { indexed } = await runMiddleware({
      method: 'POST',
      path: '/api/collections',
      user: { sub: 'user-1', roles: ['admin'] },
      headers: {},
      ip: '127.0.0.1',
    });
    assert.equal(indexed, 1);
  });

  test('skips generic audit when auditAction already recorded a semantic event', async () => {
    const req = {
      method: 'POST',
      path: '/api/entries',
      user: { sub: 'user-1', roles: ['admin'] },
      headers: {},
      ip: '127.0.0.1',
    } as Partial<Request> & { semanticAuditRecorded?: boolean };

    let indexed = 0;
    stubEs('index', async () => {
      indexed += 1;
      return {};
    });

    await auditAction(req as Request, 'SUBMIT_ENTRY', 'pending-1');

    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = 202;

    await new Promise<void>((resolve) => {
      auditMiddleware(req as Request, res as Response, () => {
        res.emit('finish');
        resolve();
      });
    });

    assert.equal(indexed, 1);
  });
});
