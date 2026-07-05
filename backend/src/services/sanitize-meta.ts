const MAX_KEYS = 20;
const MAX_VALUE_LEN = 500;

/**
 * Bound and flatten untrusted client-supplied metadata before it lands in a
 * dynamically-mapped Elasticsearch object. Unbounded keys or deeply nested
 * values from an (unauthenticated, rate-limited) ingest endpoint could
 * otherwise explode the index mapping or bloat storage. Keeps at most
 * `MAX_KEYS` keys, coerces values to primitives, and truncates long strings.
 */
export function boundedMeta(
  meta: unknown,
  opts: { maxKeys?: number; maxValueLen?: number; excludeKeys?: string[] } = {},
): Record<string, unknown> {
  const maxKeys = opts.maxKeys ?? MAX_KEYS;
  const maxValueLen = opts.maxValueLen ?? MAX_VALUE_LEN;
  const exclude = new Set(opts.excludeKeys ?? []);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (exclude.has(key)) continue;
    if (count >= maxKeys) break;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, maxValueLen);
    } else {
      try {
        out[key] = JSON.stringify(value).slice(0, maxValueLen);
      } catch {
        out[key] = '[unserializable]';
      }
    }
    count += 1;
  }
  return out;
}
