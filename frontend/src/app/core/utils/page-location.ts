/** Sensitive query params that must not appear in client telemetry. */
const REDACTED_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'id_token',
  'code',
  'state',
  'session',
  'session_state',
]);

/**
 * Page location safe for audit/logging ingest — pathname + filtered search only.
 * Omits hash fragments and redacts common auth callback parameters.
 */
export function safePageLocation(): string {
  const { pathname, searchParams } = new URL(window.location.href);
  const filtered = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (REDACTED_QUERY_KEYS.has(key.toLowerCase())) {
      filtered.set(key, '[redacted]');
    } else {
      filtered.set(key, value);
    }
  }
  const qs = filtered.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
