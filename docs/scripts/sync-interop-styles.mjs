#!/usr/bin/env node
/**
 * Vendors project/styles.css into docs/src/styles/interop.css.
 * Run from repo root: node docs/scripts/sync-interop-styles.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const canonical = join(root, 'project/styles.css');
const vendored = join(root, 'docs/src/styles/interop.css');

writeFileSync(vendored, readFileSync(canonical, 'utf8'));
console.log('✓ docs/src/styles/interop.css synced from project/styles.css');
