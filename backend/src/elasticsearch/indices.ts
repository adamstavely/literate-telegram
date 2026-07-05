import { esClient } from './client.js';

const REGISTRY_INDEX = 'interop-registry';
const PENDING_INDEX = 'interop-pending';
const AUDIT_INDEX = 'interop-audit';
const LOGS_INDEX = 'interop-logs';
const NOTIFICATIONS_INDEX = 'interop-notifications';
const NOTIFICATION_READS_INDEX = 'interop-notification-reads';
const POLICY_INDEX = 'interop-policy';

export const INDEX_NAMES = {
  REGISTRY: REGISTRY_INDEX,
  PENDING: PENDING_INDEX,
  AUDIT: AUDIT_INDEX,
  LOGS: LOGS_INDEX,
  NOTIFICATIONS: NOTIFICATIONS_INDEX,
  NOTIFICATION_READS: NOTIFICATION_READS_INDEX,
  POLICY: POLICY_INDEX,
} as const;

async function createILMPolicy(policyName: string, maxAgeDays: number): Promise<void> {
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
  } catch {
    // ILM might not be available in all ES configurations; proceed without it
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
        // API fields
        style: { type: 'keyword' },
        endpoint: { type: 'keyword' },
        wrappedBy: { type: 'keyword' },
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
        entry: {
          type: 'object',
          dynamic: true,
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

  await createILMPolicy('interop-audit-policy', 90);

  await esClient.indices.create({
    index: AUDIT_INDEX,
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
    },
  });
}

async function createLogsIndex(): Promise<void> {
  if (await indexExists(LOGS_INDEX)) return;

  await createILMPolicy('interop-logs-policy', 30);

  await esClient.indices.create({
    index: LOGS_INDEX,
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

async function createPolicyIndex(): Promise<void> {
  if (await indexExists(POLICY_INDEX)) return;

  await esClient.indices.create({
    index: POLICY_INDEX,
    mappings: {
      dynamic: false,
      properties: {
        id: { type: 'keyword' },
        policy: { type: 'object', dynamic: true },
        rules: { type: 'object', dynamic: true },
        domains: { type: 'object', dynamic: true },
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

export async function setupIndices(): Promise<void> {
  await Promise.all([
    createRegistryIndex(),
    createPendingIndex(),
    createAuditIndex(),
    createLogsIndex(),
    createNotificationsIndex(),
    createNotificationReadsIndex(),
    createPolicyIndex(),
  ]);
}
