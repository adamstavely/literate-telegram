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
import { COLLECTION_DEFINITIONS } from '../../data/collections.js';

const AUTH = { Authorization: 'Bearer mock-token' };

describe('GET /api/collections', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('resolves members by slug without relying on a bulk 500 cap', async () => {
    const def = COLLECTION_DEFINITIONS[0];
    assert.ok(def);
    const memberSlug = def.members[0]?.id;
    assert.ok(memberSlug);

    stubEs('search', async (params: { index?: string; query?: { bool?: { filter?: unknown[] } } }) => {
      if (params.index === 'interop-collections') {
        return { hits: { hits: [] } };
      }
      if (params.index === 'interop-registry') {
        return {
          hits: {
            hits: [
              {
                _source: {
                  id: 'entry-1',
                  type: 'server',
                  slug: memberSlug,
                  name: 'Member',
                  summary: 's',
                  description: 'd',
                  sensitivity: 'public',
                  visibility: 'public',
                  installs: 3,
                },
              },
            ],
          },
        };
      }
      return { hits: { hits: [] } };
    });

    const res = await request(app).get('/api/collections');
    assert.equal(res.status, 200);
    const col = res.body.find((c: { id: string }) => c.id === def.id);
    assert.ok(col);
    assert.ok(col.count >= 1);
    assert.ok(col.entries.some((e: { slug: string }) => e.slug === memberSlug));
  });
});

describe('GET /api/collections/:id', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns 404 for unknown collection', async () => {
    stubEs('search', async () => ({ hits: { hits: [] } }));
    const res = await request(app).get('/api/collections/does-not-exist');
    assert.equal(res.status, 404);
  });
});
