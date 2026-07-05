import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';
import { logger } from '../logger/logger.js';

/** Do not reclaim a slug lock until this long after claim (avoids TOCTOU races). */
export const LOCK_GRACE_MS = 15 * 60 * 1000;

export function typeSlugKey(type: string, slug: string): string {
  return `${type}:${slug}`;
}

/** True if an Elasticsearch error is a version/create conflict. */
export function isEsConflict(err: unknown): boolean {
  const e = err as { statusCode?: number; meta?: { statusCode?: number } };
  return e?.statusCode === 409 || e?.meta?.statusCode === 409;
}

/** True if an Elasticsearch error is a 404 (document/index not found). */
export function isEsNotFound(err: unknown): boolean {
  const e = err as { statusCode?: number; meta?: { statusCode?: number } };
  return e?.statusCode === 404 || e?.meta?.statusCode === 404;
}

function isLockGraceActive(claimedAt?: string): boolean {
  if (!claimedAt) return true;
  const age = Date.now() - new Date(claimedAt).getTime();
  return age >= 0 && age < LOCK_GRACE_MS;
}

/**
 * True if a live registry entry, slug lock, or in-flight pending submission
 * already uses this type+slug. Orphan locks (no matching registry/pending doc)
 * are released and treated as available once outside the claim grace window.
 */
export async function slugTaken(type: string, slug: string): Promise<boolean> {
  const [registry, pending, lockExists] = await Promise.all([
    esClient.count({
      index: INDEX_NAMES.REGISTRY,
      query: { bool: { filter: [{ term: { type } }, { term: { slug } }] } },
    }),
    esClient.count({
      index: INDEX_NAMES.PENDING,
      query: {
        bool: {
          filter: [
            { term: { status: 'pending' } },
            { term: { 'entry.type': type } },
            { term: { 'entry.slug': slug } },
          ],
        },
      },
    }),
    esClient.exists({
      index: INDEX_NAMES.SLUG_LOCKS,
      id: typeSlugKey(type, slug),
    }),
  ]);

  if (registry.count > 0 || pending.count > 0) return true;
  if (!lockExists) return false;

  try {
    const doc = await esClient.get<{ entryId?: string; claimedAt?: string }>({
      index: INDEX_NAMES.SLUG_LOCKS,
      id: typeSlugKey(type, slug),
    });
    const entryId = doc._source?.entryId;
    const claimedAt = doc._source?.claimedAt;

    if (!entryId) {
      if (isLockGraceActive(claimedAt)) return true;
      await releaseSlug(type, slug);
      return false;
    }

    if (isLockGraceActive(claimedAt)) return true;

    const [regDoc, pendCount] = await Promise.all([
      esClient.exists({ index: INDEX_NAMES.REGISTRY, id: entryId }),
      esClient.count({
        index: INDEX_NAMES.PENDING,
        query: {
          bool: {
            filter: [
              { term: { status: 'pending' } },
              { term: { 'entry.id': entryId } },
            ],
          },
        },
      }),
    ]);
    if (regDoc || pendCount.count > 0) return true;
    await releaseSlug(type, slug, entryId);
    return false;
  } catch (err) {
    logger.error('Failed to resolve slug lock state', {
      type,
      slug,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

/** Atomically claim a type+slug. Returns false if already taken. */
export async function claimSlug(type: string, slug: string, entryId: string): Promise<boolean> {
  try {
    await esClient.create({
      index: INDEX_NAMES.SLUG_LOCKS,
      id: typeSlugKey(type, slug),
      document: { type, slug, entryId, claimedAt: new Date().toISOString() },
      refresh: 'wait_for',
    });
    return true;
  } catch (err) {
    if (isEsConflict(err)) return false;
    throw err;
  }
}

/**
 * Claim a type+slug, or accept it if this same entry already owns the lock.
 * The submit path claims the lock; approve then re-checks with this so an
 * entry's own lock (held since submission) doesn't read as a conflict, while a
 * lock held by a *different* entry still blocks. Legacy pending entries with no
 * lock yet are claimed here.
 */
export async function claimOrOwnSlug(type: string, slug: string, entryId: string): Promise<boolean> {
  if (await claimSlug(type, slug, entryId)) return true;
  try {
    const doc = await esClient.get<{ entryId?: string }>({
      index: INDEX_NAMES.SLUG_LOCKS,
      id: typeSlugKey(type, slug),
    });
    return doc._source?.entryId === entryId;
  } catch {
    return false;
  }
}

/**
 * Release a slug lock. When entryId is supplied, the lock is deleted only if
 * that entry still owns it — prevents freeing a lock held by a different entry.
 */
export async function releaseSlug(type: string, slug: string, entryId?: string): Promise<boolean> {
  const lockId = typeSlugKey(type, slug);
  try {
    if (entryId) {
      try {
        const doc = await esClient.get<{ entryId?: string }>({
          index: INDEX_NAMES.SLUG_LOCKS,
          id: lockId,
        });
        if (doc._source?.entryId !== entryId) return false;
      } catch (err) {
        if (isEsNotFound(err)) return false;
        throw err;
      }
    }

    await esClient.delete({
      index: INDEX_NAMES.SLUG_LOCKS,
      id: lockId,
      refresh: 'wait_for',
    });
    return true;
  } catch (err) {
    if (isEsNotFound(err)) return false;
    logger.warn('Failed to release slug lock', {
      type,
      slug,
      entryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
