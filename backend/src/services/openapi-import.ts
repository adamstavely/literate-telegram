import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI } from 'openapi-types';
import { ApiStyle, ApiEndpoint, EndpointParam, EndpointParamLocation, EndpointResponse } from '../types/index.js';
import { HttpError } from '../middleware/error-handler.js';

/**
 * Maps an OpenAPI 3.0/3.1 or Swagger 2.0 document into an `Api` draft (baseUrl,
 * auth label, and rich `endpoints[]`) used to pre-fill the register wizard and,
 * downstream, the interactive endpoint console. Internal `$ref`s are resolved;
 * external `$ref`s are NOT (see derefInternal) so a spec cannot trigger SSRF.
 */

export interface ApiDraft {
  name?: string;
  summary?: string;
  description?: string;
  version?: string;
  style: ApiStyle;
  baseUrl?: string;
  endpoint?: string;
  auth?: string;
  endpoints: ApiEndpoint[];
}

type Obj = Record<string, unknown>;

const MAX_ENDPOINTS = 100;
const MAX_PARAMS = 40;
const MAX_RESPONSES = 20;
const REST_HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function obj(v: unknown): Obj | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function s(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function toExample(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return undefined;
  }
}

/** Parse a raw spec string (JSON or YAML) into an object. */
export function parseSpecText(text: string): Obj {
  const trimmed = text.trim();
  let parsed: unknown;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new HttpError(400, 'Spec is not valid JSON');
    }
  } else {
    try {
      parsed = yaml.load(trimmed);
    } catch {
      throw new HttpError(400, 'Spec is not valid YAML or JSON');
    }
  }
  const o = obj(parsed);
  if (!o) throw new HttpError(400, 'Spec must be a JSON/YAML object');
  return o;
}

/** Resolve internal ($ref: '#/...') references only; never fetch external refs. */
async function derefInternal(spec: Obj): Promise<Obj> {
  try {
    const cloned = JSON.parse(JSON.stringify(spec)) as unknown as OpenAPI.Document;
    const result = await SwaggerParser.dereference(cloned, {
      resolve: { external: false },
      dereference: { circular: 'ignore' },
    });
    return obj(result) ?? spec;
  } catch {
    // Lenient: map the raw document; any unresolved $refs are simply skipped.
    return spec;
  }
}

function detectVersion(spec: Obj): '3' | '2' {
  if (typeof spec['openapi'] === 'string' && (spec['openapi'] as string).startsWith('3')) return '3';
  if (spec['swagger'] === '2.0') return '2';
  throw new HttpError(400, 'Unrecognized document — expected OpenAPI 3.x or Swagger 2.0');
}

function baseUrlFor(spec: Obj, version: '3' | '2'): string | undefined {
  if (version === '3') {
    const server = obj(arr(spec['servers'])[0]);
    return server ? s(server['url'])?.replace(/\/$/, '') : undefined;
  }
  const host = s(spec['host']);
  if (!host) return undefined;
  const scheme = s(arr(spec['schemes'])[0]) ?? 'https';
  const basePath = s(spec['basePath']) ?? '';
  return `${scheme}://${host}${basePath}`.replace(/\/$/, '');
}

function authLabel(spec: Obj, version: '3' | '2'): string | undefined {
  const schemes =
    version === '3' ? obj(obj(spec['components'])?.['securitySchemes']) : obj(spec['securityDefinitions']);
  if (!schemes) return undefined;
  const first = obj(Object.values(schemes)[0]);
  if (!first) return undefined;
  const type = s(first['type']);
  switch (type) {
    case 'http':
      return s(first['scheme'])?.toLowerCase() === 'bearer' ? 'Bearer token' : 'Basic auth';
    case 'basic':
      return 'Basic auth';
    case 'apiKey':
      return 'API key';
    case 'oauth2':
      return 'OAuth 2.0';
    case 'openIdConnect':
      return 'OpenID Connect';
    default:
      return type ? `Auth: ${type}` : undefined;
  }
}

function mapParam(raw: unknown): EndpointParam | null {
  const p = obj(raw);
  if (!p) return null;
  const name = s(p['name']);
  const location = s(p['in']);
  if (!name || !location) return null;
  if (!['path', 'query', 'header'].includes(location)) return null; // body/cookie handled elsewhere
  const schema = obj(p['schema']);
  const type = s(schema?.['type']) ?? s(p['type']) ?? 'string';
  const param: EndpointParam = {
    name,
    in: location as EndpointParamLocation,
    type,
    required: p['required'] === true || location === 'path',
  };
  const description = s(p['description']);
  if (description) param.description = description;
  const example = toExample(p['example'] ?? schema?.['example']);
  if (example !== undefined) param.example = example;
  return param;
}

function bodyFieldsFromSchema(schema: Obj | undefined): EndpointParam[] {
  const props = obj(schema?.['properties']);
  if (!props) return [];
  const required = new Set(arr(schema?.['required']).filter((x): x is string => typeof x === 'string'));
  return Object.entries(props)
    .slice(0, MAX_PARAMS)
    .map(([name, raw]): EndpointParam => {
      const prop = obj(raw) ?? {};
      const field: EndpointParam = {
        name,
        in: 'body',
        type: s(prop['type']) ?? 'object',
        required: required.has(name),
      };
      const description = s(prop['description']);
      if (description) field.description = description;
      const example = toExample(prop['example']);
      if (example !== undefined) field.example = example;
      return field;
    });
}

function mapEndpoint(
  path: string,
  method: string,
  op: Obj,
  pathParams: unknown[],
  version: '3' | '2',
): ApiEndpoint {
  const endpoint: ApiEndpoint = { method: method.toUpperCase(), path, summary: s(op['summary']) ?? '' };
  const operationId = s(op['operationId']);
  if (operationId) endpoint.operationId = operationId;
  const description = s(op['description']);
  if (description) endpoint.description = description;

  // Params: path-level + operation-level (path/query/header).
  const rawParams = [...pathParams, ...arr(op['parameters'])];
  const params = rawParams.map(mapParam).filter((p): p is EndpointParam => p !== null).slice(0, MAX_PARAMS);
  if (params.length > 0) endpoint.params = params;

  // Request body: OpenAPI 3 requestBody.content, or Swagger 2 in:'body'/formData.
  if (version === '3') {
    const content = obj(obj(op['requestBody'])?.['content']);
    const json = obj(content?.['application/json']) ?? (content ? obj(Object.values(content)[0]) : undefined);
    if (json) {
      const schema = obj(json['schema']);
      const fields = bodyFieldsFromSchema(schema);
      const example = toExample(json['example'] ?? schema?.['example']);
      const contentType = content && obj(content['application/json']) ? 'application/json' : s(Object.keys(content ?? {})[0]);
      if (fields.length > 0 || example !== undefined) {
        endpoint.requestBody = {
          ...(contentType ? { contentType } : {}),
          ...(fields.length > 0 ? { fields } : {}),
          ...(example !== undefined ? { example } : {}),
        };
      }
    }
  } else {
    const bodyParam = arr(op['parameters']).map(obj).find((p) => p && p['in'] === 'body');
    const schema = obj(bodyParam?.['schema']);
    const fields = bodyFieldsFromSchema(schema);
    if (fields.length > 0) endpoint.requestBody = { contentType: 'application/json', fields };
  }

  // Responses.
  const responses = obj(op['responses']);
  if (responses) {
    const mapped: EndpointResponse[] = Object.entries(responses)
      .slice(0, MAX_RESPONSES)
      .map(([code, raw]): EndpointResponse => {
        const r = obj(raw) ?? {};
        const resp: EndpointResponse = { code };
        const desc = s(r['description']);
        if (desc) resp.description = desc;
        let exVal: unknown;
        if (version === '3') {
          const json = obj(obj(r['content'])?.['application/json']);
          const examples = obj(json?.['examples']);
          const firstExample = examples ? obj(Object.values(examples)[0]) : undefined;
          exVal = json?.['example'] ?? firstExample?.['value'] ?? obj(json?.['schema'])?.['example'];
        } else {
          exVal = obj(r['examples'])?.['application/json'] ?? obj(r['schema'])?.['example'];
        }
        const example = toExample(exVal);
        if (example !== undefined) resp.example = example;
        return resp;
      });
    if (mapped.length > 0) endpoint.responses = mapped;
  }

  return endpoint;
}

/** Map a parsed spec object → Api draft. */
export async function mapSpecToDraft(rawSpec: Obj): Promise<ApiDraft> {
  const version = detectVersion(rawSpec);
  const spec = await derefInternal(rawSpec);

  const info = obj(spec['info']) ?? {};
  const draft: ApiDraft = { style: 'REST', endpoints: [] };
  const name = s(info['title']);
  if (name) draft.name = name;
  const description = s(info['description']);
  if (description) draft.description = description;
  const summary = s(info['summary']) ?? description;
  if (summary) draft.summary = summary.slice(0, 500);
  const apiVersion = s(info['version']);
  if (apiVersion) draft.version = apiVersion;

  const baseUrl = baseUrlFor(spec, version);
  if (baseUrl) {
    draft.baseUrl = baseUrl;
    draft.endpoint = baseUrl;
  }
  const auth = authLabel(spec, version);
  if (auth) draft.auth = auth;

  const paths = obj(spec['paths']) ?? {};
  for (const [path, rawItem] of Object.entries(paths)) {
    if (draft.endpoints.length >= MAX_ENDPOINTS) break;
    const item = obj(rawItem);
    if (!item) continue;
    const pathParams = arr(item['parameters']);
    for (const method of REST_HTTP_METHODS) {
      const op = obj(item[method]);
      if (!op) continue;
      if (draft.endpoints.length >= MAX_ENDPOINTS) break;
      draft.endpoints.push(mapEndpoint(path, method, op, pathParams, version));
    }
  }

  return draft;
}

/** Parse a raw spec string and map it to an Api draft. */
export async function importSpecFromText(text: string): Promise<ApiDraft> {
  return mapSpecToDraft(parseSpecText(text));
}
