import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  claimRegistrySlug,
  claimOrOwnRegistrySlug,
  releaseRegistrySlug,
  registrySlugReserved,
} from './registry-slugs.js';
import { stubEs, restoreEs } from '../test/mock-es.js';

describe('registry-slugs', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('registrySlugReserved reflects exists', async () => {
    stubEs('exists', async (params: { index?: string }) => params.index === 'interop-registry-slugs');
    assert.equal(await registrySlugReserved('tool', 'foo'), true);
  });

  test('claimRegistrySlug returns true on create', async () => {
    stubEs('create', async () => ({}));
    assert.equal(await claimRegistrySlug('skill', 'new', 'entry-1'), true);
  });

  test('claimRegistrySlug returns false on conflict', async () => {
    stubEs('create', async () => {
      const err = new Error('conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });
    assert.equal(await claimRegistrySlug('skill', 'taken', 'entry-2'), false);
  });

  test('claimOrOwnRegistrySlug accepts same entry owner', async () => {
    stubEs('create', async () => {
      const err = new Error('conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });
    stubEs('get', async () => ({ _source: { entryId: 'entry-1' } }));
    assert.equal(await claimOrOwnRegistrySlug('skill', 'mine', 'entry-1'), true);
  });

  test('releaseRegistrySlug deletes when owner matches', async () => {
    let deleted = false;
    stubEs('get', async () => ({ _source: { entryId: 'owner' } }));
    stubEs('delete', async () => {
      deleted = true;
      return {};
    });
    assert.equal(await releaseRegistrySlug('skill', 'held', 'owner'), true);
    assert.equal(deleted, true);
  });
});
