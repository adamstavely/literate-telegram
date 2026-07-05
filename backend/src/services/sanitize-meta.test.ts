import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { boundedMeta } from './sanitize-meta.js';

describe('boundedMeta', () => {
  test('returns empty object for non-objects', () => {
    assert.deepEqual(boundedMeta(null), {});
    assert.deepEqual(boundedMeta([]), {});
    assert.deepEqual(boundedMeta('x'), {});
  });

  test('truncates long strings and limits key count', () => {
    const out = boundedMeta({
      a: 'x'.repeat(600),
      b: 1,
      c: true,
      d: null,
      e: 2,
      f: 3,
      g: 4,
      h: 5,
      i: 6,
      j: 7,
      k: 8,
      l: 9,
      m: 10,
      n: 11,
      o: 12,
      p: 13,
      q: 14,
      r: 15,
      s: 16,
      t: 17,
      u: 18,
      v: 19,
      w: 20,
      z: 21,
    });
    assert.equal(Object.keys(out).length, 20);
    assert.equal((out['a'] as string).length, 500);
    assert.equal(out['b'], 1);
    assert.equal(out['c'], true);
    assert.equal(out['d'], null);
    assert.equal(out['z'], undefined);
  });

  test('stringifies nested objects and excludes keys', () => {
    const out = boundedMeta(
      { stack: 'secret', nested: { deep: true }, label: 'ok' },
      { excludeKeys: ['stack'] },
    );
    assert.equal(out['stack'], undefined);
    assert.equal(out['label'], 'ok');
    assert.match(String(out['nested']), /deep/);
  });
});
