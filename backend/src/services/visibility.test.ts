import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registryVisibilityFilter, entryVisibleToCaller } from './visibility.js';
import { Request } from 'express';

function mockReq(user?: { sub: string; roles: string[] }): Request {
  return { user } as Request;
}

describe('visibility', () => {
  test('anonymous callers only see public entries', () => {
    assert.equal(entryVisibleToCaller({ visibility: 'public' }, mockReq()), true);
    assert.equal(entryVisibleToCaller({ visibility: 'org' }, mockReq()), false);
    assert.equal(entryVisibleToCaller({ visibility: 'private' }, mockReq()), false);
  });

  test('authenticated callers see public and org entries', () => {
    const req = mockReq({ sub: 'u1', roles: ['user'] });
    assert.equal(entryVisibleToCaller({ visibility: 'org' }, req), true);
    assert.equal(entryVisibleToCaller({ visibility: 'private' }, req), false);
  });

  test('admins see all visibility levels', () => {
    const req = mockReq({ sub: 'a1', roles: ['admin'] });
    assert.equal(entryVisibleToCaller({ visibility: 'private' }, req), true);
    assert.deepEqual(registryVisibilityFilter(req), { match_all: {} });
  });

  test('admins with mixed-case Admin role are recognized', () => {
    const req = mockReq({ sub: 'a1', roles: ['Admin'] });
    assert.equal(entryVisibleToCaller({ visibility: 'private' }, req), true);
    assert.deepEqual(registryVisibilityFilter(req), { match_all: {} });
  });

  test('legacy entries without visibility default to org scope', () => {
    assert.equal(entryVisibleToCaller({}, mockReq()), false);
    const req = mockReq({ sub: 'u1', roles: ['user'] });
    assert.equal(entryVisibleToCaller({}, req), true);
  });

  test('anonymous ES filter excludes legacy entries without visibility', () => {
    const filter = registryVisibilityFilter(mockReq()) as {
      bool: { should: unknown[] };
    };
    assert.equal(filter.bool.should.length, 1);
  });

  test('authenticated ES filter includes legacy entries without visibility', () => {
    const filter = registryVisibilityFilter(mockReq({ sub: 'u1', roles: ['user'] })) as {
      bool: { should: unknown[] };
    };
    assert.equal(filter.bool.should.length, 2);
  });
});
