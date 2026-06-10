export interface DocSection {
  id: string;
  label: string;
}

export interface DocArticle {
  id: string;
  section: string;
  title: string;
  readTime: number;
  updatedAt: string;
  lead: string;
  body: string; // HTML content
}

export const DOC_SECTIONS: DocSection[] = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'object-types', label: 'Object Types' },
  { id: 'governance', label: 'Governance' },
  { id: 'reference', label: 'Reference' },
];

export const DOC_ARTICLES: DocArticle[] = [
  {
    id: 'introduction',
    section: 'getting-started',
    title: 'Introduction',
    readTime: 3,
    updatedAt: '2026-05-01',
    lead: 'Interop is a governed registry for everything an agent needs — MCP servers, tools, skills, agents, and APIs — discoverable and deployable from a single interface.',
    body: `
      <h2 id="what-is-interop">What is Interop?</h2>
      <p>Interop solves a coordination problem. As AI agents proliferate, so do the capabilities they depend on: MCP servers that expose database connections, tools that call APIs, skills that encode procedural knowledge, agents that compose all of the above. Without a registry, every team maintains its own list. Capability drift is invisible. Governance is impossible.</p>
      <p>Interop brings these into one governed catalog. Browse what exists, understand what each entry does, connect it to your stack, and publish your own — with a policy layer that controls what is allowed to run and for whom.</p>

      <h2 id="five-object-types">Five object types</h2>
      <p>The registry recognizes five distinct kinds of entry, each with its own role in the agent stack:</p>
      <ul>
        <li><strong>MCP Servers</strong> — packages that expose tools, resources, and prompts over the MCP protocol.</li>
        <li><strong>Tools</strong> — individual callable functions within a server: a name, an input schema, and a return shape.</li>
        <li><strong>Skills</strong> — portable procedural knowledge encoded in SKILL.md files, read by agents, not called by them.</li>
        <li><strong>Agents</strong> — composed assistants that wire together servers, skills, and a model to accomplish a category of tasks.</li>
        <li><strong>APIs</strong> — raw HTTP or GraphQL APIs that can be catalogued directly or wrapped in an MCP server.</li>
      </ul>

      <h2 id="governing-by-default">Governing by default</h2>
      <p>Every entry carries a sensitivity classification (Public, Internal, Confidential, Restricted), and the admin can configure policy rules that gate what gets published. High-risk submissions — write tools, destructive operations, unverified publishers — are flagged automatically and queued for human review.</p>

      <div class="callout callout--info">
        <strong>Design principle:</strong> The registry is read-first. Browsing and searching require no account. Registration and governance actions require authentication.
      </div>
    `,
  },

  {
    id: 'quickstart',
    section: 'getting-started',
    title: 'Quick Start',
    readTime: 5,
    updatedAt: '2026-05-10',
    lead: 'Connect your first MCP server in under five minutes — find it in the catalog, copy the install command, and paste it into your client config.',
    body: `
      <h2 id="find-a-server">1. Find a server</h2>
      <p>Browse to the <a href="/">catalog</a>. Use the sidebar to filter by type (Server), category, or compatible client. Or search by name — the search bar in the header runs across names, summaries, and publisher names.</p>

      <h2 id="read-the-detail-page">2. Read the detail page</h2>
      <p>Click any card to open the detail page. The <strong>Overview</strong> tab shows what the server does, which clients support it, and which tools it exposes. The <strong>Install</strong> tab gives you the config block to paste.</p>

      <h2 id="install">3. Install</h2>
      <p>For stdio servers, the install command looks like:</p>
      <pre><code>npx -y @modelcontextprotocol/server-github</code></pre>
      <p>For HTTP/SSE servers, you'll get a URL and an auth snippet. Paste the JSON block into your client's MCP config file:</p>
      <pre><code>{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "&lt;your-token&gt;"
      }
    }
  }
}</code></pre>

      <h2 id="verify">4. Verify</h2>
      <p>Restart your client. The server should appear in the MCP tools list. If it doesn't, check the client logs — most clients surface MCP connection errors there.</p>

      <div class="callout callout--tip">
        <strong>Tip:</strong> Use the <strong>Clients</strong> column on the detail page to confirm your client is listed as compatible before installing.
      </div>
    `,
  },

  {
    id: 'mcp-servers',
    section: 'object-types',
    title: 'MCP Servers',
    readTime: 6,
    updatedAt: '2026-05-15',
    lead: 'An MCP server is the package and process that exposes a set of tools, resources, and prompts over the Model Context Protocol — the governed toolbox behind one endpoint.',
    body: `
      <h2 id="what-a-server-is">What a server is</h2>
      <p>An MCP server is a running process that implements the MCP specification. It carries the credentials, the transport (stdio/HTTP/SSE), and the lifecycle. Tools-to-server is many-to-one: a server is a governed toolbox, and the tools are the individual callables it exposes.</p>
      <p>When a gateway does least-privilege through virtual servers, it is choosing which tools from which servers a caller sees. That's access control over the capability axis.</p>

      <h2 id="transports">Transports</h2>
      <p>Three transports are in use today:</p>
      <ul>
        <li><strong>stdio</strong> — The server runs as a child process. The client communicates via stdin/stdout. Simplest to deploy, no network surface.</li>
        <li><strong>HTTP</strong> — The server exposes a REST-like endpoint. Suitable for remote servers and multi-client scenarios.</li>
        <li><strong>SSE</strong> — Server-Sent Events over HTTP. Used for streaming responses and long-lived connections.</li>
      </ul>

      <h2 id="auth">Auth</h2>
      <p>Each server declares its auth requirement in its registry entry. Common values: <code>none</code>, <code>api-key</code>, <code>oauth2</code>, <code>connection-string</code>. The detail page shows you exactly what credential the server expects and how to supply it.</p>

      <h2 id="tools-and-resources">Tools, resources, and prompts</h2>
      <p>A server exposes three kinds of MCP primitive:</p>
      <ul>
        <li><strong>Tools</strong> — callable functions the model can invoke.</li>
        <li><strong>Resources</strong> — read-only data sources the model can reference (file contents, database rows, etc.).</li>
        <li><strong>Prompts</strong> — reusable prompt templates the client or model can load.</li>
      </ul>
      <p>The registry's <strong>Tools</strong> tab on each server detail page lists every tool with its parameters and return type.</p>

      <div class="callout callout--warn">
        <strong>Write tools:</strong> Any tool that mutates state (creates, updates, deletes) is flagged as a write tool and subject to stricter governance. Check the policy settings to see the rules that apply in your organization.
      </div>
    `,
  },

  {
    id: 'tools',
    section: 'object-types',
    title: 'Tools',
    readTime: 4,
    updatedAt: '2026-05-15',
    lead: 'A tool is one callable function: a name, a description, an input schema, and a return value. The model calls it, code runs, a result comes back. It is a primitive in the MCP spec.',
    body: `
      <h2 id="anatomy-of-a-tool">Anatomy of a tool</h2>
      <p>Every tool entry in the registry records:</p>
      <ul>
        <li><strong>Name</strong> — the function identifier the model uses to call it (e.g., <code>create_issue</code>, <code>query_table</code>).</li>
        <li><strong>Description</strong> — what the tool does, written for the model, not the developer. The model reads this to decide whether to call the tool.</li>
        <li><strong>Parameters</strong> — the input schema: name, type, description, and required flag for each parameter.</li>
        <li><strong>Returns</strong> — the shape of the result (string, JSON object, etc.).</li>
        <li><strong>Read-only flag</strong> — whether the tool mutates state. Affects governance policy.</li>
      </ul>

      <h2 id="tool-naming">Naming conventions</h2>
      <p>Tool names should be verb-first and unambiguous: <code>send_email</code>, <code>list_issues</code>, <code>drop_table</code>. Avoid abbreviations. The model uses the name as a hint about what the tool does when the description isn't in context.</p>

      <h2 id="registering-a-tool">Registering a tool</h2>
      <p>Tools must be registered under a parent server. Use the <strong>Register</strong> flow, select <strong>Tool</strong>, and pick the parent server from the dropdown. The tool inherits the server's publisher, transport, and auth.</p>

      <div class="callout callout--info">
        <strong>One-to-many:</strong> A tool belongs to exactly one server. If you need the same tool callable from a different server, register a separate tool entry pointing to that server.
      </div>
    `,
  },

  {
    id: 'skills',
    section: 'object-types',
    title: 'Skills',
    readTime: 5,
    updatedAt: '2026-05-18',
    lead: 'A skill is portable procedural knowledge — a SKILL.md file with YAML frontmatter that tells an agent how to do a task. The agent reads it; it does not call it.',
    body: `
      <h2 id="skills-vs-tools">Skills vs tools</h2>
      <p>The distinguishing mechanism is the object layer. Tools and servers are MCP protocol — the spec defines tools, resources, prompts, and the server transport. Skills are not MCP. They live at the host/agent layer above the protocol.</p>
      <p>A tool gives the agent an ability to <em>do</em> something. A skill gives the agent the ability to <em>think</em> about how to do something. Tools are callable endpoints; skills are instructional documents.</p>

      <h2 id="skill-md-format">SKILL.md format</h2>
      <p>A skill file has two parts: a YAML frontmatter block and a markdown body.</p>
      <pre><code>---
name: pr-review
description: Review a pull request for correctness, style, and test coverage.
triggers:
  - "review this PR"
  - "look at my pull request"
  - "check my changes"
reaches:
  - github/create_review
  - github/list_prs
---

# PR Review Skill

## When to use
Use this skill when asked to review a pull request...

## Steps
1. Fetch the PR diff using the GitHub MCP server...
</code></pre>

      <h2 id="progressive-disclosure">Progressive disclosure</h2>
      <p>An agent holds a lightweight index of skill names and descriptions. When a task matches a trigger phrase, the agent loads the full SKILL.md. This is progressive disclosure — the agent sees a summary list and pulls the full instructions only when needed, keeping context lean.</p>

      <h2 id="trigger-phrases">Trigger phrases</h2>
      <p>Trigger phrases are the natural-language patterns that cause a skill to load. They should be specific enough to avoid false positives but broad enough to catch reasonable phrasings of the same intent.</p>

      <div class="callout callout--tip">
        <strong>Convention:</strong> Keep trigger phrases in the imperative and conversational. "review this PR" is better than "pull_request_review_requested" — the user types the trigger, not the developer.
      </div>
    `,
  },

  {
    id: 'agents',
    section: 'object-types',
    title: 'Agents',
    readTime: 5,
    updatedAt: '2026-05-20',
    lead: 'An agent is a composed assistant — a model wired to a set of servers and skills, configured for a specific domain of work.',
    body: `
      <h2 id="composition">Composition</h2>
      <p>An agent entry declares:</p>
      <ul>
        <li><strong>Model</strong> — which LLM to use (e.g., <code>claude-opus-4-8</code>, <code>claude-sonnet-4-6</code>).</li>
        <li><strong>Servers</strong> — which MCP servers it has access to (and therefore which tools).</li>
        <li><strong>Skills</strong> — which skill files it loads in its context.</li>
        <li><strong>Autonomy level</strong> — how much the agent acts without human confirmation (low / medium / high / full).</li>
      </ul>

      <h2 id="do-vs-think">Do vs think</h2>
      <p>Bundles give an agent the ability to <em>do</em> things (servers + tools). Skills give it the ability to <em>think</em> — encoded judgment about how to approach a class of task. A well-designed agent combines both: enough tools to act, enough skill context to act correctly.</p>

      <h2 id="autonomy">Autonomy levels</h2>
      <ul>
        <li><strong>Low</strong> — proposes actions, waits for human approval before executing.</li>
        <li><strong>Medium</strong> — executes read operations autonomously, confirms writes.</li>
        <li><strong>High</strong> — executes most operations autonomously, escalates on ambiguity or destructive actions.</li>
        <li><strong>Full</strong> — operates end-to-end without confirmation. Requires explicit governance approval.</li>
      </ul>

      <div class="callout callout--warn">
        <strong>Scope matters:</strong> A full-autonomy agent with write access to production systems is a significant governance risk. Apply the principle of least privilege — give agents only the servers they need for their defined scope.
      </div>
    `,
  },

  {
    id: 'apis',
    section: 'object-types',
    title: 'APIs',
    readTime: 4,
    updatedAt: '2026-05-22',
    lead: 'APIs are raw HTTP or GraphQL endpoints catalogued in Interop — either for direct reference, or as the backing layer for an MCP server.',
    body: `
      <h2 id="why-catalogue-apis">Why catalogue APIs?</h2>
      <p>Not every service has an MCP server yet. Cataloguing the raw API lets your team know it exists and understand its shape, even before you build the server wrapper. It also documents the relationship: when you do build the MCP server, you link it back to the source API.</p>

      <h2 id="rest-vs-graphql">REST vs GraphQL</h2>
      <p>Interop tracks the API style because it affects how you build the MCP wrapper:</p>
      <ul>
        <li><strong>REST</strong> — resource-based, maps naturally to CRUD tools (<code>get_resource</code>, <code>create_resource</code>, etc.).</li>
        <li><strong>GraphQL</strong> — query-based, often mapped to fewer tools with richer query parameters.</li>
      </ul>

      <h2 id="wrapping-an-api">Wrapping an API in an MCP server</h2>
      <p>The recommended pattern is to build a dedicated MCP server that exposes a curated subset of the API's capabilities — not everything, just what agents need. Link the server entry back to the source API using the "Wrapped by" field in the API registry entry.</p>

      <div class="callout callout--info">
        <strong>Stripe example:</strong> The Stripe REST API is catalogued as an API entry. The Stripe MCP Server wraps it, exposing <code>create_payment_intent</code>, <code>list_customers</code>, and <code>issue_refund</code> — a curated, governed subset.
      </div>
    `,
  },

  {
    id: 'governance',
    section: 'governance',
    title: 'Governance',
    readTime: 6,
    updatedAt: '2026-05-25',
    lead: 'The governance layer controls what gets published, who can publish it, and what classification it carries — without slowing down teams who are working with already-approved capabilities.',
    body: `
      <h2 id="sensitivity-classification">Sensitivity classification</h2>
      <p>Every registry entry carries one of four sensitivity tiers:</p>
      <ul>
        <li><strong>Public</strong> — no data restrictions, accessible to all agents.</li>
        <li><strong>Internal</strong> — internal data only, not for external-facing agents.</li>
        <li><strong>Confidential</strong> — restricted to specific teams; requires approval.</li>
        <li><strong>Restricted</strong> — highest tier; requires explicit per-agent authorization.</li>
      </ul>

      <h2 id="review-queue">Review queue</h2>
      <p>New submissions land in the admin moderation queue before they're published. The queue shows each entry's risk score and the flags that generated it. Admins can approve, request changes, or reject with a reason.</p>

      <h2 id="policy-rules">Policy rules</h2>
      <p>The Policy settings page lets admins configure the rules that generate risk flags automatically. Each rule has a name, a condition, a severity (info / warn / block), and an action (Flag / Require review / Block / Auto-reject).</p>
      <p>Examples of built-in rules:</p>
      <ul>
        <li><strong>Write tool</strong> — flags any tool that is not read-only.</li>
        <li><strong>Destructive verb</strong> — flags tool names containing drop, delete, destroy, truncate.</li>
        <li><strong>Unverified publisher</strong> — flags entries from publishers without a verified domain.</li>
        <li><strong>Prompt injection scan</strong> — checks skill trigger phrases for injection patterns.</li>
      </ul>

      <h2 id="publisher-trust">Publisher trust</h2>
      <p>Verified publishers (organizations with a verified domain in the allowlist) can skip the review queue when the default posture is set to Balanced or Open. Strict posture always requires review regardless of publisher status.</p>
    `,
  },

  {
    id: 'publishing',
    section: 'governance',
    title: 'Publishing',
    readTime: 5,
    updatedAt: '2026-05-28',
    lead: 'The registration flow guides you through a five-step wizard — type, identity, details, governance, and review — before your entry lands in the moderation queue.',
    body: `
      <h2 id="registration-flow">Registration flow</h2>
      <p>Click <strong>Register</strong> in the header (requires sign-in). The wizard walks you through five steps:</p>
      <ol>
        <li><strong>Type</strong> — pick what you're registering: Server, Tool, Skill, Agent, or API.</li>
        <li><strong>Identity</strong> — name, slug (auto-derived), publisher, summary, and description.</li>
        <li><strong>Details</strong> — type-specific fields: transports and auth for servers, parameters for tools, trigger phrases for skills, model and wired servers for agents.</li>
        <li><strong>Governance</strong> — sensitivity classification, read-only flag (for tools), and whether the entry should be internal-only.</li>
        <li><strong>Review</strong> — summary of all fields before submission.</li>
      </ol>

      <h2 id="after-submission">After submission</h2>
      <p>Your entry appears in the admin moderation queue with status <strong>Pending</strong>. Admins are notified. Once approved, the entry is published and searchable in the catalog. If the admin requests changes, you'll receive a notification with their comments.</p>

      <h2 id="updating-an-entry">Updating an entry</h2>
      <p>Updates to published entries follow the same review flow. The existing entry stays live until the update is approved, so there's no downtime for consumers.</p>

      <div class="callout callout--tip">
        <strong>Versioning:</strong> Increment the version field on every update that changes behavior — adding parameters, changing return shapes, or modifying trigger phrases. Consumers depend on the version contract.
      </div>
    `,
  },

  {
    id: 'api-reference',
    section: 'reference',
    title: 'API Reference',
    readTime: 8,
    updatedAt: '2026-05-30',
    lead: 'The Interop backend exposes a REST API at /api. All endpoints accept and return JSON. Authenticated endpoints require a Bearer token in the Authorization header.',
    body: `
      <h2 id="authentication">Authentication</h2>
      <p>Include an OIDC-issued JWT in the Authorization header:</p>
      <pre><code>Authorization: Bearer &lt;token&gt;</code></pre>
      <p>The token is validated against the configured JWKS endpoint. Roles are read from the <code>https://interop.io/roles</code> claim (or <code>roles</code> directly). Admin routes require the <code>admin</code> role.</p>

      <h2 id="entries">Entries</h2>
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Auth</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td>/api/entries</td><td>Search/list entries. Query: q, type, category, client, sort, page, size.</td><td>None</td></tr>
          <tr><td>GET</td><td>/api/entries/stats</td><td>Aggregate counts by type, total installs, verified count.</td><td>None</td></tr>
          <tr><td>GET</td><td>/api/entries/:type/:slug</td><td>Fetch a single entry by type and slug.</td><td>None</td></tr>
          <tr><td>POST</td><td>/api/entries</td><td>Submit a new entry (creates pending submission).</td><td>Required</td></tr>
        </tbody>
      </table>

      <h2 id="pending">Pending (Admin)</h2>
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Auth</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td>/api/pending</td><td>List pending submissions. Filter: status, type, risk.</td><td>Admin</td></tr>
          <tr><td>PUT</td><td>/api/pending/:id/approve</td><td>Approve and publish a submission.</td><td>Admin</td></tr>
          <tr><td>PUT</td><td>/api/pending/:id/reject</td><td>Reject with required reason.</td><td>Admin</td></tr>
        </tbody>
      </table>

      <h2 id="notifications">Notifications</h2>
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Auth</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td>/api/notifications</td><td>Get current user's notifications, unread first.</td><td>Required</td></tr>
          <tr><td>PUT</td><td>/api/notifications/:id/read</td><td>Mark one notification as read.</td><td>Required</td></tr>
          <tr><td>PUT</td><td>/api/notifications/read-all</td><td>Mark all notifications as read.</td><td>Required</td></tr>
          <tr><td>DELETE</td><td>/api/notifications/:id</td><td>Dismiss a notification.</td><td>Required</td></tr>
        </tbody>
      </table>

      <h2 id="audit">Audit (Admin)</h2>
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Auth</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td>/api/audit</td><td>Query audit log. Filter: userId, action, resource, from, to, page, size.</td><td>Admin</td></tr>
        </tbody>
      </table>

      <h2 id="health">Health</h2>
      <pre><code>GET /api/health
→ 200 { status: "healthy", elasticsearch: "connected", uptime: 3600 }
→ 503 { status: "degraded", elasticsearch: "unavailable" }</code></pre>
    `,
  },
];
