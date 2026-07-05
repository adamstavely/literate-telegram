# Interop — Engineering Handoff

This is the deep-dive guide for a developer taking over the codebase. It covers
the architecture, every moving part of the backend and frontend, the
Elasticsearch schema, the governance model, deployment, and a "wire this before
production" checklist.

Read [`README.md`](./README.md) first for the 5-minute orientation and quick
start; this document is the reference.

---

## Table of contents

1. [What Interop is](#1-what-interop-is)
2. [High-level architecture](#2-high-level-architecture)
3. [Repository structure](#3-repository-structure)
4. [Backend](#4-backend)
5. [Elasticsearch data layer](#5-elasticsearch-data-layer)
6. [The governance model (read this)](#6-the-governance-model)
7. [Frontend](#7-frontend)
8. [Local development](#8-local-development)
9. [Deployment (Helm / Kubernetes)](#9-deployment-helm--kubernetes)
10. [CI](#10-ci)
11. [Environment variables (full reference)](#11-environment-variables-full-reference)
12. [Operational notes](#12-operational-notes)
13. ["Before production" checklist](#13-before-production-checklist)
14. [Where to start / common tasks](#14-where-to-start--common-tasks)

---

## 1. What Interop is

Interop is a **registry** (catalogue) of AI building blocks. Every catalogue
record is an **entry** of one of five types:

| Type | What it is |
|------|-----------|
| `server` | An MCP server exposing tools over stdio/HTTP/SSE |
| `tool` | A single callable function that belongs to a server |
| `skill` | A SKILL.md-defined reusable behaviour |
| `agent` | A composed model + servers + skills |
| `api` | A raw REST/GraphQL API (the layer an MCP server wraps) |

On top of the catalogue there are three governance/product surfaces:

- **Data sensitivity** — every entry declares the highest data tier it may
  process (`public` → `internal` → `confidential` → `restricted`).
- **Policy + moderation** — submissions are risk-scored against an editable
  policy document; risky ones enter an **admin moderation queue** (approve /
  reject); low-risk ones can be auto-approved.
- **Collections** — curated, installable "stacks" of entries; their sensitivity
  tier is derived from the highest-tier member.

There is also a **docs** section and an in-app **API endpoint explorer** ("try it"
console) on API detail pages.

---

## 2. High-level architecture

```
                       ┌──────────────────────────────────────────┐
   Browser  ──────────▶│  nginx (frontend container)              │
                       │   • serves the Angular SPA               │
                       │   • proxies /api/* → backend:3000         │
                       └───────────────┬──────────────────────────┘
                                       │  /api  (X-Forwarded-For set)
                                       ▼
                       ┌──────────────────────────────────────────┐
                       │  Express backend (Node + TS)             │
                       │   • OIDC JWT verification (jose)          │
                       │   • policy engine + moderation           │
                       │   • rate limiting, audit, logging        │
                       └───────────────┬──────────────────────────┘
                                       │  @elastic/elasticsearch
                                       ▼
                       ┌──────────────────────────────────────────┐
                       │  Elasticsearch 8.13 (9 indices)          │
                       └──────────────────────────────────────────┘
```

- The frontend is a **static SPA**; it talks only to the backend's `/api`.
- The backend is **stateless** — all state lives in Elasticsearch. You can run
  N replicas (Helm defaults to 2). A couple of caches are process-local and
  documented in [§12](#12-operational-notes).
- Auth is **Bearer JWT**. The frontend attaches the token; the backend verifies
  it against the OIDC provider's JWKS.

---

## 3. Repository structure

```
backend/
  src/
    index.ts               Process entrypoint: startup, ES index setup, graceful shutdown
    app.ts                 Express app: middleware pipeline + route mount + error handlers
    config/index.ts        Env-driven typed config (single source of truth for env vars)
    api/
      router.ts            Health endpoints + mounts all sub-routers under /api
      routes/
        entries.ts         Registry search/list/stats/detail + submit
        pending.ts         Moderation queue: list/stats/approve/reject
        collections.ts     List/detail + create (admin)
        notifications.ts   Per-user notifications (with per-user read receipts)
        audit.ts           Client audit ingest + admin audit query
        logs.ts            Client log ingest
        policy.ts          Get/update the governance policy document (admin)
        *.routes.test.ts   supertest route tests
    middleware/
      auth.ts              requireAuth / optionalAuth / requireAdmin (jose JWT)
      audit.ts             auditMiddleware + auditAction() helper
      logging.ts           requestLoggingMiddleware (assigns req.id correlation id)
      rate-limit.ts        ingestRateLimiter (tight per-IP limiter for ingest routes)
      error-handler.ts     errorHandler + notFoundHandler
    services/
      policy.ts            Risk scoring, policy enforcement, submission policy, cache
      policy-validation.ts Structural validation of an incoming policy document
      entry-dto.ts         sanitizeSubmission(): per-type allowlist (mass-assignment guard)
      slug-locks.ts        claimSlug / claimOrOwnSlug / releaseSlug / slugTaken
      compensation.ts      runCompensation(): retrying rollback + reconciliation record
      sanitize-meta.ts     boundedMeta(): bound/flatten untrusted client metadata
      *.test.ts            node:test unit tests
    elasticsearch/
      client.ts            Singleton ES client (+ pingElasticsearch)
      indices.ts           INDEX_NAMES + setupIndices() (idempotent index creation)
      seed.ts              Demo-data seeder (npm run seed)
    data/
      default-policy.ts    DEFAULT_POLICY_DOCUMENT (fallback when none saved)
      collections.ts       COLLECTION_DEFINITIONS (built-in curated collections)
    types/index.ts         All domain types (mirrored by the frontend)
    logger/logger.ts       Winston logger
    test/mock-es.ts        stubEs/restoreEs test helper
  Dockerfile               Multi-stage build → node:20-alpine runner
  .env.example             Documented env template

frontend/
  src/
    main.ts, index.html, styles.scss
    environments/          environment.ts (dev) / environment.prod.ts
    vendor/interop.css     Vendored copy of project/styles.css (kept in sync)
    app/
      app.config.ts        Providers: router, httpClient(+interceptors), animations
      app.routes.ts        Lazy standalone routes + guards
      app.component.*      Root shell (header + <router-outlet>)
      core/
        services/          registry, auth, theme, logging, audit
        guards/            adminGuard, authGuard
        interceptors/      authInterceptor (Bearer + 401), auditInterceptor
      features/            browse, detail, register, admin, policy, collections, docs, not-found
      shared/
        components/        header, entry-card, sensitivity-*, endpoint-card, icon, tooltip, ...
        constants/         sensitivity + type metadata
        utils/             endpoint-spec, skill-sensitivity, focus-trap
        types/index.ts     Domain types (must stay in sync with backend)
  nginx.conf               SPA serving + /api proxy + caching + security headers
  docker-entrypoint.sh     envsubst of BACKEND_URL into nginx.conf at container start
  karma.conf.js            Headless test config (ChromeHeadlessNoSandbox launcher)
  Dockerfile               Multi-stage build → nginx:1.25-alpine (installs curl)

helm/                      Kubernetes chart (see §9)
project/                   Canonical design source: styles.css + HTML/JSX prototypes
scripts/check-styles-sync.mjs   CI guard: vendor CSS == project/styles.css
docker-compose.yml         Local full stack
```

---

## 4. Backend

### 4.1 Startup and app bootstrap

- **`src/index.ts`** is the process entrypoint. It:
  1. Calls `setupIndices()` (idempotent ES index creation — see [§5](#5-elasticsearch-data-layer)). Failure here is **non-fatal**; the server still starts (ES may come up later).
  2. Starts the HTTP server on `config.port` (default `3000`).
  3. Wires graceful shutdown (`SIGTERM`/`SIGINT`), a 10s force-exit timeout, and `uncaughtException`/`unhandledRejection` handlers.
- **`src/app.ts`** builds the Express app and is what the tests import. The middleware pipeline, in order:
  1. `app.set('trust proxy', config.trustProxy)` — governs how `req.ip` is derived from `X-Forwarded-For`.
  2. `helmet()` (security headers; `crossOriginResourcePolicy: cross-origin`).
  3. `cors()` — allowlist from `ALLOWED_ORIGINS`; requests with no origin (curl/server-to-server) are allowed.
  4. `compression()`.
  5. `express.json({ limit: '1mb' })` + `urlencoded`.
  6. Global `rateLimit` (`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS`, default 200/min) returning `429`.
  7. `requestLoggingMiddleware` — assigns `req.id` (a correlation id echoed in every response/log) and logs request/response.
  8. `optionalAuth` — attaches `req.user` if a valid Bearer token is present (does not reject).
  9. `auditMiddleware` — records mutating requests to the audit index.
  10. `app.use('/api', apiRouter)`.
  11. `notFoundHandler`, then `errorHandler`.

### 4.2 Configuration (`src/config/index.ts`)

All configuration comes from environment variables, parsed once into a typed
`config` object. Highlights (full table in [§11](#11-environment-variables-full-reference)):

- `NODE_ENV` must be `development | production | test`.
- In **production**, `OIDC_ISSUER/AUDIENCE/JWKS_URI` are **required** and the app
  **refuses to start** if they still contain the `your-tenant.*` placeholder.
- `ALLOW_MOCK_AUTH` only has effect in dev/test; it enables the `mock-token`
  bypass.
- `TRUST_PROXY` accepts `false` / `true` / an integer (hop count) / a string
  (e.g. `loopback`). Set it only when actually behind a trusted proxy.
- `ES_CA_FINGERPRINT` is a certificate **fingerprint** (SHA-256), passed to the
  ES client's `caFingerprint` option — not a PEM cert.

### 4.3 Authentication & authorization (`src/middleware/auth.ts`)

- JWTs are verified with **`jose`** against the OIDC provider's JWKS
  (`createRemoteJWKSet` + `jwtVerify`, checking `issuer` and `audience`). The
  JWKS is cached for 5 minutes.
- Roles come from the `https://interop.io/roles` claim (falls back to `roles`).
  `admin` is the privileged role.
- Three guards:
  - **`requireAuth`** — 401 unless a valid Bearer token; sets `req.user`.
  - **`optionalAuth`** — sets `req.user` if present, else continues anonymously
    (used globally + on ingest routes).
  - **`requireAdmin`** — 403 unless `req.user.roles` includes `admin`.
- **Dev bypass:** when `config.allowMockAuth` is true (dev/test + `ALLOW_MOCK_AUTH=true`),
  the literal bearer `mock-token` is accepted as `dev-user-1` with the `admin`
  role. This is off by default and impossible in production.

### 4.4 API surface

All routes are mounted under `/api`. Health lives directly on the api router.

| Method & path | Auth | Purpose |
|---------------|------|---------|
| `GET /api/health` | – | Combined health; `503` when ES down |
| `GET /api/health/live` | – | Liveness — always `200` if the process is up |
| `GET /api/health/ready` | – | Readiness — `503` when ES is unavailable |
| `GET /api/entries` | – | Search/list registry (query, type, category, client, sort, page, size) |
| `GET /api/entries/stats` | – | Aggregate counts (by type, installs, verified) |
| `GET /api/entries/:type/:slug` | – | Single entry |
| `POST /api/entries` | auth | Submit an entry (→ policy → queue or auto-approve) |
| `GET /api/collections` | – | List collections (built-in + created), resolved against entries |
| `GET /api/collections/:id` | – | Single collection |
| `POST /api/collections` | **admin** | Create a curated collection |
| `GET /api/pending/stats` | **admin** | Moderation KPIs |
| `GET /api/pending` | **admin** | List queue (filter status/type/risk) |
| `PUT /api/pending/:id/approve` | **admin** | Approve (publish to registry) |
| `PUT /api/pending/:id/reject` | **admin** | Reject (frees the slug) |
| `GET /api/notifications` | auth | User + global notifications (per-user read state) |
| `PUT /api/notifications/read-all` | auth | Mark all read |
| `PUT /api/notifications/:id/read` | auth | Mark one read |
| `DELETE /api/notifications/:id` | auth | Dismiss |
| `POST /api/logs` | optional (rate-limited) | Client log ingest (bulk ≤50) |
| `POST /api/audit/client` | optional (rate-limited) | Client audit-event ingest (bulk ≤50) |
| `GET /api/audit` | **admin** | Query the audit log |
| `GET /api/policy` | **admin** | Get the active policy document |
| `PUT /api/policy` | **admin** | Replace the policy document (structurally validated) |

Every error response includes a `correlationId` (the request's `req.id`).

### 4.5 Domain model (`src/types/index.ts`)

- `RegistryEntry = Server | Tool | Skill | Agent | Api` (discriminated by `type`),
  all extending `BaseEntry` (id, name, slug, publisher, verified, summary,
  description, installs, sensitivity, categories, timestamps, and the
  server-controlled `visibility` + `reviewDueAt`).
  - `Api` additionally has `baseUrl`, `auth`, and `endpoints: ApiEndpoint[]`
    (`{ method, path, summary }`) that drive the endpoint explorer.
- `PendingEntry` — a queued submission (`entry`, `status`, `risk`, `flags`,
  approver bookkeeping, `approvals[]` for two-approver, `overrideReason`).
- `PolicyDocument` — `{ policy: PolicyState, rules: PolicyRule[], domains: TrustDomain[] }`
  (see [§6](#6-the-governance-model)).
- `Notification`, `NotificationRead` (per-user receipt), `AuditEvent`,
  `Collection` / `CollectionDefinition` / `CollectionMember`.

The frontend has a **parallel copy** in `frontend/src/app/shared/types/index.ts`.
**Keep the two in sync** when you change a shape.

### 4.6 Services

- **`policy.ts`** — the governance brain:
  - `assessRiskWithPolicy(entry, doc)` → `{ risk, flags, firedRules }` — scores an
    entry (agent autonomy, sensitivity, no-auth, and each enabled rule) into
    `low|medium|high|critical`.
  - `evaluatePolicyEnforcement(entry, doc)` → what blocks approval (reject rules,
    block rules, quarantine, two-approver).
  - `applySubmissionPolicy(entry, doc)` → adjusts the entry (default visibility,
    forced read-only) and decides `autoApprove` + `rejectRules` at **submit** time.
  - `getPolicy(forceFresh?)` — reads the saved policy from ES (30s process-local
    cache) or falls back to `DEFAULT_POLICY_DOCUMENT`. Approval reads
    `getPolicy(true)` to bypass the cache.
  - `reviewDueAt(doc, from)` — computes re-review date from `republishAfterDays`.
- **`entry-dto.ts`** — `sanitizeSubmission(body)`: an explicit **allowlist** per
  entry type. Untrusted request bodies never spread directly into storage; this
  is the mass-assignment guard and enum validator.
- **`slug-locks.ts`** — atomic `type+slug` uniqueness via a dedicated ES index
  (`create` with a deterministic id fails on conflict). `claimSlug`,
  `claimOrOwnSlug` (tolerates the entry's own lock), `releaseSlug`, `slugTaken`.
- **`compensation.ts`** — `runCompensation(label, fn, ctx)` retries a rollback;
  on exhaustion it logs a distinct `COMPENSATION_EXHAUSTED` alert **and** writes a
  durable `RECONCILIATION_REQUIRED` record to the audit index for ops to query.
- **`sanitize-meta.ts`** — `boundedMeta()` caps untrusted client metadata (≤20
  keys, values coerced/truncated) before it lands in a dynamically-mapped ES
  object, preventing mapping explosion.
- **`policy-validation.ts`** — `validatePolicyDocument()` structurally validates
  a `PUT /api/policy` body (every toggle, rule action/severity, domain shape).

### 4.7 Logging, audit, errors

- **Correlation id:** `requestLoggingMiddleware` assigns `req.id`; it appears in
  logs and in error-response bodies.
- **Audit:** `auditMiddleware` records mutations; `auditAction(req, action, resourceId, meta)`
  writes explicit events (`SUBMIT_ENTRY`, `APPROVE_ENTRY`, `REJECT_ENTRY`,
  `AUTO_APPROVE_ENTRY`, `UPDATE_POLICY`, `CREATE_COLLECTION`,
  `RECONCILIATION_REQUIRED`, …).
- **Errors:** route handlers use `try/catch(next)`; `errorHandler` shapes the JSON
  response and status.

### 4.8 Backend tests

`npm test` runs `node:test` via `tsx` with `--test-concurrency=1`
(`ALLOW_MOCK_AUTH=true`, `NODE_ENV=development`). Two kinds:

- **Unit tests** (`services/*.test.ts`) — pure functions (policy, entry-dto,
  policy-validation).
- **Route tests** (`api/routes/*.routes.test.ts`) — `supertest` against the real
  Express app with Elasticsearch stubbed via `src/test/mock-es.ts` (`stubEs`
  replaces `esClient` methods; `restoreEs` in `afterEach`).

When you change an approve/submit flow, update the corresponding route test's ES
stubs (they assert call ordering and status codes).

---

## 5. Elasticsearch data layer

### 5.1 Indices

`setupIndices()` (`src/elasticsearch/indices.ts`) is called on backend startup and
by the seed script. It is **idempotent** — each index is created only if it
doesn't already exist. `INDEX_NAMES` (nine):

| Constant | Index / alias | Notes |
|----------|---------------|-------|
| `REGISTRY` | `interop-registry` | Published entries. `dynamic: false`, explicit mappings incl. nested `tools`/`endpoints`. |
| `PENDING` | `interop-pending` | Moderation queue. `entry` is a `dynamic: true` object. |
| `AUDIT` | `interop-audit` | **Write alias** over `interop-audit-000001`, with an ILM rollover policy (90d). |
| `LOGS` | `interop-logs` | **Write alias** over `interop-logs-000001`, ILM (30d). |
| `NOTIFICATIONS` | `interop-notifications` | Notification docs (global = no `userId`). |
| `NOTIFICATION_READS` | `interop-notification-reads` | Per-user read/dismiss receipts (id = `userId::notificationId`). |
| `POLICY` | `interop-policy` | Single doc `id: default`. |
| `SLUG_LOCKS` | `interop-slug-locks` | Uniqueness locks (id = `type:slug`). |
| `COLLECTIONS` | `interop-collections` | User-created collection definitions. |

Notes:
- **Audit & logs** are created as `…-000001` with a write alias + an ILM policy
  (`index.lifecycle.name` + `rollover_alias`). Writes/reads target the alias; ILM
  rolls the backing index. ILM attachment is best-effort — if `putLifecycle`
  fails (e.g. ILM unavailable), the index is still created without lifecycle
  settings.
- **Policy** is not seeded. If `interop-policy/default` is absent, `getPolicy()`
  returns `DEFAULT_POLICY_DOCUMENT` (`src/data/default-policy.ts`). Saving via
  `PUT /api/policy` creates/updates the doc.

### 5.2 Seeding

`npm run seed` (`src/elasticsearch/seed.ts`) calls `setupIndices()` then bulk-loads
demo data: MCP servers (with nested tools), skills, agents, APIs (with endpoint
lists), a batch of **pending** submissions, and notifications. It prints a
summary. Safe to re-run; it re-indexes by id.

### 5.3 ES client

`src/elasticsearch/client.ts` exports a singleton `esClient`
(`@elastic/elasticsearch`) built from config (`node`, basic auth, optional
`caFingerprint` + TLS). `pingElasticsearch()` backs the health probes.

---

## 6. The governance model

This is the heart of the product; understand it before touching `entries.ts` /
`pending.ts` / `policy.ts`.

### 6.1 The policy document

`PolicyDocument` = `{ policy, rules, domains }`:

- **`policy` (PolicyState)** — toggles: `readOnlyDefault`, `perToolApproval`,
  `blockWriteUntilReview`, `quarantineHighRisk`, `requireReview`,
  `autoApproveVerified`, `autoApproveSkills`, `twoApproversHighRisk`,
  `republishAfterDays`, `defaultVisibility`, `transports`/`auth` allow-maps,
  `scanInjection`, `requireTriggers`, `tokenCap`.
- **`rules` (PolicyRule[])** — heuristics (`arbitrary-exec`, `no-sandbox`,
  `write-default`, `broad-scope`, `unverified-domain`, `destructive-verbs`,
  `internal-visibility`, `injection`), each with a `severity`, an `action`
  (`flag | review | block | reject`), and `enabled`.
- **`domains` (TrustDomain[])** — publisher-domain allowlist for the
  `unverified-domain` rule and the verified-publisher auto-approve path.

Editable at `admin/policy` (frontend) → `PUT /api/policy` (structurally
validated). Absent doc → `DEFAULT_POLICY_DOCUMENT`.

### 6.2 Submission flow (`POST /api/entries`)

1. `sanitizeSubmission()` builds the entry from an allowlist (drops
   server-controlled/unknown fields; validates enums).
2. `applySubmissionPolicy()` sets `visibility` from `defaultVisibility`, forces
   read-only tools when `readOnlyDefault`, flags token-cap violations, and decides
   `autoApprove` (low risk + no gating/reject rules + a category opt-in such as
   `autoApproveSkills` or a verified publisher, and not blocked by `requireReview`).
3. **Reject-action rules fail closed at submit** (`422`) — don't queue something
   that can never be approved.
4. **Slug uniqueness:** `slugTaken()` pre-check, then the slug lock is **claimed at
   submit** (`claimSlug`) before the pending doc is written, so two concurrent
   same-slug submissions can't both queue. The lock is held for the whole pending
   lifecycle.
5. If `autoApprove`: publish to the registry (verified) + record an approved
   pending doc; on failure, compensating rollback + `releaseSlug`.
6. Otherwise: index a `pending` doc; response `202`.

### 6.3 Approval flow (`PUT /api/pending/:id/approve`) — concurrency & atomicity

This is deliberately ordered for crash safety and single-publish semantics:

1. Fetch the pending doc **with `seq_no`/`primary_term`** (optimistic-lock tokens).
2. Enforce policy (`evaluatePolicyEnforcement`, fresh policy read):
   - fired **reject** rule → `422` (must be rejected);
   - **block** rule or **quarantine** (high/critical) → requires
     `{ override: true, overrideReason }` (≥10 chars), audited;
   - **two-approver** (high/critical) → first distinct approver records a vote and
     the entry stays pending (`202`); a second distinct approver proceeds.
3. `claimOrOwnSlug()` — the entry already owns its lock (from submit); a lock held
   by a *different* entry blocks (`409`).
4. **Publish to the registry first** (idempotent on `entry.id`), re-sanitizing the
   stored blob.
5. **Then** flip the pending doc to `approved` under the optimistic lock. A losing
   concurrent approver conflicts here → `409`.

Why registry-first: a crash between the two writes leaves the entry `pending`
(safe, re-approvable) rather than `approved` with no registry doc. Because the
registry write is idempotent, concurrent approvers writing the identical document
is harmless; the optimistic pending update elects a single winner.

### 6.4 Reject flow

Optimistic-locked flip to `rejected` (requires a reason ≥10 chars), then
`releaseSlug()` frees the slug for resubmission.

### 6.5 Compensation & reconciliation

Where two stores can diverge (auto-approve registry+pending), failures run through
`runCompensation()`, which retries and — on exhaustion — emits a
`COMPENSATION_EXHAUSTED` log and writes a `RECONCILIATION_REQUIRED` audit record.
Query the audit index for `action: RECONCILIATION_REQUIRED` to find pairs needing
manual repair.

---

## 7. Frontend

### 7.1 Stack & bootstrap

- **Angular 17**, **standalone components**, **signals** for state, lazy-loaded
  routes. No NgModules.
- `app.config.ts` providers: `provideRouter(routes, withComponentInputBinding(),
  withViewTransitions())`, `provideHttpClient(withInterceptors([authInterceptor,
  auditInterceptor]))`, `provideAnimations()`, `APP_BASE_HREF = '/'`.
- `withComponentInputBinding()` binds route params to component `@Input()`s
  (e.g. Detail's `type`/`slug`) — components react in `ngOnChanges`, so navigating
  between entries on the reused component reloads correctly.

### 7.2 Routing & guards (`app.routes.ts`)

| Path | Component | Guard |
|------|-----------|-------|
| `` | Browse | – |
| `entry/:type/:slug` | Detail | – |
| `register` | Register (publish wizard) | `authGuard` |
| `admin` | Admin (moderation queue) | `adminGuard` |
| `admin/policy` | Policy editor | `adminGuard` |
| `collections` | Collections index | – |
| `collections/new` | Create collection | `authGuard` |
| `collections/:id` | Collection detail | – |
| `docs` / `docs/:articleId` | Docs | – |
| `**` | NotFound | – |

- **`adminGuard`** — allows admins, else redirects to `/`.
- **`authGuard`** — allows authenticated users, else kicks off login and redirects
  to `/` (no dead end).

### 7.3 Core services

- **`registry.service.ts`** — the single API client (search, entry, stats,
  collections, `createCollection`, submit, pending list/approve/reject,
  notifications, policy get/save). GETs use a light `retry({count:1})`.
- **`auth.service.ts`** — **placeholder OIDC** (mock). It reads a `mock-auth`
  object from `localStorage`; **in non-production it auto-seeds a signed-in admin
  session** so the app behaves like the prototype without a login screen.
  `getAccessToken()` returns the stored token (`mock-token` in dev).
  **To wire real OIDC:** replace this service with a real library
  (`angular-oauth2-oidc` / `auth0-angular`) — `getAccessToken`, `currentUser$`,
  `isAdmin`, `login`, `logout` are the contract the rest of the app uses. The
  header comments in the file enumerate the exact swap points.
- **`theme.service.ts`** — light/dark + accent, persisted; sets `data-theme` /
  `data-accent` on `<html>`.
- **`logging.service.ts` / `audit.service.ts`** — batch client logs / audit
  events to `POST /api/logs` and `POST /api/audit/client`.

### 7.4 Interceptors

- **`authInterceptor`** — attaches `Authorization: Bearer <token>` to `/api`
  requests; on `401` it logs out and redirects home.
- **`auditInterceptor`** — feeds client-side audit events.

### 7.5 Feature components

- **Browse** — search/filter/sort with a debounced, `switchMap`'d search stream;
  URL query params are the single source of truth (no double-fetch); featured
  collections strip; hero stats.
- **Detail** — one component for all entry types (tabs: Overview / Install /
  Tools / Reviews as applicable), sensitivity panel, and — for `api` entries —
  the **endpoint explorer** (see 7.7). In-flight requests are cancelled on
  navigation (`switchMap` + `takeUntil`); related-data failures surface a
  non-blocking notice.
- **Register** — a multi-step publish wizard (per-step validation) with a
  "Collection" tile that routes to `collections/new`.
- **Admin** — the moderation queue with KPIs, filters (roving-tabindex tablist),
  and an accessible reject/request-changes **dialog** (not `window.prompt`).
- **Policy** — toggles/rules/domains editor bound to `PUT /api/policy`.
- **Collections / collection-detail / collection-create** — index, detail
  (members grouped, derived sensitivity), and an authoring form with icon/accent
  pickers.
- **Docs** — static content (`docs-content.ts`), reacts to `articleId` input.
- **NotFound** — real 404 page (the `**` route).

### 7.6 Shared

- **`header.component`** — nav, search (⌘K, dispatched from the app root),
  notifications popover, **app-switcher (waffle) popover**, theme toggle, avatar.
  The notifications, apps popover, and mobile-nav overlay use a CDK **focus trap**
  via `shared/utils/focus-trap.util.ts` (`activateFocusTrap`).
- **`endpoint-card.component`** + **`utils/endpoint-spec.ts`** — the API explorer
  (7.7).
- Sensitivity components (`sens-bars`, `sensitivity-badge`, `sensitivity-panel`)
  + `constants/sensitivity.constants.ts` + `utils/skill-sensitivity.ts` (derive a
  skill's effective tier from the servers it reaches).
- `icon.component` — inline SVG icon set (add new glyphs to `ICON_CONTENT`).

### 7.7 API endpoint explorer (mock)

`utils/endpoint-spec.ts` synthesizes swagger-style params/responses/examples from
an API entry's `endpoints[]` (via per-resource lookup tables), and
`endpoint-card.component` renders an expandable card with a **"Try it out"**
console. **Execution is a client-side mock** — a spinner + a canned/derived
response. No request leaves the browser. If you later want live execution, this is
where a real proxy call would go.

### 7.8 Styling / vendored CSS

`project/styles.css` is the canonical stylesheet (design tokens + component CSS).
It is **vendored** to `frontend/src/vendor/interop.css` and imported by
`src/styles.scss` (plus a few Angular-specific additions there, e.g. the darker
`--faint`, mobile-nav, tooltip focus, and modal styles). The frontend Docker build
context is `frontend/` only, so it can't reach `project/`. CI fails if the two
diverge — after editing `project/styles.css`, run
`cp project/styles.css frontend/src/vendor/interop.css`.

### 7.9 Frontend tests

Karma + Jasmine, run headless with `npm run test:ci` (uses the
`ChromeHeadlessNoSandbox` launcher in `karma.conf.js` for containers/CI). Specs
live beside their code (`*.spec.ts`): guards, pure utils, and a couple of
component tests.

---

## 8. Local development

### 8.1 Docker Compose (everything)

```bash
cp backend/.env.example .env
docker compose up --build
cd backend && npm ci && npm run seed   # once ES is healthy
```

Default stack: `elasticsearch` (internal only), `backend` (proxied via frontend nginx at `/api`, `TRUST_PROXY=1`), `frontend` (:4200). Optional `kibana` (`--profile observability`, :5601).

**Dev overlay** (`docker-compose.dev.yml`): publishes ES :9200 and backend :3000, sets `TRUST_PROXY=0`, and runs `tsx watch` for backend hot-reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### 8.2 Services directly

Run ES, then `backend: npm run dev`, then `frontend: npm start`. Set
`ALLOW_MOCK_AUTH=true` in `backend/.env` for the dev admin bypass. The dev
frontend targets `http://localhost:3000/api` (`environments/environment.ts`).

---

## 9. Deployment (Helm / Kubernetes)

Chart in `helm/` (`interop`, appVersion 1.0.0). `helm install interop ./helm -n <ns>`
(override `values.yaml` for a real environment).

### 9.1 Templates

| Template | Resource |
|----------|----------|
| `backend-deployment.yaml` | Backend Deployment (default 2 replicas). Readiness → `/api/health/ready`, liveness → `/api/health/live`. Reads config from the ConfigMap + secrets from the Secret. Non-root, read-only rootfs, `emptyDir` `/app/tmp`. |
| `frontend-deployment.yaml` | Frontend Deployment; `BACKEND_URL` injected for nginx. |
| `backend-service.yaml` / `frontend-service.yaml` | ClusterIP services (3000 / 80). |
| `elasticsearch-statefulset.yaml` / `elasticsearch-service.yaml` | Built-in single-node ES (when `elasticsearch.enabled=true`), PVC `storageSize`. |
| `configmap.yaml` | Non-secret backend env (`NODE_ENV`, `PORT`, `LOG_LEVEL`, `ES_NODE`, `ES_USERNAME`, `ALLOWED_ORIGINS`, rate limits, `LOG_INDEX`, `AUDIT_INDEX`, `TRUST_PROXY`). |
| `secret.yaml` | `ES_PASSWORD`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URI` (kept on uninstall via `resource-policy: keep`). |
| `backend-job-seed.yaml` | **post-install** Job that waits for ES then runs the seeder (runs once per install). |
| `ingress.yaml` | Routes `/api`→backend, `/`→frontend; TLS via `interop-tls`. |
| `hpa.yaml` | Optional HorizontalPodAutoscaler (`autoscaling.enabled`). |
| `serviceaccount.yaml`, `_helpers.tpl`, `NOTES.txt` | SA + template helpers + post-install notes. |

### 9.2 Key values

- `image.{frontend,backend}.{repository,tag}` — set your registry/tags.
- `elasticsearch.enabled` — `true` for built-in ES, or `false` + `host`/`port`/
  `username`/`password` for an external cluster.
- `oidc.issuer/audience/jwksUri` — **must be real** in production (the backend
  refuses placeholders). Stored in the Secret.
- `backend.env.*` — `ALLOWED_ORIGINS`, rate limits, `TRUST_PROXY` (default `"1"`),
  etc.
- `frontend.backendUrl` — nginx upstream (default `interop-backend:3000`).
- `podSecurityContext` / `securityContext` — non-root, read-only rootfs, drop all
  caps.

### 9.3 First-install checklist

1. Provide real `oidc.*` and `elasticsearch.password` (via `--set` or a values
   override / sealed secret).
2. Set `image.*` to pushed images.
3. `helm install` — the seed Job populates indices on first install.
4. Point DNS/TLS at the ingress host.

---

## 10. CI

`.github/workflows/ci.yml` runs on push to `main` and on PRs, six jobs:

1. **styles-sync** — `node scripts/check-styles-sync.mjs` (vendor CSS == canonical).
2. **backend** — `npm ci && npm run build && npm test`.
3. **frontend** — `npm ci && npm run build && npm run test:ci` (with
   `browser-actions/setup-chrome`).
4. **docker** — builds backend and frontend Docker images.
5. **helm** — `helm lint`, `helm template`, and NetworkPolicy structure checks
   (`scripts/check-helm-networkpolicy.mjs`).
6. **compose** — validates compose configs and runs a smoke test against
   `/api/health/ready` (Elasticsearch readiness, not just process liveness).

All six must be green. Node 20 in CI; note the backend test script uses `find`
to enumerate test files so it works on Node 20 (its `--test` glob is Node 21+).

**Multi-replica rate limits:** the backend uses an in-memory rate-limit store by
default (per pod). For a cluster-wide budget across replicas, configure a shared
store (e.g. Redis) at the orchestrator layer — see
`backend/src/middleware/rate-limit.ts`.

---

## 11. Environment variables (full reference)

Backend (`backend/.env.example` is the canonical template):

| Var | Default | Notes |
|-----|---------|-------|
| `NODE_ENV` | `development` | `development \| production \| test` |
| `PORT` | `3000` | |
| `ES_NODE` | `http://localhost:9200` | Elasticsearch URL |
| `ES_USERNAME` | `elastic` | |
| `ES_PASSWORD` | `changeme` | Override in real envs |
| `ES_CA_FINGERPRINT` | – | SHA-256 cert fingerprint (not a PEM) |
| `OIDC_ISSUER` | placeholder | **Required in prod** (no `your-tenant.*`) |
| `OIDC_AUDIENCE` | placeholder | **Required in prod** |
| `OIDC_JWKS_URI` | placeholder | **Required in prod** |
| `ALLOW_MOCK_AUTH` | `false` | Dev/test only; enables the `mock-token` bypass |
| `TRUST_PROXY` | `false` | `false \| true \| <int> \| loopback`; set behind a proxy |
| `ALLOWED_ORIGINS` | `http://localhost:4200` | CSV CORS allowlist |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Global limiter window |
| `RATE_LIMIT_MAX` | `200` | Global limiter max |
| `INGEST_RATE_LIMIT_WINDOW_MS` | `60000` | Ingest (`/logs`, `/audit/client`) window |
| `INGEST_RATE_LIMIT_MAX` | `30` | Ingest per-IP max |
| `LOG_LEVEL` | `info` | Winston level |
| `LOG_INDEX` | `interop-logs` | |
| `AUDIT_INDEX` | `interop-audit` | |

Frontend build-time config is in `src/environments/*` (`apiBaseUrl`, OIDC
placeholders). The prod nginx image substitutes `BACKEND_URL` at container start
(`docker-entrypoint.sh`).

---

## 12. Operational notes

- **Health probes:** use `/api/health/live` for liveness and `/api/health/ready`
  for readiness so a transient ES outage doesn't restart pods (readiness fails,
  liveness stays green). `/api/health` is the combined legacy check.
- **Rate limits:** global (default 200/min/IP) plus a tight ingest limiter
  (default 30/min/IP) on the unauthenticated `POST /api/logs` and
  `POST /api/audit/client`.
- **`req.ip` correctness** depends on `TRUST_PROXY`. Behind nginx/ingress set it
  (compose uses `1`, Helm defaults `"1"`), else rate limits and audit IPs record
  the proxy/container IP.
- **Process-local caches:** the policy cache (30s TTL per replica) — approvals
  bypass it (`getPolicy(true)`); the JWKS cache (5 min per replica). Both are
  bounded staleness, not correctness issues.
- **Reconciliation:** audit records with `action: RECONCILIATION_REQUIRED` mark
  a compensation that exhausted its retries — investigate for diverged
  registry/pending state.
- **ILM:** audit/logs roll over via write aliases; other indices are unbounded —
  add ILM/curation if their volume grows.

---

## 13. "Before production" checklist

The app is production-shaped but a few things are intentionally **dev
placeholders** — wire them before a real launch:

- [ ] **Real frontend auth.** `auth.service.ts` is a mock that auto-seeds an admin
      session in non-prod and is a no-op placeholder in prod. Integrate a real
      OIDC client and keep the `getAccessToken/currentUser$/isAdmin/login/logout`
      contract.
- [ ] **OIDC backend config.** Set real `OIDC_ISSUER/AUDIENCE/JWKS_URI` (the app
      refuses to start on placeholders in prod).
- [ ] **Secrets.** Replace `ES_PASSWORD=changeme` and provide the OIDC secret.
- [ ] **`ALLOW_MOCK_AUTH` must be unset/false** everywhere except local dev.
- [ ] **Elasticsearch security.** The built-in dev ES runs with `xpack.security`
      disabled. Use a secured/managed cluster in prod (`elasticsearch.enabled=false`
      + credentials, or enable security).
- [ ] **API explorer "Try it"** is a client-side mock — decide whether to keep it
      as documentation or implement live execution.
- [ ] **Index lifecycle** for the unbounded indices if volume grows.
- [ ] **Observability.** Pod annotations advertise `/api/metrics` for Prometheus,
      but there is no metrics endpoint yet — add one or remove the annotation.

---

## 14. Where to start / common tasks

- **Add an API endpoint:** create the route in `backend/src/api/routes/*`, mount
  it in `api/router.ts`, add types in `types/index.ts`, then the client method in
  `frontend/.../registry.service.ts` (+ mirror types). Add a `supertest` route
  test.
- **Add an entry field:** update `BaseEntry`/the specific type in **both**
  `backend/src/types/index.ts` and `frontend/.../shared/types/index.ts`, the ES
  mapping in `indices.ts`, the allowlist in `entry-dto.ts`, and the seed.
- **Change the policy engine:** `services/policy.ts` (+ `policy.test.ts`);
  validation lives in `policy-validation.ts`.
- **Add/adjust an ES index:** add to `INDEX_NAMES` and a `create…Index()` in
  `indices.ts`, wire it into `setupIndices()`.
- **Restyle:** edit `project/styles.css`, then
  `cp project/styles.css frontend/src/vendor/interop.css` (CI enforces sync).
  Angular-only additions go in `frontend/src/styles.scss`.
- **Add an icon:** add an entry to `ICON_CONTENT` in `icon.component.ts`.
- **Run everything before pushing:** `backend: npm run build && npm test`;
  `frontend: npm run build && npm run test:ci`; `node scripts/check-styles-sync.mjs`.
```
