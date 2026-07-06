import type { MappingProperty } from '@elastic/elasticsearch/lib/api/types.js';
import { config } from '../config/index.js';
import { esClient } from './client.js';
import { logger } from '../logger/logger.js';

const REGISTRY_INDEX = 'interop-registry';
const PENDING_INDEX = 'interop-pending';
const AUDIT_INDEX = config.logging.auditIndex;
const LOGS_INDEX = config.logging.logIndex;
const NOTIFICATIONS_INDEX = 'interop-notifications';
const NOTIFICATION_READS_INDEX = 'interop-notification-reads';
const POLICY_INDEX = 'interop-policy';
const SLUG_LOCKS_INDEX = 'interop-slug-locks';
const REGISTRY_SLUGS_INDEX = 'interop-registry-slugs';
const COLLECTIONS_INDEX = 'interop-collections';
const DOCS_FEEDBACK_INDEX = 'interop-docs-feedback';

export const INDEX_NAMES = {
  REGISTRY: REGISTRY_INDEX,
  PENDING: PENDING_INDEX,
  AUDIT: AUDIT_INDEX,
  LOGS: LOGS_INDEX,
  NOTIFICATIONS: NOTIFICATIONS_INDEX,
  NOTIFICATION_READS: NOTIFICATION_READS_INDEX,
  POLICY: POLICY_INDEX,
  SLUG_LOCKS: SLUG_LOCKS_INDEX,
  REGISTRY_SLUGS: REGISTRY_SLUGS_INDEX,
  COLLECTIONS: COLLECTIONS_INDEX,
  DOCS_FEEDBACK: DOCS_FEEDBACK_INDEX,
} as const;

// Rich per-endpoint sub-fields (populated by OpenAPI import). Shared between the
// registry + pending mappings and the additive putMapping migration so existing
// clusters gain the fields too. requestBody is a free-form shape — stored in
// _source but not indexed (avoids nested-mapping churn / explosion).
const ENDPOINT_PROPERTIES: Record<string, MappingProperty> = {
  method: { type: 'keyword' },
  path: { type: 'keyword' },
  summary: { type: 'text' },
  operationId: { type: 'keyword' },
  description: { type: 'text' },
  params: {
    type: 'nested',
    properties: {
      name: { type: 'keyword' },
      in: { type: 'keyword' },
      type: { type: 'keyword' },
      required: { type: 'boolean' },
      description: { type: 'text' },
    },
  },
  responses: {
    type: 'nested',
    properties: {
      status: { type: 'keyword' },
      description: { type: 'text' },
    },
  },
  requestBody: { type: 'object', enabled: false },
};

// Top-level fields for standalone `tool` entries (the same shape the `tools`
// nested block declares for a server's tools, but at the document root).
const TOOL_TOP_LEVEL_PROPERTIES: Record<string, MappingProperty> = {
  parentServer: { type: 'keyword' },
  returns: { type: 'keyword' },
  readOnly: { type: 'boolean' },
  params: {
    type: 'nested',
    properties: {
      name: { type: 'keyword' },
      type: { type: 'keyword' },
      description: { type: 'text' },
      required: { type: 'boolean' },
    },
  },
};

async function createILMPolicy(policyName: string, maxAgeDays: number): Promise<boolean> {
  try {
    await esClient.ilm.putLifecycle({
      name: policyName,
      policy: {
        phases: {
          hot: {
            min_age: '0ms',
            actions: {
              rollover: {
                max_age: `${maxAgeDays}d`,
                max_size: '10gb',
              },
            },
          },
          delete: {
            min_age: `${maxAgeDays * 3}d`,
            actions: {
              delete: {},
            },
          },
        },
      },
    });
    return true;
  } catch {
    // ILM might not be available in all ES configurations; proceed without it
    return false;
  }
}

async function indexExists(indexName: string): Promise<boolean> {
  try {
    const exists = await esClient.indices.exists({ index: indexName });
    return exists;
  } catch {
    return false;
  }
}

async function createRegistryIndex(): Promise<void> {
  if (await indexExists(REGISTRY_INDEX)) return;

  await esClient.indices.create({
    index: REGISTRY_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        name: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        slug: { type: 'keyword' },
        publisher: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        verified: { type: 'boolean' },
        summary: { type: 'text' },
        description: { type: 'text' },
        installs: { type: 'long' },
        sensitivity: { type: 'keyword' },
        categories: { type: 'keyword' },
        version: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        visibility: { type: 'keyword' },
        reviewDueAt: { type: 'date' },
        // Server fields
        transports: { type: 'keyword' },
        auth: { type: 'keyword' },
        clients: { type: 'keyword' },
        license: { type: 'keyword' },
        source: { type: 'keyword' },
        rating: { type: 'float' },
        tools: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            slug: { type: 'keyword' },
            summary: { type: 'text' },
            description: { type: 'text' },
            parentServer: { type: 'keyword' },
            returns: { type: 'keyword' },
            readOnly: { type: 'boolean' },
            params: {
              type: 'nested',
              properties: {
                name: { type: 'keyword' },
                type: { type: 'keyword' },
                description: { type: 'text' },
                required: { type: 'boolean' },
              },
            },
          },
        },
        // Skill fields
        triggers: { type: 'keyword' },
        reaches: { type: 'keyword' },
        tokens: { type: 'integer' },
        // Agent fields
        model: { type: 'keyword' },
        autonomy: { type: 'keyword' },
        servers: { type: 'keyword' },
        skills: { type: 'keyword' },
        // Standalone `tool` entry fields (root-level, distinct from server tools)
        ...TOOL_TOP_LEVEL_PROPERTIES,
        // API fields
        style: { type: 'keyword' },
        endpoint: { type: 'keyword' },
        wrappedBy: { type: 'keyword' },
        baseUrl: { type: 'keyword' },
        endpoints: {
          type: 'nested',
          properties: ENDPOINT_PROPERTIES,
        },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
      'index.max_result_window': 10000,
    },
  });
}

async function createPendingIndex(): Promise<void> {
  if (await indexExists(PENDING_INDEX)) return;

  await esClient.indices.create({
    index: PENDING_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        submittedBy: { type: 'keyword' },
        submittedAt: { type: 'date' },
        status: { type: 'keyword' },
        risk: { type: 'keyword' },
        flags: { type: 'keyword' },
        rejectReason: { type: 'text' },
        approvedBy: { type: 'keyword' },
        approvedAt: { type: 'date' },
        rejectedBy: { type: 'keyword' },
        rejectedAt: { type: 'date' },
        approvals: { type: 'keyword' },
        policyOverride: { type: 'boolean' },
        overrideReason: { type: 'text' },
        entry: {
          type: 'object',
          dynamic: false,
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            slug: { type: 'keyword' },
            publisher: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            summary: { type: 'text' },
            description: { type: 'text' },
            sensitivity: { type: 'keyword' },
            categories: { type: 'keyword' },
            version: { type: 'keyword' },
            visibility: { type: 'keyword' },
            transports: { type: 'keyword' },
            auth: { type: 'keyword' },
            clients: { type: 'keyword' },
            license: { type: 'keyword' },
            source: { type: 'keyword' },
            tools: {
              type: 'nested',
              properties: {
                id: { type: 'keyword' },
                name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                slug: { type: 'keyword' },
                summary: { type: 'text' },
                description: { type: 'text' },
                parentServer: { type: 'keyword' },
                returns: { type: 'keyword' },
                readOnly: { type: 'boolean' },
                params: {
                  type: 'nested',
                  properties: {
                    name: { type: 'keyword' },
                    type: { type: 'keyword' },
                    description: { type: 'text' },
                    required: { type: 'boolean' },
                  },
                },
              },
            },
            triggers: { type: 'keyword' },
            reaches: { type: 'keyword' },
            tokens: { type: 'integer' },
            model: { type: 'keyword' },
            autonomy: { type: 'keyword' },
            servers: { type: 'keyword' },
            skills: { type: 'keyword' },
            parentServer: { type: 'keyword' },
            returns: { type: 'keyword' },
            readOnly: { type: 'boolean' },
            style: { type: 'keyword' },
            endpoint: { type: 'keyword' },
            wrappedBy: { type: 'keyword' },
            baseUrl: { type: 'keyword' },
            endpoints: {
              type: 'nested',
              properties: ENDPOINT_PROPERTIES,
            },
          },
        },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

async function createAuditIndex(): Promise<void> {
  if (await indexExists(AUDIT_INDEX)) return;

  // Attach the ILM policy via a rollover write-alias: writes target the alias
  // (AUDIT_INDEX), which points at the current backing index. Without the alias
  // the policy's rollover action has nothing to act on.
  const ilmOk = await createILMPolicy('interop-audit-policy', 90);

  await esClient.indices.create({
    index: `${AUDIT_INDEX}-000001`,
    aliases: { [AUDIT_INDEX]: { is_write_index: true } },
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        userId: { type: 'keyword' },
        action: { type: 'keyword' },
        resource: { type: 'keyword' },
        resourceId: { type: 'keyword' },
        timestamp: { type: 'date' },
        ip: { type: 'ip' },
        userAgent: { type: 'keyword' },
        result: { type: 'keyword' },
        responseTime: { type: 'integer' },
        metadata: {
          type: 'object',
          dynamic: true,
        },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
      ...(ilmOk
        ? { lifecycle: { name: 'interop-audit-policy', rollover_alias: AUDIT_INDEX } }
        : {}),
    },
  });
}

async function createLogsIndex(): Promise<void> {
  if (await indexExists(LOGS_INDEX)) return;

  const ilmOk = await createILMPolicy('interop-logs-policy', 30);

  await esClient.indices.create({
    index: `${LOGS_INDEX}-000001`,
    aliases: { [LOGS_INDEX]: { is_write_index: true } },
    mappings: {
      dynamic: false,
      properties: {
        '@timestamp': { type: 'date' },
        level: { type: 'keyword' },
        message: { type: 'text' },
        correlationId: { type: 'keyword' },
        userId: { type: 'keyword' },
        service: { type: 'keyword' },
        method: { type: 'keyword' },
        path: { type: 'keyword' },
        statusCode: { type: 'integer' },
        duration: { type: 'integer' },
        stack: { type: 'text', index: false },
        meta: {
          type: 'object',
          dynamic: true,
        },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
      ...(ilmOk
        ? { lifecycle: { name: 'interop-logs-policy', rollover_alias: LOGS_INDEX } }
        : {}),
    },
  });
}

async function createNotificationsIndex(): Promise<void> {
  if (await indexExists(NOTIFICATIONS_INDEX)) return;

  await esClient.indices.create({
    index: NOTIFICATIONS_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        userId: { type: 'keyword' },
        type: { type: 'keyword' },
        title: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        body: { type: 'text' },
        read: { type: 'boolean' },
        createdAt: { type: 'date' },
        link: { type: 'keyword' },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

async function createNotificationReadsIndex(): Promise<void> {
  if (await indexExists(NOTIFICATION_READS_INDEX)) return;

  // Per-user read/dismissal receipts. Global notifications (no userId) are shared
  // documents, so their read state must live here, keyed by user, instead of
  // mutating the shared notification. Doc id is `${userId}::${notificationId}`.
  await esClient.indices.create({
    index: NOTIFICATION_READS_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        userId: { type: 'keyword' },
        notificationId: { type: 'keyword' },
        read: { type: 'boolean' },
        dismissed: { type: 'boolean' },
        updatedAt: { type: 'date' },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

async function createSlugLocksIndex(): Promise<void> {
  if (await indexExists(SLUG_LOCKS_INDEX)) return;

  await esClient.indices.create({
    index: SLUG_LOCKS_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        type: { type: 'keyword' },
        slug: { type: 'keyword' },
        entryId: { type: 'keyword' },
        claimedAt: { type: 'date' },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

async function createRegistrySlugsIndex(): Promise<void> {
  if (await indexExists(REGISTRY_SLUGS_INDEX)) return;

  // Document id is `${type}:${slug}` — ES create gives an atomic uniqueness
  // constraint for published registry entries (complements submit-time locks).
  await esClient.indices.create({
    index: REGISTRY_SLUGS_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        type: { type: 'keyword' },
        slug: { type: 'keyword' },
        entryId: { type: 'keyword' },
        reservedAt: { type: 'date' },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

async function createPolicyIndex(): Promise<void> {
  if (await indexExists(POLICY_INDEX)) return;

  await esClient.indices.create({
    index: POLICY_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        policy: {
          type: 'object',
          dynamic: false,
          properties: {
            readOnlyDefault: { type: 'boolean' },
            perToolApproval: { type: 'boolean' },
            blockWriteUntilReview: { type: 'boolean' },
            quarantineHighRisk: { type: 'boolean' },
            requireReview: { type: 'boolean' },
            autoApproveVerified: { type: 'boolean' },
            autoApproveSkills: { type: 'boolean' },
            twoApproversHighRisk: { type: 'boolean' },
            republishAfterDays: { type: 'integer' },
            defaultVisibility: { type: 'keyword' },
            transports: { type: 'flattened' },
            auth: { type: 'flattened' },
            scanInjection: { type: 'boolean' },
            requireTriggers: { type: 'boolean' },
            tokenCap: { type: 'boolean' },
          },
        },
        rules: {
          type: 'nested',
          dynamic: false,
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text' },
            cond: { type: 'keyword' },
            desc: { type: 'text' },
            severity: { type: 'keyword' },
            action: { type: 'keyword' },
            enabled: { type: 'boolean' },
            flag: { type: 'keyword' },
          },
        },
        domains: {
          type: 'nested',
          dynamic: false,
          properties: {
            d: { type: 'keyword' },
            verified: { type: 'boolean' },
          },
        },
        updatedAt: { type: 'date' },
        updatedBy: { type: 'keyword' },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

async function createCollectionsIndex(): Promise<void> {
  if (await indexExists(COLLECTIONS_INDEX)) return;

  await esClient.indices.create({
    index: COLLECTIONS_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        desc: { type: 'text' },
        blurb: { type: 'text' },
        icon: { type: 'keyword' },
        curator: { type: 'keyword' },
        accent: { type: 'keyword' },
        members: {
          type: 'nested',
          properties: {
            kind: { type: 'keyword' },
            id: { type: 'keyword' },
          },
        },
        createdBy: { type: 'keyword' },
        createdAt: { type: 'date' },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

async function createDocsFeedbackIndex(): Promise<void> {
  if (await indexExists(DOCS_FEEDBACK_INDEX)) return;

  await esClient.indices.create({
    index: DOCS_FEEDBACK_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        page_path: { type: 'keyword' },
        page_title: { type: 'keyword' },
        helpful: { type: 'keyword' },
        message: { type: 'text', index: false },
        visitor_id: { type: 'keyword' },
        '@timestamp': { type: 'date' },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
    },
  });
}

/**
 * Additive mapping migration for clusters created before the rich endpoint /
 * standalone-tool fields existed. `create` is guarded by `indexExists`, so an
 * existing index never picks up new fields on its own; under `dynamic: false`
 * those fields would be silently un-indexed (retained in _source, so display
 * still works, but unsearchable). putMapping only adds fields — it never
 * rewrites or reindexes — so this is safe to run on every startup. Best-effort:
 * a failure here must not stop the server from starting.
 */
async function migrateMappings(): Promise<void> {
  const targets: Array<{ index: string; label: string }> = [
    { index: REGISTRY_INDEX, label: 'registry' },
    { index: PENDING_INDEX, label: 'pending' },
  ];
  for (const { index, label } of targets) {
    try {
      if (!(await indexExists(index))) continue;
      const properties: Record<string, MappingProperty> =
        index === PENDING_INDEX
          ? { entry: { properties: { ...TOOL_TOP_LEVEL_PROPERTIES, endpoints: { type: 'nested', properties: ENDPOINT_PROPERTIES } } } }
          : { ...TOOL_TOP_LEVEL_PROPERTIES, endpoints: { type: 'nested', properties: ENDPOINT_PROPERTIES } };
      await esClient.indices.putMapping({ index, properties });
    } catch (err) {
      logger.warn('Additive mapping migration failed (non-fatal)', {
        index: label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function setupIndices(): Promise<void> {
  await Promise.all([
    createRegistryIndex(),
    createPendingIndex(),
    createAuditIndex(),
    createLogsIndex(),
    createNotificationsIndex(),
    createNotificationReadsIndex(),
    createPolicyIndex(),
    createSlugLocksIndex(),
    createRegistrySlugsIndex(),
    createCollectionsIndex(),
    createDocsFeedbackIndex(),
  ]);
  // After indices exist, backfill mappings on any pre-existing cluster.
  await migrateMappings();
}
