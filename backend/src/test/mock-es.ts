import { esClient } from '../elasticsearch/client.js';

const originals = new Map<string, unknown>();

export function stubEs(method: string, impl: unknown): void {
  const client = esClient as unknown as Record<string, unknown>;
  if (!originals.has(method)) {
    originals.set(method, client[method]);
  }
  client[method] = impl;
}

export function restoreEs(): void {
  const client = esClient as unknown as Record<string, unknown>;
  for (const [method, original] of originals) {
    client[method] = original;
  }
  originals.clear();
}
