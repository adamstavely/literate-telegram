import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runCompensation } from './compensation.js';
import { stubEs, restoreEs } from '../test/mock-es.js';

describe('runCompensation', () => {
  beforeEach(() => restoreEs());
  afterEach(() => restoreEs());

  test('returns true when fn succeeds on first attempt', async () => {
    let calls = 0;
    const ok = await runCompensation('test-op', async () => {
      calls++;
    });
    assert.equal(ok, true);
    assert.equal(calls, 1);
  });

  test('retries and succeeds on later attempt', async () => {
    let calls = 0;
    const ok = await runCompensation('retry-op', async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
    });
    assert.equal(ok, true);
    assert.equal(calls, 2);
  });

  test('returns false and writes reconciliation audit after exhausting retries', async () => {
    let indexed = false;
    stubEs('index', async (params: { document?: { action?: string } }) => {
      if (params.document?.action === 'RECONCILIATION_REQUIRED') indexed = true;
      return {};
    });

    const ok = await runCompensation('fail-op', async () => {
      throw new Error('permanent');
    }, { entryId: 'e1' });

    assert.equal(ok, false);
    assert.equal(indexed, true);
  });
});
