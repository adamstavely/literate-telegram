import {
  EntryType,
  RegistryEntry,
  SensitivityLevel,
  TransportType,
  AutonomyLevel,
  ApiStyle,
  ToolParam,
  Tool,
  ApiEndpoint,
  EndpointParam,
  EndpointParamLocation,
  EndpointRequestBody,
  EndpointResponse,
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
const MAX_ENDPOINT_PARAMS = 40;
const MAX_ENDPOINT_RESPONSES = 20;
const MAX_ENDPOINT_EXAMPLE_LEN = 4096;
const PARAM_LOCATIONS: readonly EndpointParamLocation[] = [
  'path',
  'query',
  'header',
  'body',
  'variable',
];
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

function sanitizeEndpointParam(raw: unknown): EndpointParam | null {
  const p = (raw ?? {}) as RawBody;
  const name = (str(p['name']) ?? '').slice(0, MAX_NESTED_STRING_LEN);
  if (!name) return null;
  const param: EndpointParam = {
    name,
    in: enumValue(p['in'], PARAM_LOCATIONS, 'query'),
    type: (str(p['type']) ?? 'string').slice(0, MAX_NESTED_STRING_LEN),
    required: boolean(p['required']) ?? false,
  };
  const description = str(p['description']);
  if (description !== undefined) param.description = description.slice(0, MAX_NESTED_STRING_LEN);
  const example = str(p['example']);
  if (example !== undefined) param.example = example.slice(0, MAX_NESTED_STRING_LEN);
  return param;
}

function sanitizeEndpointParams(value: unknown): EndpointParam[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const params = value
    .slice(0, MAX_ENDPOINT_PARAMS)
    .map(sanitizeEndpointParam)
    .filter((p): p is EndpointParam => p !== null);
  return params.length > 0 ? params : undefined;
}

function sanitizeRequestBody(value: unknown): EndpointRequestBody | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const b = value as RawBody;
  const out: EndpointRequestBody = {};
  const contentType = str(b['contentType']);
  if (contentType !== undefined) out.contentType = contentType.slice(0, MAX_NESTED_STRING_LEN);
  const fields = sanitizeEndpointParams(b['fields']);
  if (fields) out.fields = fields;
  const example = str(b['example']);
  if (example !== undefined) out.example = example.slice(0, MAX_ENDPOINT_EXAMPLE_LEN);
  return out.contentType || out.fields || out.example ? out : undefined;
}

function sanitizeEndpointResponses(value: unknown): EndpointResponse[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const responses = value
    .slice(0, MAX_ENDPOINT_RESPONSES)
    .map((raw): EndpointResponse | null => {
      const r = (raw ?? {}) as RawBody;
      const code = (str(r['code']) ?? '').slice(0, 16);
      if (!code) return null;
      const resp: EndpointResponse = { code };
      const description = str(r['description']);
      if (description !== undefined) resp.description = description.slice(0, MAX_NESTED_STRING_LEN);
      const example = str(r['example']);
      if (example !== undefined) resp.example = example.slice(0, MAX_ENDPOINT_EXAMPLE_LEN);
      return resp;
    })
    .filter((r): r is EndpointResponse => r !== null);
  return responses.length > 0 ? responses : undefined;
}

function sanitizeApiEndpoint(raw: unknown, style: ApiStyle): ApiEndpoint | null {
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

  const endpoint: ApiEndpoint = {
    method,
    path,
    summary: (str(e['summary']) ?? '').slice(0, 500),
  };

  // Rich metadata (populated from an imported OpenAPI spec) — all optional.
  const operationId = str(e['operationId']);
  if (operationId !== undefined) endpoint.operationId = operationId.slice(0, MAX_NESTED_STRING_LEN);
  const description = str(e['description']);
  if (description !== undefined) endpoint.description = description.slice(0, MAX_NESTED_STRING_LEN);
  const params = sanitizeEndpointParams(e['params']);
  if (params) endpoint.params = params;
  const requestBody = sanitizeRequestBody(e['requestBody']);
  if (requestBody) endpoint.requestBody = requestBody;
  const responses = sanitizeEndpointResponses(e['responses']);
  if (responses) endpoint.responses = responses;

  return endpoint;
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
        auth: (str(body['auth']) ?? 'None').slice(0, MAX_API_FIELD_LEN),
        clients: stringArray(body['clients']) ?? [],
        license: (str(body['license']) ?? '').slice(0, MAX_API_FIELD_LEN),
        source: (str(body['source']) ?? '').slice(0, MAX_API_FIELD_LEN),
        tools: Array.isArray(body['tools'])
          ? body['tools'].slice(0, MAX_TOOLS).map(sanitizeTool)
          : [],
        // rating is a server-controlled popularity signal, never submitter-set.
        rating: 0,
      } as Partial<RegistryEntry>;

    case 'tool':
      return {
        ...base,
        parentServer: (str(body['parentServer']) ?? '').slice(0, MAX_API_FIELD_LEN),
        returns: (str(body['returns']) ?? '').slice(0, MAX_API_FIELD_LEN),
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
        model: (str(body['model']) ?? '').slice(0, MAX_API_FIELD_LEN),
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
