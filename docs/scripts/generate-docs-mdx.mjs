#!/usr/bin/env node
/**
 * Generates docs/src/pages/docs/*.mdx from project/docs-content.js block definitions.
 * Run from repo root: node docs/scripts/generate-docs-mdx.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const outDir = join(root, 'docs/src/pages/docs');
const ARTICLE_TAGS = JSON.parse(
  readFileSync(join(__dirname, '../content/doc-tags.json'), 'utf8'),
);

function loadArticles() {
  const js = readFileSync(join(root, 'project/docs-content.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(js, sandbox);
  return sandbox.window.DOCS;
}

function docHref(target) {
  if (target === '#browse') return '/';
  if (target.startsWith('#')) return `/docs/${target.slice(1)}`;
  return `/docs/${target}`;
}

function parseInline(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="doc-icode">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) =>
      `<a href="${docHref(target)}" class="doc-link">${label}</a>`);
}

function yamlQuote(s) {
  return JSON.stringify(s);
}

function renderBlock(b) {
  switch (b.t) {
    case 'lead':
      return `<Lead>${parseInline(b.v)}</Lead>`;
    case 'h2':
      return `\n## ${b.v}\n`;
    case 'h3':
      return `\n### ${b.v}\n`;
    case 'p':
      return `\n${inlineToMd(b.v)}\n`;
    case 'code':
      return `\n\`\`\`${b.lang || ''}\n${b.v}\n\`\`\`\n`;
    case 'callout': {
      const tone = b.tone && b.tone !== 'default' ? ` tone="${b.tone}"` : '';
      const icon = b.icon ? ` icon="${b.icon}"` : '';
      return `\n<Callout${tone}${icon}>${parseInline(b.v)}</Callout>\n`;
    }
    case 'list':
      return `\n${b.v.map((it) => `- ${inlineToMd(it)}`).join('\n')}\n`;
    case 'steps': {
      const items = b.v
        .map(
          (s) =>
            `  { title: ${yamlQuote(parseInline(s.title))}, body: ${yamlQuote(parseInline(s.body))} }`,
        )
        .join(',\n');
      return `\n<Steps items={[\n${items}\n]} />\n`;
    }
    case 'cards': {
      const items = b.v
        .map((c) => {
          const parts = [
            c.icon ? `icon: "${c.icon}"` : null,
            `title: ${yamlQuote(c.title)}`,
            `body: ${yamlQuote(c.body)}`,
            c.go ? `href: "/docs/${c.go}"` : null,
          ].filter(Boolean);
          return `  { ${parts.join(', ')} }`;
        })
        .join(',\n');
      return `\n<DocCards items={[\n${items}\n]} />\n`;
    }
    case 'keyval': {
      const rows = b.v
        .map(([k, v]) => `  [${yamlQuote(k)}, ${yamlQuote(parseInline(v))}]`)
        .join(',\n');
      return `\n<KeyVal rows={[\n${rows}\n]} />\n`;
    }
    case 'table': {
      const head = `[${b.head.map((h) => yamlQuote(h)).join(', ')}]`;
      const rows = b.rows
        .map((row) => `  [${row.map((cell, j) => yamlQuote(j === 0 ? cell : parseInline(cell))).join(', ')}]`)
        .join(',\n');
      return `\n<DocTable head={${head}} rows={[\n${rows}\n]} />\n`;
    }
    case 'divider':
      return '\n---\n';
    default:
      return '';
  }
}

/** Keep markdown syntax for plain paragraphs/lists where MDX will render it. */
function inlineToMd(str) {
  return str
    .replace(/\[([^\]]+)\]\(#browse\)/g, '[$1](/)')
    .replace(/\[([^\]]+)\]\(#([^)]+)\)/g, '[$1](/docs/$2)')
    .replace(/\[([^\]]+)\]\(([^#][^)]*)\)/g, '[$1]($2)');
}

/** Shared MDX shortcode imports — Astro page MDX does not auto-register mdx-components.ts. */
const MDX_IMPORTS = [
  "import Callout from '../../components/mdx/Callout.astro';",
  "import DocCards from '../../components/mdx/DocCards.astro';",
  "import DocTable from '../../components/mdx/DocTable.astro';",
  "import KeyVal from '../../components/mdx/KeyVal.astro';",
  "import Lead from '../../components/mdx/Lead.astro';",
  "import Steps from '../../components/mdx/Steps.astro';",
].join('\n');

function renderArticle(id, def, navLabel) {
  const body = def.blocks.map(renderBlock).join('\n').trim();
  const lines = [
    '---',
    'layout: ../../layouts/DocLayout.astro',
    `title: ${yamlQuote(def.title)}`,
    `description: ${yamlQuote(def.desc)}`,
  ];
  if (navLabel && navLabel !== def.title) {
    lines.push(`navLabel: ${yamlQuote(navLabel)}`);
  }
  const tags = ARTICLE_TAGS[id];
  if (tags?.length) {
    lines.push(`tags: ${JSON.stringify(tags)}`);
  }
  lines.push('---', '', MDX_IMPORTS, '', body, '');
  return lines.join('\n');
}

const { NAV, ARTICLES } = loadArticles();
mkdirSync(outDir, { recursive: true });

let count = 0;
for (const group of NAV) {
  for (const item of group.items) {
    const def = ARTICLES[item.id];
    if (!def) continue;
    const mdx = renderArticle(item.id, def, item.label);
    writeFileSync(join(outDir, `${item.id}.mdx`), mdx);
    count += 1;
  }
}

console.log(`✓ Generated ${count} MDX articles in docs/src/pages/docs/`);
