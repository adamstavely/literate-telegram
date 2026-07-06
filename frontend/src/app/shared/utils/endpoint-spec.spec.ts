import {
  buildEndpointSpec,
  buildLiveRequest,
  buildStructuredRequest,
  epToken,
  exampleVal,
  liveResponseBody,
} from './endpoint-spec';
import { Api, ApiEndpoint } from '../types';

function api(partial: Partial<Api>): Api {
  return {
    id: 'a', type: 'api', name: 'Test API', slug: 'test', publisher: 'acme',
    verified: true, summary: '', description: '', installs: 0, sensitivity: 'public',
    categories: [], createdAt: '', updatedAt: '', style: 'REST',
    baseUrl: 'https://api.test.com/v1', auth: 'API key',
    ...partial,
  } as Api;
}

describe('endpoint-spec', () => {
  it('derives path params from a REST path', () => {
    const ep: ApiEndpoint = { method: 'GET', path: '/customers/:id', summary: '' };
    const spec = buildEndpointSpec(api({}), ep);
    expect(spec.pathParams.map((p) => p.name)).toEqual(['id']);
    expect(spec.pathParams[0].in).toBe('path');
    expect(spec.pathParams[0].required).toBe(true);
  });

  it('marks write endpoints with a request body and 201', () => {
    const ep: ApiEndpoint = { method: 'POST', path: '/charges', summary: '' };
    const spec = buildEndpointSpec(api({}), ep);
    expect(spec.body.length).toBeGreaterThan(0);
    expect(spec.responses.some((r) => r.code === '201')).toBe(true);
  });

  it('treats GraphQL endpoints with variables, not path params', () => {
    const ep: ApiEndpoint = { method: 'MUTATION', path: 'issueCreate', summary: '' };
    const spec = buildEndpointSpec(api({ style: 'GraphQL', baseUrl: 'https://gql.test/graphql' }), ep);
    expect(spec.isGql).toBe(true);
    expect(spec.bodyIn).toBe('variable');
    expect(spec.example).toContain('mutation');
  });

  it('epToken extracts the resource token', () => {
    expect(epToken({ method: 'GET', path: '/customers/:id' })).toBe('customers');
    expect(epToken({ method: 'QUERY', path: 'issues(filter)' })).toBe('issues');
  });

  it('builds a live curl request from entered values', () => {
    const ep: ApiEndpoint = { method: 'GET', path: '/customers/:id', summary: '' };
    const spec = buildEndpointSpec(api({}), ep);
    const req = buildLiveRequest(api({}), ep, spec, { id: 'cus_42' });
    expect(req).toContain('https://api.test.com/v1/customers/cus_42');
    expect(req).toContain('Authorization: Bearer $TOKEN');
  });

  it('exampleVal returns known defaults and type-based fallbacks', () => {
    expect(exampleVal({ name: 'amount', in: 'body', type: 'integer', required: true, desc: '' })).toBe('4200');
    expect(exampleVal({ name: 'unknown', in: 'query', type: 'string', required: false, desc: '' })).toBe('');
    expect(exampleVal({ name: 'count', in: 'query', type: 'integer', required: false, desc: '' })).toBe('1');
  });

  it('liveResponseBody substitutes entered values into the sample', () => {
    const ep: ApiEndpoint = { method: 'POST', path: '/charges', summary: '' };
    const spec = buildEndpointSpec(api({}), ep);
    const body = liveResponseBody(spec, { amount: '9900', currency: 'eur' });
    expect(body).toContain('"amount": 9900');
    expect(body).toContain('"currency": "eur"');
  });

  describe('imported endpoint (real OpenAPI metadata)', () => {
    const importedEp: ApiEndpoint = {
      method: 'POST',
      path: '/pets/{id}',
      summary: 'Update a pet',
      params: [
        { name: 'id', in: 'path', type: 'string', required: true, description: 'Pet id', example: 'p1' },
        { name: 'expand', in: 'query', type: 'string', required: false },
      ],
      requestBody: { fields: [{ name: 'name', in: 'body', type: 'string', required: true }] },
      responses: [{ code: '201', description: 'Created', example: '{"id":"p1"}' }],
    };

    it('uses the real params/body/responses instead of the dictionary', () => {
      const spec = buildEndpointSpec(api({}), importedEp);
      expect(spec.pathParams.map((p) => p.name)).toEqual(['id']);
      expect(spec.query.map((p) => p.name)).toContain('expand');
      expect(spec.body.map((p) => p.name)).toContain('name');
      expect(spec.responses[0].code).toBe('201');
      expect(spec.sample).toContain('"id"');
    });

    it('substitutes {brace}-style path params in the live request', () => {
      const spec = buildEndpointSpec(api({}), importedEp);
      const req = buildLiveRequest(api({}), importedEp, spec, { id: '42', name: 'rex' });
      expect(req).toContain('/pets/42');
      expect(req).toContain('-X POST');
    });

    it('seeds the try-it form from the imported example', () => {
      const spec = buildEndpointSpec(api({}), importedEp);
      const idParam = spec.pathParams.find((p) => p.name === 'id')!;
      expect(exampleVal(idParam)).toBe('p1');
    });

    it('buildStructuredRequest produces a REST request with substituted path, query, and body', () => {
      const spec = buildEndpointSpec(api({}), importedEp);
      const req = buildStructuredRequest(api({}), importedEp, spec, { id: '42', expand: 'owner', name: 'rex' });
      expect(req.method).toBe('POST');
      expect(req.path).toBe('/pets/42');
      expect(req.query).toEqual({ expand: 'owner' });
      expect(req.body).toBe(JSON.stringify({ name: 'rex' }));
    });
  });

  it('buildStructuredRequest builds a GraphQL POST with query + variables', () => {
    const ep: ApiEndpoint = { method: 'MUTATION', path: 'issueCreate', summary: '' };
    const gqlApi = api({ style: 'GraphQL', baseUrl: 'https://gql.test/graphql' });
    const spec = buildEndpointSpec(gqlApi, ep);
    const req = buildStructuredRequest(gqlApi, ep, spec, {});
    expect(req.method).toBe('POST');
    expect(req.path).toBe('');
    expect(req.body).toContain('mutation');
  });
});
