// Registry mock data. Plain JS, attaches to window.REGISTRY.
(function () {
  // ---- Clients (compatibility axis) ----
  const CLIENTS = [
    { id: "claude-desktop", name: "Claude Desktop" },
    { id: "claude-code", name: "Claude Code" },
    { id: "cursor", name: "Cursor" },
    { id: "vscode", name: "VS Code" },
    { id: "windsurf", name: "Windsurf" },
    { id: "zed", name: "Zed" },
  ];

  const CATEGORIES = [
    "Communication",
    "Developer Tools",
    "Data & Analytics",
    "Productivity",
    "Payments",
    "Search",
    "Security",
    "Design",
  ];

  // ---- Servers (each exposes tools, resources, prompts over a transport) ----
  // transports: stdio | http | sse
  const SERVERS = [
    {
      id: "github",
      type: "server",
      name: "GitHub",
      slug: "anthropic/github",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Developer Tools",
      summary: "Repositories, issues, pull requests, and code search over the GitHub REST and GraphQL APIs.",
      description:
        "The GitHub server exposes a governed toolbox for repository operations. It carries OAuth credentials, handles rate limits, and presents a stable tool surface so an agent never touches raw tokens. Use it to triage issues, open and review pull requests, search code across an org, and inspect CI status.",
      transports: ["http", "stdio"],
      auth: "OAuth 2.1",
      version: "2.4.1",
      updated: "2026-05-28",
      installs: 184200,
      callsWeek: 9120000,
      rating: 4.8,
      clients: ["claude-desktop", "claude-code", "cursor", "vscode", "windsurf", "zed"],
      resources: 6,
      prompts: 3,
      license: "MIT",
      repo: "github.com/anthropic/mcp-github",
      tools: [
        { id: "create_issue", name: "create_issue", summary: "Open a new issue on a repository.",
          params: [
            { name: "repo", type: "string", required: true, desc: "owner/name" },
            { name: "title", type: "string", required: true, desc: "Issue title" },
            { name: "body", type: "string", required: false, desc: "Markdown body" },
            { name: "labels", type: "string[]", required: false, desc: "Label names" },
          ], returns: "Issue { number, url, state }", calls: 412000 },
        { id: "search_code", name: "search_code", summary: "Full-text and symbol search across repositories.",
          params: [
            { name: "query", type: "string", required: true, desc: "Search expression" },
            { name: "repo", type: "string", required: false, desc: "Scope to a repo" },
          ], returns: "CodeResult[]", calls: 1880000 },
        { id: "get_pull_request", name: "get_pull_request", summary: "Fetch a PR with diff, checks, and reviews.",
          params: [
            { name: "repo", type: "string", required: true, desc: "owner/name" },
            { name: "number", type: "integer", required: true, desc: "PR number" },
          ], returns: "PullRequest", calls: 760000 },
        { id: "merge_pull_request", name: "merge_pull_request", summary: "Merge a pull request with a chosen strategy.",
          params: [
            { name: "repo", type: "string", required: true, desc: "owner/name" },
            { name: "number", type: "integer", required: true, desc: "PR number" },
            { name: "method", type: "enum", required: false, desc: "merge | squash | rebase" },
          ], returns: "MergeResult", calls: 134000, write: true },
        { id: "list_commits", name: "list_commits", summary: "List commits on a branch with author and message.",
          params: [{ name: "repo", type: "string", required: true, desc: "owner/name" }],
          returns: "Commit[]", calls: 540000 },
      ],
    },
    {
      id: "postgres",
      type: "server",
      name: "Postgres",
      slug: "anthropic/postgres",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Data & Analytics",
      summary: "Read-only and read-write SQL access with schema introspection and query guards.",
      description:
        "A governed database surface. The server holds the connection string, enforces statement timeouts, and can be pinned to read-only via the gateway. Schema is exposed as resources so an agent can ground queries without guessing column names.",
      transports: ["stdio"],
      auth: "Connection string",
      version: "1.9.0",
      updated: "2026-05-21",
      installs: 96400,
      callsWeek: 3110000,
      rating: 4.7,
      clients: ["claude-desktop", "claude-code", "cursor", "vscode"],
      resources: 24,
      prompts: 1,
      license: "Apache-2.0",
      repo: "github.com/anthropic/mcp-postgres",
      tools: [
        { id: "run_query", name: "run_query", summary: "Execute a parameterized SQL query.",
          params: [
            { name: "sql", type: "string", required: true, desc: "SQL with $1..$n params" },
            { name: "params", type: "any[]", required: false, desc: "Bound parameters" },
          ], returns: "Row[]", calls: 2200000 },
        { id: "describe_table", name: "describe_table", summary: "Return columns, types, and indexes for a table.",
          params: [{ name: "table", type: "string", required: true, desc: "schema.table" }],
          returns: "TableSchema", calls: 410000 },
        { id: "explain", name: "explain", summary: "Return the query plan without executing.",
          params: [{ name: "sql", type: "string", required: true, desc: "SQL statement" }],
          returns: "QueryPlan", calls: 88000 },
      ],
    },
    {
      id: "slack",
      type: "server",
      name: "Slack",
      slug: "anthropic/slack",
      publisher: "Anthropic",
      verified: true,
      official: false,
      category: "Communication",
      summary: "Send messages, search history, and manage channels in a workspace.",
      description:
        "Workspace messaging behind one endpoint. Scoped to the channels the bot token can see; the gateway can further restrict which tools a caller is allowed to use, so an agent that should only read is never handed send_message.",
      transports: ["http", "sse"],
      auth: "Bot token",
      version: "3.1.2",
      updated: "2026-05-30",
      installs: 142800,
      callsWeek: 5400000,
      rating: 4.6,
      clients: ["claude-desktop", "claude-code", "cursor"],
      resources: 4,
      prompts: 2,
      license: "MIT",
      repo: "github.com/anthropic/mcp-slack",
      tools: [
        { id: "send_message", name: "send_message", summary: "Post a message to a channel or thread.",
          params: [
            { name: "channel", type: "string", required: true, desc: "Channel ID or name" },
            { name: "text", type: "string", required: true, desc: "Message body" },
            { name: "thread_ts", type: "string", required: false, desc: "Reply in thread" },
          ], returns: "Message", calls: 1900000, write: true },
        { id: "search_messages", name: "search_messages", summary: "Search message history across channels.",
          params: [{ name: "query", type: "string", required: true, desc: "Search terms" }],
          returns: "Message[]", calls: 980000 },
        { id: "list_channels", name: "list_channels", summary: "List channels visible to the token.",
          params: [], returns: "Channel[]", calls: 220000 },
      ],
    },
    {
      id: "linear",
      type: "server",
      name: "Linear",
      slug: "linear/mcp",
      publisher: "Linear",
      verified: true,
      official: true,
      category: "Productivity",
      summary: "Issues, projects, and cycles for fast-moving product teams.",
      description:
        "Linear's official server. Maps the GraphQL API to a compact tool set and exposes team and project structure as resources so an agent can route work correctly.",
      transports: ["http"],
      auth: "OAuth 2.1",
      version: "1.4.0",
      updated: "2026-05-19",
      installs: 71200,
      callsWeek: 1640000,
      rating: 4.9,
      clients: ["claude-desktop", "claude-code", "cursor", "vscode", "windsurf"],
      resources: 8,
      prompts: 2,
      license: "Proprietary",
      repo: "github.com/linear/mcp",
      tools: [
        { id: "create_issue", name: "create_issue", summary: "Create an issue in a team.",
          params: [
            { name: "team", type: "string", required: true, desc: "Team key" },
            { name: "title", type: "string", required: true, desc: "Title" },
            { name: "priority", type: "enum", required: false, desc: "0–4" },
          ], returns: "Issue", calls: 520000, write: true },
        { id: "search_issues", name: "search_issues", summary: "Search issues with filters.",
          params: [{ name: "query", type: "string", required: true, desc: "Search terms" }],
          returns: "Issue[]", calls: 690000 },
      ],
    },
    {
      id: "stripe",
      type: "server",
      name: "Stripe",
      slug: "stripe/agent-toolkit",
      publisher: "Stripe",
      verified: true,
      official: true,
      category: "Payments",
      summary: "Customers, payments, invoices, and subscriptions with strict write guards.",
      description:
        "Financial operations are high-blast-radius, so this server ships read tools enabled and every write tool behind an explicit allowlist. The gateway pattern of virtual servers is the recommended way to expose only refunds, or only invoicing, to a given agent.",
      transports: ["http"],
      auth: "Restricted API key",
      version: "2.0.3",
      updated: "2026-05-12",
      installs: 58900,
      callsWeek: 870000,
      rating: 4.7,
      clients: ["claude-desktop", "claude-code"],
      resources: 5,
      prompts: 1,
      license: "MIT",
      repo: "github.com/stripe/agent-toolkit",
      tools: [
        { id: "list_customers", name: "list_customers", summary: "List or search customers.",
          params: [{ name: "email", type: "string", required: false, desc: "Filter by email" }],
          returns: "Customer[]", calls: 410000 },
        { id: "create_refund", name: "create_refund", summary: "Refund a charge in full or part.",
          params: [
            { name: "charge", type: "string", required: true, desc: "Charge ID" },
            { name: "amount", type: "integer", required: false, desc: "Cents; omit for full" },
          ], returns: "Refund", calls: 64000, write: true },
      ],
    },
    {
      id: "filesystem",
      type: "server",
      name: "Filesystem",
      slug: "anthropic/filesystem",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Developer Tools",
      summary: "Sandboxed read and write access to a directory tree.",
      description:
        "A local stdio server scoped to one root directory. Path traversal is blocked at the boundary; write tools can be disabled at install time.",
      transports: ["stdio"],
      auth: "None (local)",
      version: "0.9.4",
      updated: "2026-04-30",
      installs: 213000,
      callsWeek: 6700000,
      rating: 4.5,
      clients: ["claude-desktop", "claude-code", "cursor", "vscode", "windsurf", "zed"],
      resources: 0,
      prompts: 0,
      license: "MIT",
      repo: "github.com/anthropic/mcp-filesystem",
      tools: [
        { id: "read_file", name: "read_file", summary: "Read a file as text.",
          params: [{ name: "path", type: "string", required: true, desc: "Relative path" }],
          returns: "string", calls: 4100000 },
        { id: "write_file", name: "write_file", summary: "Create or overwrite a file.",
          params: [
            { name: "path", type: "string", required: true, desc: "Relative path" },
            { name: "content", type: "string", required: true, desc: "File body" },
          ], returns: "void", calls: 1200000, write: true },
        { id: "list_dir", name: "list_dir", summary: "List entries in a directory.",
          params: [{ name: "path", type: "string", required: true, desc: "Relative path" }],
          returns: "Entry[]", calls: 1400000 },
      ],
    },
    {
      id: "sentry",
      type: "server",
      name: "Sentry",
      slug: "sentry/mcp",
      publisher: "Sentry",
      verified: true,
      official: true,
      category: "Developer Tools",
      summary: "Errors, issues, and release health for application monitoring.",
      description:
        "Pulls issue detail, stack traces, and release health so an agent can triage incidents with grounded context rather than guesses.",
      transports: ["http"],
      auth: "Auth token",
      version: "1.2.1",
      updated: "2026-05-08",
      installs: 39400,
      callsWeek: 610000,
      rating: 4.6,
      clients: ["claude-desktop", "claude-code", "cursor"],
      resources: 3,
      prompts: 1,
      license: "BSL-1.1",
      repo: "github.com/getsentry/sentry-mcp",
      tools: [
        { id: "get_issue", name: "get_issue", summary: "Fetch an issue with latest event and stack trace.",
          params: [{ name: "id", type: "string", required: true, desc: "Issue ID" }],
          returns: "Issue", calls: 280000 },
      ],
    },
    {
      id: "notion",
      type: "server",
      name: "Notion",
      slug: "notion/mcp",
      publisher: "Notion",
      verified: false,
      official: false,
      category: "Productivity",
      summary: "Pages, databases, and blocks for docs and wikis.",
      description:
        "Community server for Notion. Read and write pages, query databases, and append blocks. Not yet verified — review the requested scopes before installing.",
      transports: ["http"],
      auth: "Integration token",
      version: "0.6.2",
      updated: "2026-04-18",
      installs: 28800,
      callsWeek: 340000,
      rating: 4.2,
      clients: ["claude-desktop", "cursor"],
      resources: 2,
      prompts: 0,
      license: "MIT",
      repo: "github.com/makenotion/notion-mcp",
      tools: [
        { id: "query_database", name: "query_database", summary: "Query a Notion database with filters.",
          params: [{ name: "database_id", type: "string", required: true, desc: "Database ID" }],
          returns: "Page[]", calls: 190000 },
      ],
    },
    {
      id: "brave-search",
      type: "server",
      name: "Brave Search",
      slug: "brave/search",
      publisher: "Brave",
      verified: true,
      official: false,
      category: "Search",
      summary: "Privacy-preserving web and local search.",
      description:
        "A single search surface over the Brave Search API. Returns titles, snippets, and URLs an agent can fetch downstream.",
      transports: ["http"],
      auth: "API key",
      version: "1.1.0",
      updated: "2026-05-02",
      installs: 67100,
      callsWeek: 2300000,
      rating: 4.4,
      clients: ["claude-desktop", "claude-code", "cursor", "vscode"],
      resources: 0,
      prompts: 0,
      license: "MIT",
      repo: "github.com/brave/brave-search-mcp",
      tools: [
        { id: "web_search", name: "web_search", summary: "Search the web and return ranked results.",
          params: [
            { name: "query", type: "string", required: true, desc: "Search query" },
            { name: "count", type: "integer", required: false, desc: "Max results" },
          ], returns: "SearchResult[]", calls: 2200000 },
      ],
    },
  ];

  // ---- Skills (procedural knowledge — read, not called) ----
  const SKILLS = [
    {
      id: "pr-review",
      type: "skill",
      name: "PR Review",
      slug: "anthropic/pr-review",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Developer Tools",
      summary: "Review a pull request the way a senior engineer would: correctness, tests, risk, and a crisp verdict.",
      description:
        "A SKILL.md that teaches the agent how to review code changes. It is procedural knowledge, not an endpoint — the agent reads it when a task matches and follows the steps, reaching for whichever tools are connected.",
      triggers: ["review this PR", "code review", "look over my changes", "is this ready to merge"],
      reaches: ["github / get_pull_request", "github / search_code", "filesystem / read_file"],
      steps: [
        "Pull the diff and the PR description; restate the intended change in one line.",
        "Read changed files in full, not just the hunks — check call sites and tests.",
        "Flag correctness, security, and performance issues with file:line references.",
        "Separate blocking issues from nits. End with an explicit verdict.",
      ],
      installs: 54300,
      updated: "2026-05-26",
      rating: 4.9,
      version: "1.3.0",
      license: "MIT",
      tokens: "~1.8k",
      skillmd: `---
name: PR Review
description: Review a pull request for correctness, tests, risk, and a clear verdict.
triggers:
  - review this PR
  - code review
  - look over my changes
---

# PR Review

You are reviewing a pull request as a senior engineer would.

## Steps
1. **Understand intent.** Read the title, description, and linked issue.
   Restate the change in one sentence before reading code.
2. **Read in full.** Open each changed file with read_file — review call
   sites and tests, not only the diff hunks.
3. **Assess.** Note correctness, security, and performance concerns with
   precise file:line references.
4. **Verdict.** Separate blocking issues from nits. End with
   APPROVE / REQUEST CHANGES and a one-line rationale.

## Conventions
- Be specific. "This can deadlock if X" beats "looks risky".
- Praise sparingly and concretely.`,
    },
    {
      id: "incident-response",
      type: "skill",
      name: "Incident Response",
      slug: "anthropic/incident-response",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Security",
      summary: "Drive a production incident from alert to mitigation with a calm, structured playbook.",
      description:
        "Procedural knowledge for triaging and mitigating incidents. The agent loads the full playbook only when an incident is declared (progressive disclosure), then coordinates across Sentry, Slack, and the runbooks it can reach.",
      triggers: ["we have an incident", "production is down", "page the on-call", "start the incident bridge"],
      reaches: ["sentry / get_issue", "slack / send_message", "github / list_commits"],
      steps: [
        "Establish severity and a single incident channel.",
        "Pull recent deploys and the failing error to form a hypothesis.",
        "Mitigate first (roll back / feature-flag), root-cause second.",
        "Post a timeline and owner before standing down.",
      ],
      installs: 21900,
      updated: "2026-05-15",
      rating: 4.8,
      version: "2.0.1",
      license: "MIT",
      tokens: "~2.4k",
      skillmd: `---
name: Incident Response
description: Triage and mitigate a production incident, alert to all-clear.
triggers:
  - we have an incident
  - production is down
  - page the on-call
---

# Incident Response

## Priorities (in order)
1. Stop the bleeding. 2. Communicate. 3. Root cause.

## Steps
1. Declare severity (SEV1–3) and open one incident channel.
2. Pull the failing error (get_issue) and recent deploys (list_commits).
3. Mitigate: roll back or flag off the suspect change.
4. Post a running timeline to the channel every 15 minutes.
5. Stand down only with an owner assigned for the post-mortem.`,
    },
    {
      id: "release-notes",
      type: "skill",
      name: "Release Notes",
      slug: "anthropic/release-notes",
      publisher: "Anthropic",
      verified: true,
      official: false,
      category: "Communication",
      summary: "Turn a range of merged PRs into clear, user-facing release notes in your house voice.",
      description:
        "Teaches the agent to summarize shipped work for humans: group by theme, lead with user impact, drop the internal noise. Reaches for the GitHub server to gather the changes.",
      triggers: ["draft release notes", "what shipped this week", "changelog for the release"],
      reaches: ["github / list_commits", "github / get_pull_request"],
      steps: [
        "Collect merged PRs in the range; ignore chores and reverts.",
        "Group by theme: Added, Improved, Fixed.",
        "Lead each line with user impact, not implementation.",
        "Keep voice consistent; link each item to its PR.",
      ],
      installs: 33600,
      updated: "2026-05-20",
      rating: 4.7,
      version: "1.1.0",
      license: "MIT",
      tokens: "~1.2k",
      skillmd: `---
name: Release Notes
description: Convert merged PRs into user-facing release notes.
triggers:
  - draft release notes
  - what shipped this week
---

# Release Notes

## Steps
1. List merged PRs in the range (list_commits / get_pull_request).
2. Drop chores, reverts, and dependency bumps.
3. Group under Added / Improved / Fixed.
4. Write each line from the user's point of view.
5. Append the PR number to every entry.`,
    },
    {
      id: "sql-optimization",
      type: "skill",
      name: "SQL Optimization",
      slug: "community/sql-optimization",
      publisher: "Community",
      verified: false,
      official: false,
      category: "Data & Analytics",
      summary: "Diagnose a slow query and propose an indexed, plan-verified rewrite.",
      description:
        "Knowledge for making queries fast: read the plan, find the bottleneck, propose an index or rewrite, and verify the new plan. Community-authored — review before trusting in production.",
      triggers: ["this query is slow", "optimize this SQL", "why is this query slow"],
      reaches: ["postgres / explain", "postgres / describe_table", "postgres / run_query"],
      steps: [
        "Run explain to read the current plan.",
        "Identify the dominant cost: scan, sort, or join.",
        "Propose an index or rewrite; explain the trade-off.",
        "Re-run explain to confirm the improvement.",
      ],
      installs: 12400,
      updated: "2026-04-22",
      rating: 4.3,
      version: "0.4.0",
      license: "MIT",
      tokens: "~1.5k",
      skillmd: `---
name: SQL Optimization
description: Diagnose and rewrite a slow SQL query, verified by plan.
triggers:
  - this query is slow
  - optimize this SQL
---

# SQL Optimization

## Steps
1. explain the query; read the plan top-down.
2. Find the dominant node (seq scan, sort, nested loop).
3. Propose an index or rewrite. State the trade-off.
4. explain again. Keep the change only if the plan improves.`,
    },
    {
      id: "brand-voice",
      type: "skill",
      name: "Brand Voice",
      slug: "community/brand-voice",
      publisher: "Community",
      verified: false,
      official: false,
      category: "Design",
      summary: "Rewrite any copy to match a defined brand voice with examples and do/don't rules.",
      description:
        "A portable style guide as a skill. Gives the agent the voice, the vocabulary, and the anti-patterns so generated copy sounds like you, not like a model.",
      triggers: ["make this on-brand", "rewrite in our voice", "fix the tone"],
      reaches: ["— (no tools required)"],
      steps: [
        "Identify the artifact type and audience.",
        "Apply voice rules: concise, warm, no hype.",
        "Replace banned words; keep claims specific.",
        "Return the rewrite plus a one-line rationale.",
      ],
      installs: 18700,
      updated: "2026-05-04",
      rating: 4.5,
      version: "1.0.2",
      license: "CC-BY-4.0",
      tokens: "~0.9k",
      skillmd: `---
name: Brand Voice
description: Rewrite copy to match the house voice.
triggers:
  - make this on-brand
  - rewrite in our voice
---

# Brand Voice

## Voice
Concise. Warm. Specific. Never hype.

## Rules
- Cut adjectives that don't add information.
- Prefer verbs over nouns.
- Banned: "seamless", "revolutionary", "unlock", "leverage".
- Keep every claim concrete and checkable.`,
    },
  ];

  // ---- Agents (the composition layer: servers + skills → an assistant) ----
  const AGENTS = [
    {
      id: "release-captain",
      type: "agent",
      name: "Release Captain",
      slug: "anthropic/release-captain",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Developer Tools",
      summary: "Ships a release end to end — cuts the branch, drafts notes, and shepherds the PRs to merge.",
      description:
        "An assistant that owns the release train. It reads the merged work, drafts user-facing notes in your house voice, opens the release PR, and chases the checks. It composes the GitHub and Linear servers for action and the Release Notes and PR Review skills for judgement — and asks before it merges.",
      model: "Claude Sonnet 4.5",
      autonomy: "approval",
      servers: ["github", "linear"],
      skills: ["release-notes", "pr-review"],
      role: "You are a careful release manager. Group shipped work by user impact, never merge without green checks, and always leave a paper trail in the release channel.",
      tasks: ["Cut the 2.5.0 release branch", "Draft release notes for everything since v2.4.1", "Open the release PR and summarize risk", "Chase failing checks before merge"],
      runsWeek: 4200,
      installs: 38400,
      rating: 4.8,
      updated: "2026-05-31",
      version: "1.4.0",
      license: "MIT",
      repo: "github.com/anthropic/agent-release-captain",
      clients: ["claude-desktop", "claude-code", "cursor"],
      sensitivity: "confidential",
    },
    {
      id: "oncall-sre",
      type: "agent",
      name: "On-Call SRE",
      slug: "anthropic/oncall-sre",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Security",
      summary: "Runs a production incident from first alert to all-clear with a calm, structured playbook.",
      description:
        "The teammate you want at 3am. It pulls the failing error and recent deploys to form a hypothesis, opens an incident channel, proposes a mitigation, and keeps a running timeline. Wired to Sentry, Slack, and GitHub, and driven by the Incident Response skill. Acts only with an operator's confirmation.",
      model: "Claude Opus 4.1",
      autonomy: "approval",
      servers: ["sentry", "slack", "github"],
      skills: ["incident-response"],
      role: "You are an incident commander. Stop the bleeding first, communicate constantly, and root-cause second. Never take a destructive action without explicit sign-off.",
      tasks: ["Triage the spiking error in checkout", "Open an incident bridge and set severity", "Correlate with the last three deploys", "Draft a mitigation and post the timeline"],
      runsWeek: 1860,
      installs: 24700,
      rating: 4.9,
      updated: "2026-05-29",
      version: "2.1.0",
      license: "MIT",
      repo: "github.com/anthropic/agent-oncall-sre",
      clients: ["claude-desktop", "claude-code"],
      sensitivity: "restricted",
    },
    {
      id: "support-concierge",
      type: "agent",
      name: "Support Concierge",
      slug: "acme/support-concierge",
      publisher: "Acme Co",
      verified: false,
      official: false,
      category: "Communication",
      summary: "Triages inbound support, drafts on-brand replies, and files the bug when it's real.",
      description:
        "Front-line support that never sleeps. It reads the ticket, searches past resolutions in Notion, replies in your brand voice, and opens a Linear issue with a clean repro when something's actually broken. Read-mostly: it drafts, a human sends.",
      model: "Claude Haiku 4.5",
      autonomy: "read-only",
      servers: ["slack", "notion", "linear"],
      skills: ["brand-voice"],
      role: "You are a calm, precise support concierge. Lead with empathy, resolve from known answers, and escalate with a tight repro when you can't.",
      tasks: ["Triage the overnight support inbox", "Draft a reply to the billing question", "Find prior resolutions for this error", "File a bug with steps to reproduce"],
      runsWeek: 9100,
      installs: 15200,
      rating: 4.5,
      updated: "2026-05-24",
      version: "0.9.2",
      license: "Proprietary",
      repo: "github.com/acme/support-concierge",
      clients: ["claude-desktop", "cursor", "vscode"],
      sensitivity: "confidential",
    },
    {
      id: "data-analyst",
      type: "agent",
      name: "Data Analyst",
      slug: "anthropic/data-analyst",
      publisher: "Anthropic",
      verified: true,
      official: false,
      category: "Data & Analytics",
      summary: "Answers questions of the warehouse in plain English, with the query and a sanity check attached.",
      description:
        "A read-only analyst. It introspects the schema, writes the SQL, runs it, and explains the result — always showing the query so the answer is auditable. Composes the Postgres server (pinned read-only) and the SQL Optimization skill, and never mutates data.",
      model: "Claude Sonnet 4.5",
      autonomy: "read-only",
      servers: ["postgres", "brave-search"],
      skills: ["sql-optimization"],
      role: "You are a rigorous analyst. Ground every query in the real schema, show your SQL, and flag when a result looks too clean to trust.",
      tasks: ["What was week-over-week signup growth?", "Break down revenue by plan tier", "Explain why this query is slow", "Find the schema for the orders table"],
      runsWeek: 6400,
      installs: 28900,
      rating: 4.7,
      updated: "2026-05-27",
      version: "1.2.1",
      license: "Apache-2.0",
      repo: "github.com/anthropic/agent-data-analyst",
      clients: ["claude-desktop", "claude-code", "cursor", "vscode"],
      sensitivity: "restricted",
    },
    {
      id: "code-reviewer",
      type: "agent",
      name: "Code Reviewer",
      slug: "anthropic/code-reviewer",
      publisher: "Anthropic",
      verified: true,
      official: true,
      category: "Developer Tools",
      summary: "Reviews a pull request like a senior engineer — correctness and security first, nits last.",
      description:
        "A focused reviewer that reads the whole diff before commenting, separates blocking issues from nits, and ends with an explicit verdict. Wired to the GitHub server and driven by the PR Review skill. Comments only — it never merges.",
      model: "Claude Sonnet 4.5",
      autonomy: "read-only",
      servers: ["github"],
      skills: ["pr-review"],
      role: "You are a senior reviewer. Read the full diff first, flag correctness and security before style, and close with ship / hold / needs-changes.",
      tasks: ["Review PR #1284 on the api repo", "Check this diff for security issues", "Confirm tests cover the change", "Summarize the review as a verdict"],
      runsWeek: 11200,
      installs: 52100,
      rating: 4.8,
      updated: "2026-05-30",
      version: "1.6.0",
      license: "MIT",
      repo: "github.com/anthropic/agent-code-reviewer",
      clients: ["claude-desktop", "claude-code", "cursor", "vscode", "windsurf", "zed"],
      sensitivity: "confidential",
    },
  ];

  // ---- APIs (raw HTTP services — the layer an MCP server wraps) ----
  const APIS = [
    {
      id: "stripe-api",
      type: "api",
      name: "Stripe API",
      slug: "stripe/api",
      publisher: "Stripe",
      verified: true,
      official: true,
      category: "Payments",
      summary: "Charges, customers, subscriptions, and payouts over a resource-oriented REST API.",
      description:
        "The canonical payments API. Resource-oriented REST with predictable URLs, idempotency keys on writes, and rich error objects. In the registry it sits one layer below MCP — the Stripe server wraps these endpoints into governed tools so an agent never touches a live secret key.",
      style: "REST",
      baseUrl: "https://api.stripe.com/v1",
      auth: "API key",
      version: "2026-04-30",
      wrappedBy: "stripe",
      specUrl: "stripe.com/docs/api",
      endpoints: [
        { method: "POST", path: "/charges", summary: "Create a charge against a customer or source." },
        { method: "GET", path: "/customers/:id", summary: "Retrieve a customer and their default source." },
        { method: "POST", path: "/refunds", summary: "Refund a charge in full or in part." },
        { method: "GET", path: "/subscriptions", summary: "List subscriptions, filterable by status." },
        { method: "POST", path: "/payouts", summary: "Pay out an available balance to a bank account." },
      ],
      installs: 312000,
      callsWeek: 41000000,
      rating: 4.9,
      updated: "2026-05-26",
      license: "Proprietary",
      repo: "github.com/stripe/stripe-node",
      sensitivity: "restricted",
    },
    {
      id: "github-rest",
      type: "api",
      name: "GitHub REST API",
      slug: "github/rest",
      publisher: "GitHub",
      verified: true,
      official: true,
      category: "Developer Tools",
      summary: "Repositories, issues, pull requests, and Actions over a versioned REST API.",
      description:
        "The REST surface behind github.com. Token-scoped, paginated, and rate-limited. The GitHub MCP server wraps the most useful endpoints into tools and holds the OAuth credential, so the raw API stays at the boundary.",
      style: "REST",
      baseUrl: "https://api.github.com",
      auth: "OAuth 2.1",
      version: "2022-11-28",
      wrappedBy: "github",
      specUrl: "docs.github.com/rest",
      endpoints: [
        { method: "GET", path: "/repos/:owner/:repo", summary: "Fetch a repository's metadata." },
        { method: "POST", path: "/repos/:owner/:repo/issues", summary: "Open a new issue." },
        { method: "GET", path: "/repos/:owner/:repo/pulls/:n", summary: "Get a pull request with its diff stats." },
        { method: "PUT", path: "/repos/:owner/:repo/pulls/:n/merge", summary: "Merge a pull request." },
        { method: "GET", path: "/search/code", summary: "Search code across repositories." },
      ],
      installs: 248000,
      callsWeek: 28000000,
      rating: 4.8,
      updated: "2026-05-22",
      license: "Proprietary",
      repo: "github.com/github/rest-api-description",
      sensitivity: "confidential",
    },
    {
      id: "linear-graphql",
      type: "api",
      name: "Linear GraphQL API",
      slug: "linear/graphql",
      publisher: "Linear",
      verified: true,
      official: true,
      category: "Productivity",
      summary: "Issues, projects, and cycles over a single typed GraphQL endpoint.",
      description:
        "One endpoint, a typed schema, and exactly the fields you ask for. GraphQL fits issue-tracking well — fetch an issue with its project, assignee, and comments in a single round trip. The Linear server wraps common queries and mutations into MCP tools.",
      style: "GraphQL",
      baseUrl: "https://api.linear.app/graphql",
      auth: "OAuth 2.1",
      version: "v1",
      wrappedBy: "linear",
      specUrl: "developers.linear.app",
      endpoints: [
        { method: "QUERY", path: "issue(id)", summary: "Fetch an issue with nested project and assignee." },
        { method: "QUERY", path: "issues(filter)", summary: "List issues matching a structured filter." },
        { method: "MUTATION", path: "issueCreate", summary: "Create an issue in a team." },
        { method: "MUTATION", path: "issueUpdate", summary: "Update state, assignee, or estimate." },
        { method: "QUERY", path: "cycles", summary: "List cycles for a team with progress." },
      ],
      installs: 87000,
      callsWeek: 6200000,
      rating: 4.7,
      updated: "2026-05-19",
      license: "Proprietary",
      repo: "github.com/linear/linear",
      sensitivity: "internal",
    },
    {
      id: "twilio-api",
      type: "api",
      name: "Twilio API",
      slug: "twilio/api",
      publisher: "Twilio",
      verified: true,
      official: false,
      category: "Communication",
      summary: "Send SMS, place calls, and manage numbers over a REST API. Not yet wrapped as a server.",
      description:
        "Programmable messaging and voice. A classic REST API with form-encoded bodies and per-resource SIDs. No MCP server wraps it yet — a clear opportunity: wrap these endpoints into governed tools so an agent can notify without holding the auth token.",
      style: "REST",
      baseUrl: "https://api.twilio.com/2010-04-01",
      auth: "API key",
      version: "2010-04-01",
      wrappedBy: null,
      specUrl: "twilio.com/docs/usage/api",
      endpoints: [
        { method: "POST", path: "/Messages", summary: "Send an SMS or MMS message." },
        { method: "POST", path: "/Calls", summary: "Place an outbound phone call." },
        { method: "GET", path: "/Messages/:sid", summary: "Fetch the status of a sent message." },
        { method: "GET", path: "/IncomingPhoneNumbers", summary: "List the numbers on the account." },
      ],
      installs: 64000,
      callsWeek: 3400000,
      rating: 4.5,
      updated: "2026-05-12",
      license: "Proprietary",
      repo: "github.com/twilio/twilio-node",
      sensitivity: "confidential",
    },
    {
      id: "openweather-api",
      type: "api",
      name: "OpenWeather API",
      slug: "openweather/api",
      publisher: "OpenWeather",
      verified: false,
      official: false,
      category: "Search",
      summary: "Current conditions and forecasts by coordinates over a simple REST API.",
      description:
        "A lightweight, public weather API — current conditions, hourly, and daily forecasts keyed by latitude and longitude. No credentials beyond an API key, low blast radius, and an easy first thing to wrap as an MCP server.",
      style: "REST",
      baseUrl: "https://api.openweathermap.org/data/3.0",
      auth: "API key",
      version: "3.0",
      wrappedBy: null,
      specUrl: "openweathermap.org/api",
      endpoints: [
        { method: "GET", path: "/onecall", summary: "Current, hourly, and daily forecast for a point." },
        { method: "GET", path: "/weather", summary: "Current conditions for coordinates." },
        { method: "GET", path: "/forecast", summary: "5-day / 3-hour forecast." },
      ],
      installs: 41000,
      callsWeek: 1900000,
      rating: 4.3,
      updated: "2026-05-08",
      license: "CC BY-SA 4.0",
      repo: "github.com/openweather/api-docs",
      sensitivity: "public",
    },
  ];

  // ---- Pending submissions (admin queue) ----
  const PENDING = [
    {
      id: "p-figma",
      type: "server",
      name: "Figma",
      slug: "figma/mcp",
      publisher: "Figma",
      category: "Design",
      summary: "Read file structure, components, and design tokens from Figma.",
      submitted: "2026-06-01",
      submittedBy: "designtools@figma.com",
      transports: ["http"],
      auth: "OAuth 2.1",
      toolCount: 7,
      flags: ["Requests file:read scope", "New publisher — unverified domain"],
      risk: "medium",
    },
    {
      id: "p-shell",
      type: "server",
      name: "Shell Runner",
      slug: "community/shell-runner",
      publisher: "j.castellano",
      category: "Developer Tools",
      summary: "Execute arbitrary shell commands on the host.",
      submitted: "2026-05-31",
      submittedBy: "j.castellano@gmail.com",
      transports: ["stdio"],
      auth: "None",
      toolCount: 2,
      flags: ["Arbitrary code execution", "No sandbox declared", "Write tools enabled by default"],
      risk: "high",
    },
    {
      id: "p-onboarding",
      type: "skill",
      name: "Customer Onboarding",
      slug: "acme/customer-onboarding",
      publisher: "Acme Internal",
      category: "Productivity",
      summary: "Walk a new customer through setup using our internal playbook.",
      submitted: "2026-05-30",
      submittedBy: "ops@acme.internal",
      toolCount: 0,
      flags: ["Internal only — restrict visibility"],
      risk: "low",
    },
    {
      id: "p-weather",
      type: "server",
      name: "Weather",
      slug: "community/weather",
      publisher: "m.okonkwo",
      category: "Search",
      summary: "Current conditions and forecasts by location.",
      submitted: "2026-05-29",
      submittedBy: "m.okonkwo@gmail.com",
      transports: ["http"],
      auth: "API key",
      toolCount: 2,
      flags: [],
      risk: "low",
    },
    {
      id: "p-issue-refund",
      type: "tool",
      name: "issue_refund",
      slug: "stripe/agent-toolkit:issue_refund",
      publisher: "Stripe",
      parent: "Stripe",
      category: "Payments",
      summary: "Refund a charge in full or in part on a connected account.",
      submitted: "2026-05-31",
      submittedBy: "platform@stripe.com",
      auth: "Restricted API key",
      toolCount: 0,
      flags: ["Write tools enabled by default", "Mutates financial state"],
      risk: "medium",
    },
    {
      id: "p-drop-table",
      type: "tool",
      name: "drop_table",
      slug: "anthropic/postgres:drop_table",
      publisher: "k.alvarez",
      parent: "Postgres",
      category: "Data & Analytics",
      summary: "Permanently delete a table and all of its rows.",
      submitted: "2026-06-01",
      submittedBy: "k.alvarez@gmail.com",
      auth: "Connection string",
      toolCount: 0,
      flags: ["Destructive verbs, no confirm", "Write tools enabled by default"],
      risk: "high",
    },
  ];

  // ---- Notifications ----
  const NOTIFICATIONS = [
    { id: "n1", kind: "governance", icon: "flag", unread: true, time: "12m",
      title: "**drop_table** was submitted to the queue", desc: "High-risk tool on Postgres — flagged for destructive verbs. Needs review.", cat: "Governance" },
    { id: "n2", kind: "security", icon: "warning", unread: true, time: "1h",
      title: "New risk rule flagged **2 installed servers**", desc: "“Write tools on by default” now applies to Stripe and Slack in your org.", cat: "Governance" },
    { id: "n3", kind: "success", icon: "verified", unread: true, time: "3h",
      title: "Your submission **PR Review** was approved", desc: "The skill is now live in the catalog and published to your org.", cat: "Publishing" },
    { id: "n4", kind: "update", icon: "refresh", unread: false, time: "Yesterday",
      title: "**GitHub** server updated to v2.4.1", desc: "Adds get_pull_request. Review the changelog before connecting agents.", cat: "Updates" },
    { id: "n5", kind: "skill", icon: "skill", unread: false, time: "Yesterday",
      title: "**Changelog Writer** triggered 41 times this week", desc: "Your published skill is seeing steady use across 6 agents.", cat: "Updates" },
    { id: "n6", kind: "governance", icon: "user", unread: false, time: "2d",
      title: "**k.alvarez** requested publish access", desc: "Wants to submit an internal Data & Analytics server. Awaiting an admin.", cat: "Governance" },
    { id: "n7", kind: "update", icon: "install", unread: false, time: "3d",
      title: "**Filesystem** crossed 213k installs", desc: "The server you maintain is trending in Developer Tools.", cat: "Updates" },
  ];

  // ---- Data-sensitivity classification (tier each entry is approved to handle) ----
  const SENS_BY_ID = {
    github: "confidential", postgres: "restricted", slack: "confidential",
    linear: "internal", stripe: "restricted", filesystem: "confidential",
    "brave-search": "public", brave: "public", sentry: "internal",
    notion: "confidential", weather: "public",
  };
  const SENS_BY_CAT = {
    Payments: "restricted", "Data & Analytics": "restricted", Security: "restricted",
    Communication: "confidential", "Developer Tools": "confidential",
    Productivity: "internal", Design: "internal", Search: "public",
  };
  const pickSens = (e) =>
    SENS_BY_ID[e.id] || SENS_BY_CAT[e.category] || "internal";

  SERVERS.forEach((s) => { if (!s.sensitivity) s.sensitivity = pickSens(s); });
  // Skills carry no credentials — they read data, never hold it — so cap them lower.
  SKILLS.forEach((s) => { if (!s.sensitivity) s.sensitivity = s.internalOnly ? "internal" : "public"; });

  window.REGISTRY = { CLIENTS, CATEGORIES, SERVERS, SKILLS, AGENTS, APIS, PENDING, NOTIFICATIONS };
})();
