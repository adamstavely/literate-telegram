#!/usr/bin/env node
/**
 * Fetches Agent Skills docs and writes docs/src/pages/docs/skills-*.mdx.
 * Run from repo root: node docs/scripts/sync-skills-mdx.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const outDir = join(root, 'docs/src/pages/docs');
const ARTICLE_TAGS = JSON.parse(
  readFileSync(join(__dirname, '../content/doc-tags.json'), 'utf8'),
);
const BASE = 'https://raw.githubusercontent.com/adamstavely/refactored-palm-tree/main/skills';

const ARTICLES = [
  { id: 'skills-overview', file: 'Skill overview.md', navLabel: 'Overview' },
  { id: 'skills-quickstart', file: 'Skill getting started.md', navLabel: 'Quickstart' },
  { id: 'skills-specification', file: 'Skill.md', navLabel: 'Specification' },
  { id: 'skills-agent-integration', file: 'Agentskill.md', navLabel: 'Agent integration' },
  { id: 'skills-best-practices', file: 'Best practices skills.md', navLabel: 'Best practices' },
  { id: 'skills-descriptions', file: 'Skilldescriptions.md', navLabel: 'Skill descriptions' },
  { id: 'skills-scripts', file: 'Skillscripts.md', navLabel: 'Using scripts' },
  { id: 'skills-evaluating', file: 'Evalskills.md', navLabel: 'Evaluating skills' },
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

function mapHref(href) {
  if (!href || href.startsWith('http') || href.startsWith('/docs/')) return href;
  const [path, hash] = href.split('#');
  const mapped = LINK_MAP[path] ?? (path.startsWith('/') ? `https://agentskills.io${path}` : href);
  return hash ? `${mapped}#${hash}` : mapped;
}

function preprocess(md) {
  let text = md;
  text = text.replace(/^> ## Documentation Index[\s\S]*?(?=\n# )/m, '');
  text = text.replace(/export const LogoCarousel[\s\S]*?\}\];\s*/m, '');
  text = text.replace(/<LogoCarousel[^/]*\/>\s*/g, '');

  text = text.replace(
    /<CardGroup[^>]*>([\s\S]*?)<\/CardGroup>/g,
    (_, inner) => {
      const cards = [...inner.matchAll(/<Card\s+title="([^"]+)"[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/Card>/g)];
      if (!cards.length) return inner;
      const items = cards
        .map(([, title, href, body]) =>
          `  { title: ${JSON.stringify(title)}, body: ${JSON.stringify(body.trim())}, href: ${JSON.stringify(mapHref(href))} }`,
        )
        .join(',\n');
      return `\n<DocCards items={[\n${items}\n]} />\n\n`;
    },
  );

  text = text.replace(/<Tabs[^>]*>([\s\S]*?)<\/Tabs>/g, (_, inner) => {
    const tabs = [...inner.matchAll(/<Tab title="([^"]+)">([\s\S]*?)<\/Tab>/g)];
    return tabs.map(([, title, body]) => `### ${title}\n\n${body.trim()}\n`).join('\n');
  });

  text = text.replace(/<Note>\s*([\s\S]*?)\s*<\/Note>/g, (_, body) =>
    `\n<Callout>${body.trim()}</Callout>\n\n`,
  );
  text = text.replace(/<Tip>\s*([\s\S]*?)\s*<\/Tip>/g, (_, body) =>
    `\n<Callout tone="accent">${body.trim()}</Callout>\n\n`,
  );
  text = text.replace(/<Card>\s*([\s\S]*?)\s*<\/Card>/g, (_, body) =>
    `\n<Callout>${body.trim()}</Callout>\n\n`,
  );

  text = text.replace(/```(\S+?)(?:\s+\S+)*\s+theme=\{null\}/g, '```$1');
  text = text.replace(/```(\S+?)\s+theme=\{null\}/g, '```$1');
  text = text.replace(/```(\w+)\s+[\w./-]+\s+theme=\{null\}/g, '```$1');

  // Rewrite relative agentskills.io links in markdown.
  text = text.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, (_, label, href) =>
    `[${label}](${mapHref(href)})`,
  );

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

function stripTitleAndLead(md) {
  return md
    .replace(/^#\s+.+\n?/m, '')
    .replace(/^>\s+.+\n?/m, '')
    .trim();
}

function renderMdx(def, cleaned) {
  const { title, lead } = extractMeta(cleaned);
  const body = stripTitleAndLead(cleaned);
  const lines = [
    '---',
    'layout: ../../layouts/DocLayout.astro',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(lead)}`,
  ];
  if (def.navLabel && def.navLabel !== title) {
    lines.push(`navLabel: ${JSON.stringify(def.navLabel)}`);
  }
  const tags = ARTICLE_TAGS[def.id];
  if (tags?.length) {
    lines.push(`tags: ${JSON.stringify(tags)}`);
  }
  lines.push('---', '');
  if (lead) {
    lines.push(`<Lead>${lead}</Lead>`, '');
  }
  lines.push(body, '');
  return lines.join('\n');
}

async function fetchArticle(def) {
  const url = `${BASE}/${encodeURIComponent(def.file)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${def.file}: ${res.status}`);
  const raw = await res.text();
  return renderMdx(def, preprocess(raw));
}

mkdirSync(outDir, { recursive: true });

try {
  const results = await Promise.all(
    ARTICLES.map(async (def) => {
      const mdx = await fetchArticle(def);
      const path = join(outDir, `${def.id}.mdx`);
      writeFileSync(path, mdx);
      return def.id;
    }),
  );
  console.log(`✓ Wrote ${results.length} skills MDX articles to docs/src/pages/docs/`);
} catch (err) {
  console.warn(`⚠ Upstream skills sync failed (${err.message}); run generate-skills-from-ts.mjs instead.`);
  process.exit(1);
}
