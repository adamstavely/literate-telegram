import { Request } from 'express';
import { RegistryEntry, Visibility } from '../types/index.js';
import { hasRole } from '../middleware/roles.js';

function isAdmin(req: Request): boolean {
  return hasRole(req.user, 'admin');
}

const PUBLIC_VISIBILITIES: Visibility[] = ['public'];
const AUTHENTICATED_VISIBILITIES: Visibility[] = ['public', 'org'];

/** Elasticsearch filter clause for registry reads scoped to the caller. */
export function registryVisibilityFilter(req: Request): Record<string, unknown> {
  if (isAdmin(req)) {
    return { match_all: {} };
  }

  const allowed = req.user ? AUTHENTICATED_VISIBILITIES : PUBLIC_VISIBILITIES;
  const should: Record<string, unknown>[] = [{ terms: { visibility: allowed } }];
  // Legacy entries without a visibility field are treated as org-scoped (not public).
  if (req.user) {
    should.push({ bool: { must_not: { exists: { field: 'visibility' } } } });
  }
  return {
    bool: {
      should,
      minimum_should_match: 1,
    },
  };
}

export function entryVisibleToCaller(
  entry: Pick<RegistryEntry, 'visibility'>,
  req: Request,
): boolean {
  if (isAdmin(req)) return true;
  const visibility = entry.visibility ?? 'org';
  if (visibility === 'public') return true;
  if (!req.user) return false;
  if (visibility === 'org') return true;
  return false;
}
