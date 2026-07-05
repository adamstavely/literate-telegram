import { Client } from '@elastic/elasticsearch';
import { config } from '../config/index.js';

/** Shared Elasticsearch client options for the main client and logger transport. */
export function buildEsClientOptions(): ConstructorParameters<typeof Client>[0] {
  const options: ConstructorParameters<typeof Client>[0] = {
    node: config.elasticsearch.node,
    auth: {
      username: config.elasticsearch.username,
      password: config.elasticsearch.password,
    },
    maxRetries: 3,
    requestTimeout: 30000,
    sniffOnStart: false,
  };

  if (config.elasticsearch.caFingerprint) {
    options.caFingerprint = config.elasticsearch.caFingerprint;
    options.tls = { rejectUnauthorized: true };
  }

  return options;
}
