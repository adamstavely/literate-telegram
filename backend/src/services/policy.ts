import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';
import { DEFAULT_POLICY_DOCUMENT } from '../data/default-policy.js';
import {
  PolicyDocument,
  PolicyRule,
  RegistryEntry,
  RiskLevel,
  Server,
  Tool,
  Skill,
} from '../types/index.js';

const POLICY_DOC_ID = 'default';

/** Thrown when a policy save conflicts with a concurrent update. */
export class PolicyVersionConflictError extends Error {
  constructor() {
    super('Policy was modified concurrently');
    this.name = 'PolicyVersionConflictError';
  }
}

export interface PolicySaveOptions {
  ifSeqNo?: number;
  ifPrimaryTerm?: number;
}

let cachedPolicy: PolicyDocument | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30_000;

/** Clear the in-memory policy cache (used by route tests). */
export function resetPolicyCache(): void {
  cachedPolicy = null;
  cacheTime = 0;
}

function publisherDomain(publisher: string | undefined): string | null {
  if (!publisher) return null;
  const at = publisher.lastIndexOf('@');
  if (at !== -1) return publisher.slice(at + 1).toLowerCase();
  if (publisher.includes('.')) return publisher.toLowerCase();
  return null;
}

/**
 * Canonicalize an auth method label to the keys used in the policy `auth` map.
 * Seed/registry data uses machine values ('oauth2', 'api-key', 'none') while the
 * policy document keys are display strings ('OAuth 2.1', 'API key', 'None'), so
 * a naive lookup silently misses every prohibition. Normalizing bridges both.
 */
function normalizeAuthMethod(auth: string | undefined): string {
  if (!auth) return 'None';
  const key = auth.trim().toLowerCase().replace(/[\s._-]+/g, '');
  const map: Record<string, string> = {
    none: 'None',
    oauth2: 'OAuth 2.1',
    oauth21: 'OAuth 2.1',
    apikey: 'API key',
    restrictedapikey: 'Restricted API key',
    bottoken: 'Bot token',
    connectionstring: 'Connection string',
  };
  return map[key] ?? auth;
}

function severityScore(severity: PolicyRule['severity'], action: PolicyRule['action']): number {
  if (action === 'block' || action === 'reject') return severity === 'high' ? 4 : 3;
  if (action === 'review') return severity === 'high' ? 3 : 2;
  return severity === 'high' ? 2 : 1;
}

/** Match custom rule cond strings against entry text using significant keywords. */
function evaluateCustomCond(cond: string, text: string): boolean {
  const keywords = cond
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  if (keywords.length === 0) return false;
  return keywords.some((kw) => text.includes(kw));
}

function evaluateRule(
  rule: PolicyRule,
  entry: Partial<RegistryEntry>,
  doc: PolicyDocument,
): string | null {
  if (!rule.enabled) return null;

  const text = `${entry.name ?? ''} ${entry.summary ?? ''} ${entry.description ?? ''}`.toLowerCase();

  switch (rule.id) {
    case 'arbitrary-exec':
      if (entry.type === 'tool' && /\b(shell|eval|exec|execute|run_command|subprocess)\b/.test(text)) {
        return rule.flag;
      }
      break;
    case 'no-sandbox':
      if (entry.type === 'server') {
        const server = entry as Server;
        if (server.transports?.includes('stdio')) return rule.flag;
      }
      break;
    case 'write-default':
      if (entry.type === 'tool' && (entry as Tool).readOnly === false) return rule.flag;
      break;
    case 'broad-scope': {
      const server = entry as Server;
      const auth = server.auth?.toLowerCase() ?? '';
      if (auth.includes('admin') || auth.includes('file:read')) return rule.flag;
      break;
    }
    case 'unverified-domain': {
      const domain = publisherDomain(entry.publisher);
      if (domain) {
        const trusted = doc.domains.some(d => d.d === domain && d.verified);
        if (!trusted) return rule.flag;
      }
      break;
    }
    case 'destructive-verbs':
      if (entry.type === 'tool' && /^(delete|drop|purge)_/i.test(entry.name ?? '')) {
        return rule.flag;
      }
      break;
    case 'internal-visibility':
      if (entry.sensitivity === 'internal' || entry.sensitivity === 'confidential') {
        return rule.flag;
      }
      break;
    case 'injection':
      if (entry.type === 'skill' && doc.policy.scanInjection) {
        const skill = entry as Skill;
        const body = `${skill.description ?? ''} ${(skill.triggers ?? []).join(' ')}`.toLowerCase();
        if (
          /ignore (all )?previous|disregard (your )?instructions|you must (now )?call|system prompt/.test(
            body,
          )
        ) {
          return rule.flag;
        }
      }
      break;
    default:
      if (rule.cond && evaluateCustomCond(rule.cond, text)) {
        return rule.flag;
      }
      break;
  }

  return null;
}

function checkPolicyConstraints(
  entry: Partial<RegistryEntry>,
  doc: PolicyDocument,
  flags: string[],
): number {
  let extraScore = 0;

  if (entry.type === 'server') {
    const server = entry as Server;
    for (const transport of server.transports ?? []) {
      if (doc.policy.transports[transport] === false) {
        flags.push(`Transport not permitted: ${transport}`);
        extraScore += 2;
      }
    }
    const authMethod = normalizeAuthMethod(server.auth);
    if (doc.policy.auth[authMethod] === false) {
      flags.push(`Auth method not permitted: ${authMethod}`);
      extraScore += 2;
    }
  }

  if (entry.type === 'skill' && doc.policy.requireTriggers) {
    const skill = entry as Skill;
    if (!skill.triggers?.length) {
      flags.push('Skill missing trigger phrases');
      extraScore += 1;
    }
  }

  return extraScore;
}

/**
 * Load the active policy. The cache is process-local (each replica caches
 * independently for up to CACHE_TTL_MS), which is fine for the high-frequency
 * submission path but not for governance decisions — pass forceFresh at approve
 * time so an approval never runs against a stale policy on one replica.
 */
export async function getPolicy(forceFresh = false): Promise<PolicyDocument> {
  const now = Date.now();
  if (!forceFresh && cachedPolicy && now - cacheTime < CACHE_TTL_MS) {
    return cachedPolicy;
  }

  try {
    const response = await esClient.get<PolicyDocument>({
      index: INDEX_NAMES.POLICY,
      id: POLICY_DOC_ID,
    });

    if (response._source) {
      const doc: PolicyDocument = {
        ...response._source,
        _seqNo: response._seq_no,
        _primaryTerm: response._primary_term,
      };
      cachedPolicy = doc;
      cacheTime = now;
      return doc;
    }
  } catch {
    // Index or document may not exist yet — fall through to default.
  }

  return { ...DEFAULT_POLICY_DOCUMENT };
}

export async function savePolicy(
  doc: Omit<PolicyDocument, 'id' | 'updatedAt' | 'updatedBy' | '_seqNo' | '_primaryTerm'>,
  updatedBy: string,
  opts: PolicySaveOptions = {},
): Promise<PolicyDocument> {
  const saved: PolicyDocument = {
    id: POLICY_DOC_ID,
    ...doc,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  const writeParams = {
    index: INDEX_NAMES.POLICY,
    id: POLICY_DOC_ID,
    document: saved,
    refresh: 'wait_for' as const,
    ...(opts.ifSeqNo !== undefined && opts.ifPrimaryTerm !== undefined
      ? { if_seq_no: opts.ifSeqNo, if_primary_term: opts.ifPrimaryTerm }
      : {}),
  };

  try {
    const result = await esClient.index(writeParams);
    saved._seqNo = result._seq_no;
    saved._primaryTerm = result._primary_term;
  } catch (err) {
    const e = err as { statusCode?: number; meta?: { statusCode?: number } };
    if (e?.statusCode === 409 || e?.meta?.statusCode === 409) {
      throw new PolicyVersionConflictError();
    }
    throw err;
  }

  cachedPolicy = saved;
  cacheTime = Date.now();
  return saved;
}

export function assessRiskWithPolicy(
  entry: Partial<RegistryEntry>,
  doc: PolicyDocument,
): { risk: RiskLevel; flags: string[]; firedRules: PolicyRule[] } {
  const flags: string[] = [];
  let riskScore = checkPolicyConstraints(entry, doc, flags);

  if (entry.type === 'agent') {
    const agent = entry as { autonomy?: string };
    if (agent.autonomy === 'full') { riskScore += 3; flags.push('full-autonomy'); }
    if (agent.autonomy === 'high') { riskScore += 2; flags.push('high-autonomy'); }
  }

  if (entry.sensitivity === 'restricted') { riskScore += 3; flags.push('restricted-data'); }
  if (entry.sensitivity === 'confidential') { riskScore += 2; flags.push('confidential-data'); }

  const server = entry as { auth?: string };
  if (server.auth !== undefined && normalizeAuthMethod(server.auth) === 'None') {
    riskScore += 1;
    flags.push('no-auth');
  }

  const firedRules: PolicyRule[] = [];
  for (const rule of doc.rules) {
    const flag = evaluateRule(rule, entry, doc);
    if (flag) {
      flags.push(flag);
      riskScore += severityScore(rule.severity, rule.action);
      firedRules.push(rule);
    }
  }

  let risk: RiskLevel;
  if (riskScore >= 4) risk = 'critical';
  else if (riskScore >= 3) risk = 'high';
  else if (riskScore >= 1) risk = 'medium';
  else risk = 'low';

  return { risk, flags: [...new Set(flags)], firedRules };
}

export async function assessEntryRisk(
  entry: Partial<RegistryEntry>,
): Promise<{ risk: RiskLevel; flags: string[] }> {
  const doc = await getPolicy();
  const { risk, flags } = assessRiskWithPolicy(entry, doc);
  return { risk, flags };
}

/**
 * Governance decision for approving a pending entry against the active policy.
 *
 * The Policy page toggles and per-rule actions are meaningless unless something
 * reads them at approval time. This turns them into enforcement:
 *  - a fired rule with action 'reject' hard-blocks approval,
 *  - a fired rule with action 'block' (or quarantineHighRisk on a high/critical
 *    entry) blocks approval unless an admin explicitly overrides,
 *  - twoApproversHighRisk requires two distinct approvers on high/critical risk.
 */
export interface ApprovalEnforcement {
  risk: RiskLevel;
  flags: string[];
  /** Rule names whose action is 'reject' and which fired — approval is forbidden. */
  rejectRules: string[];
  /** Rule names whose action is 'block' and which fired — approval needs override. */
  blockRules: string[];
  /** High/critical entry while quarantineHighRisk is on — approval needs override. */
  quarantined: boolean;
  /** High/critical entry while twoApproversHighRisk is on — needs a second approver. */
  requiresTwoApprovers: boolean;
}

export function evaluatePolicyEnforcement(
  entry: Partial<RegistryEntry>,
  doc: PolicyDocument,
): ApprovalEnforcement {
  const { risk, flags, firedRules } = assessRiskWithPolicy(entry, doc);
  const highRisk = risk === 'high' || risk === 'critical';

  return {
    risk,
    flags,
    rejectRules: firedRules.filter((r) => r.action === 'reject').map((r) => r.name),
    blockRules: firedRules.filter((r) => r.action === 'block').map((r) => r.name),
    quarantined: doc.policy.quarantineHighRisk === true && highRisk,
    requiresTwoApprovers: doc.policy.twoApproversHighRisk === true && highRisk,
  };
}

/** Skill token budget enforced when policy.tokenCap is enabled. */
export const DEFAULT_MAX_SKILL_TOKENS = 8000;

/** True if the entry exposes any write-capable (non read-only) tool. */
function isWriteCapable(entry: Partial<RegistryEntry>): boolean {
  if (entry.type === 'tool') return (entry as Tool).readOnly === false;
  if (entry.type === 'server') {
    return ((entry as Server).tools ?? []).some((t) => t.readOnly === false);
  }
  return false;
}

/**
 * When the entry must next be re-reviewed, per policy.republishAfterDays.
 * Returns undefined when the toggle is off (0 / unset).
 */
export function reviewDueAt(doc: PolicyDocument, fromIso: string): string | undefined {
  const days = doc.policy.republishAfterDays;
  if (!days || days <= 0) return undefined;
  return new Date(new Date(fromIso).getTime() + days * 86_400_000).toISOString();
}

export function isPublisherDomainVerified(
  publisher: string | undefined,
  doc: PolicyDocument,
): boolean {
  const domain = publisherDomain(publisher);
  if (!domain) return false;
  return doc.domains.some((d) => d.d === domain && d.verified);
}

export interface SubmissionDecision {
  /** The entry after policy-driven adjustments (e.g. forced read-only). */
  entry: Partial<RegistryEntry>;
  /** Whether the entry may be published immediately without manual review. */
  autoApprove: boolean;
  /** Extra flags raised at submission time (e.g. token cap). */
  flags: string[];
  /** Names of fired 'reject'-action rules — the submission must be refused. */
  rejectRules: string[];
}

/**
 * Apply policy toggles that act at submission time, before an entry enters the
 * review queue. This makes the Policy page's submit-side switches real:
 *  - readOnlyDefault: mutating tools are forced read-only; enabling writes is an
 *    admin opt-in during review, never a submitter choice.
 *  - tokenCap: skills over the token budget are flagged and cannot auto-approve.
 *  - requireReview / autoApproveVerified / autoApproveSkills: decide whether a
 *    low-risk, un-flagged submission can publish immediately or must be queued.
 *
 * The remaining PolicyState fields (perToolApproval, blockWriteUntilReview,
 * defaultVisibility, republishAfterDays) describe install-time / lifecycle
 * behavior that the registry API does not own, so they remain declarative.
 */
export function applySubmissionPolicy(
  entry: Partial<RegistryEntry>,
  doc: PolicyDocument,
): SubmissionDecision {
  const flags: string[] = [];
  const adjusted: Partial<RegistryEntry> = { ...entry };

  // defaultVisibility — the submitter never sets visibility; policy does.
  adjusted.visibility = doc.policy.defaultVisibility;

  // readOnlyDefault — writes must be opted into by an admin, not the submitter.
  if (doc.policy.readOnlyDefault) {
    if (adjusted.type === 'tool') {
      (adjusted as Tool).readOnly = true;
    }
    if (adjusted.type === 'server' && Array.isArray((adjusted as Server).tools)) {
      (adjusted as Server).tools = (adjusted as Server).tools.map((t) => ({
        ...t,
        readOnly: true,
      }));
    }
  }

  // tokenCap — oversized skills are flagged so they can't slip through auto-approve.
  let tokenCapExceeded = false;
  if (doc.policy.tokenCap && adjusted.type === 'skill') {
    const tokens = (adjusted as Skill).tokens ?? 0;
    if (tokens > DEFAULT_MAX_SKILL_TOKENS) {
      tokenCapExceeded = true;
      flags.push(`Token cap exceeded (${tokens} > ${DEFAULT_MAX_SKILL_TOKENS})`);
    }
  }

  const { risk, firedRules } = assessRiskWithPolicy(adjusted, doc);
  const rejectRules = firedRules.filter((r) => r.action === 'reject').map((r) => r.name);
  // block/reject are hard; review-action rules must also gate the fast-path so
  // anything a moderator is meant to look at never auto-publishes.
  const gatingRule = firedRules.some(
    (r) => r.action === 'block' || r.action === 'reject' || r.action === 'review',
  );

  // Lifecycle toggles that force manual review rather than auto-publish:
  //  - blockWriteUntilReview: write-capable entries wait for a reviewer.
  //  - perToolApproval: a server's tools are each approved during review.
  const hasTools = adjusted.type === 'server' && ((adjusted as Server).tools?.length ?? 0) > 0;
  const lifecycleGate =
    (doc.policy.blockWriteUntilReview && isWriteCapable(adjusted)) ||
    (doc.policy.perToolApproval && hasTools);

  // An explicit category opt-in: trusted publisher, or the skills fast-path.
  const categoryAutoApprove =
    (doc.policy.autoApproveVerified && isPublisherDomainVerified(adjusted.publisher, doc)) ||
    (doc.policy.autoApproveSkills && adjusted.type === 'skill');

  const autoApprove =
    risk === 'low' &&
    !gatingRule &&
    !lifecycleGate &&
    !tokenCapExceeded &&
    rejectRules.length === 0 &&
    (!doc.policy.requireReview || categoryAutoApprove);

  return { entry: adjusted, autoApprove, flags, rejectRules };
}
