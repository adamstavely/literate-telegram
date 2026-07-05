import { Client } from '@elastic/elasticsearch';
import { buildEsClientOptions } from './client-options.js';

export const esClient = new Client(buildEsClientOptions());

export async function pingElasticsearch(): Promise<boolean> {
  try {
    await esClient.ping();
    return true;
  } catch {
    return false;
  }
}
