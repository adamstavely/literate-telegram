import {
  EntryType,
  RegistryEntry,
  SensitivityLevel,
  TransportType,
  AutonomyLevel,
  ApiStyle,
  ToolParam,
  Tool,
} from '../types/index.js';

/**
 * Explicit allowlist mapping for entry submissions.
 *
 * Submissions arrive as untrusted JSON. Spreading `req.body` directly lets a
 * caller inject server-controlled fields (verified, installs, rating) or
 * arbitrary nested data that the pending index (dynamic: true on `entry`) would
 * happily store. We instead pick only the fields a submitter is allowed to set,
 * per entry type, and let the route layer stamp the server-controlled ones.
 */

type RawBody = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === 'string');
}

/** Keep only values that are members of the allowed set. */
function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function enumArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v));
}

const TRANSPORTS: readonly TransportType[] = ['stdio', 'http', 'sse'];
const AUTONOMY: readonly AutonomyLevel[] = ['low', 'medium', 'high', 'full'];
const API_STYLES: readonly ApiStyle[] = ['REST', 'GraphQL'];
const SENSITIVITIES: readonly SensitivityLevel[] = [
  'public',
  'internal',
  'confidential',
  'restricted',
];

function boolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sanitizeParams(value: unknown): ToolParam[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const p = (raw ?? {}) as RawBody;
    return {
      name: str(p['name']) ?? '',
      type: str(p['type']) ?? '',
      description: str(p['description']) ?? '',
      required: boolean(p['required']) ?? false,
    };
  });
}

function sanitizeTool(raw: unknown): Partial<Tool> {
  const t = (raw ?? {}) as RawBody;
  return {
    type: 'tool',
    name: str(t['name']) ?? '',
    slug: str(t['slug']) ?? '',
    summary: str(t['summary']) ?? '',
    description: str(t['description']) ?? '',
    parentServer: str(t['parentServer']) ?? '',
    returns: str(t['returns']) ?? '',
    readOnly: boolean(t['readOnly']) ?? true,
    params: sanitizeParams(t['params']),
    // Submitter never controls trust/popularity signals on nested tools.
    verified: false,
    installs: 0,
  };
}

/** Fields any submitter may set, common to every entry type. */
function pickBaseFields(body: RawBody): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: str(body['type']) as EntryType,
    name: str(body['name']),
    slug: str(body['slug']),
    publisher: str(body['publisher']),
    summary: str(body['summary']),
    description: str(body['description']),
    sensitivity: enumValue(body['sensitivity'], SENSITIVITIES, 'public'),
    categories: stringArray(body['categories']) ?? [],
  };
  const version = str(body['version']);
  if (version !== undefined) base['version'] = version;
  return base;
}

/**
 * Build a sanitized entry from an untrusted submission body. Only allowlisted,
 * type-appropriate fields survive; server-controlled fields (id, verified,
 * installs, ratings, timestamps) are the caller's responsibility to stamp.
 */
export function sanitizeSubmission(body: RawBody): Partial<RegistryEntry> {
  const type = str(body['type']) as EntryType | undefined;
  const base = pickBaseFields(body);

  switch (type) {
    case 'server':
      return {
        ...base,
        transports: enumArray(body['transports'], TRANSPORTS),
        auth: str(body['auth']) ?? 'None',
        clients: stringArray(body['clients']) ?? [],
        license: str(body['license']) ?? '',
        source: str(body['source']) ?? '',
        tools: Array.isArray(body['tools']) ? body['tools'].map(sanitizeTool) : [],
        // rating is a server-controlled popularity signal, never submitter-set.
        rating: 0,
      } as Partial<RegistryEntry>;

    case 'tool':
      return {
        ...base,
        parentServer: str(body['parentServer']) ?? '',
        returns: str(body['returns']) ?? '',
        readOnly: boolean(body['readOnly']) ?? true,
        params: sanitizeParams(body['params']),
      } as Partial<RegistryEntry>;

    case 'skill':
      return {
        ...base,
        triggers: stringArray(body['triggers']) ?? [],
        reaches: stringArray(body['reaches']) ?? [],
        tokens: finiteNumber(body['tokens']) ?? 0,
      } as Partial<RegistryEntry>;

    case 'agent':
      return {
        ...base,
        model: str(body['model']) ?? '',
        autonomy: enumValue(body['autonomy'], AUTONOMY, 'low'),
        servers: stringArray(body['servers']) ?? [],
        skills: stringArray(body['skills']) ?? [],
      } as Partial<RegistryEntry>;

    case 'api': {
      const entry: Record<string, unknown> = {
        ...base,
        style: enumValue(body['style'], API_STYLES, 'REST'),
      };
      const endpoint = str(body['endpoint']);
      if (endpoint !== undefined) entry['endpoint'] = endpoint;
      const wrappedBy = str(body['wrappedBy']);
      if (wrappedBy !== undefined) entry['wrappedBy'] = wrappedBy;
      return entry as Partial<RegistryEntry>;
    }

    default:
      return base as Partial<RegistryEntry>;
  }
}
