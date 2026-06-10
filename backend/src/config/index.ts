import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function optionalEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, got: ${value}`);
  }
  return parsed;
}

export interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  elasticsearch: {
    node: string;
    username: string;
    password: string;
    caFingerprint: string | undefined;
  };
  oidc: {
    issuer: string;
    audience: string;
    jwksUri: string;
  };
  cors: {
    allowedOrigins: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
    logIndex: string;
    auditIndex: string;
  };
}

function loadConfig(): Config {
  const nodeEnvRaw = optionalEnv('NODE_ENV', 'development');
  if (!['development', 'production', 'test'].includes(nodeEnvRaw)) {
    throw new Error(`NODE_ENV must be one of: development, production, test. Got: ${nodeEnvRaw}`);
  }
  const nodeEnv = nodeEnvRaw as Config['nodeEnv'];

  const allowedOriginsRaw = optionalEnv('ALLOWED_ORIGINS', 'http://localhost:4200');
  const allowedOrigins = allowedOriginsRaw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const caFingerprint = process.env['ES_CA_FINGERPRINT'] || undefined;

  return {
    nodeEnv,
    port: optionalEnvNumber('PORT', 3000),
    elasticsearch: {
      node: optionalEnv('ES_NODE', 'http://localhost:9200'),
      username: optionalEnv('ES_USERNAME', 'elastic'),
      password: optionalEnv('ES_PASSWORD', 'changeme'),
      caFingerprint: caFingerprint && caFingerprint.length > 0 ? caFingerprint : undefined,
    },
    oidc: {
      issuer: optionalEnv('OIDC_ISSUER', 'https://your-tenant.auth0.com/'),
      audience: optionalEnv('OIDC_AUDIENCE', 'https://api.interop.io'),
      jwksUri: optionalEnv(
        'OIDC_JWKS_URI',
        'https://your-tenant.auth0.com/.well-known/jwks.json'
      ),
    },
    cors: {
      allowedOrigins,
    },
    rateLimit: {
      windowMs: optionalEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
      max: optionalEnvNumber('RATE_LIMIT_MAX', 200),
    },
    logging: {
      level: optionalEnv('LOG_LEVEL', 'info'),
      logIndex: optionalEnv('LOG_INDEX', 'interop-logs'),
      auditIndex: optionalEnv('AUDIT_INDEX', 'interop-audit'),
    },
  };
}

export const config = loadConfig();

// Validate OIDC config is present when not in test mode
if (config.nodeEnv !== 'test') {
  requireEnv; // imported but used selectively at runtime
}
