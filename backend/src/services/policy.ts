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

let cachedPolicy: PolicyDocument | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30_000;

function publisherDomain(publisher: string | undefined): string | null {
  if (!publisher) return null;
  const at = publisher.lastIndexOf('@');
  if (at !== -1) return publisher.slice(at + 1).toLowerCase();
  if (publisher.includes('.')) return publisher.toLowerCase();
  return null;
}

function severityScore(severity: PolicyRule['severity'], action: PolicyRule['action']): number {
  if (action === 'block' || action === 'reject') return severity === 'high' ? 4 : 3;
  if (action === 'review') return severity === 'high' ? 3 : 2;
  return severity === 'high' ? 2 : 1;
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
    const authMethod = server.auth ?? 'None';
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

export async function getPolicy(): Promise<PolicyDocument> {
  const now = Date.now();
  if (cachedPolicy && now - cacheTime < CACHE_TTL_MS) {
    return cachedPolicy;
  }

  try {
    const response = await esClient.get<PolicyDocument>({
      index: INDEX_NAMES.POLICY,
      id: POLICY_DOC_ID,
    });

    if (response._source) {
      cachedPolicy = response._source;
      cacheTime = now;
      return response._source;
    }
  } catch {
    // Index or document may not exist yet — fall through to default.
  }

  return { ...DEFAULT_POLICY_DOCUMENT };
}

export async function savePolicy(
  doc: Omit<PolicyDocument, 'id' | 'updatedAt' | 'updatedBy'>,
  updatedBy: string,
): Promise<PolicyDocument> {
  const saved: PolicyDocument = {
    id: POLICY_DOC_ID,
    ...doc,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await esClient.index({
    index: INDEX_NAMES.POLICY,
    id: POLICY_DOC_ID,
    document: saved,
    refresh: 'wait_for',
  });

  cachedPolicy = saved;
  cacheTime = Date.now();
  return saved;
}

export function assessRiskWithPolicy(
  entry: Partial<RegistryEntry>,
  doc: PolicyDocument,
): { risk: RiskLevel; flags: string[] } {
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
  if (server.auth === 'none' || server.auth === 'None') {
    riskScore += 1;
    flags.push('no-auth');
  }

  for (const rule of doc.rules) {
    const flag = evaluateRule(rule, entry, doc);
    if (flag) {
      flags.push(flag);
      riskScore += severityScore(rule.severity, rule.action);
    }
  }

  let risk: RiskLevel;
  if (riskScore >= 4) risk = 'critical';
  else if (riskScore >= 3) risk = 'high';
  else if (riskScore >= 1) risk = 'medium';
  else risk = 'low';

  return { risk, flags: [...new Set(flags)] };
}

export async function assessEntryRisk(
  entry: Partial<RegistryEntry>,
): Promise<{ risk: RiskLevel; flags: string[] }> {
  const doc = await getPolicy();
  return assessRiskWithPolicy(entry, doc);
}
