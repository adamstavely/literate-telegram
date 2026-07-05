# Interop — AI Registry

Interop is a governed registry and catalog for AI building blocks — **MCP servers,
tools, skills, agents, and APIs**. Teams browse and publish entries, curate them
into installable **collections**, and govern them through a **data-sensitivity**
model, a **policy engine**, and an **admin moderation queue**.

| Layer | Tech |
|-------|------|
| Frontend | Angular 17 (standalone components + signals), served by nginx |
| Backend | Node.js + Express + TypeScript |
| Datastore | Elasticsearch 8.13 |
| Auth | OIDC / JWT (Bearer), verified server-side with `jose` |
| Local dev | Docker Compose |
| Deployment | Helm chart (Kubernetes) |

> **New to this codebase? Read [`HANDOFF.md`](./HANDOFF.md).** It is the detailed
> engineering guide: architecture, request flows, the governance model, every
> environment variable, all Elasticsearch indices, and how to run/deploy.

## Repository layout

```
backend/     Express + TypeScript API (src/), Dockerfile, .env.example
frontend/    Angular 17 app (src/), nginx config, Dockerfile
helm/        Helm chart (Kubernetes deployment)
project/     Canonical design source (styles.css + HTML/JSX prototypes)
scripts/     Repo-level scripts (e.g. CSS-sync check)
docker-compose.yml   Local full stack (Elasticsearch + backend + frontend)
docker-compose.dev.yml   Dev overrides (hot-reload, :3000/:9200 publish)
.github/workflows/   CI (styles-sync, backend, frontend, docker, helm, compose)
```

## Quick start (Docker Compose)

```bash
cp backend/.env.example .env          # tweak if needed (dev defaults are fine)
docker compose up --build             # ES + backend + frontend
# Frontend: http://localhost:4200   API via nginx proxy at /api (backend not on host :3000)
```

For local backend hot-reload and direct API access on `:3000`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Then seed demo data (servers, tools, skills, agents, APIs, pending items,
notifications):

```bash
cd backend && npm ci && npm run seed  # targets http://localhost:9200 by default
```

Optional Kibana: `docker compose --profile observability up`.

## Quick start (run services directly)

```bash
# 1. Elasticsearch (single node, security off) — e.g. via docker:
docker run -p 9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false \
  docker.elastic.co/elasticsearch/elasticsearch:8.13.0

# 2. Backend
cd backend && npm ci
cp .env.example .env && echo "ALLOW_MOCK_AUTH=true" >> .env   # dev-only admin bypass
npm run seed        # create indices + demo data
npm run dev         # http://localhost:3000  (tsx watch)

# 3. Frontend
cd frontend && npm ci
npm start           # http://localhost:4200  (proxies /api to :3000)
```

In development the frontend auto-creates a mock signed-in **admin** session, and
the backend accepts the bearer token `mock-token` when `ALLOW_MOCK_AUTH=true`
(dev/test only — never in production).

## Common commands

| Where | Command | Purpose |
|-------|---------|---------|
| backend | `npm run dev` | Run API with hot reload (`tsx watch`) |
| backend | `npm run build` | Typecheck + compile to `dist/` |
| backend | `npm run seed` | Create ES indices + seed demo data |
| backend | `npm test` | Unit + route tests (`node:test` + `supertest`) |
| frontend | `npm start` | Dev server on `:4200` |
| frontend | `npm run build` | Production build to `dist/` |
| frontend | `npm run test:ci` | Headless unit tests |
| frontend | `npm run check:styles` | Verify vendored CSS matches `project/styles.css` |
| repo | `node scripts/check-styles-sync.mjs` | Same check, from repo root (CI) |

## Deployment

Kubernetes via the Helm chart in [`helm/`](./helm). It deploys Elasticsearch
(optional, a built-in single-node StatefulSet), the backend (with a post-install
seed Job), the frontend, services, and an ingress. See
[`HANDOFF.md`](./HANDOFF.md) → **Deployment**.

## Design system

The canonical stylesheet lives at `project/styles.css` and is **vendored** into
`frontend/src/vendor/interop.css` (the frontend Docker build context can't reach
outside `frontend/`). The two must stay identical — CI enforces it. After editing
`project/styles.css`, run:

```bash
cp project/styles.css frontend/src/vendor/interop.css
```
