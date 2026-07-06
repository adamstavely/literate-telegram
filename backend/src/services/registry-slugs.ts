import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';
import { isEsConflict, isEsNotFound, typeSlugKey } from './slug-locks.js';

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
