import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { config, validateProductionGuardrails } from '../config/index.js';
import type { Config } from '../config/index.js';

function productionConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...config,
    nodeEnv: 'production',
    oidc: {
      issuer: 'https://auth.example.com/',
      audience: 'https://api.example.com',
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
    },
    elasticsearch: {
      node: 'https://es.example.com:9243',
      username: 'elastic',
      password: 'strong-cloud-password',
      caFingerprint: 'AA:BB:CC',
    },
    ...overrides,
  };
}

describe('validateProductionGuardrails', () => {
  test('accepts a valid Elastic Cloud-style configuration', () => {
    assert.doesNotThrow(() => validateProductionGuardrails(productionConfig()));
  });

  test('rejects placeholder OIDC tenant values', () => {
    assert.throws(
      () =>
        validateProductionGuardrails(
          productionConfig({
            oidc: {
              issuer: 'https://your-tenant.auth0.com/',
              audience: 'https://api.example.com',
              jwksUri: 'https://your-tenant.auth0.com/.well-known/jwks.json',
            },
          }),
        ),
      /placeholder values/,
    );
  });

  test('rejects weak Elasticsearch passwords', () => {
    assert.throws(
      () =>
        validateProductionGuardrails(
          productionConfig({
            elasticsearch: {
              ...productionConfig().elasticsearch,
              password: 'changeme',
            },
          }),
        ),
      /ES_PASSWORD/,
    );
  });

  test('requires CA fingerprint for HTTPS ES endpoints', () => {
    assert.throws(
      () =>
        validateProductionGuardrails(
          productionConfig({
            elasticsearch: {
              ...productionConfig().elasticsearch,
              caFingerprint: undefined,
            },
          }),
        ),
      /ES_CA_FINGERPRINT/,
    );
  });
});
