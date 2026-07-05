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
  allowMockAuth: boolean;
  trustProxy: boolean | number | string;
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
    ingestWindowMs: number;
    ingestMax: number;
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

  // The mock-token admin bypass is a local dev convenience. It must be opted
  // into explicitly (and never in production) so a leaked compose default can't
  // hand out admin in a shared environment.
  const isProd = nodeEnv === 'production';

  const allowMockAuth =
    nodeEnv === 'development' && optionalEnv('ALLOW_MOCK_AUTH', 'false') === 'true';

  // Express `trust proxy` setting. Only when this is configured does req.ip
  // honor X-Forwarded-For — so rate limiting and audit IPs stay consistent and
  // aren't spoofable when the app is not actually behind a trusted proxy.
  const trustProxyRaw = optionalEnv('TRUST_PROXY', 'false');
  let trustProxy: boolean | number | string;
  if (trustProxyRaw === 'true') trustProxy = true;
  else if (trustProxyRaw === 'false') trustProxy = false;
  else if (/^\d+$/.test(trustProxyRaw)) trustProxy = parseInt(trustProxyRaw, 10);
  else trustProxy = trustProxyRaw;

  return {
    nodeEnv,
    port: optionalEnvNumber('PORT', 3000),
    allowMockAuth,
    trustProxy,
    elasticsearch: {
      node: optionalEnv('ES_NODE', 'http://localhost:9200'),
      username: optionalEnv('ES_USERNAME', 'elastic'),
      password: optionalEnv('ES_PASSWORD', 'changeme'),
      caFingerprint: caFingerprint && caFingerprint.length > 0 ? caFingerprint : undefined,
    },
    oidc: {
      // In production these must be supplied explicitly — the placeholder
      // tenant defaults would silently accept nobody (or the wrong issuer).
      issuer: isProd ? requireEnv('OIDC_ISSUER') : optionalEnv('OIDC_ISSUER', 'https://your-tenant.auth0.com/'),
      audience: isProd ? requireEnv('OIDC_AUDIENCE') : optionalEnv('OIDC_AUDIENCE', 'https://api.interop.io'),
      jwksUri: isProd
        ? requireEnv('OIDC_JWKS_URI')
        : optionalEnv('OIDC_JWKS_URI', 'https://your-tenant.auth0.com/.well-known/jwks.json'),
    },
    cors: {
      allowedOrigins,
    },
    rateLimit: {
      windowMs: optionalEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
      max: optionalEnvNumber('RATE_LIMIT_MAX', 200),
      // Client-side telemetry ingestion is unauthenticated, so it gets a much
      // tighter per-IP budget than the global limit to prevent ES flooding.
      ingestWindowMs: optionalEnvNumber('INGEST_RATE_LIMIT_WINDOW_MS', 60000),
      ingestMax: optionalEnvNumber('INGEST_RATE_LIMIT_MAX', 30),
    },
    logging: {
      level: optionalEnv('LOG_LEVEL', 'info'),
      logIndex: optionalEnv('LOG_INDEX', 'interop-logs'),
      auditIndex: optionalEnv('AUDIT_INDEX', 'interop-audit'),
    },
  };
}

export const config = loadConfig();

// Reject leftover placeholder OIDC values in production — they would otherwise
// point token verification at a tenant that isn't ours.
if (config.nodeEnv === 'production') {
  const placeholders = [config.oidc.issuer, config.oidc.jwksUri];
  if (placeholders.some((v) => v.includes('your-tenant'))) {
    throw new Error(
      'OIDC configuration still contains placeholder values (your-tenant.*). Set OIDC_ISSUER / OIDC_JWKS_URI to real values in production.',
    );
  }
}
