import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import Transport from 'winston-transport';
import { config } from '../config/index.js';

interface LogInfo {
  level: string;
  message: string;
  correlationId?: string;
  userId?: string;
  [key: string]: unknown;
}

class ElasticsearchTransport extends Transport {
  private client: Client;
  private index: string;
  private buffer: LogInfo[];
  private flushTimer: NodeJS.Timeout | null;
  private readonly bufferSize: number;
  private readonly flushInterval: number;

  constructor(
    opts: Transport.TransportStreamOptions & {
      client: Client;
      index: string;
      bufferSize?: number;
      flushInterval?: number;
    }
  ) {
    super(opts);
    this.client = opts.client;
    this.index = opts.index;
    this.buffer = [];
    this.flushTimer = null;
    this.bufferSize = opts.bufferSize ?? 50;
    this.flushInterval = opts.flushInterval ?? 5000;
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushInterval);
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  log(info: unknown, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const logInfo = info as LogInfo;
    const { level, message, correlationId, userId, ...rest } = logInfo;
    this.buffer.push({
      '@timestamp': new Date().toISOString(),
      level,
      message,
      correlationId,
      userId,
      service: 'interop-backend',
      ...rest,
    });

    if (this.buffer.length >= this.bufferSize) {
      void this.flush();
    }

    callback();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const docs = this.buffer.splice(0, this.buffer.length);
    const body = docs.flatMap((doc) => [
      { index: { _index: this.index } },
      doc,
    ]);

    try {
      const result = await this.client.bulk({ body });
      if (result.errors) {
        const failed = result.items?.filter((item) => {
          const status = item.index?.status ?? item.create?.status ?? 200;
          return status >= 400;
        }).length ?? 0;
        console.error(`Elasticsearch log transport: ${failed}/${docs.length} documents failed to index`);
      }
    } catch (err) {
      console.error('Elasticsearch log transport bulk write failed', {
        error: err instanceof Error ? err.message : String(err),
        batchSize: docs.length,
      });
    }
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
  }
}

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isDev = config.nodeEnv === 'development';

// Lazy ES client to avoid circular dependency with esClient module
let _esTransport: ElasticsearchTransport | null = null;

function getEsTransport(): ElasticsearchTransport {
  if (!_esTransport) {
    // Import lazily to avoid circular dependency
    const { Client } = require('@elastic/elasticsearch') as { Client: typeof import('@elastic/elasticsearch').Client };
    const { buildEsClientOptions } = require('../elasticsearch/client-options.js') as {
      buildEsClientOptions: typeof import('../elasticsearch/client-options.js').buildEsClientOptions;
    };
    const esClient = new Client(buildEsClientOptions());
    _esTransport = new ElasticsearchTransport({
      client: esClient,
      index: config.logging.logIndex,
      level: 'warn',
    });
  }
  return _esTransport;
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    json()
  ),
  defaultMeta: { service: 'interop-backend' },
  transports: [
    isDev
      ? new winston.transports.Console({
          format: combine(colorize(), simple()),
        })
      : new winston.transports.Console({
          format: combine(timestamp(), json()),
        }),
  ],
  exitOnError: false,
});

// Add ES transport after logger is created (non-blocking)
setImmediate(() => {
  try {
    logger.add(getEsTransport());
  } catch {
    // Proceed without ES transport if unavailable
  }
});

export function createRequestLogger(correlationId: string, userId?: string): winston.Logger {
  return logger.child({ correlationId, userId });
}
