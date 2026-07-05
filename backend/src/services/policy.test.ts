import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessRiskWithPolicy,
  applySubmissionPolicy,
  evaluatePolicyEnforcement,
} from './policy.js';
import { DEFAULT_POLICY_DOCUMENT } from '../data/default-policy.js';
import { PolicyDocument, RegistryEntry } from '../types/index.js';

function clonePolicy(): PolicyDocument {
  return structuredClone(DEFAULT_POLICY_DOCUMENT);
}

describe('assessRiskWithPolicy — auth normalization', () => {
  test('machine auth value "none" is treated as the prohibited "None"', () => {
    const doc = clonePolicy(); // default: auth None = false
    const entry = {
      type: 'server',
      name: 'S',
      publisher: 'anthropic.com',
      sensitivity: 'public',
      auth: 'none',
      transports: ['http'],
    } as unknown as Partial<RegistryEntry>;

    const { flags } = assessRiskWithPolicy(entry, doc);
    assert.ok(flags.includes('no-auth'), 'no-auth flag should be raised');
    assert.ok(
      flags.some((f) => f.includes('Auth method not permitted: None')),
      'normalized auth prohibition should fire',
    );
  });
});

describe('applySubmissionPolicy', () => {
  test('readOnlyDefault forces a submitted writable tool to read-only', () => {
    const doc = clonePolicy(); // readOnlyDefault = true by default
    const entry = {
      type: 'tool',
      name: 'writer',
      publisher: 'anthropic.com',
      sensitivity: 'public',
      readOnly: false,
    } as unknown as Partial<RegistryEntry>;

    const decision = applySubmissionPolicy(entry, doc);
    assert.equal((decision.entry as { readOnly?: boolean }).readOnly, true);
  });

  test('tokenCap flags an oversized skill and blocks auto-approve', () => {
    const doc = clonePolicy(); // tokenCap = true
    const entry = {
      type: 'skill',
      name: 'big',
      publisher: 'anthropic.com',
      sensitivity: 'public',
      triggers: ['when asked'],
      tokens: 100000,
    } as unknown as Partial<RegistryEntry>;

    const decision = applySubmissionPolicy(entry, doc);
    assert.ok(decision.flags.some((f) => f.startsWith('Token cap exceeded')));
    assert.equal(decision.autoApprove, false);
  });

  test('autoApproveSkills fast-paths a low-risk skill', () => {
    const doc = clonePolicy();
    doc.policy.autoApproveSkills = true;
    const entry = {
      type: 'skill',
      name: 'safe',
      publisher: 'anthropic.com', // trusted domain → no unverified-domain flag
      sensitivity: 'public',
      triggers: ['when asked'],
      tokens: 100,
      description: 'a benign helpful skill',
    } as unknown as Partial<RegistryEntry>;

    const decision = applySubmissionPolicy(entry, doc);
    assert.equal(decision.autoApprove, true);
    assert.equal(decision.rejectRules.length, 0);
  });

  test('a fired reject-action rule surfaces in rejectRules', () => {
    const doc = clonePolicy();
    const execRule = doc.rules.find((r) => r.id === 'arbitrary-exec');
    assert.ok(execRule);
    execRule!.action = 'reject';
    const entry = {
      type: 'tool',
      name: 'run',
      publisher: 'anthropic.com',
      sensitivity: 'public',
      summary: 'this tool can exec shell commands',
      description: 'runs subprocess exec on the host',
    } as unknown as Partial<RegistryEntry>;

    const decision = applySubmissionPolicy(entry, doc);
    assert.ok(decision.rejectRules.includes(execRule!.name));
    assert.equal(decision.autoApprove, false);
  });
});

describe('evaluatePolicyEnforcement', () => {
  test('a high-risk entry is quarantined and needs two approvers', () => {
    const doc = clonePolicy(); // quarantineHighRisk + twoApproversHighRisk on
    const entry = {
      type: 'agent',
      name: 'autonomous',
      publisher: 'anthropic.com',
      sensitivity: 'restricted',
      autonomy: 'full',
    } as unknown as Partial<RegistryEntry>;

    const enforcement = evaluatePolicyEnforcement(entry, doc);
    assert.ok(enforcement.risk === 'high' || enforcement.risk === 'critical');
    assert.equal(enforcement.quarantined, true);
    assert.equal(enforcement.requiresTwoApprovers, true);
  });
});
