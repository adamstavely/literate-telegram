/**
 * Downloads Agent Skills docs from refactored-palm-tree and generates
 * frontend/src/app/features/docs/skills-articles.ts
 *
 * Run: node scripts/sync-skills-docs.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../src/app/features/docs/skills-articles.ts');
const BASE = 'https://raw.githubusercontent.com/adamstavely/refactored-palm-tree/main/skills';

const ARTICLES = [
  {
    id: 'skills-overview',
    file: 'Skill overview.md',
    navLabel: 'Overview',
    updated: '2026-06-01',
  },
  {
    id: 'skills-quickstart',
    file: 'Skill getting started.md',
    navLabel: 'Quickstart',
    updated: '2026-06-01',
  },
  {
    id: 'skills-specification',
    file: 'Skill.md',
    navLabel: 'Specification',
    updated: '2026-06-01',
  },
  {
    id: 'skills-agent-integration',
    file: 'Agentskill.md',
    navLabel: 'Agent integration',
    updated: '2026-06-01',
  },
  {
    id: 'skills-best-practices',
    file: 'Best practices skills.md',
    navLabel: 'Best practices',
    updated: '2026-06-01',
  },
  {
    id: 'skills-descriptions',
    file: 'Skilldescriptions.md',
    navLabel: 'Skill descriptions',
    updated: '2026-06-01',
  },
  {
    id: 'skills-scripts',
    file: 'Skillscripts.md',
    navLabel: 'Using scripts',
    updated: '2026-06-01',
  },
  {
    id: 'skills-evaluating',
    file: 'Evalskills.md',
    navLabel: 'Evaluating skills',
    updated: '2026-06-01',
  },
];

const LINK_MAP = {
  '/specification': '/docs/skills-specification',
  '/skill-creation/quickstart': '/docs/skills-quickstart',
  '/skill-creation/best-practices': '/docs/skills-best-practices',
  '/skill-creation/evaluating-skills': '/docs/skills-evaluating',
  '/skill-creation/optimizing-descriptions': '/docs/skills-descriptions',
  '/skill-creation/using-scripts': '/docs/skills-scripts',
  '/clients': 'https://agentskills.io/clients',
};

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mapHref(href) {
  if (!href || href.startsWith('http') || href.startsWith('/docs/')) return href;
  const [path, hash] = href.split('#');
  const mapped = LINK_MAP[path] ?? (path.startsWith('/') ? `https://agentskills.io${path}` : href);
  return hash ? `${mapped}#${hash}` : mapped;
}

function preprocess(md) {
  let text = md;

  // Documentation index blockquote at the top.
  text = text.replace(/^> ## Documentation Index[\s\S]*?(?=\n# )/m, '');

  // React carousel + client data in overview.
  text = text.replace(/export const LogoCarousel[\s\S]*?\}\];\s*/m, '');
  text = text.replace(/<LogoCarousel[^/]*\/>\s*/g, '');

  // Card groups → doc cards.
  text = text.replace(
    /<CardGroup[^>]*>([\s\S]*?)<\/CardGroup>/g,
    (_, inner) => {
      const cards = [...inner.matchAll(/<Card\s+title="([^"]+)"[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/Card>/g)];
      if (!cards.length) return inner;
      const items = cards.map(([, title, href, body]) =>
        `<a href="${mapHref(href)}" class="doc-card"><div class="doc-card-t">${title}</div><div class="doc-card-b">${body.trim()}</div></a>`,
      ).join('');
      return `<div class="doc-cards">${items}</div>\n\n`;
    },
  );

  // Tabs → stacked sections.
  text = text.replace(/<Tabs[^>]*>([\s\S]*?)<\/Tabs>/g, (_, inner) => {
    const tabs = [...inner.matchAll(/<Tab title="([^"]+)">([\s\S]*?)<\/Tab>/g)];
    return tabs.map(([, title, body]) => `### ${title}\n\n${body.trim()}\n`).join('\n');
  });

  // Callout components.
  text = text.replace(/<Note>\s*([\s\S]*?)\s*<\/Note>/g, (_, body) =>
    `<div class="callout doc-callout">${body.trim()}</div>\n\n`,
  );
  text = text.replace(/<Tip>\s*([\s\S]*?)\s*<\/Tip>/g, (_, body) =>
    `<div class="callout accent doc-callout">${body.trim()}</div>\n\n`,
  );
  text = text.replace(/<Card>\s*([\s\S]*?)\s*<\/Card>/g, (_, body) =>
    `<div class="callout doc-callout">${body.trim()}</div>\n\n`,
  );

  // Code fence info strings: ```bash theme={null} → ```bash
  text = text.replace(/```(\S+?)(?:\s+\S+)*\s+theme=\{null\}/g, '```$1');
  text = text.replace(/```(\S+?)\s+theme=\{null\}/g, '```$1');
  text = text.replace(/```(\w+)\s+[\w./-]+\s+theme=\{null\}/g, '```$1');

  return text.trim();
}

function extractMeta(md) {
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const leadMatch = md.match(/^>\s+(.+)$/m);
  return {
    title: titleMatch?.[1]?.trim() ?? 'Untitled',
    lead: leadMatch?.[1]?.trim() ?? '',
  };
}

function estimateReadMinutes(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 220));
}

function postprocessHtml(html) {
  return html
    .replace(/<h2>([^<]+)<\/h2>/g, (_, t) => `<h2 id="${slugify(t)}" class="doc-h2">${t}</h2>`)
    .replace(/<h3>/g, '<h3 class="doc-h3">')
    .replace(/<p>/g, '<p class="doc-p">')
    .replace(/<ul>/g, '<ul class="doc-list">')
    .replace(/<ol>/g, '<ol class="doc-steps">')
    .replace(/<blockquote>/g, '<div class="callout doc-callout">')
    .replace(/<\/blockquote>/g, '</div>')
    .replace(/<pre><code/g, '<div class="codeblock"><pre><code')
    .replace(/<\/code><\/pre>/g, '</code></pre></div>')
    .replace(/<table>/g, '<div class="doc-table-wrap"><table class="doc-table">')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<code>/g, '<code class="doc-icode">')
    .replace(/<a href="([^"]+)"(?![^>]*class=)/g, (_, href) => `<a href="${mapHref(href)}" class="doc-link"`)
    .replace(/<code class="doc-icode">/g, '<code>'); // restore code blocks
}

function fixCodeBlocks(html) {
  return html.replace(
    /<div class="codeblock"><pre><code class="doc-icode">([\s\S]*?)<\/code><\/pre><\/div>/g,
    '<div class="codeblock"><pre><code>$1</code></pre></div>',
  );
}

function stripTitleAndLead(md) {
  return md
    .replace(/^#\s+.+\n?/m, '')
    .replace(/^>\s+.+\n?/m, '')
    .trim();
}

function renderMarkdown(md) {
  const stripped = stripTitleAndLead(md);
  const bodyStart = stripped.search(/^##\s/m);
  const rest = bodyStart >= 0 ? stripped.slice(bodyStart) : stripped;

  let html = marked.parse(rest, { async: false, gfm: true });
  html = postprocessHtml(html);
  html = fixCodeBlocks(html);
  return html;
}

async function fetchArticle(def) {
  const url = `${BASE}/${encodeURIComponent(def.file)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${def.file}: ${res.status}`);
  const raw = await res.text();
  const cleaned = preprocess(raw);
  const { title, lead } = extractMeta(cleaned);
  const body = renderMarkdown(cleaned);
  const read = estimateReadMinutes(cleaned);
  return { ...def, title, lead, body, read };
}

const articles = await Promise.all(ARTICLES.map(fetchArticle));

const navItems = articles.map(a => `    { id: '${a.id}', label: '${a.navLabel}' },`).join('\n');

const articleExports = articles.map(a => {
  const escapedBody = a.body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `  {
    id: '${a.id}',
    section: 'agent-skills',
    title: ${JSON.stringify(a.title)},
    navLabel: ${JSON.stringify(a.navLabel)},
    readTime: ${a.read},
    updatedAt: '${a.updated}',
    lead: ${JSON.stringify(a.lead)},
    body: \`${escapedBody}\`,
  }`;
}).join(',\n');

const output = `// Generated by scripts/sync-skills-docs.mjs — do not edit by hand.

export const SKILLS_NAV = {
  group: 'Agent Skills',
  sectionId: 'agent-skills',
  items: [
${navItems}
  ],
} as const;

export const SKILLS_ARTICLES = [
${articleExports},
];
`;

writeFileSync(OUT, output);
console.log(`Wrote ${articles.length} skill articles to ${OUT}`);
