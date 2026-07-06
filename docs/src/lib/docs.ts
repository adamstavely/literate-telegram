import { ALL_DOC_ITEMS } from './nav';
import { slugifyTag } from './tag-utils';

export { slugifyTag, tagHref, tagsIndexHref } from './tag-utils';

/** A documentation page with its topic tags. */
export interface RawDoc {
  id: string;
  title: string;
  description?: string;
  url: string;
  order: number;
  /** Display labels, trimmed but original casing preserved. */
  tags: string[];
}

/** A tag aggregated across all docs. */
export interface TagInfo {
  slug: string;
  display: string;
  count: number;
}

const loaders = import.meta.glob<{
  frontmatter: {
    title: string;
    description?: string;
    tags?: string[];
  };
  url?: string;
}>('../pages/docs/**/*.mdx', { eager: false });

let cache: RawDoc[] | null = null;

function docIdFromUrl(url: string): string {
  return url.replace(/^\/docs\//, '').replace(/\/+$/, '');
}

function navOrder(id: string): number {
  const idx = ALL_DOC_ITEMS.findIndex((d) => d.id === id);
  return idx >= 0 ? idx : 999;
}

/** Every doc, resolved once and memoized. */
export async function getAllDocs(): Promise<RawDoc[]> {
  if (cache) return cache;
  const mods = await Promise.all(Object.values(loaders).map((load) => load()));
  cache = mods
    .filter((m) => m.url && !m.url.includes('/tags/'))
    .map((m) => {
      const url = m.url as string;
      const id = docIdFromUrl(url);
      return {
        id,
        title: m.frontmatter.title,
        description: m.frontmatter.description,
        url,
        order: navOrder(id),
        tags: (m.frontmatter.tags ?? []).map((t) => t.trim()).filter(Boolean),
      };
    });
  return cache;
}

/** All tags with counts, deduped by slug, sorted by count desc then display. */
export async function getAllTags(): Promise<TagInfo[]> {
  const docs = await getAllDocs();
  const bySlug = new Map<string, TagInfo>();
  for (const doc of docs) {
    for (const tag of doc.tags) {
      const slug = slugifyTag(tag);
      if (!slug) continue;
      const existing = bySlug.get(slug);
      if (existing) existing.count += 1;
      else bySlug.set(slug, { slug, display: tag, count: 1 });
    }
  }
  return [...bySlug.values()].sort(
    (a, b) => b.count - a.count || a.display.localeCompare(b.display),
  );
}

/** Docs carrying a given tag slug, sorted in sidebar order. */
export async function getDocsByTag(slug: string): Promise<RawDoc[]> {
  const docs = await getAllDocs();
  return docs
    .filter((d) => d.tags.some((t) => slugifyTag(t) === slug))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Other docs sharing at least one tag with the current doc. */
export async function getRelatedByTags(
  pathname: string,
  tags: string[],
  limit = 4,
): Promise<RawDoc[]> {
  const slugs = new Set(tags.map(slugifyTag).filter(Boolean));
  if (slugs.size === 0) return [];
  const here = pathname.replace(/\/+$/, '') || '/';
  return (await getAllDocs())
    .filter(
      (d) =>
        d.url.replace(/\/+$/, '') !== here &&
        d.tags.some((t) => slugs.has(slugifyTag(t))),
    )
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .slice(0, limit);
}
