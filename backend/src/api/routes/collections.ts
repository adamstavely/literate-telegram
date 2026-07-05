import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { COLLECTION_DEFINITIONS } from '../../data/collections.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { auditAction } from '../../middleware/audit.js';
import {
  Collection,
  CollectionDefinition,
  CollectionMember,
  CollectionMemberKind,
  RegistryEntry,
  SensitivityLevel,
} from '../../types/index.js';
import { logger } from '../../logger/logger.js';

const router = Router();

const MEMBER_KINDS: readonly CollectionMemberKind[] = ['server', 'skill', 'agent', 'api'];

async function loadCreatedDefinitions(): Promise<CollectionDefinition[]> {
  try {
    const response = await esClient.search<CollectionDefinition>({
      index: INDEX_NAMES.COLLECTIONS,
      size: 200,
      query: { match_all: {} },
    });
    return response.hits.hits
      .map((h) => h._source)
      .filter((s): s is CollectionDefinition => s !== undefined);
  } catch {
    // Index may not exist yet — only the curated definitions are available.
    return [];
  }
}

async function allDefinitions(): Promise<CollectionDefinition[]> {
  const created = await loadCreatedDefinitions();
  return [...COLLECTION_DEFINITIONS, ...created];
}

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
    const [all, defs] = await Promise.all([loadAllEntries(), allDefinitions()]);
    const bySlug = new Map(all.map((e) => [e.slug, e]));
    const collections = defs.map((def) => resolveCollection(def, bySlug));
    res.json(collections);
  } catch (err) {
    next(err);
  }
});

// POST /api/collections — create a curated collection (icon + accent + members).
// Curated collections are a governance surface, so creation is admin-only.
router.post(
  '/',
  requireAuth,
  requireAdmin,
  [
    body('title').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Title must be 2-100 characters'),
    body('desc').isString().trim().isLength({ min: 3, max: 280 }).withMessage('Description is required'),
    body('icon').isString().trim().isLength({ min: 1, max: 40 }),
    body('accent').isString().trim().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Accent must be a hex color'),
    body('members').isArray({ min: 1 }).withMessage('At least one member is required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    try {
      const b = req.body as {
        title: string; desc: string; blurb?: string; icon: string; accent: string;
        members: Array<{ kind?: string; id?: string }>;
      };

      const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const members: CollectionMember[] = b.members
        .filter((m) => typeof m?.id === 'string' && m.id.trim() !== '')
        .map((m) => ({
          kind: MEMBER_KINDS.includes(m.kind as CollectionMemberKind) ? (m.kind as CollectionMemberKind) : 'server',
          id: String(m.id).trim(),
        }));

      if (members.length === 0) {
        res.status(422).json({ error: 'Validation Error', message: 'At least one valid member is required', correlationId: req.id });
        return;
      }

      const def: CollectionDefinition = {
        id: `${slug}-${uuidv4().slice(0, 6)}`,
        title: b.title.trim(),
        desc: b.desc.trim(),
        blurb: (b.blurb?.trim() || b.desc.trim()),
        icon: b.icon.trim(),
        curator: req.user?.name ?? req.user?.sub ?? 'community',
        accent: b.accent,
        members,
      };

      await esClient.index({
        index: INDEX_NAMES.COLLECTIONS,
        id: def.id,
        document: { ...def, createdBy: req.user!.sub, createdAt: new Date().toISOString() },
        refresh: 'wait_for',
      });

      await auditAction(req, 'CREATE_COLLECTION', def.id, { title: def.title, members: members.length });
      logger.info('Collection created', { correlationId: req.id, userId: req.user?.sub, collectionId: def.id });

      const all = await loadAllEntries();
      const bySlug = new Map(all.map((e) => [e.slug, e]));
      res.status(201).json(resolveCollection(def, bySlug));
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  try {
    const defs = await allDefinitions();
    const def = defs.find((c) => c.id === id);
    if (!def) {
      res.status(404).json({ error: 'Not Found', message: `Collection ${id} not found` });
      return;
    }
    const all = await loadAllEntries();
    const bySlug = new Map(all.map((e) => [e.slug, e]));
    res.json(resolveCollection(def, bySlug));
  } catch (err) {
    next(err);
  }
});

export default router;
