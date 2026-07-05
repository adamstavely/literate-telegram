import { AuthenticatedUser } from '../types/index.js';

/** Normalize role strings for case-insensitive comparison. */
export function normalizeRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.toLowerCase());
}

export function hasRole(user: AuthenticatedUser | undefined, role: string): boolean {
  const normalized = role.toLowerCase();
  return user?.roles?.some((r) => r.toLowerCase() === normalized) ?? false;
}
