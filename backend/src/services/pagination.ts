/** Elasticsearch default max result window (from + size). */
export const ES_MAX_RESULT_WINDOW = 10_000;

/** Clamp page so from + size stays within the ES result window. */
export function clampPage(page: number, size: number): number {
  const safeSize = Math.max(1, size);
  const maxPage = Math.max(0, Math.floor(ES_MAX_RESULT_WINDOW / safeSize) - 1);
  return Math.min(Math.max(0, page), maxPage);
}

export function paginationFrom(page: number, size: number): number {
  return clampPage(page, size) * Math.max(1, size);
}
