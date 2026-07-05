import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTVerifyResult, JWTPayload } from 'jose';
import { config } from '../config/index.js';
import { AuthenticatedUser } from '../types/index.js';
import { logger } from '../logger/logger.js';

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  const now = Date.now();
  if (!jwksCache || now - jwksCacheTime > JWKS_CACHE_TTL) {
    jwksCache = createRemoteJWKSet(new URL(config.oidc.jwksUri));
    jwksCacheTime = now;
  }
  return jwksCache;
}

interface TokenClaims extends JWTPayload {
  email?: string;
  name?: string;
  'https://interop.io/roles'?: string[];
  roles?: string[];
  scope?: string;
}

function extractUser(payload: TokenClaims): AuthenticatedUser {
  // Support both custom claim namespace and direct roles claim
  const roles =
    payload['https://interop.io/roles'] ??
    payload['roles'] ??
    [];

  return {
    sub: payload.sub ?? '',
    email: payload.email,
    name: payload.name,
    roles: Array.isArray(roles) ? roles : [],
  };
}

async function verifyToken(token: string): Promise<JWTVerifyResult<TokenClaims>> {
  const jwks = getJwks();
  return jwtVerify<TokenClaims>(token, jwks, {
    issuer: config.oidc.issuer,
    audience: config.oidc.audience,
  });
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
      correlationId: req.id,
    });
    return;
  }

  const token = authHeader.slice(7);

  if (config.allowMockAuth && token === 'mock-token') {
    req.user = {
      sub: 'dev-user-1',
      email: 'dev@example.com',
      name: 'Dev User',
      roles: ['admin'],
    };
    next();
    return;
  }

  try {
    const { payload } = await verifyToken(token);
    req.user = extractUser(payload);
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    logger.warn('JWT verification failed', {
      correlationId: req.id,
      error: message,
      ip: req.ip,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      correlationId: req.id,
    });
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  if (config.allowMockAuth && token === 'mock-token') {
    req.user = {
      sub: 'dev-user-1',
      email: 'dev@example.com',
      name: 'Dev User',
      roles: ['admin'],
    };
    next();
    return;
  }

  try {
    const { payload } = await verifyToken(token);
    req.user = extractUser(payload);
  } catch {
    // Not a valid token; continue without user context
  }

  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      correlationId: req.id,
    });
    return;
  }

  const roles = req.user.roles ?? [];
  if (!roles.includes('admin')) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin role required',
      correlationId: req.id,
    });
    return;
  }

  next();
}
