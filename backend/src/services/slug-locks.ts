import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';

export function typeSlugKey(type: string, slug: string): string {
  return `${type}:${slug}`;
}

/** True if an Elasticsearch error is a version/create conflict. */
export function isEsConflict(err: unknown): boolean {
  const e = err as { statusCode?: number; meta?: { statusCode?: number } };
  return e?.statusCode === 409 || e?.meta?.statusCode === 409;
}

/**
 * True if a live registry entry, slug lock, or in-flight pending submission
 * already uses this type+slug.
 */
export async function slugTaken(type: string, slug: string): Promise<boolean> {
  const [registry, pending, locks] = await Promise.all([
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
            { term: { 'entry.type.keyword': type } },
            { term: { 'entry.slug.keyword': slug } },
          ],
        },
      },
    }),
    esClient.exists({
      index: INDEX_NAMES.SLUG_LOCKS,
      id: typeSlugKey(type, slug),
    }),
  ]);
  return registry.count > 0 || pending.count > 0 || locks;
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

export async function releaseSlug(type: string, slug: string): Promise<void> {
  await esClient
    .delete({
      index: INDEX_NAMES.SLUG_LOCKS,
      id: typeSlugKey(type, slug),
      refresh: 'wait_for',
    })
    .catch(() => undefined);
}
