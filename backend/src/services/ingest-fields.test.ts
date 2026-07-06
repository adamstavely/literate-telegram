import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boundedIngestString,
  MAX_INGEST_URL_LEN,
  MAX_INGEST_UA_LEN,
} from './ingest-fields.js';

describe('ingest-fields', () => {
  test('boundedIngestString trims and truncates', () => {
    assert.equal(boundedIngestString('  hello  ', 10), 'hello');
    assert.equal(boundedIngestString('x'.repeat(20), 5), 'xxxxx');
  });

  test('exports sensible max lengths', () => {
    assert.ok(MAX_INGEST_URL_LEN >= 512);
    assert.ok(MAX_INGEST_UA_LEN >= 128);
  });
});
