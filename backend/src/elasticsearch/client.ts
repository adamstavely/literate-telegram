import { Client } from '@elastic/elasticsearch';
import { config } from '../config/index.js';

const clientOptions: ConstructorParameters<typeof Client>[0] = {
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
  clientOptions.tls = {
    ca: config.elasticsearch.caFingerprint,
    rejectUnauthorized: true,
  };
}

export const esClient = new Client(clientOptions);

export async function pingElasticsearch(): Promise<boolean> {
  try {
    await esClient.ping();
    return true;
  } catch {
    return false;
  }
}
