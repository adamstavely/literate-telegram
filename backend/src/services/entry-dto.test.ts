import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSubmission } from './entry-dto.js';
import { Server, Skill, Agent, Api } from '../types/index.js';

describe('sanitizeSubmission', () => {
  test('drops server-controlled and unknown fields (mass-assignment guard)', () => {
    const out = sanitizeSubmission({
      type: 'server',
      name: 'Evil',
      slug: 'evil',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'public',
      categories: ['Security'],
      // Injected fields that must not survive:
      verified: true,
      installs: 9999,
      rating: 5,
      bogusField: 'nope',
    }) as Server & { bogusField?: unknown };

    assert.equal(out.verified, undefined, 'verified must not pass through');
    assert.equal(out.installs, undefined, 'installs must not pass through');
    assert.equal(out.rating, 0, 'rating is forced to 0, not caller-set');
    assert.equal((out as { bogusField?: unknown }).bogusField, undefined);
  });

  test('keeps only enum-valid transports and coerces bad ones out', () => {
    const out = sanitizeSubmission({
      type: 'server',
      name: 'Srv',
      slug: 'srv',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'public',
      categories: ['x'],
      transports: ['http', 'ftp', 'stdio', 123],
    }) as Server;

    assert.deepEqual(out.transports, ['http', 'stdio']);
  });

  test('falls back to safe enum defaults for invalid values', () => {
    const agent = sanitizeSubmission({
      type: 'agent',
      name: 'Ag',
      slug: 'ag',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'nonsense',
      categories: ['x'],
      autonomy: 'godmode',
    }) as Agent;

    assert.equal(agent.autonomy, 'low');
    assert.equal(agent.sensitivity, 'public');
  });

  test('sanitizes nested tools on a server', () => {
    const out = sanitizeSubmission({
      type: 'server',
      name: 'Srv',
      slug: 'srv',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'public',
      categories: ['x'],
      tools: [{ name: 't', slug: 't', verified: true, installs: 5, readOnly: false }],
    }) as Server;

    assert.equal(out.tools.length, 1);
    assert.equal((out.tools[0] as { verified?: unknown }).verified, false);
    assert.equal((out.tools[0] as { installs?: unknown }).installs, 0);
  });

  test('defaults api style and preserves optional endpoint', () => {
    const api = sanitizeSubmission({
      type: 'api',
      name: 'A',
      slug: 'a',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'public',
      categories: ['x'],
      style: 'SOAP',
      endpoint: 'https://api.example.com',
    }) as Api;

    assert.equal(api.style, 'REST');
    assert.equal(api.endpoint, 'https://api.example.com');
  });

  test('rejects invalid API methods and paths', () => {
    const api = sanitizeSubmission({
      type: 'api',
      name: 'A',
      slug: 'a',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'public',
      categories: ['x'],
      style: 'REST',
      baseUrl: 'not-a-url',
      endpoints: [
        { method: 'DROP', path: '/ok', summary: 'bad method' },
        { method: 'GET', path: 'no-leading-slash', summary: 'bad path' },
        { method: 'GET', path: '/users/{id}', summary: 'good' },
      ],
    }) as Api;

    assert.equal(api.baseUrl, undefined);
    assert.deepEqual(api.endpoints, [{ method: 'GET', path: '/users/{id}', summary: 'good' }]);
  });

  test('accepts GraphQL operation names as paths', () => {
    const api = sanitizeSubmission({
      type: 'api',
      name: 'Gql',
      slug: 'gql',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'public',
      categories: ['x'],
      style: 'GraphQL',
      endpoints: [{ method: 'QUERY', path: 'GetUser', summary: 'fetch user' }],
    }) as Api;

    assert.equal(api.endpoints?.[0]?.method, 'QUERY');
    assert.equal(api.endpoints?.[0]?.path, 'GetUser');
  });

  test('coerces skill tokens and arrays', () => {
    const skill = sanitizeSubmission({
      type: 'skill',
      name: 'S',
      slug: 's',
      publisher: 'acme.com',
      summary: 'a summary here',
      description: 'a description that is long enough',
      sensitivity: 'internal',
      categories: ['x'],
      triggers: ['when x', 42],
      tokens: 'lots',
    }) as Skill;

    assert.deepEqual(skill.triggers, ['when x']);
    assert.equal(skill.tokens, 0);
  });
});
