/** Left-sidebar navigation — mirrors `project/docs-content.js` NAV. */
export interface DocNavItem {
  id: string;
  label: string;
  href: string;
}

export interface DocNavGroup {
  group: string;
  sectionId: string;
  items: DocNavItem[];
}

const item = (id: string, label: string): DocNavItem => ({
  id,
  label,
  href: `/docs/${id}`,
});

export const DOC_NAV: DocNavGroup[] = [
  {
    group: 'Getting started',
    sectionId: 'getting-started',
    items: [
      item('overview', 'Overview'),
      item('quickstart', 'Quickstart'),
      item('concepts', 'Core concepts'),
    ],
  },
  {
    group: 'Object types',
    sectionId: 'object-types',
    items: [
      item('apis', 'APIs'),
      item('servers', 'MCP servers'),
      item('tools', 'Tools'),
      item('skills', 'Skills'),
      item('agents', 'Agents'),
    ],
  },
  {
    group: 'Governance',
    sectionId: 'governance',
    items: [
      item('least-privilege', 'Least privilege'),
      item('publishing', 'Publishing & review'),
    ],
  },
  {
    group: 'Reference',
    sectionId: 'reference',
    items: [
      item('skill-spec', 'SKILL.md spec'),
      item('transports', 'Transports & auth'),
      item('compatibility', 'Client compatibility'),
    ],
  },
  {
    group: 'Agent Skills',
    sectionId: 'agent-skills',
    items: [
      item('skills-overview', 'Overview'),
      item('skills-quickstart', 'Quickstart'),
      item('skills-specification', 'Specification'),
      item('skills-agent-integration', 'Agent integration'),
      item('skills-best-practices', 'Best practices'),
      item('skills-descriptions', 'Skill descriptions'),
      item('skills-scripts', 'Using scripts'),
      item('skills-evaluating', 'Evaluating skills'),
    ],
  },
];

/** Flat ordered list of every doc page for prev/next navigation. */
export const ALL_DOC_ITEMS: DocNavItem[] = DOC_NAV.flatMap((g) => g.items);

/** Return the nav item id that matches the current pathname, if any. */
export function activeNavId(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  for (const section of DOC_NAV) {
    for (const navItem of section.items) {
      if (normalized === navItem.href || normalized.endsWith(`/${navItem.id}`)) {
        return navItem.id;
      }
    }
  }
  return null;
}

/** Previous and next articles in sidebar order. */
export function getDocSiblings(articleId: string | null): {
  prev: DocNavItem | null;
  next: DocNavItem | null;
} {
  if (!articleId) return { prev: null, next: null };
  const idx = ALL_DOC_ITEMS.findIndex((d) => d.id === articleId);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? ALL_DOC_ITEMS[idx - 1] : null,
    next: idx >= 0 && idx < ALL_DOC_ITEMS.length - 1 ? ALL_DOC_ITEMS[idx + 1] : null,
  };
}

/** Human-readable title for pager labels (nav label is often enough). */
export function pagerTitle(item: DocNavItem, pageTitle?: string): string {
  return pageTitle ?? item.label;
}
