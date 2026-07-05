#!/usr/bin/env node
/**
 * Fails if the vendored stylesheet has drifted from the canonical one.
 *
 * frontend/src/vendor/interop.css is a build-context-local copy of
 * project/styles.css (the Docker build context is frontend/ only). They must be
 * kept identical; this guard is meant to run in CI and locally.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonical = join(root, 'project/styles.css');
const vendored = join(root, 'frontend/src/vendor/interop.css');

const a = readFileSync(canonical, 'utf8');
const b = readFileSync(vendored, 'utf8');

if (a !== b) {
  console.error('✗ frontend/src/vendor/interop.css is out of sync with project/styles.css');
  console.error('  Re-vendor it: cp project/styles.css frontend/src/vendor/interop.css');
  process.exit(1);
}

console.log('✓ frontend/src/vendor/interop.css matches project/styles.css');
