#!/usr/bin/env node
/**
 * Generates skills-*.mdx from docs/content/skills-articles.ts
 * (fallback when upstream agentskills sources are unavailable).
 * Run: node docs/scripts/generate-skills-from-ts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const src = readFileSync(
  join(root, 'docs/content/skills-articles.ts'),
  'utf8',
);
const outDir = join(root, 'docs/src/pages/docs');
const ARTICLE_TAGS = JSON.parse(
  readFileSync(join(__dirname, '../content/doc-tags.json'), 'utf8'),
);

/** Parse exported SKILLS_ARTICLES array entries from the generated TS file. */
function parseSkillsArticles(file) {
  const articles = [];
  const re =
    /\{\s*id:\s*'([^']+)',\s*section:\s*'[^']+',\s*title:\s*"([^"]+)",\s*navLabel:\s*"([^"]+)",\s*readTime:\s*\d+,\s*updatedAt:\s*'[^']+',\s*lead:\s*"((?:\\.|[^"\\])*)",\s*body:\s*`([\s\S]*?)`\s*,?\s*\}/g;
  let m;
  while ((m = re.exec(file)) !== null) {
    articles.push({
      id: m[1],
      title: m[2],
      navLabel: m[3],
      lead: m[4].replace(/\\"/g, '"'),
      body: m[5],
    });
  }
  return articles;
}

function escapeTemplateLiteral(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function renderMdx(article) {
  const lines = [
    '---',
    'layout: ../../layouts/DocLayout.astro',
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(article.lead)}`,
  ];
  if (article.navLabel !== article.title) {
    lines.push(`navLabel: ${JSON.stringify(article.navLabel)}`);
  }
  const tags = ARTICLE_TAGS[article.id];
  if (tags?.length) {
    lines.push(`tags: ${JSON.stringify(tags)}`);
  }
  lines.push(
    '---',
    '',
    "import Lead from '../../components/mdx/Lead.astro';",
    "import RawHtml from '../../components/mdx/RawHtml.astro';",
    '',
    `<Lead>${article.lead}</Lead>`,
    '',
    `<RawHtml html={\`${escapeTemplateLiteral(article.body.trim())}\`} />`,
    '',
  );
  return lines.join('\n');
}

const articles = parseSkillsArticles(src);
if (articles.length === 0) {
  console.error('✗ No skills articles parsed from skills-articles.ts');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const article of articles) {
  writeFileSync(join(outDir, `${article.id}.mdx`), renderMdx(article));
}

console.log(`✓ Generated ${articles.length} skills MDX articles from skills-articles.ts`);
