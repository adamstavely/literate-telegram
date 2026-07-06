import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { importSpecFromText } from './openapi-import.js';

const OAS3 = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Pet API', version: '1.2.0', description: 'Pets service' },
  servers: [{ url: 'https://api.pets.example.com/v1/' }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/pets/{id}': {
      get: {
        operationId: 'getPet',
        summary: 'Get a pet',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'expand', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'ok', content: { 'application/json': { example: { id: 'p1' } } } } },
      },
    },
    '/pets': {
      post: {
        summary: 'Create pet',
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, age: { type: 'integer' } } },
            },
          },
        },
        responses: { '201': { description: 'created' } },
      },
    },
  },
});

const SWAGGER2 = JSON.stringify({
  swagger: '2.0',
  info: { title: 'Legacy API', version: '1.0' },
  host: 'api.legacy.example.com',
  basePath: '/api',
  schemes: ['https'],
  securityDefinitions: { key: { type: 'apiKey', name: 'X-Key', in: 'header' } },
  paths: {
    '/things': {
      get: {
        summary: 'List things',
        parameters: [{ name: 'limit', in: 'query', type: 'integer' }],
        responses: { '200': { description: 'ok' } },
      },
      post: {
        summary: 'Create thing',
        parameters: [{ name: 'body', in: 'body', schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } } }],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
});

describe('openapi-import — OpenAPI 3.x', () => {
  test('maps info, server, auth, and endpoints', async () => {
    const draft = await importSpecFromText(OAS3);
    assert.equal(draft.name, 'Pet API');
    assert.equal(draft.version, '1.2.0');
    assert.equal(draft.style, 'REST');
    assert.equal(draft.baseUrl, 'https://api.pets.example.com/v1'); // trailing slash trimmed
    assert.equal(draft.auth, 'Bearer token');
    assert.equal(draft.endpoints.length, 2);

    const get = draft.endpoints.find((e) => e.method === 'GET' && e.path === '/pets/{id}');
    assert.ok(get);
    assert.equal(get!.operationId, 'getPet');
    const idParam = get!.params?.find((p) => p.name === 'id');
    assert.equal(idParam?.in, 'path');
    assert.equal(idParam?.required, true);
    assert.ok(get!.params?.some((p) => p.name === 'expand' && p.in === 'query'));
    assert.ok(get!.responses?.some((r) => r.code === '200'));

    const post = draft.endpoints.find((e) => e.method === 'POST' && e.path === '/pets');
    assert.ok(post);
    const nameField = post!.requestBody?.fields?.find((f) => f.name === 'name');
    assert.equal(nameField?.in, 'body');
    assert.equal(nameField?.required, true);
    assert.ok(post!.requestBody?.fields?.some((f) => f.name === 'age'));
  });
});

describe('openapi-import — Swagger 2.0', () => {
  test('maps host/basePath/schemes, apiKey auth, params, and body', async () => {
    const draft = await importSpecFromText(SWAGGER2);
    assert.equal(draft.name, 'Legacy API');
    assert.equal(draft.baseUrl, 'https://api.legacy.example.com/api');
    assert.equal(draft.auth, 'API key');
    assert.equal(draft.endpoints.length, 2);

    const get = draft.endpoints.find((e) => e.method === 'GET');
    assert.ok(get!.params?.some((p) => p.name === 'limit' && p.in === 'query'));

    const post = draft.endpoints.find((e) => e.method === 'POST');
    assert.ok(post!.requestBody?.fields?.some((f) => f.name === 'title' && f.required));
  });
});

describe('openapi-import — invalid input', () => {
  test('rejects a non-spec object', async () => {
    await assert.rejects(() => importSpecFromText(JSON.stringify({ hello: 'world' })));
  });

  test('rejects unparseable text', async () => {
    await assert.rejects(() => importSpecFromText('{ not valid json'));
  });
});
