import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const nginxHeaders = readFileSync(
  join(repoRoot, 'frontend/nginx-security-headers.conf'),
  'utf8',
);
const nginxConf = readFileSync(join(repoRoot, 'frontend/nginx.conf'), 'utf8');

describe('nginx security header coverage', () => {
  test('CSP includes object-src and form-action hardening', () => {
    assert.match(nginxHeaders, /object-src 'none'/);
    assert.match(nginxHeaders, /form-action 'self'/);
  });

  test('/api/ proxy location includes shared security headers', () => {
    assert.match(nginxConf, /location \/api\//);
    assert.match(nginxConf, /include \/etc\/nginx\/nginx-security-headers\.conf;/);
  });

  test('/docs location serves Astro static HTML with security headers', () => {
    assert.match(nginxConf, /location \^~ \/docs/);
    assert.match(nginxConf, /try_files \$uri \$uri\/ \$uri\/index\.html =404;/);
  });
});
