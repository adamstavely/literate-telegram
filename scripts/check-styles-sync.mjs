#!/usr/bin/env node
/**
 * Fails if vendored stylesheets have drifted from the canonical project/styles.css.
 *
 * - frontend/src/vendor/interop.css — Docker build context is frontend/ only
 * - docs/src/styles/interop.css — Astro docs site vendors the same tokens/components
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonical = readFileSync(join(root, 'project/styles.css'), 'utf8');

const vendoredPaths = [
  join(root, 'frontend/src/vendor/interop.css'),
  join(root, 'docs/src/styles/interop.css'),
];

let failed = false;
for (const path of vendoredPaths) {
  const vendored = readFileSync(path, 'utf8');
  if (canonical !== vendored) {
    console.error(`✗ ${path.replace(root + '/', '')} is out of sync with project/styles.css`);
    failed = true;
  } else {
    console.log(`✓ ${path.replace(root + '/', '')} matches project/styles.css`);
  }
}

if (failed) {
  console.error('');
  console.error('Re-vendor:');
  console.error('  cp project/styles.css frontend/src/vendor/interop.css');
  console.error('  cp project/styles.css docs/src/styles/interop.css');
  console.error('  # or: node docs/scripts/sync-interop-styles.mjs');
  process.exit(1);
}
