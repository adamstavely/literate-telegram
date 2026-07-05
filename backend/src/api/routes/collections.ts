import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { COLLECTION_DEFINITIONS } from '../../data/collections.js';
import { requireAuth, requireAdmin, optionalAuth } from '../../middleware/auth.js';
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
import { registryVisibilityFilter, entryVisibleToCaller } from '../../services/visibility.js';

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

function memberKey(member: CollectionMember): string {
  return `${member.kind}:${member.id}`;
}

async function loadEntriesByMembers(
  members: CollectionMember[],
  req: Request,
): Promise<Map<string, RegistryEntry>> {
  const unique = [...new Map(members.map((m) => [memberKey(m), m])).values()];
  if (unique.length === 0) return new Map();

  const response = await esClient.search<RegistryEntry>({
    index: INDEX_NAMES.REGISTRY,
    size: unique.length,
    query: {
      bool: {
        filter: [registryVisibilityFilter(req)],
        should: unique.map((m) => ({
          bool: {
            filter: [{ term: { slug: m.id } }, { term: { type: m.kind } }],
          },
        })),
        minimum_should_match: 1,
      },
    },
  });

  const byMember = new Map<string, RegistryEntry>();
  for (const hit of response.hits.hits) {
    if (hit._source && entryVisibleToCaller(hit._source, req)) {
      byMember.set(`${hit._source.type}:${hit._source.slug}`, hit._source);
    }
  }
  return byMember;
}

async function loadEntriesForDefinitions(
  defs: CollectionDefinition[],
  req: Request,
): Promise<Map<string, RegistryEntry>> {
  const members = defs.flatMap((d) => d.members);
  return loadEntriesByMembers(members, req);
}

function resolveCollection(
  def: (typeof COLLECTION_DEFINITIONS)[number],
  byMember: Map<string, RegistryEntry>,
): Collection {
  const entries = def.members
    .map((m) => byMember.get(memberKey(m)))
    .filter((e): e is RegistryEntry => e !== undefined);

  const sensitivity = entries.reduce<SensitivityLevel>(
    (max, e) =>
      SENS_RANK[e.sensitivity] > SENS_RANK[max] ? e.sensitivity : max,
    'public',
  );

  const visibleMembers = def.members.filter((m) => byMember.has(memberKey(m)));

  return {
    ...def,
    members: visibleMembers,
    entries,
    count: entries.length,
    installs: entries.reduce((n, e) => n + (e.installs || 0), 0),
    sensitivity,
  };
}

router.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defs = await allDefinitions();
    const byMember = await loadEntriesForDefinitions(defs, req);
    const collections = defs.map((def) => resolveCollection(def, byMember));
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
      const members: CollectionMember[] = [];
      for (const raw of b.members) {
        if (typeof raw?.id !== 'string' || raw.id.trim() === '') continue;
        if (!MEMBER_KINDS.includes(raw.kind as CollectionMemberKind)) {
          res.status(422).json({
            error: 'Validation Error',
            message: `Invalid member kind "${String(raw.kind)}" — must be one of: ${MEMBER_KINDS.join(', ')}`,
            correlationId: req.id,
          });
          return;
        }
        members.push({ kind: raw.kind as CollectionMemberKind, id: raw.id.trim() });
      }

      if (members.length === 0) {
        res.status(422).json({ error: 'Validation Error', message: 'At least one valid member is required', correlationId: req.id });
        return;
      }

      const byMember = await loadEntriesByMembers(members, req);
      const missing = members.filter((m) => !byMember.has(memberKey(m)));
      if (missing.length > 0) {
        res.status(422).json({
          error: 'Validation Error',
          message: 'One or more member slugs were not found in the registry.',
          missing: missing.map((m) => ({ kind: m.kind, id: m.id })),
          correlationId: req.id,
        });
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

      res.status(201).json(resolveCollection(def, byMember));
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  try {
    const defs = await allDefinitions();
    const def = defs.find((c) => c.id === id);
    if (!def) {
      res.status(404).json({ error: 'Not Found', message: `Collection ${id} not found` });
      return;
    }
    const byMember = await loadEntriesByMembers(def.members, req);
    res.json(resolveCollection(def, byMember));
  } catch (err) {
    next(err);
  }
});

export default router;
