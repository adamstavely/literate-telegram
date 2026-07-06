import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedAddress, assertAllowedTarget, assertPublicHost } from './net-guard.js';

describe('net-guard isBlockedAddress', () => {
  test('blocks private, loopback, link-local, metadata, and reserved addresses', () => {
    const blocked = [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.9.9',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '0.0.0.0',
      '100.64.0.1', // CGNAT
      '255.255.255.255',
      '::1',
      '::',
      'fe80::1',
      'fc00::1',
      'fd12:3456:789a::1',
      '::ffff:127.0.0.1', // IPv4-mapped loopback
      '::127.0.0.1', // IPv4-compatible (::/96) loopback
      '2002:a9fe:a9fe::', // 6to4 embedding 169.254.169.254 (metadata)
      '2002:7f00:0001::', // 6to4 embedding 127.0.0.1
    ];
    for (const ip of blocked) {
      assert.equal(isBlockedAddress(ip), true, `${ip} should be blocked`);
    }
  });

  test('allows public addresses', () => {
    const allowed = [
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '2606:2800:220:1:248:1893:25c8:1946',
      '2002:0808:0808::', // 6to4 embedding public 8.8.8.8
    ];
    for (const ip of allowed) {
      assert.equal(isBlockedAddress(ip), false, `${ip} should be allowed`);
    }
  });

  test('assertPublicHost strips IPv6 literal brackets and blocks loopback', async () => {
    await assert.rejects(() => assertPublicHost('[::1]'));
    await assert.rejects(() => assertPublicHost('[::ffff:127.0.0.1]'));
  });

  test('assertPublicHost accepts a public IPv6 literal', async () => {
    await assert.doesNotReject(() => assertPublicHost('[2606:2800:220:1:248:1893:25c8:1946]'));
  });

  test('treats a non-IP string as unsafe', () => {
    assert.equal(isBlockedAddress('not-an-ip'), true);
  });
});

describe('net-guard assertAllowedTarget', () => {
  test('rejects non-http(s) schemes', () => {
    assert.throws(() => assertAllowedTarget('ftp://example.com'));
    assert.throws(() => assertAllowedTarget('file:///etc/passwd'));
    assert.throws(() => assertAllowedTarget('gopher://example.com'));
  });

  test('rejects plain http when https-only (default)', () => {
    assert.throws(() => assertAllowedTarget('http://example.com'));
  });

  test('accepts https and returns the parsed URL', () => {
    assert.equal(assertAllowedTarget('https://example.com/openapi.json').host, 'example.com');
  });

  test('rejects malformed URLs', () => {
    assert.throws(() => assertAllowedTarget('not a url'));
  });
});
