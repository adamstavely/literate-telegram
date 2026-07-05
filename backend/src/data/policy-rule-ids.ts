import { DEFAULT_POLICY_DOCUMENT } from './default-policy.js';

/** Rule IDs with dedicated evaluators in evaluateRule(). */
export const SUPPORTED_POLICY_RULE_IDS: readonly string[] = DEFAULT_POLICY_DOCUMENT.rules.map(
  (r) => r.id,
);

/** Custom rule IDs must match this pattern and include a cond string at save time. */
export const CUSTOM_POLICY_RULE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
