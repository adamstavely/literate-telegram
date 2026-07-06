/** Sensitive query params that must not appear in client telemetry. */
const REDACTED_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'state',
  'session',
  'session_state',
  'password',
  'pwd',
  'secret',
  'client_secret',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'nonce',
  'code_challenge',
  'code_verifier',
]);

const SENSITIVE_KEY_PATTERN = /(?:token|secret|password|credential|auth|session|code)/i;

function shouldRedactQueryKey(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACTED_QUERY_KEYS.has(lower) || SENSITIVE_KEY_PATTERN.test(lower);
}

/**
 * Page location safe for audit/logging ingest — pathname + filtered search only.
 * Omits hash fragments and redacts common auth callback parameters.
 */
export function safePageLocation(): string {
  const { pathname, searchParams } = new URL(window.location.href);
  const filtered = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (shouldRedactQueryKey(key)) {
      filtered.set(key, '[redacted]');
    } else {
      filtered.set(key, value);
    }
  });
  const qs = filtered.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
