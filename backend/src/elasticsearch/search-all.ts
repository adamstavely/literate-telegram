import { esClient } from './client.js';

const DEFAULT_PAGE_SIZE = 500;

type SearchHit<T> = {
  _source?: T;
  sort?: unknown[];
};

type SearchSort = Array<Record<string, 'asc' | 'desc'>>;

/**
 * Paginate through all matching documents using search_after.
 * Requires a stable sort key on every document in the index.
 */
export async function searchAll<T>(
  index: string,
  query: Record<string, unknown>,
  options: {
    pageSize?: number;
    sort?: SearchSort;
    source?: string[] | boolean;
  } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const sort: SearchSort = options.sort ?? [{ createdAt: 'desc' }, { _id: 'asc' }];
  const results: T[] = [];
  let searchAfter: unknown[] | undefined;

  while (true) {
    const response = await esClient.search<T>({
      index,
      size: pageSize,
      sort,
      query,
      ...(options.source !== undefined ? { _source: options.source } : {}),
      ...(searchAfter ? { search_after: searchAfter } : {}),
    });

    const hits = response.hits.hits as SearchHit<T>[];
    if (hits.length === 0) break;

    for (const hit of hits) {
      if (hit._source !== undefined) results.push(hit._source);
    }

    const last = hits[hits.length - 1];
    if (!last?.sort || hits.length < pageSize) break;
    searchAfter = last.sort;
  }

  return results;
}
