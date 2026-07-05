#!/usr/bin/env node
/**
 * Validates frontend nginx security header config:
 * - CSP present on SPA shell include
 * - HSTS not set on cleartext container listener (ingress owns HSTS)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const headers = readFileSync(join(root, 'frontend/nginx-security-headers.conf'), 'utf8');

if (!headers.includes('Content-Security-Policy')) {
  console.error('✗ nginx-security-headers.conf missing Content-Security-Policy');
  process.exit(1);
}

if (/Strict-Transport-Security/i.test(headers)) {
  console.error('✗ nginx-security-headers.conf must not set HSTS (use ingress TLS headers)');
  process.exit(1);
}

console.log('✓ nginx-security-headers.conf has CSP and no container HSTS');
