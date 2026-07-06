/**
 * Swagger-style endpoint spec synthesis, ported from the design prototype
 * (detail2.jsx). Given an API entry and one of its endpoints, derive the
 * parameters, request body, responses, and example request/response — plus a
 * live request builder for the "Try it out" console.
 */
import { Api, ApiEndpoint, EndpointParam } from '../types';

export type ParamLocation = 'path' | 'query' | 'body' | 'variable';

export interface EpParam {
  name: string;
  in: ParamLocation;
  type: string;
  required: boolean;
  desc: string;
  /** Seed value for the try-it form (from an imported spec example). */
  example?: string;
}

export interface EpResponse {
  code: string;
  tone: 'ok' | 'warn' | 'danger';
  label: string;
  desc: string;
}

export interface EndpointSpec {
  pathParams: EpParam[];
  query: EpParam[];
  body: EpParam[];
  bodyIn: ParamLocation;
  responses: EpResponse[];
  sample: string;
  example: string;
  isGql: boolean;
}

type Field = [name: string, type: string, required: boolean, desc: string];

/* Body-field library, keyed by the resource token in the path (or GraphQL op). */
const EP_BODY: Record<string, Field[]> = {
  charges: [['amount', 'integer', true, 'Amount to collect, in the smallest currency unit (e.g. cents).'], ['currency', 'string', true, 'Three-letter ISO currency code, lowercase.'], ['customer', 'string', false, 'ID of an existing customer to charge.'], ['description', 'string', false, 'An arbitrary string attached to the object.']],
  refunds: [['charge', 'string', true, 'The identifier of the charge to refund.'], ['amount', 'integer', false, 'A positive integer in cents; omit to refund in full.'], ['reason', 'enum', false, 'duplicate · fraudulent · requested_by_customer']],
  payouts: [['amount', 'integer', true, 'A positive integer in cents to pay out.'], ['currency', 'string', true, 'Three-letter ISO currency code.'], ['method', 'enum', false, 'standard · instant']],
  issues: [['title', 'string', true, 'The title of the issue.'], ['body', 'string', false, 'The contents of the issue, in Markdown.'], ['labels', 'string[]', false, 'Labels to associate with this issue.'], ['assignees', 'string[]', false, 'Logins for users to assign to this issue.']],
  merge: [['commit_title', 'string', false, 'Title for the automatic merge commit.'], ['merge_method', 'enum', false, 'merge · squash · rebase']],
  Messages: [['To', 'string', true, 'Destination phone number in E.164 format.'], ['From', 'string', true, 'A Twilio number or Messaging Service SID.'], ['Body', 'string', true, 'The text of the message, up to 1600 characters.']],
  Calls: [['To', 'string', true, 'The phone number to call, in E.164 format.'], ['From', 'string', true, 'A Twilio number that places the call.'], ['Url', 'string', true, 'A URL that returns TwiML for the call.']],
  issueCreate: [['teamId', 'ID!', true, 'The team the issue belongs to.'], ['title', 'String!', true, 'The issue title.'], ['description', 'String', false, 'Markdown body of the issue.'], ['priority', 'Int', false, '0 (none) – 4 (urgent).']],
  issueUpdate: [['id', 'ID!', true, 'The issue to update.'], ['stateId', 'ID', false, 'Move the issue to this workflow state.'], ['assigneeId', 'ID', false, 'Reassign the issue to this user.'], ['estimate', 'Int', false, 'Story-point estimate.']],
};

/* Query-param library for GET / list / query endpoints. */
const EP_QUERY: Record<string, Field[]> = {
  subscriptions: [['status', 'enum', false, 'active · past_due · canceled · all'], ['limit', 'integer', false, 'Number of objects to return (1–100). Default 10.'], ['starting_after', 'string', false, 'Cursor for pagination — an object ID.']],
  code: [['q', 'string', true, 'The search query, with optional qualifiers.'], ['per_page', 'integer', false, 'Results per page (max 100).'], ['page', 'integer', false, 'Page number of the results.']],
  IncomingPhoneNumbers: [['PageSize', 'integer', false, 'How many resources to return per page.'], ['Beta', 'boolean', false, 'Whether to include beta numbers.']],
  onecall: [['lat', 'number', true, 'Latitude, decimal (-90; 90).'], ['lon', 'number', true, 'Longitude, decimal (-180; 180).'], ['exclude', 'string', false, 'Comma-separated parts to omit: current,minutely,hourly,daily.'], ['units', 'enum', false, 'standard · metric · imperial'], ['appid', 'string', true, 'Your API key.']],
  weather: [['lat', 'number', true, 'Latitude, decimal (-90; 90).'], ['lon', 'number', true, 'Longitude, decimal (-180; 180).'], ['units', 'enum', false, 'standard · metric · imperial'], ['appid', 'string', true, 'Your API key.']],
  forecast: [['lat', 'number', true, 'Latitude, decimal (-90; 90).'], ['lon', 'number', true, 'Longitude, decimal (-180; 180).'], ['cnt', 'integer', false, 'Number of timestamps to return.'], ['appid', 'string', true, 'Your API key.']],
  issues: [['filter', 'IssueFilter', false, 'Structured filter for state, assignee, label, etc.'], ['first', 'Int', false, 'Return the first N results (pagination).']],
  cycles: [['teamId', 'ID', false, 'Restrict to cycles on one team.'], ['first', 'Int', false, 'Return the first N results.']],
};

/* Representative success bodies. Fallback generates a minimal object. */
const EP_SAMPLE: Record<string, string> = {
  charges: `{\n  "id": "ch_3P8x2aLk9Qf0",\n  "object": "charge",\n  "amount": 4200,\n  "currency": "usd",\n  "customer": "cus_Qf0b2Nk",\n  "paid": true,\n  "status": "succeeded",\n  "created": 1717286400\n}`,
  customers: `{\n  "id": "cus_Qf0b2Nk",\n  "object": "customer",\n  "email": "ada@acme.com",\n  "name": "Ada Lovelace",\n  "default_source": "card_1P8x",\n  "created": 1712000000\n}`,
  refunds: `{\n  "id": "re_3P8x2a",\n  "object": "refund",\n  "charge": "ch_3P8x2aLk9Qf0",\n  "amount": 4200,\n  "status": "succeeded",\n  "reason": "requested_by_customer"\n}`,
  subscriptions: `{\n  "object": "list",\n  "has_more": false,\n  "data": [\n    { "id": "sub_1P8x", "status": "active", "customer": "cus_Qf0b2Nk", "plan": "pro_monthly" },\n    { "id": "sub_1P7w", "status": "past_due", "customer": "cus_Ra12", "plan": "team_annual" }\n  ]\n}`,
  payouts: `{\n  "id": "po_1P8x",\n  "object": "payout",\n  "amount": 250000,\n  "currency": "usd",\n  "arrival_date": 1717372800,\n  "status": "in_transit",\n  "method": "standard"\n}`,
  repos: `{\n  "id": 40912,\n  "full_name": "acme/app",\n  "private": true,\n  "default_branch": "main",\n  "open_issues_count": 27,\n  "pushed_at": "2026-05-30T18:04:11Z"\n}`,
  issues: `{\n  "number": 482,\n  "state": "open",\n  "title": "Session token not refreshed on 401",\n  "html_url": "https://github.com/acme/app/issues/482",\n  "labels": [ { "name": "bug" } ],\n  "created_at": "2026-06-01T09:12:00Z"\n}`,
  pulls: `{\n  "number": 1284,\n  "state": "open",\n  "title": "Add retry to session refresh",\n  "additions": 84,\n  "deletions": 12,\n  "mergeable": true,\n  "draft": false\n}`,
  merge: `{\n  "sha": "e9c1a7b4f2",\n  "merged": true,\n  "message": "Pull Request successfully merged"\n}`,
  code: `{\n  "total_count": 2,\n  "items": [\n    { "path": "src/auth/session.ts", "repository": "acme/app" },\n    { "path": "src/api/login.ts", "repository": "acme/app" }\n  ]\n}`,
  Messages: `{\n  "sid": "SM8f1a2b3c",\n  "status": "queued",\n  "to": "+14155550100",\n  "from": "+14155550199",\n  "body": "Your code is 4821",\n  "date_created": "Sun, 01 Jun 2026 09:12:00 +0000"\n}`,
  Calls: `{\n  "sid": "CA9d2e3f",\n  "status": "queued",\n  "to": "+14155550100",\n  "from": "+14155550199",\n  "direction": "outbound-api"\n}`,
  IncomingPhoneNumbers: `{\n  "incoming_phone_numbers": [\n    { "sid": "PN1a2b", "phone_number": "+14155550199", "friendly_name": "Support line" }\n  ]\n}`,
  onecall: `{\n  "lat": 37.77,\n  "lon": -122.42,\n  "timezone": "America/Los_Angeles",\n  "current": { "temp": 17.4, "humidity": 72, "weather": [ { "main": "Clouds" } ] },\n  "daily": [ { "temp": { "min": 12.1, "max": 19.8 }, "summary": "Partly cloudy" } ]\n}`,
  weather: `{\n  "coord": { "lat": 37.77, "lon": -122.42 },\n  "weather": [ { "main": "Clouds", "description": "broken clouds" } ],\n  "main": { "temp": 17.4, "feels_like": 17.0, "humidity": 72 },\n  "name": "San Francisco"\n}`,
  forecast: `{\n  "cnt": 40,\n  "list": [\n    { "dt": 1717286400, "main": { "temp": 17.4 }, "weather": [ { "main": "Clouds" } ] }\n  ]\n}`,
  issue: `{\n  "data": {\n    "issue": {\n      "id": "iss_9f2a",\n      "identifier": "ENG-482",\n      "title": "Session token not refreshed on 401",\n      "state": { "name": "In Progress" },\n      "assignee": { "name": "Ada Lovelace" }\n    }\n  }\n}`,
  issueCreate: `{\n  "data": {\n    "issueCreate": {\n      "success": true,\n      "issue": { "id": "iss_9f2a", "identifier": "ENG-483", "url": "https://linear.app/acme/issue/ENG-483" }\n    }\n  }\n}`,
  issueUpdate: `{\n  "data": {\n    "issueUpdate": { "success": true, "issue": { "id": "iss_9f2a", "state": { "name": "Done" } } }\n  }\n}`,
  cycles: `{\n  "data": {\n    "cycles": {\n      "nodes": [ { "id": "cyc_31", "number": 31, "progress": 0.62 } ]\n    }\n  }\n}`,
};

/* Example value seeds so "Try it out" fields start filled, like Swagger. */
const EP_EXAMPLE_VALS: Record<string, string> = {
  owner: 'acme', repo: 'app', n: '1284', id: '123', sid: 'SM8f1a2b3c',
  charge: 'ch_3P8x2aLk9Qf0', customer: 'cus_Qf0b2Nk', amount: '4200', currency: 'usd',
  lat: '37.77', lon: '-122.42', appid: '$OPENWEATHER_KEY', units: 'metric', exclude: 'minutely',
  status: 'active', limit: '10', starting_after: '', q: 'createSession', per_page: '20', page: '1',
  to: '+14155550100', from: '+14155550199', body: 'Your code is 4821', url: 'https://demo.dev/twiml',
  title: 'Session token not refreshed on 401', description: 'Repro attached', labels: 'bug',
  teamid: 'ENG', first: '25', priority: '2', filter: '{ state: { type: { eq: "started" } } }',
  reason: 'requested_by_customer', method: 'squash', commit_title: 'Merge PR #1284',
  merge_method: 'squash', pagesize: '20', cnt: '8', assignees: 'ada',
};

export const epToken = (ep: ApiEndpoint): string => {
  if (/\(/.test(ep.path)) return ep.path.split('(')[0].trim();
  const parts = ep.path
    .split('/')
    .filter(Boolean)
    .filter((s) => !s.startsWith(':') && !s.startsWith('{'));
  return parts[parts.length - 1] || 'resource';
};

/** Replace both `:name` (seed style) and `{name}` (OpenAPI style) path params. */
function substitutePath(path: string, resolve: (name: string) => string): string {
  return path.replace(/:(\w+)|\{(\w+)\}/g, (_m, a, b) => resolve(a ?? b));
}

const HTTP_LABELS: Record<string, string> = {
  '200': 'OK', '201': 'Created', '202': 'Accepted', '204': 'No Content',
  '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden', '404': 'Not Found',
  '409': 'Conflict', '422': 'Unprocessable', '429': 'Too Many Requests', '500': 'Server Error',
};
function httpLabel(code: string): string {
  return HTTP_LABELS[code] ?? (code === 'default' ? 'Default' : code);
}
function toneForCode(code: string): 'ok' | 'warn' | 'danger' {
  if (/^2/.test(code)) return 'ok';
  if (/^5/.test(code)) return 'danger';
  if (/^4/.test(code)) return 'warn';
  return 'ok';
}
function importedParam(p: EndpointParam, loc: ParamLocation): EpParam {
  return {
    name: p.name,
    in: loc,
    type: p.type || 'string',
    required: p.required,
    desc: p.description ?? '',
    ...(p.example !== undefined ? { example: p.example } : {}),
  };
}
function demoPathVal(name: string, example?: string): string {
  if (example) return example;
  return name === 'n' ? '1284' : name === 'owner' ? 'acme' : name === 'repo' ? 'app' : '123';
}
function buildExampleCurl(
  api: Api,
  ep: ApiEndpoint,
  spec: { isGql: boolean; pathParams: EpParam[]; query: EpParam[]; body: EpParam[] },
): string {
  const baseUrl = api.baseUrl ?? api.endpoint ?? '';
  if (spec.isGql) {
    const argList = [...spec.query, ...spec.body];
    const decl = argList.length ? `(${argList.map((a) => `$${a.name}: ${a.type}`).join(', ')})` : '';
    const pass = argList.length ? `(${argList.map((a) => `${a.name.replace(/Filter$/, '')}: $${a.name}`).join(', ')})` : '';
    return `curl ${baseUrl} \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "query": "${ep.method === 'MUTATION' ? 'mutation' : 'query'}${decl} { ${epToken(ep)}${pass} { id } }" }'`;
  }
  const url =
    baseUrl +
    substitutePath(ep.path, (n) => demoPathVal(n, spec.pathParams.find((p) => p.name === n)?.example));
  const q = spec.query.filter((p) => p.required).map((p) => `${p.name}=…`).join('&');
  const lines = [
    `curl ${ep.method !== 'GET' ? `-X ${ep.method} ` : ''}"${url}${q ? '?' + q : ''}" \\`,
    `  -H "Authorization: Bearer $TOKEN"`,
  ];
  if (spec.body.length) {
    lines[lines.length - 1] += ` \\`;
    lines.push(`  -H "Content-Type: application/json" \\`);
    const bodyObj = spec.body
      .slice(0, 3)
      .map((f) => `"${f.name}": ${f.type === 'integer' ? '1000' : f.type.includes('[]') ? '[]' : `"…"`}`)
      .join(', ');
    lines.push(`  -d '{ ${bodyObj} }'`);
  }
  return lines.join('\n');
}

/** Build an EndpointSpec from real imported metadata (params/body/responses). */
function specFromImport(api: Api, ep: ApiEndpoint): EndpointSpec {
  const isGql = api.style === 'GraphQL';
  const params = ep.params ?? [];
  const pathParams = params.filter((p) => p.in === 'path').map((p) => importedParam(p, 'path'));
  const query = params
    .filter((p) => p.in === 'query' || p.in === 'header')
    .map((p) => importedParam(p, isGql ? 'variable' : 'query'));
  const bodyIn: ParamLocation = isGql ? 'variable' : 'body';
  const body = (ep.requestBody?.fields ?? []).map((p) => importedParam(p, bodyIn));

  let responses: EpResponse[] = (ep.responses ?? []).map((r) => ({
    code: r.code,
    tone: toneForCode(r.code),
    label: httpLabel(r.code),
    desc: r.description ?? '',
  }));
  if (responses.length === 0) {
    const code = ep.method === 'POST' ? '201' : '200';
    responses = [{ code, tone: 'ok', label: httpLabel(code), desc: '' }];
  }

  const token = epToken(ep);
  const okResp =
    (ep.responses ?? []).find((r) => /^2/.test(r.code) && r.example) ??
    (ep.responses ?? []).find((r) => r.example);
  const sample =
    okResp?.example ?? ep.requestBody?.example ?? `{\n  "object": "${token.replace(/s$/, '')}",\n  "id": "obj_1a2b3c"\n}`;

  const example = buildExampleCurl(api, ep, { isGql, pathParams, query, body });
  return { pathParams, query, body, bodyIn, responses, sample, example, isGql };
}

export function buildEndpointSpec(api: Api, ep: ApiEndpoint): EndpointSpec {
  // Prefer real metadata from an imported OpenAPI spec; otherwise synthesize
  // from the built-in dictionaries (seed data has no rich endpoint fields).
  if ((ep.params && ep.params.length > 0) || ep.requestBody || (ep.responses && ep.responses.length > 0)) {
    return specFromImport(api, ep);
  }
  const isGql = api.style === 'GraphQL';
  const token = epToken(ep);
  const write = /^(POST|PUT|PATCH|DELETE|MUTATION)$/.test(ep.method);
  const auth = api.auth ?? 'the API credential';

  const pathParams: EpParam[] = (ep.path.match(/:(\w+)/g) || []).map((m) => {
    const name = m.slice(1);
    return {
      name, in: 'path', type: name === 'n' ? 'integer' : 'string', required: true,
      desc: name === 'n' ? 'The number identifying the resource.' : `The ${name} path segment.`,
    };
  });

  const query: EpParam[] = (EP_QUERY[token] || []).map(([name, type, required, desc]) => ({
    name, in: isGql ? 'variable' : 'query', type, required, desc,
  }));

  const body: EpParam[] = write
    ? (EP_BODY[token] || [['payload', 'object', true, 'The resource attributes to create or update.'] as Field]).map(
        ([name, type, required, desc]) => ({ name, in: (isGql ? 'variable' : 'body') as ParamLocation, type, required, desc }),
      )
    : [];
  const bodyIn: ParamLocation = isGql ? 'variable' : 'body';

  const okCode = ep.method === 'POST' ? '201' : '200';
  const responses: EpResponse[] = [];
  if (isGql) {
    responses.push({ code: '200', tone: 'ok', label: 'OK', desc: `Returns the ${token} result under \`data\`.` });
    responses.push({ code: '200', tone: 'warn', label: 'errors[]', desc: 'GraphQL returns 200 with an `errors` array on partial or validation failure.' });
  } else {
    responses.push({ code: okCode, tone: 'ok', label: okCode === '201' ? 'Created' : 'OK', desc: `The ${token.replace(/s$/, '')} was ${write ? 'created' : 'returned'} successfully.` });
    if (write) responses.push({ code: '400', tone: 'warn', label: 'Bad Request', desc: 'A required field is missing or a value is invalid.' });
    responses.push({ code: '401', tone: 'warn', label: 'Unauthorized', desc: `Missing or invalid ${auth}.` });
    if (pathParams.length) responses.push({ code: '404', tone: 'danger', label: 'Not Found', desc: 'No resource matches the given identifier.' });
    responses.push({ code: '429', tone: 'danger', label: 'Too Many Requests', desc: 'Rate limit exceeded — back off and retry with the Retry-After header.' });
  }

  const sample = EP_SAMPLE[token] || `{\n  "object": "${token.replace(/s$/, '')}",\n  "id": "obj_1a2b3c"\n}`;
  const baseUrl = api.baseUrl ?? api.endpoint ?? '';
  let example: string;
  if (isGql) {
    const op = ep.method === 'MUTATION' ? 'mutation' : 'query';
    const argList = [...query, ...body];
    const varsDecl = argList.length ? `(${argList.map((a) => `$${a.name}: ${a.type}`).join(', ')})` : '';
    const argPass = argList.length ? `(${argList.map((a) => `${a.name.replace(/Filter$/, '')}: $${a.name}`).join(', ')})` : '';
    example = `curl ${baseUrl} \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "query": "${op}${varsDecl} { ${token}${argPass} { id } }" }'`;
  } else {
    const url = baseUrl + ep.path.replace(/:(\w+)/g, (_m, n) => (n === 'n' ? '1284' : n === 'owner' ? 'acme' : n === 'repo' ? 'app' : '123'));
    const q = query.filter((p) => p.required).map((p) => `${p.name}=…`).join('&');
    const lines = [`curl ${ep.method !== 'GET' ? `-X ${ep.method} ` : ''}"${url}${q ? '?' + q : ''}" \\`, `  -H "Authorization: Bearer $TOKEN"`];
    if (body.length) {
      lines[lines.length - 1] += ` \\`;
      lines.push(`  -H "Content-Type: application/json" \\`);
      const bodyObj = body.slice(0, 3).map((f) => `"${f.name}": ${f.type === 'integer' ? '1000' : f.type.includes('[]') ? '[]' : `"…"`}`).join(', ');
      lines.push(`  -d '{ ${bodyObj} }'`);
    }
    example = lines.join('\n');
  }

  return { pathParams, query, body, bodyIn, responses, sample, example, isGql };
}

export const exampleVal = (p: EpParam): string => {
  if (p.example !== undefined && p.example !== '') return p.example;
  const key = p.name.toLowerCase();
  if (key in EP_EXAMPLE_VALS) return EP_EXAMPLE_VALS[key];
  if (/^(integer|number)$/.test(p.type) || /Int/.test(p.type)) return '1';
  return '';
};

function coerce(field: EpParam, raw: string): unknown {
  if (/^(integer|number)$/.test(field.type) || /Int/.test(field.type)) {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  if (field.type && field.type.includes('[]')) return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  return raw;
}

export function buildLiveRequest(api: Api, ep: ApiEndpoint, spec: EndpointSpec, vals: Record<string, string>): string {
  const baseUrl = api.baseUrl ?? api.endpoint ?? '';
  if (spec.isGql) {
    const args = [...spec.query, ...spec.body];
    const varsObj: Record<string, unknown> = {};
    args.forEach((a) => { if (vals[a.name] !== undefined && vals[a.name] !== '') varsObj[a.name] = coerce(a, vals[a.name]); });
    const op = ep.method === 'MUTATION' ? 'mutation' : 'query';
    const decl = args.length ? `(${args.map((a) => `$${a.name}: ${a.type}`).join(', ')})` : '';
    const pass = args.length ? `(${args.map((a) => `${a.name.replace(/Filter$/, '')}: $${a.name}`).join(', ')})` : '';
    const q = `${op}${decl} { ${epToken(ep)}${pass} { id } }`;
    return `curl ${baseUrl} \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ query: q, variables: varsObj })}'`;
  }
  const url = baseUrl + substitutePath(ep.path, (n) => encodeURIComponent(vals[n] || `:${n}`));
  const qp = spec.query.filter((p) => vals[p.name] !== undefined && vals[p.name] !== '').map((p) => `${p.name}=${encodeURIComponent(vals[p.name])}`).join('&');
  const lines = [`curl ${ep.method !== 'GET' ? `-X ${ep.method} ` : ''}"${url}${qp ? '?' + qp : ''}" \\`, `  -H "Authorization: Bearer $TOKEN"`];
  if (spec.body.length) {
    const obj: Record<string, unknown> = {};
    spec.body.forEach((f) => { if (vals[f.name] !== undefined && vals[f.name] !== '') obj[f.name] = coerce(f, vals[f.name]); });
    lines[lines.length - 1] += ` \\`;
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${JSON.stringify(obj)}'`);
  }
  return lines.join('\n');
}

/* Fold entered values into the canned success body so the response feels live. */
export function liveResponseBody(spec: EndpointSpec, vals: Record<string, string>): string {
  let body = spec.sample;
  const swap = (k: string, v: string) => {
    body = body.replace(new RegExp(`("${k}":\\s*)(\\d+|"[^"]*")`), (_m, p1) => `${p1}${/^\d+$/.test(String(v)) ? v : JSON.stringify(v)}`);
  };
  ['amount', 'currency', 'customer', 'charge', 'to', 'from', 'body', 'title', 'reason', 'units'].forEach((k) => {
    const hit = Object.keys(vals).find((n) => n.toLowerCase() === k);
    if (hit && vals[hit] !== '') swap(k, vals[hit]);
  });
  return body;
}
