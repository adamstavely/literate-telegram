import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  typeSlugKey,
  isEsConflict,
  isEsNotFound,
  slugTaken,
  claimSlug,
  claimOrOwnSlug,
  releaseSlug,
} from './slug-locks.js';
import { stubEs, restoreEs } from '../test/mock-es.js';

describe('slug-locks helpers', () => {
  test('typeSlugKey combines type and slug', () => {
    assert.equal(typeSlugKey('skill', 'my-skill'), 'skill:my-skill');
  });

  test('isEsConflict detects 409', () => {
    assert.equal(isEsConflict({ statusCode: 409 }), true);
    assert.equal(isEsConflict({ meta: { statusCode: 409 } }), true);
    assert.equal(isEsConflict({ statusCode: 404 }), false);
  });

  test('isEsNotFound detects 404', () => {
    assert.equal(isEsNotFound({ statusCode: 404 }), true);
    assert.equal(isEsNotFound({ statusCode: 409 }), false);
  });
});

describe('slugTaken', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns true when registry has a matching entry', async () => {
    stubEs('count', async (params: { index?: string }) => {
      if (params.index === 'interop-registry') return { count: 1 };
      return { count: 0 };
    });
    stubEs('exists', async () => false);

    assert.equal(await slugTaken('skill', 'foo'), true);
  });

  test('returns false when no lock and no registry/pending entries', async () => {
    stubEs('count', async () => ({ count: 0 }));
    stubEs('exists', async () => false);

    assert.equal(await slugTaken('skill', 'free-slug'), false);
  });

  test('releases orphan lock with no entryId', async () => {
    let deleted = false;
    stubEs('count', async () => ({ count: 0 }));
    stubEs('exists', async () => true);
    stubEs('get', async () => ({ _source: {} }));
    stubEs('delete', async () => {
      deleted = true;
      return {};
    });

    assert.equal(await slugTaken('skill', 'orphan'), false);
    assert.equal(deleted, true);
  });
});

describe('claimSlug', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns true on successful create', async () => {
    stubEs('create', async () => ({}));
    assert.equal(await claimSlug('skill', 'new', 'entry-1'), true);
  });

  test('returns false on conflict', async () => {
    stubEs('create', async () => {
      const err = new Error('conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });
    assert.equal(await claimSlug('skill', 'taken', 'entry-2'), false);
  });
});

describe('claimOrOwnSlug', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns true when same entry owns the lock', async () => {
    stubEs('create', async () => {
      const err = new Error('conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });
    stubEs('get', async () => ({ _source: { entryId: 'entry-1' } }));

    assert.equal(await claimOrOwnSlug('skill', 'mine', 'entry-1'), true);
  });

  test('returns false when a different entry owns the lock', async () => {
    stubEs('create', async () => {
      const err = new Error('conflict') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    });
    stubEs('get', async () => ({ _source: { entryId: 'other-entry' } }));

    assert.equal(await claimOrOwnSlug('skill', 'theirs', 'entry-1'), false);
  });
});

describe('releaseSlug', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('swallows delete errors', async () => {
    stubEs('delete', async () => {
      throw new Error('not found');
    });
    await assert.doesNotReject(releaseSlug('skill', 'gone'));
  });
});
