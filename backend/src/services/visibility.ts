import { Request } from 'express';
import { RegistryEntry, Visibility } from '../types/index.js';

function isAdmin(req: Request): boolean {
  return req.user?.roles?.includes('admin') ?? false;
}

const PUBLIC_VISIBILITIES: Visibility[] = ['public'];
const AUTHENTICATED_VISIBILITIES: Visibility[] = ['public', 'org'];

/** Elasticsearch filter clause for registry reads scoped to the caller. */
export function registryVisibilityFilter(req: Request): Record<string, unknown> {
  if (isAdmin(req)) {
    return { match_all: {} };
  }

  const allowed = req.user ? AUTHENTICATED_VISIBILITIES : PUBLIC_VISIBILITIES;
  return {
    bool: {
      should: [
        { terms: { visibility: allowed } },
        { bool: { must_not: { exists: { field: 'visibility' } } } },
      ],
      minimum_should_match: 1,
    },
  };
}

export function entryVisibleToCaller(
  entry: Pick<RegistryEntry, 'visibility'>,
  req: Request,
): boolean {
  if (isAdmin(req)) return true;
  const visibility = entry.visibility ?? 'public';
  if (visibility === 'public') return true;
  if (!req.user) return false;
  if (visibility === 'org') return true;
  return false;
}
