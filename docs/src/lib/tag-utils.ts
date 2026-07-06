/** Pure tag helpers — no doc glob imports (avoids cycles with docs.ts). */

/** Turn a display tag into a URL-safe slug. */
export function slugifyTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Link to a single tag's page. */
export function tagHref(slug: string): string {
  return `/docs/tags/${slug}`;
}

/** Link to the tags index. */
export function tagsIndexHref(): string {
  return '/docs/tags';
}
