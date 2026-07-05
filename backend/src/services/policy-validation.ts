import {
  PolicyDocument,
  PolicyState,
  RuleAction,
  RuleSeverity,
  Visibility,
} from '../types/index.js';

const RULE_ACTIONS: readonly RuleAction[] = ['flag', 'review', 'block', 'reject'];
const RULE_SEVERITIES: readonly RuleSeverity[] = ['high', 'medium', 'low'];
const VISIBILITIES: readonly Visibility[] = ['private', 'org', 'public'];

const BOOLEAN_POLICY_KEYS: readonly (keyof PolicyState)[] = [
  'readOnlyDefault',
  'perToolApproval',
  'blockWriteUntilReview',
  'quarantineHighRisk',
  'requireReview',
  'autoApproveVerified',
  'autoApproveSkills',
  'twoApproversHighRisk',
  'scanInjection',
  'requireTriggers',
  'tokenCap',
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isBoolMap(v: unknown): boolean {
  return isPlainObject(v) && Object.values(v).every((x) => typeof x === 'boolean');
}

/**
 * Structurally validate an incoming policy document before it is persisted.
 * `body('policy').isObject()` alone lets arbitrary shapes through, which then
 * drive real governance decisions — so every field is type-checked here.
 * Returns a list of human-readable errors (empty when valid).
 */
export function validatePolicyDocument(
  input: Pick<PolicyDocument, 'policy' | 'rules' | 'domains'>,
): string[] {
  const errors: string[] = [];
  const { policy, rules, domains } = input;

  if (!isPlainObject(policy)) {
    errors.push('policy must be an object');
  } else {
    for (const key of BOOLEAN_POLICY_KEYS) {
      if (typeof policy[key] !== 'boolean') errors.push(`policy.${key} must be a boolean`);
    }
    if (typeof policy.republishAfterDays !== 'number' || policy.republishAfterDays < 0) {
      errors.push('policy.republishAfterDays must be a non-negative number');
    }
    if (!VISIBILITIES.includes(policy.defaultVisibility)) {
      errors.push(`policy.defaultVisibility must be one of ${VISIBILITIES.join(', ')}`);
    }
    if (!isBoolMap(policy.transports)) {
      errors.push('policy.transports must be a map of string to boolean');
    }
    if (!isBoolMap(policy.auth)) {
      errors.push('policy.auth must be a map of string to boolean');
    }
  }

  if (!Array.isArray(rules)) {
    errors.push('rules must be an array');
  } else {
    rules.forEach((rule, i) => {
      if (!isPlainObject(rule)) {
        errors.push(`rules[${i}] must be an object`);
        return;
      }
      if (typeof rule['id'] !== 'string' || !rule['id']) errors.push(`rules[${i}].id must be a non-empty string`);
      if (typeof rule['name'] !== 'string') errors.push(`rules[${i}].name must be a string`);
      if (!RULE_SEVERITIES.includes(rule['severity'] as RuleSeverity)) {
        errors.push(`rules[${i}].severity must be one of ${RULE_SEVERITIES.join(', ')}`);
      }
      if (!RULE_ACTIONS.includes(rule['action'] as RuleAction)) {
        errors.push(`rules[${i}].action must be one of ${RULE_ACTIONS.join(', ')}`);
      }
      if (typeof rule['enabled'] !== 'boolean') errors.push(`rules[${i}].enabled must be a boolean`);
      if (rule['flag'] !== null && typeof rule['flag'] !== 'string') {
        errors.push(`rules[${i}].flag must be a string or null`);
      }
    });
  }

  if (!Array.isArray(domains)) {
    errors.push('domains must be an array');
  } else {
    domains.forEach((domain, i) => {
      if (!isPlainObject(domain)) {
        errors.push(`domains[${i}] must be an object`);
        return;
      }
      if (typeof domain['d'] !== 'string' || !domain['d']) errors.push(`domains[${i}].d must be a non-empty string`);
      if (typeof domain['verified'] !== 'boolean') errors.push(`domains[${i}].verified must be a boolean`);
    });
  }

  return errors;
}
