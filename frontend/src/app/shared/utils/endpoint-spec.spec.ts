import { buildEndpointSpec, buildLiveRequest, epToken, exampleVal, liveResponseBody } from './endpoint-spec';
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
});
