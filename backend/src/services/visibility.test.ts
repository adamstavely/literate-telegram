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
});
