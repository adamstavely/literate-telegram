#!/usr/bin/env node
/**
 * Validates Helm-rendered NetworkPolicy resources for expected connectivity rules.
 * Runs in CI after `helm template` — no cluster required.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function renderManifest() {
  return execSync(
    'helm template interop ./helm --set elasticsearch.password=ci-test-password',
    { cwd: root, encoding: 'utf8' },
  );
}

function splitDocuments(yaml) {
  return yaml
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter(Boolean);
}

function parseSimpleYaml(doc) {
  const kind = doc.match(/^kind:\s*(.+)$/m)?.[1]?.trim();
  const name = doc.match(/^metadata:\s*\n\s*name:\s*(.+)$/m)?.[1]?.trim();
  return { kind, name, doc };
}

const manifest = renderManifest();
const docs = splitDocuments(manifest);
const policies = docs
  .map(parseSimpleYaml)
  .filter((d) => d.kind === 'NetworkPolicy');

if (policies.length < 3) {
  console.error(`✗ Expected at least 3 NetworkPolicies, found ${policies.length}`);
  process.exit(1);
}

const byName = Object.fromEntries(policies.map((p) => [p.name, p.doc]));

const checks = [
  {
    suffix: '-backend',
    mustInclude: ['policyTypes:', '- Egress', 'port: 9200', 'port: 3000'],
    label: 'backend allows ES egress and receives frontend/seed ingress',
  },
  {
    suffix: '-frontend',
    mustInclude: ['policyTypes:', '- Egress', 'port: 3000'],
    label: 'frontend egress to backend',
  },
  {
    suffix: '-elasticsearch',
    mustInclude: ['policyTypes:', '- Egress', 'port: 9200', 'port: 53'],
    mustNotInclude: ['curlimages/curl'],
    label: 'elasticsearch ingress from backend/seed and restricted egress',
  },
];

for (const check of checks) {
  const match = Object.entries(byName).find(([name]) => name.endsWith(check.suffix));
  if (!match) {
    console.error(`✗ Missing NetworkPolicy matching *${check.suffix}`);
    process.exit(1);
  }
  const [, doc] = match;
  for (const needle of check.mustInclude) {
    if (!doc.includes(needle)) {
      console.error(`✗ ${check.label}: expected "${needle}" in ${match[0]}`);
      process.exit(1);
    }
  }
  for (const needle of check.mustNotInclude ?? []) {
    if (doc.includes(needle)) {
      console.error(`✗ ${check.label}: unexpected "${needle}" in ${match[0]}`);
      process.exit(1);
    }
  }
}

console.log(`✓ ${policies.length} NetworkPolicies passed connectivity structure checks`);
