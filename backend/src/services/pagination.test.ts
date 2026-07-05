import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, paginationFrom, ES_MAX_RESULT_WINDOW } from './pagination.js';

describe('pagination', () => {
  test('clampPage keeps from + size within the ES result window', () => {
    assert.equal(clampPage(0, 100), 0);
    assert.equal(clampPage(99, 100), 99);
    assert.equal(clampPage(100, 100), 99);
    assert.equal(clampPage(999, 100), 99);
  });

  test('paginationFrom uses the clamped page', () => {
    assert.equal(paginationFrom(100, 100), 9900);
    assert.equal(paginationFrom(100, 100) + 100, ES_MAX_RESULT_WINDOW);
  });
});
