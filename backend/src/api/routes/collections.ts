import { Router, Request, Response, NextFunction } from 'express';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { COLLECTION_DEFINITIONS } from '../../data/collections.js';
import {
  Collection,
  RegistryEntry,
  SensitivityLevel,
} from '../../types/index.js';

const router = Router();

const SENS_RANK: Record<SensitivityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

async function loadAllEntries(): Promise<RegistryEntry[]> {
  const response = await esClient.search<RegistryEntry>({
    index: INDEX_NAMES.REGISTRY,
    size: 500,
    query: { match_all: {} },
  });
  return response.hits.hits
    .map((h) => h._source)
    .filter((s): s is RegistryEntry => s !== undefined);
}

function resolveCollection(
  def: (typeof COLLECTION_DEFINITIONS)[number],
  bySlug: Map<string, RegistryEntry>,
): Collection {
  const entries = def.members
    .map((m) => bySlug.get(m.id))
    .filter((e): e is RegistryEntry => e !== undefined);

  const sensitivity = entries.reduce<SensitivityLevel>(
    (max, e) =>
      SENS_RANK[e.sensitivity] > SENS_RANK[max] ? e.sensitivity : max,
    'public',
  );

  return {
    ...def,
    entries,
    count: entries.length,
    installs: entries.reduce((n, e) => n + (e.installs || 0), 0),
    sensitivity,
  };
}

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const all = await loadAllEntries();
    const bySlug = new Map(all.map((e) => [e.slug, e]));
    const collections = COLLECTION_DEFINITIONS.map((def) =>
      resolveCollection(def, bySlug),
    );
    res.json(collections);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const def = COLLECTION_DEFINITIONS.find((c) => c.id === id);
  if (!def) {
    res.status(404).json({ error: 'Not Found', message: `Collection ${id} not found` });
    return;
  }
  try {
    const all = await loadAllEntries();
    const bySlug = new Map(all.map((e) => [e.slug, e]));
    res.json(resolveCollection(def, bySlug));
  } catch (err) {
    next(err);
  }
});

export default router;
