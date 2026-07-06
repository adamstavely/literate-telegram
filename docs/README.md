# Interop Docs (Astro)

Markdown documentation for the Interop Registry. Built with **Astro 7** as a static site served at `/docs/*` alongside the Angular app.

**Full architecture & handoff guide:** [`DOCS.md`](../DOCS.md) at the repo root.

Requires **Node.js 22+** (Astro 7).

## Quick start

```bash
cd docs
npm install
npm run sync-styles   # vendor project/styles.css → src/styles/interop.css
npm run dev           # http://localhost:4321/docs/overview
```

## Build

```bash
npm run sync-styles   # run after project/styles.css changes
npm run build         # → dist/
npm run preview
npm run check         # TypeScript / Astro diagnostics
```

## Styling

The docs site vendors the Registry design system from `project/styles.css` into `src/styles/interop.css`. Run `npm run sync-styles` whenever the canonical stylesheet changes (same workflow as `frontend/src/vendor/interop.css`).

Docs-specific overrides (MDX prose mapping, accent themes, mobile nav) live in `src/styles/docs-overrides.css`.

## Content sync

Built-in articles are generated from `project/docs-content.js`:

```bash
npm run generate-docs    # 13 registry articles → src/pages/docs/*.mdx
npm run sync-skills      # skills articles (upstream or TS fallback)
npm run content:sync     # both
```

Skills articles prefer upstream markdown from [refactored-palm-tree](https://github.com/adamstavely/refactored-palm-tree); when unavailable, `generate-skills-from-ts.mjs` converts `docs/content/skills-articles.ts`.

### MDX shortcodes

Registered in generated pages (see `src/components/mdx/`):

| Component | Purpose |
|-----------|---------|
| `Lead` | Intro paragraph (`.doc-lead`) |
| `Callout` | Accent/note callouts |
| `DocCards` | Linked card grid |
| `Steps` | Numbered steps |
| `KeyVal` | Key/value rows |
| `DocTable` | Data tables |
| `RawHtml` | Pre-rendered HTML bodies (skills sync) |

## Phase status

### Phase 1 — Scaffold ✓
- Astro 7 static site in `docs/`
- MDX with unified remark/rehype processor
- `remark-reading-time` → clock icon + "N min read"
- `remark-last-updated` → check icon + "Updated …" (git date)
- `rehype-external-links` → new tab + icon
- Sample page: `src/pages/docs/overview.mdx`
- Routes: `/docs` → `/docs/overview`, `/docs/overview`

### Phase 2 — Layout & styling ✓
- Vendored `project/styles.css` → `src/styles/interop.css` (CI-guarded)
- Geist fonts, Registry header, theme toggle (`interop-theme` localStorage)
- Full 21-item sidebar nav (mirrors `docs-content.ts`)
- 3-pane shell, H2 "On this page" TOC, prev/next pager
- CI job: `docs` (build + astro check)

### Phase 3 — Content migration ✓
- MDX shortcodes: `Lead`, `Callout`, `DocCards`, `Steps`, `KeyVal`, `DocTable`, `RawHtml`
- `generate-docs-mdx.mjs` — 13 built-in articles from `project/docs-content.js`
- `sync-skills-mdx.mjs` + `generate-skills-from-ts.mjs` fallback — 8 skills articles
- `npm run content:sync` regenerates all 21 pages
- Docs-specific CSS for cards, steps, keyval, and skills HTML bodies

### Phase 4 — Tags ✓
- `tags:` frontmatter on every article (`content/doc-tags.json` is the source map)
- `TagList` chips on article meta row + `/docs/tags` index
- `/docs/tags/[tag]` filtered doc lists
- "Related" section on articles sharing tags
- "Browse tags" link in docs sidebar

### Phase 5 — Page feedback ✓
- `PageFeedback` widget on every doc article ("Was this page helpful?")
- `POST /api/docs/feedback` → Elasticsearch `interop-docs-feedback` index
- `GET /api/docs/feedback/session` issues anonymous `interop_docs_visitor` cookie (dedupe per page)
- Astro dev proxies `/api` → backend (`BACKEND_URL`, default `http://localhost:3000`)

### Phase 6 — nginx/Docker integration ✓
- Multi-stage `frontend/Dockerfile` builds Angular + Astro docs (repo-root context)
- nginx serves `/docs/*`, `/_astro/*`, and `/fonts/*` before the Angular SPA fallback
- Angular `docs` routes and components removed; header links to `/docs/overview`
- Compose smoke test curls `/docs/overview`

### Production layout

```
/usr/share/nginx/html/
├── index.html          # Angular SPA
├── …                   # Angular bundles
├── docs/               # Astro static pages
├── _astro/             # Astro hashed CSS/JS
└── fonts/              # Geist fonts for docs
```
