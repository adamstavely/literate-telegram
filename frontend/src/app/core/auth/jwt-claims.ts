/** Decode a JWT payload without verifying the signature (UI hints only — backend verifies). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function rolesFromAccessToken(token: string | null): string[] {
  if (!token) return [];
  const payload = decodeJwtPayload(token);
  if (!payload) return [];

  const custom = payload['https://interop.io/roles'];
  const direct = payload['roles'];
  const raw = Array.isArray(custom) ? custom : Array.isArray(direct) ? direct : [];
  return raw.filter((r): r is string => typeof r === 'string').map(r => r.toLowerCase());
}

export function userFromAccessToken(token: string | null): {
  sub: string;
  email?: string;
  name?: string;
  roles: string[];
} | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload['sub'] !== 'string') return null;

  return {
    sub: payload['sub'],
    email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
    name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    roles: rolesFromAccessToken(token),
  };
}
