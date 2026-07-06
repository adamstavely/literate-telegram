import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';
import { logger } from '../logger/logger.js';
import { isEsConflict, isEsNotFound, typeSlugKey, LOCK_GRACE_MS } from './slug-locks.js';

/** True if a permanent type+slug reservation exists in the registry-slugs index. */
export async function registrySlugReserved(type: string, slug: string): Promise<boolean> {
  return esClient.exists({
    index: INDEX_NAMES.REGISTRY_SLUGS,
    id: typeSlugKey(type, slug),
  });
}

/** Atomically reserve a published type+slug. Returns false if already taken. */
export async function claimRegistrySlug(
  type: string,
  slug: string,
  entryId: string,
): Promise<boolean> {
  try {
    await esClient.create({
      index: INDEX_NAMES.REGISTRY_SLUGS,
      id: typeSlugKey(type, slug),
      document: { type, slug, entryId, reservedAt: new Date().toISOString() },
      refresh: 'wait_for',
    });
    return true;
  } catch (err) {
    if (isEsConflict(err)) return false;
    throw err;
  }
}

/**
 * Reserve a type+slug, or accept it if this same entry already owns the reservation.
 * Used when concurrent approvers publish the same pending entry.
 */
export async function claimOrOwnRegistrySlug(
  type: string,
  slug: string,
  entryId: string,
): Promise<boolean> {
  if (await claimRegistrySlug(type, slug, entryId)) return true;
  try {
    const doc = await esClient.get<{ entryId?: string }>({
      index: INDEX_NAMES.REGISTRY_SLUGS,
      id: typeSlugKey(type, slug),
    });
    return doc._source?.entryId === entryId;
  } catch {
    return false;
  }
}

/** Release a registry slug reservation when rolling back a failed publish. */
export async function releaseRegistrySlug(
  type: string,
  slug: string,
  entryId?: string,
): Promise<boolean> {
  const id = typeSlugKey(type, slug);
  try {
    if (entryId) {
      try {
        const doc = await esClient.get<{ entryId?: string }>({
          index: INDEX_NAMES.REGISTRY_SLUGS,
          id,
        });
        if (doc._source?.entryId !== entryId) return false;
      } catch (err) {
        if (isEsNotFound(err)) return false;
        throw err;
      }
    }

    await esClient.delete({
      index: INDEX_NAMES.REGISTRY_SLUGS,
      id,
      refresh: 'wait_for',
    });
    return true;
  } catch (err) {
    if (isEsNotFound(err)) return false;
    throw err;
  }
}

/**
 * Reclaim orphaned registry-slug reservations. A reservation is only created at
 * publish time (auto-approve / approve) and should always have a matching
 * registry doc. If the process crashed between reserving the slug and writing
 * the registry doc, the reservation survives with no published entry and — unlike
 * SLUG_LOCKS — nothing else reclaims it, so the slug is burned forever. This
 * sweep releases any reservation older than the grace window whose entry never
 * published. The grace window covers the normal reserve→publish transient.
 */
export async function sweepStaleRegistrySlugs(): Promise<number> {
  const cutoff = new Date(Date.now() - LOCK_GRACE_MS).toISOString();
  let released = 0;

  try {
    const response = await esClient.search<{ type?: string; slug?: string; entryId?: string }>({
      index: INDEX_NAMES.REGISTRY_SLUGS,
      size: 100,
      query: { range: { reservedAt: { lte: cutoff } } },
      _source: ['type', 'slug', 'entryId'],
    });

    for (const hit of response.hits.hits) {
      const type = hit._source?.type;
      const slug = hit._source?.slug;
      const entryId = hit._source?.entryId;
      if (!type || !slug || !entryId) continue;

      const published = await esClient.exists({ index: INDEX_NAMES.REGISTRY, id: entryId });
      if (published) continue; // reservation backs a real published entry — keep it

      if (await releaseRegistrySlug(type, slug, entryId)) released += 1;
    }
  } catch (err) {
    logger.warn('Registry slug sweep failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return released;
}
