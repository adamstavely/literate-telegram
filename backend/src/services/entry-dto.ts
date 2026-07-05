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

function stringArray(value: unknown, maxLen = MAX_NESTED_STRING_LEN): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.slice(0, maxLen));
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
const REST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const GQL_METHODS = ['QUERY', 'MUTATION', 'SUBSCRIPTION'] as const;
const MAX_API_ENDPOINTS = 100;
const MAX_API_FIELD_LEN = 2048;
const MAX_TOOLS = 50;
const MAX_PARAMS = 50;
const MAX_TRIGGERS = 50;
const MAX_REACHES = 50;
const MAX_NESTED_STRING_LEN = 512;
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

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeApiEndpoint(
  raw: unknown,
  style: ApiStyle,
): { method: string; path: string; summary: string } | null {
  const e = (raw ?? {}) as RawBody;
  const method = (str(e['method']) ?? (style === 'GraphQL' ? 'QUERY' : 'GET')).toUpperCase();
  const allowed = style === 'GraphQL' ? GQL_METHODS : REST_METHODS;
  if (!(allowed as readonly string[]).includes(method)) return null;

  const path = (str(e['path']) ?? '').slice(0, MAX_API_FIELD_LEN);
  if (style === 'REST') {
    if (!path.startsWith('/') || !/^\/[\w\-./{}:]+$/.test(path)) return null;
  } else if (path && !/^[\w]+$/.test(path)) {
    return null;
  }

  return {
    method,
    path,
    summary: (str(e['summary']) ?? '').slice(0, 500),
  };
}

function sanitizeParams(value: unknown): ToolParam[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_PARAMS).map((raw) => {
    const p = (raw ?? {}) as RawBody;
    return {
      name: (str(p['name']) ?? '').slice(0, MAX_NESTED_STRING_LEN),
      type: (str(p['type']) ?? '').slice(0, MAX_NESTED_STRING_LEN),
      description: (str(p['description']) ?? '').slice(0, MAX_NESTED_STRING_LEN),
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
        tools: Array.isArray(body['tools'])
          ? body['tools'].slice(0, MAX_TOOLS).map(sanitizeTool)
          : [],
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
        triggers: (stringArray(body['triggers']) ?? []).slice(0, MAX_TRIGGERS),
        reaches: (stringArray(body['reaches']) ?? []).slice(0, MAX_REACHES),
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
      const style = enumValue(body['style'], API_STYLES, 'REST');
      const entry: Record<string, unknown> = { ...base, style };
      const endpoint = str(body['endpoint']);
      if (endpoint !== undefined) {
        if (isValidHttpUrl(endpoint)) entry['endpoint'] = endpoint.slice(0, MAX_API_FIELD_LEN);
      }
      const wrappedBy = str(body['wrappedBy']);
      if (wrappedBy !== undefined) entry['wrappedBy'] = wrappedBy.slice(0, MAX_API_FIELD_LEN);
      const baseUrl = str(body['baseUrl']);
      if (baseUrl !== undefined) {
        if (isValidHttpUrl(baseUrl)) entry['baseUrl'] = baseUrl.slice(0, MAX_API_FIELD_LEN);
      }
      const auth = str(body['auth']);
      if (auth !== undefined) entry['auth'] = auth.slice(0, 256);
      if (Array.isArray(body['endpoints'])) {
        entry['endpoints'] = body['endpoints']
          .slice(0, MAX_API_ENDPOINTS)
          .map((raw) => sanitizeApiEndpoint(raw, style))
          .filter((e): e is NonNullable<typeof e> => e !== null);
      }
      return entry as Partial<RegistryEntry>;
    }

    default:
      return base as Partial<RegistryEntry>;
  }
}
