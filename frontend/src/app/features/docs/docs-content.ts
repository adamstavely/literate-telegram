import { ICON_CONTENT } from '../../shared/components/icon/icon.component';

export interface DocSection {
  id: string;
  label: string;
}

export interface DocArticle {
  id: string;
  section: string;
  title: string;
  navLabel?: string;
  readTime: number;
  updatedAt: string;
  lead: string;
  body: string;
}

// --- Block types (mirrors project/docs-content.js) ---

interface DocBlockLead { t: 'lead'; v: string }
interface DocBlockH2 { t: 'h2'; v: string }
interface DocBlockH3 { t: 'h3'; v: string }
interface DocBlockP { t: 'p'; v: string }
interface DocBlockCode { t: 'code'; lang: string; v: string }
interface DocBlockCallout { t: 'callout'; tone: 'accent' | 'default' | 'ok' | 'warn'; icon: string; v: string }
interface DocBlockList { t: 'list'; v: string[] }
interface DocBlockSteps { t: 'steps'; v: { title: string; body: string }[] }
interface DocBlockCards { t: 'cards'; v: { icon: string; title: string; body: string; go?: string }[] }
interface DocBlockKeyval { t: 'keyval'; v: [string, string][] }
interface DocBlockTable { t: 'table'; head: string[]; rows: string[][] }
interface DocBlockDivider { t: 'divider' }

type DocBlock =
  | DocBlockLead
  | DocBlockH2
  | DocBlockH3
  | DocBlockP
  | DocBlockCode
  | DocBlockCallout
  | DocBlockList
  | DocBlockSteps
  | DocBlockCards
  | DocBlockKeyval
  | DocBlockTable
  | DocBlockDivider;

interface DocArticleDef {
  title: string;
  navLabel?: string;
  desc: string;
  updated: string;
  read: number;
  blocks: DocBlock[];
}

// --- Renderer ---

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function iconSvg(name: string, size = 16): string {
  const paths = ICON_CONTENT[name];
  if (!paths) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function docHref(target: string): string {
  if (target === '#browse') return '/';
  if (target.startsWith('#')) return `/docs/${target.slice(1)}`;
  return `/docs/${target}`;
}

function parseInline(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="doc-icode">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) =>
      `<a href="${docHref(target)}" class="doc-link">${label}</a>`);
}

function renderBlock(b: DocBlock): string {
  switch (b.t) {
    case 'lead':
      return `<p class="doc-lead">${parseInline(b.v)}</p>`;
    case 'h2':
      return `<h2 id="${slugify(b.v)}" class="doc-h2">${b.v}</h2>`;
    case 'h3':
      return `<h3 class="doc-h3">${b.v}</h3>`;
    case 'p':
      return `<p class="doc-p">${parseInline(b.v)}</p>`;
    case 'code': {
      const escaped = b.v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="codeblock"><pre><code>${escaped}</code></pre></div>`;
    }
    case 'callout': {
      const accent = b.tone === 'accent' ? ' accent' : '';
      return `<div class="callout${accent} doc-callout">${iconSvg(b.icon)}<div>${parseInline(b.v)}</div></div>`;
    }
    case 'list':
      return `<ul class="doc-list">${b.v.map(it => `<li>${parseInline(it)}</li>`).join('')}</ul>`;
    case 'steps':
      return `<ol class="doc-steps">${b.v.map((s, i) =>
        `<li><span class="doc-step-n">${i + 1}</span><div><div class="doc-step-t">${parseInline(s.title)}</div><div class="doc-step-b">${parseInline(s.body)}</div></div></li>`,
      ).join('')}</ol>`;
    case 'cards':
      return `<div class="doc-cards">${b.v.map(c => {
        const tag = c.go ? 'a' : 'div';
        const href = c.go ? ` href="/docs/${c.go}"` : '';
        const arrow = c.go ? iconSvg('arrowRight', 14) : '';
        return `<${tag}${href} class="doc-card"><div class="doc-card-ic">${iconSvg(c.icon, 17)}</div><div class="doc-card-t">${c.title}${arrow}</div><div class="doc-card-b">${c.body}</div></${tag}>`;
      }).join('')}</div>`;
    case 'keyval':
      return `<div class="doc-keyval">${b.v.map(([k, v]) =>
        `<div class="doc-kv-row"><div class="doc-kv-k mono">${k}</div><div class="doc-kv-v">${parseInline(v)}</div></div>`,
      ).join('')}</div>`;
    case 'table': {
      const head = b.head.map((h, i) => `<th${i === 0 ? ' class="lead"' : ''}>${h}</th>`).join('');
      const rows = b.rows.map(row =>
        `<tr>${row.map((cell, j) =>
          j === 0 ? `<th scope="row">${cell}</th>` : `<td>${parseInline(cell)}</td>`,
        ).join('')}</tr>`,
      ).join('');
      return `<div class="doc-table-wrap"><table class="doc-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    case 'divider':
      return '<hr class="doc-divider">';
    default:
      return '';
  }
}

function renderBlocks(blocks: DocBlock[]): string {
  return blocks.map(renderBlock).join('\n');
}

// --- Navigation & articles (mirrors project/docs-content.js) ---

const NAV: { group: string; sectionId: string; items: { id: string; label: string }[] }[] = [
  {
    group: 'Getting started',
    sectionId: 'getting-started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'quickstart', label: 'Quickstart' },
      { id: 'concepts', label: 'Core concepts' },
    ],
  },
  {
    group: 'Object types',
    sectionId: 'object-types',
    items: [
      { id: 'apis', label: 'APIs' },
      { id: 'servers', label: 'MCP servers' },
      { id: 'tools', label: 'Tools' },
      { id: 'skills', label: 'Skills' },
      { id: 'agents', label: 'Agents' },
    ],
  },
  {
    group: 'Governance',
    sectionId: 'governance',
    items: [
      { id: 'least-privilege', label: 'Least privilege' },
      { id: 'publishing', label: 'Publishing & review' },
    ],
  },
  {
    group: 'Reference',
    sectionId: 'reference',
    items: [
      { id: 'skill-spec', label: 'SKILL.md spec' },
      { id: 'transports', label: 'Transports & auth' },
      { id: 'compatibility', label: 'Client compatibility' },
    ],
  },
];

const ARTICLES: Record<string, DocArticleDef> = {
  overview: {
    title: 'Overview',
    desc: 'Interop is the interoperability layer for everything an agent uses.',
    updated: '2026-06-01',
    read: 4,
    blocks: [
      { t: 'lead', v: 'An agent is only as capable as the things it can reach for. Interop is where your organization registers, governs, and discovers those capabilities — the **servers** and **tools** that let an agent *act*, and the **skills** that teach it how to act *well*.' },
      { t: 'h2', v: 'Three object types' },
      { t: 'p', v: 'Everything in the registry is one of three kinds. They sit at two different layers of the stack, and that distinction drives how each is governed.' },
      {
        t: 'cards', v: [
          { icon: 'server', title: 'MCP server', body: 'A package that exposes a set of tools, resources, and prompts over the MCP protocol. Carries the credentials, transport, and lifecycle.', go: 'servers' },
          { icon: 'tool', title: 'Tool', body: 'A single callable function — name, input schema, return value. The model calls it, code runs, a result comes back.', go: 'tools' },
          { icon: 'skill', title: 'Skill', body: 'Portable procedural knowledge. A SKILL.md the agent reads when a task matches — not an endpoint it calls.', go: 'skills' },
        ],
      },
      { t: 'callout', tone: 'accent', icon: 'shield', v: 'The one architectural line that matters: **tools and servers are the MCP protocol; skills are not.** MCP defines tools, resources, prompts, and the server transport. Skills are a separate, complementary standard that lives at the host/agent layer *above* the protocol.' },
      { t: 'h2', v: 'What the registry gives you' },
      {
        t: 'list', v: [
          '**One catalog** for servers, tools, and skills — searchable, filterable, and versioned.',
          '**Governed distribution.** Every entry passes through review; least privilege is the default posture.',
          '**Compatibility at a glance.** See which clients and models each entry supports before you connect it.',
          '**A path to publish.** Anyone on the team can submit; admins decide what reaches an agent.',
        ],
      },
      { t: 'h2', v: 'Where to go next' },
      {
        t: 'cards', v: [
          { icon: 'bolt', title: 'Quickstart', body: 'Find a server, connect a client, and invoke your first tool in a sandbox.', go: 'quickstart' },
          { icon: 'book', title: 'Core concepts', body: 'The precise difference between a server, a tool, and a skill — and why it matters.', go: 'concepts' },
        ],
      },
    ],
  },

  quickstart: {
    title: 'Quickstart',
    desc: 'From an empty agent to a working tool call in three steps.',
    updated: '2026-05-30',
    read: 5,
    blocks: [
      { t: 'lead', v: 'This walks through the shortest path: discover an entry, connect it to a client, and feel a tool\'s shape in the sandbox before you wire it up for real.' },
      { t: 'h2', v: '1. Find something to connect' },
      { t: 'p', v: 'Open [Browse](#browse) and filter by type. Start with a read-only server — the `Filesystem` or `Brave Search` server is a safe first connection because nothing it exposes mutates state.' },
      { t: 'callout', tone: 'default', icon: 'search', v: 'Press **⌘K** anywhere to jump straight to search.' },
      { t: 'h2', v: '2. Connect a client' },
      { t: 'p', v: 'On any server\'s page, hit **Install** and pick your client. Interop hands you a config block — drop it into your client\'s MCP settings.' },
      {
        t: 'code', lang: 'json', v: `{
  "mcpServers": {
    "brave-search": {
      "transport": "http",
      "url": "https://registry.dev/brave/search"
    }
  }
}`,
      },
      { t: 'p', v: 'On first use the client prompts you to authorize. Credentials live with the **server**, never with the individual tool calls.' },
      { t: 'h2', v: '3. Invoke a tool' },
      { t: 'p', v: 'Every tool has a **Use** action that runs against a mock, so you can see the input schema and return shape without touching production. Real calls run through the same interface once you\'re connected.' },
      {
        t: 'code', lang: 'text', v: `web_search({ query: "model context protocol" })

→ [
    { "title": "Model Context Protocol", "url": "https://modelcontextprotocol.io" },
    { "title": "Spec — Tools", "url": "https://spec.mcp.dev/tools" }
  ]`,
      },
      { t: 'h2', v: 'Add a skill' },
      { t: 'p', v: 'Skills don\'t connect — they\'re *read*. Adding one drops its SKILL.md into your agent\'s skill index; the agent loads the full instructions only when a task matches its trigger phrases. See [Skills](#skills) for how that works.' },
      { t: 'callout', tone: 'ok', icon: 'check', v: 'That\'s the whole loop: **discover → connect → use.** Servers and tools give an agent the ability to *do* things; skills give it the ability to *think* about how.' },
    ],
  },

  concepts: {
    title: 'Core concepts',
    desc: 'Servers, tools, and skills — the precise distinction.',
    updated: '2026-06-01',
    read: 6,
    blocks: [
      { t: 'lead', v: 'These three words get used loosely. The registry treats them as distinct object types because they behave differently and are governed differently. Here\'s the exact line between them.' },
      { t: 'h2', v: 'Tool' },
      { t: 'p', v: 'A tool is **one callable function**: a name, a description, an input schema, and a return value. `send_email`, `query_graph`. The model calls it, code runs, a result comes back. It is a primitive in the MCP spec.' },
      { t: 'h2', v: 'MCP server' },
      { t: 'p', v: 'A server is the **package and process** that exposes a set of tools — plus resources and prompts — over the MCP protocol. Tools-to-server is many-to-one: the server is a governed toolbox behind one endpoint, carrying the credentials, the transport (`stdio` / `HTTP` / `SSE`), and the lifecycle.' },
      { t: 'p', v: 'When a gateway enforces least privilege through *virtual servers*, it is choosing which tools from which servers a given caller can see. That is access control over the capability axis.' },
      { t: 'h2', v: 'Skill' },
      { t: 'p', v: 'A skill is **portable procedural knowledge**, not a callable endpoint. It\'s a SKILL.md file with YAML frontmatter — name, description, trigger phrases — that tells the agent *how* to do a task: the steps, the conventions, which tools to reach for, what good output looks like.' },
      { t: 'p', v: 'The agent does not call a skill, it **reads** one. The distinguishing mechanism is *progressive disclosure*: the agent holds a lightweight index of skill names and descriptions, and loads the full SKILL.md only when a task matches.' },
      { t: 'callout', tone: 'accent', icon: 'skill', v: 'A clean way to hold it: bundles give an agent the ability to **do** things; skills give it the ability to **think**.' },
      { t: 'h2', v: 'Side by side' },
      {
        t: 'table',
        head: ['', 'Server', 'Tool', 'Skill'],
        rows: [
          ['Layer', 'MCP protocol', 'MCP protocol', 'Host / agent'],
          ['Agent action', 'Connects', 'Calls', 'Reads'],
          ['Carries credentials', 'Yes', 'Inherits server\'s', 'No'],
          ['Unit', 'Process + endpoint', 'Function', 'SKILL.md file'],
          ['Governed by', 'The gateway', 'Allowlist per virtual server', 'Content review'],
        ],
      },
      { t: 'h2', v: 'The architectural line' },
      { t: 'p', v: 'Tools and servers **are** the MCP protocol. Skills are a separate standard that lives at the host layer above it. That\'s why the registry distributes both but treats them as different object types — and why a gateway governs servers but has nothing to say about skills.' },
    ],
  },

  servers: {
    title: 'MCP servers',
    desc: 'The governed toolbox behind one endpoint.',
    updated: '2026-05-28',
    read: 5,
    blocks: [
      { t: 'lead', v: 'A server is the unit you connect to. It packages a set of tools and exposes them over a single transport, holding the credentials and lifecycle so individual tool calls don\'t have to.' },
      { t: 'h2', v: 'What a server carries' },
      {
        t: 'keyval', v: [
          ['Transport', 'How the server is reached — `stdio`, streamable `HTTP`, or `SSE`.'],
          ['Authentication', 'The credential scheme: OAuth 2.1, API key, bot token, connection string.'],
          ['Tools', 'The functions it exposes. Many tools, one server.'],
          ['Resources & prompts', 'Read-only context and prompt templates the server can offer alongside its tools.'],
          ['Lifecycle', 'Versioning, health, and the update cadence the registry tracks.'],
        ],
      },
      { t: 'h2', v: 'Virtual servers' },
      { t: 'p', v: 'A caller rarely needs every tool a server ships. A **virtual server** is a least-privilege view: an admin allowlists a subset of tools from one or more real servers, and that\'s all the caller sees. The capability axis becomes an access-control surface.' },
      { t: 'callout', tone: 'accent', icon: 'shield', v: 'An agent only ever sees the tools an admin has explicitly exposed through a virtual server. That\'s the registry\'s default, not an opt-in.' },
      { t: 'h2', v: 'Reading a server page' },
      { t: 'p', v: 'Each server\'s detail page lists its tools, its transport and auth, its install count and trend, and which clients it\'s compatible with. Write tools are marked — under the default posture they stay behind an allowlist until an admin enables them.' },
      { t: 'callout', tone: 'default', icon: 'server', v: 'Browse the [servers in the catalog](#browse) to see real examples: Filesystem, GitHub, Postgres, Slack.' },
    ],
  },

  tools: {
    title: 'Tools',
    desc: 'One callable function: name, schema, return value.',
    updated: '2026-05-26',
    read: 4,
    blocks: [
      { t: 'lead', v: 'A tool is the smallest unit of capability in the registry — a single function the model can call. It\'s a primitive in the MCP spec, always exposed by a server.' },
      { t: 'h2', v: 'Anatomy of a tool' },
      {
        t: 'code', lang: 'json', v: `{
  "name": "create_issue",
  "description": "Open a new issue on a repository.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repo":  { "type": "string" },
      "title": { "type": "string" },
      "body":  { "type": "string" }
    },
    "required": ["repo", "title"]
  }
}`,
      },
      { t: 'p', v: 'The model fills in the input schema, code on the server runs, and a typed result comes back — here, an `Issue { number, url, state }`.' },
      { t: 'h2', v: 'Read vs. write' },
      { t: 'p', v: 'The single most important property of a tool is whether it **mutates state**. `search_code` is read-only and low-risk. `delete_table` is irreversible. The registry marks write tools, and the default posture holds them behind an allowlist until an admin opts in.' },
      { t: 'callout', tone: 'warn', icon: 'warning', v: 'Destructive verbs — `delete_`, `drop_`, `purge_` — with no confirmation step are flagged automatically at review. See [Least privilege](#least-privilege).' },
      { t: 'h2', v: 'Trying a tool' },
      { t: 'p', v: 'Every tool has a **Use** action. It runs against a mock that mirrors the real input schema and return shape, so you can feel how a tool behaves before connecting its server for real.' },
    ],
  },

  skills: {
    title: 'Skills',
    desc: 'Procedural knowledge, loaded on demand.',
    updated: '2026-05-29',
    read: 6,
    blocks: [
      { t: 'lead', v: 'A skill is the one object type that isn\'t part of the MCP protocol. It carries no credentials and exposes no endpoint. It\'s knowledge — a file the agent reads to learn *how* to do a task well.' },
      { t: 'h2', v: 'A skill is read, not called' },
      { t: 'p', v: 'Where a tool is a function the model invokes, a skill is a document the agent loads into context. It tells the agent the steps, the conventions, which tools to reach for, and what good output looks like. The worst case of a bad skill is bad *advice*, not a bad *action*.' },
      { t: 'h2', v: 'Progressive disclosure' },
      { t: 'p', v: 'Agents can\'t hold every skill in context at once, so skills load in two stages. The agent always holds a lightweight **index** — just each skill\'s name and description. When a task matches, it pulls the **full SKILL.md** for that one skill.' },
      { t: 'callout', tone: 'accent', icon: 'skill', v: 'You\'re talking to an instance of exactly this pattern right now: an agent holds a list of skill descriptions and pulls the full instructions in only when a task calls for one.' },
      { t: 'h2', v: 'Anatomy of a SKILL.md' },
      {
        t: 'code', lang: 'markdown', v: `---
name: PR Review
description: Review a pull request the way a senior engineer would.
triggers: ["review this PR", "code review", "look at this diff"]
---

# PR Review

Separate blocking issues from nits. End with an explicit verdict.

1. Read the diff in full before commenting.
2. Check tests cover the change.
3. Flag correctness and security first; style last.
4. Close with: ship / hold / needs-changes.`,
      },
      { t: 'p', v: 'The frontmatter is what lives in the index. The body is what loads on a match. A tight, specific `description` is what makes a skill trigger reliably — see the [SKILL.md spec](#skill-spec).' },
      { t: 'h2', v: 'Why skills aren\'t governed like servers' },
      { t: 'p', v: 'A gateway governs servers because servers hold credentials and perform actions. A skill does neither, so the registry reviews its **content** — for prompt-injection patterns, for clear triggers, for a sane token budget — rather than its access.' },
    ],
  },

  apis: {
    title: 'APIs',
    desc: 'The raw HTTP service an MCP server wraps.',
    updated: '2026-06-02',
    read: 4,
    blocks: [
      { t: 'lead', v: 'An API is the bottom of the stack — a raw REST or GraphQL service with endpoints, a base URL, and a credential. It\'s the *raw material* a server turns into governed, agent-safe tools.' },
      { t: 'h2', v: 'Why catalogue the raw API' },
      { t: 'p', v: 'A raw API isn\'t agent-safe on its own: it has no concept of least privilege, and calling it means holding a live secret. Cataloguing it in the registry makes the surface visible — so you can see what exists, what\'s already wrapped, and what\'s a candidate to wrap next.' },
      { t: 'callout', tone: 'accent', icon: 'api', v: 'The registry models the whole stack: an **API** is wrapped by an **MCP server**, which exposes **tools**, which **skills** teach an agent to use, and an **agent** composes it all. APIs are layer zero.' },
      { t: 'h2', v: 'REST vs. GraphQL' },
      {
        t: 'keyval', v: [
          ['REST', 'Resource-oriented HTTP — predictable URLs, a verb per action, one request per resource.'],
          ['GraphQL', 'A single typed endpoint — ask for exactly the fields you need in one round trip.'],
        ],
      },
      { t: 'p', v: 'The registry records each endpoint as a method and a path (`POST /charges`) or a GraphQL operation (`MUTATION issueCreate`), so you can read the surface before wrapping it.' },
      { t: 'h2', v: 'Wrapping an API' },
      { t: 'p', v: 'The point of an API entry is the **wrap**. An MCP server takes the endpoints, holds the credential at its boundary, and exposes a least-privilege subset as tools. An agent then uses the *server* — it never sees the raw API or its key.' },
      { t: 'callout', tone: 'warn', icon: 'shield', v: 'Cataloguing an API does not expose it to agents. Until it\'s wrapped as a server, the gateway has nothing to govern. Unwrapped APIs in the catalog are an invitation, not a connection.' },
      { t: 'h2', v: 'Reading an API page' },
      { t: 'p', v: 'Each API page lists its endpoints, its style and auth, and a **Wrapped by** link to the MCP server that fronts it — or a *Wrap as MCP server* call to action when none does yet. Browse the [APIs in the catalog](#browse) to see Stripe, GitHub REST, and Linear\'s GraphQL surface.' },
    ],
  },

  agents: {
    title: 'Agents',
    desc: 'The composition layer — servers and skills, assembled.',
    updated: '2026-06-02',
    read: 5,
    blocks: [
      { t: 'lead', v: 'An agent is the top of the stack: a deployable assistant that **composes** the other object types. Servers and tools give it the ability to *act*; skills give it the ability to *reason*; a model and an autonomy policy tie it together.' },
      { t: 'h2', v: 'An agent is a composition' },
      { t: 'p', v: 'Where a server is a thing you connect and a skill is a thing you read, an agent is a thing you *assemble*. It references registry entries by slug — the servers it\'s wired to and the skills it loads — plus the model it runs on and the autonomy it\'s granted.' },
      {
        t: 'code', lang: 'json', v: `{
  "agent": "anthropic/release-captain",
  "model": "Claude Sonnet 4.5",
  "autonomy": "approval",
  "servers": ["anthropic/github", "linear/mcp"],
  "skills": ["anthropic/release-notes", "anthropic/pr-review"]
}`,
      },
      { t: 'p', v: 'Deploying resolves those slugs to the governed servers and skills your org has actually approved — so an agent is never more privileged than its building blocks.' },
      { t: 'h2', v: 'Do and think' },
      { t: 'p', v: 'The two halves of an agent map exactly onto the layers below it. The **servers** are its hands — the tools it can call. The **skills** are its judgement — the playbooks that shape *how* it uses those tools. A capable agent needs both.' },
      { t: 'callout', tone: 'accent', icon: 'agent', v: 'Servers and tools give an agent the ability to **do**; skills give it the ability to **think**. An agent is where the two meet.' },
      { t: 'h2', v: 'Autonomy' },
      { t: 'p', v: 'The most important property of an agent is how far it can go without a human. The registry records one of three policies, and the gateway enforces it:' },
      {
        t: 'table',
        head: ['Policy', 'Behaviour'],
        rows: [
          ['Read-only', 'Drafts and reads. Never takes a mutating action.'],
          ['Asks approval', 'Proposes actions; a human confirms before anything runs.'],
          ['Autonomous', 'Acts on its own within its granted scope.'],
        ],
      },
      { t: 'p', v: 'Autonomy is capped by scope: an agent only ever sees the tools an admin has exposed to it through a virtual server. A higher autonomy policy widens *what it may do unattended*, never *what it can reach*.' },
      { t: 'h2', v: 'Reading an agent page' },
      { t: 'p', v: 'Each agent page leads with its **Capabilities** — the servers and skills it composes, each a live link into the registry — plus a *Composed of* count, its model, its autonomy badge, and an agent manifest. Browse the [agents in the catalog](#browse) to see Release Captain, On-Call SRE, and Code Reviewer.' },
    ],
  },

  'least-privilege': {
    title: 'Least privilege',
    desc: 'The default posture: nothing reaches an agent unasked.',
    updated: '2026-06-01',
    read: 5,
    blocks: [
      { t: 'lead', v: 'The registry\'s governing principle is that capability is granted, never assumed. An agent sees exactly the tools an admin has chosen to expose — no more.' },
      { t: 'h2', v: 'The default posture' },
      {
        t: 'list', v: [
          '**Read-only by default.** Write tools stay disabled until an admin enables them.',
          '**Per-tool approval.** Each tool is individually allowlisted into a virtual server before any caller sees it.',
          '**Block writes until reviewed.** Mutating tools are held even if the publisher shipped them enabled.',
          '**Quarantine high risk.** Anything a high-severity rule blocks is held out of the catalog until cleared.',
        ],
      },
      { t: 'callout', tone: 'accent', icon: 'shield', v: 'Admins tune all of this on the **Policy settings** page — pick a Strict / Balanced / Open preset, or set each control individually.' },
      { t: 'h2', v: 'Risk rules' },
      { t: 'p', v: 'Every submission is evaluated against a set of rules. Each match produces a flag and an action — *flag only*, *require review*, *block publish*, or *auto-reject*. The most severe matched action wins.' },
      {
        t: 'table',
        head: ['Rule', 'Severity', 'Default action'],
        rows: [
          ['Arbitrary code execution', 'High', 'Block publish'],
          ['No sandbox declared', 'High', 'Block publish'],
          ['Write tools on by default', 'Medium', 'Require review'],
          ['Unverified publisher domain', 'Medium', 'Flag'],
          ['Destructive verbs, no confirm', 'High', 'Require review'],
        ],
      },
      { t: 'p', v: 'These rules are exactly what populates the moderation queue. A flagged submission carries its flags into review so an admin sees why it was held.' },
    ],
  },

  publishing: {
    title: 'Publishing & review',
    desc: 'How an entry gets from submission to catalog.',
    updated: '2026-05-31',
    read: 4,
    blocks: [
      { t: 'lead', v: 'Anyone on the team can publish; admins decide what reaches an agent. Every entry travels the same path from draft to live.' },
      { t: 'h2', v: 'The publish flow' },
      {
        t: 'steps', v: [
          { title: 'Choose a type', body: 'Server, tool, or skill — this determines how the entry is governed.' },
          { title: 'Declare its shape', body: 'Identity and the interface: transport and auth for a server, the input schema for a tool, triggers and SKILL.md for a skill.' },
          { title: 'Set governance', body: 'Read-only defaults, per-tool approval, and visibility. Skills set who can load them.' },
          { title: 'Submit for review', body: 'The entry lands in the moderation queue with any rule flags attached.' },
        ],
      },
      { t: 'h2', v: 'The fast path' },
      { t: 'p', v: 'Not everything needs a human. Two opt-in rules let trusted submissions skip the queue when no risk rule flags them:' },
      {
        t: 'list', v: [
          '**Verified publishers.** Servers from an allowlisted, verified domain auto-approve.',
          '**Skills.** Because skills carry no credentials, they can publish without review unless a content rule flags them.',
        ],
      },
      { t: 'callout', tone: 'ok', icon: 'verified', v: 'Domains earn the verified badge by completing DNS verification. Admins manage the allowlist under **Policy settings → Publisher trust**.' },
      { t: 'h2', v: 'In the queue' },
      { t: 'p', v: 'Admins review each pending entry with its flags, risk level, and publisher in view, then approve or reject. High-risk submissions can require a second approver before going live.' },
    ],
  },

  'skill-spec': {
    title: 'SKILL.md specification',
    navLabel: 'SKILL.md spec',
    desc: 'The format an agent reads.',
    updated: '2026-05-25',
    read: 5,
    blocks: [
      { t: 'lead', v: 'A skill is a single Markdown file with YAML frontmatter. The frontmatter is the index entry; the body is what loads on a match.' },
      { t: 'h2', v: 'Frontmatter fields' },
      {
        t: 'keyval', v: [
          ['name', 'Human-readable skill name. Shown in the index.'],
          ['description', 'One or two sentences on what the skill does and when to use it. This is what the agent matches against — make it specific.'],
          ['triggers', 'Phrases or intents that should load the skill. Optional but strongly recommended.'],
          ['version', 'Semver. The registry tracks updates and can re-queue stale skills for review.'],
        ],
      },
      { t: 'h2', v: 'A minimal skill' },
      {
        t: 'code', lang: 'markdown', v: `---
name: Changelog Writer
description: Turn a range of merged PRs into a clean, grouped changelog entry.
triggers: ["write a changelog", "release notes", "summarize these PRs"]
version: 1.0.0
---

# Changelog Writer

Group changes by type. Keep voice consistent; link each item to its PR.

1. Collect merged PRs in the range.
2. Bucket into Features / Fixes / Internal.
3. Write one line per change, present tense.
4. Return the list plus a one-line summary.`,
      },
      { t: 'h2', v: 'Writing a description that triggers' },
      { t: 'p', v: 'Progressive disclosure means the agent only ever sees your `description` until a task matches it. A vague description never loads; an overstuffed one loads on the wrong tasks. State the task and the signal that should invoke it.' },
      { t: 'callout', tone: 'warn', icon: 'warning', v: 'Avoid instructions in a skill that try to override the agent or coerce tool calls. The registry scans SKILL.md bodies for prompt-injection patterns at review.' },
      { t: 'h2', v: 'Token budget' },
      { t: 'p', v: 'A skill that loads should earn its context. The registry can enforce a per-skill token cap — if a SKILL.md exceeds the agent\'s allowance, it\'s rejected. Keep the body to the steps that matter.' },
    ],
  },

  transports: {
    title: 'Transports & auth',
    desc: 'How servers are reached and how they prove identity.',
    updated: '2026-05-24',
    read: 4,
    blocks: [
      { t: 'lead', v: 'Two properties define how a server connects: its transport (the wire) and its authentication (the credential). The registry can permit or forbid each at the policy level.' },
      { t: 'h2', v: 'Transports' },
      {
        t: 'keyval', v: [
          ['HTTP', 'Streamable HTTP. A remote endpoint — the common case for hosted servers.'],
          ['SSE', 'Server-sent events. A long-lived remote stream.'],
          ['stdio', 'Runs a local subprocess on the host. The highest blast radius — often disallowed by policy.'],
        ],
      },
      { t: 'callout', tone: 'warn', icon: 'warning', v: '`stdio` executes a process on the host machine. Many organizations forbid it at the registry level — admins control this under **Policy settings → Capabilities**.' },
      { t: 'h2', v: 'Authentication' },
      {
        t: 'keyval', v: [
          ['OAuth 2.1', 'Delegated, scoped, revocable. The preferred scheme for user-facing servers.'],
          ['API key', 'A static secret. Simple, but rotate it and scope it tightly.'],
          ['Bot token', 'Workspace-scoped identity, common for messaging servers.'],
          ['Connection string', 'Direct resource access, e.g. a database. Treat as highly sensitive.'],
          ['None', 'Anonymous. Disallowing this blocks credential-free servers entirely.'],
        ],
      },
      { t: 'p', v: 'Credentials live with the **server**, never with individual tool calls. A virtual server inherits its parent\'s auth — exposing one tool doesn\'t mint a new credential.' },
    ],
  },

  compatibility: {
    title: 'Client compatibility',
    desc: 'Which agents can use what.',
    updated: '2026-05-22',
    read: 3,
    blocks: [
      { t: 'lead', v: 'Not every client speaks every protocol. The registry records compatibility so you know an entry will work before you connect it.' },
      { t: 'h2', v: 'The compatibility axis' },
      { t: 'p', v: 'Each server lists the clients it\'s been verified against. Skills are more portable — any agent that implements the skills format can read any SKILL.md — but the index still records where each has been exercised.' },
      {
        t: 'cards', v: [
          { icon: 'box', title: 'MCP clients', body: 'Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Zed — anything that speaks the MCP transport can connect a server.' },
          { icon: 'skill', title: 'Skill hosts', body: 'Any agent runtime that implements progressive disclosure and reads SKILL.md frontmatter.' },
        ],
      },
      { t: 'h2', v: 'Filtering by client' },
      { t: 'p', v: 'Use the **Compatible with** filter in [Browse](#browse) to narrow the catalog to entries your client supports. The compatibility badges on each detail page tell you what\'s been verified.' },
      { t: 'callout', tone: 'default', icon: 'check', v: 'Publishing a server? Declare the clients you\'ve tested against so the registry can route it to the right users.' },
    ],
  },
};

export const DOC_SECTIONS: DocSection[] = NAV.map(g => ({
  id: g.sectionId,
  label: g.group,
}));

export const DOC_ARTICLES: DocArticle[] = NAV.flatMap(g =>
  g.items.map(item => {
    const def = ARTICLES[item.id];
    return {
      id: item.id,
      section: g.sectionId,
      title: def.title,
      navLabel: def.navLabel ?? item.label,
      readTime: def.read,
      updatedAt: def.updated,
      lead: def.desc,
      body: renderBlocks(def.blocks),
    };
  }),
);
