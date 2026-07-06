/** Max length for client-supplied URL paths in telemetry ingest. */
export const MAX_INGEST_URL_LEN = 2048;

/** Max length for client-supplied user-agent strings in log ingest. */
export const MAX_INGEST_UA_LEN = 512;

export function boundedIngestString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}
