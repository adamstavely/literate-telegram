import { DEFAULT_POLICY_DOCUMENT } from './default-policy.js';

/** Rule IDs the policy engine actually evaluates — unknown IDs are rejected at save time. */
export const SUPPORTED_POLICY_RULE_IDS: readonly string[] = DEFAULT_POLICY_DOCUMENT.rules.map(
  (r) => r.id,
);
