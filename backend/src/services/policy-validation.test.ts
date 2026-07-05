import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validatePolicyDocument } from './policy-validation.js';
import { DEFAULT_POLICY_DOCUMENT } from '../data/default-policy.js';

const validInput = () => {
  const { policy, rules, domains } = structuredClone(DEFAULT_POLICY_DOCUMENT);
  return { policy, rules, domains };
};

describe('validatePolicyDocument', () => {
  test('accepts the default policy document', () => {
    assert.deepEqual(validatePolicyDocument(validInput()), []);
  });

  test('rejects a non-boolean policy toggle', () => {
    const input = validInput();
    (input.policy as unknown as Record<string, unknown>)['readOnlyDefault'] = 'yes';
    const errors = validatePolicyDocument(input);
    assert.ok(errors.some((e) => e.includes('readOnlyDefault')));
  });

  test('rejects a bad defaultVisibility', () => {
    const input = validInput();
    (input.policy as unknown as Record<string, unknown>)['defaultVisibility'] = 'everyone';
    assert.ok(validatePolicyDocument(input).some((e) => e.includes('defaultVisibility')));
  });

  test('rejects a rule with an invalid action', () => {
    const input = validInput();
    input.rules[0]!.action = 'nuke' as never;
    assert.ok(validatePolicyDocument(input).some((e) => e.includes('action')));
  });

  test('rejects a domain missing verified', () => {
    const input = validInput();
    input.domains.push({ d: 'x.com' } as never);
    assert.ok(validatePolicyDocument(input).some((e) => e.includes('verified')));
  });

  test('rejects non-array rules/domains', () => {
    const errors = validatePolicyDocument({
      policy: validInput().policy,
      rules: {} as never,
      domains: 'nope' as never,
    });
    assert.ok(errors.some((e) => e.includes('rules must be an array')));
    assert.ok(errors.some((e) => e.includes('domains must be an array')));
  });
});
