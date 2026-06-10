import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { esClient } from './client.js';
import { setupIndices, INDEX_NAMES } from './indices.js';
import {
  Server,
  Tool,
  Skill,
  Agent,
  Api,
  PendingEntry,
  Notification,
  RegistryEntry,
} from '../types/index.js';

const PAST = (daysAgo: number): string =>
  new Date(Date.now() - daysAgo * 86400000).toISOString();

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

const githubTools: Tool[] = [
  {
    id: uuidv4(), type: 'tool', name: 'Create Issue', slug: 'create-issue',
    publisher: 'Anthropic', verified: true,
    summary: 'Creates a new GitHub issue in a repository',
    description: 'Creates a new issue in the specified GitHub repository with title, body, labels, and assignees.',
    installs: 0, sensitivity: 'internal', categories: ['github', 'project-management'],
    parentServer: 'github', readOnly: false, returns: 'Issue object with id and url',
    createdAt: PAST(90), updatedAt: PAST(5),
    params: [
      { name: 'owner', type: 'string', description: 'Repository owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository name', required: true },
      { name: 'title', type: 'string', description: 'Issue title', required: true },
      { name: 'body', type: 'string', description: 'Issue body markdown', required: false },
      { name: 'labels', type: 'array', description: 'Label names to apply', required: false },
    ],
  },
  {
    id: uuidv4(), type: 'tool', name: 'List Pull Requests', slug: 'list-prs',
    publisher: 'Anthropic', verified: true,
    summary: 'Lists open pull requests for a repository',
    description: 'Returns a paginated list of pull requests for the specified repository, filterable by state, labels, and author.',
    installs: 0, sensitivity: 'internal', categories: ['github', 'code-review'],
    parentServer: 'github', readOnly: true, returns: 'Array of PR objects',
    createdAt: PAST(90), updatedAt: PAST(5),
    params: [
      { name: 'owner', type: 'string', description: 'Repository owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository name', required: true },
      { name: 'state', type: 'string', description: 'Filter by state: open, closed, all', required: false },
    ],
  },
  {
    id: uuidv4(), type: 'tool', name: 'Merge Pull Request', slug: 'merge-pr',
    publisher: 'Anthropic', verified: true,
    summary: 'Merges a pull request',
    description: 'Merges a pull request using the specified merge method (merge, squash, or rebase).',
    installs: 0, sensitivity: 'confidential', categories: ['github', 'deployment'],
    parentServer: 'github', readOnly: false, returns: 'Merge result object',
    createdAt: PAST(90), updatedAt: PAST(5),
    params: [
      { name: 'owner', type: 'string', description: 'Repository owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository name', required: true },
      { name: 'pull_number', type: 'number', description: 'Pull request number', required: true },
      { name: 'merge_method', type: 'string', description: 'merge | squash | rebase', required: false },
    ],
  },
  {
    id: uuidv4(), type: 'tool', name: 'Create Branch', slug: 'create-branch',
    publisher: 'Anthropic', verified: true,
    summary: 'Creates a new git branch',
    description: 'Creates a new branch in the specified repository from an existing ref.',
    installs: 0, sensitivity: 'internal', categories: ['github', 'version-control'],
    parentServer: 'github', readOnly: false, returns: 'Branch reference object',
    createdAt: PAST(90), updatedAt: PAST(5),
    params: [
      { name: 'owner', type: 'string', description: 'Repository owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository name', required: true },
      { name: 'branch', type: 'string', description: 'New branch name', required: true },
      { name: 'sha', type: 'string', description: 'SHA to branch from', required: true },
    ],
  },
  {
    id: uuidv4(), type: 'tool', name: 'Get File', slug: 'get-file',
    publisher: 'Anthropic', verified: true,
    summary: 'Retrieves file contents from a repository',
    description: 'Fetches the contents and metadata of a file at the specified path in a repository.',
    installs: 0, sensitivity: 'internal', categories: ['github', 'files'],
    parentServer: 'github', readOnly: true, returns: 'File content and metadata',
    createdAt: PAST(90), updatedAt: PAST(5),
    params: [
      { name: 'owner', type: 'string', description: 'Repository owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository name', required: true },
      { name: 'path', type: 'string', description: 'File path in repository', required: true },
      { name: 'ref', type: 'string', description: 'Branch, tag, or commit', required: false },
    ],
  },
  {
    id: uuidv4(), type: 'tool', name: 'Search Code', slug: 'search-code',
    publisher: 'Anthropic', verified: true,
    summary: 'Searches code across GitHub repositories',
    description: 'Performs a code search across GitHub repositories using GitHub search syntax.',
    installs: 0, sensitivity: 'public', categories: ['github', 'search'],
    parentServer: 'github', readOnly: true, returns: 'Array of code search results',
    createdAt: PAST(90), updatedAt: PAST(5),
    params: [
      { name: 'query', type: 'string', description: 'GitHub code search query', required: true },
      { name: 'per_page', type: 'number', description: 'Results per page (max 100)', required: false },
    ],
  },
];

const servers: Server[] = [
  {
    id: uuidv4(), type: 'server', name: 'GitHub MCP Server', slug: 'github',
    publisher: 'Anthropic', verified: true,
    summary: 'Full GitHub API access for repository management, PRs, issues, and code search',
    description: 'The official GitHub MCP Server provides comprehensive access to the GitHub API, enabling AI agents to manage repositories, pull requests, issues, branches, and perform code search. Supports OAuth2 authentication with fine-grained token scoping.',
    installs: 48200, sensitivity: 'internal', categories: ['version-control', 'developer-tools', 'ci-cd'],
    version: '1.4.2', createdAt: PAST(180), updatedAt: PAST(3),
    transports: ['stdio', 'http'], auth: 'oauth2',
    tools: githubTools,
    clients: ['claude-desktop', 'cursor', 'vscode', 'zed'],
    license: 'MIT',
    source: 'https://github.com/anthropics/github-mcp-server',
    rating: 4.8,
  },
  {
    id: uuidv4(), type: 'server', name: 'Postgres MCP Server', slug: 'postgres',
    publisher: 'Supabase', verified: true,
    summary: 'Read and write access to PostgreSQL databases via natural language',
    description: 'Connect AI agents to PostgreSQL databases with full SQL capability. Supports schema introspection, query execution, and transaction management. Uses connection string authentication with role-based access control.',
    installs: 31500, sensitivity: 'confidential', categories: ['database', 'sql', 'developer-tools'],
    version: '2.1.0', createdAt: PAST(150), updatedAt: PAST(7),
    transports: ['stdio'], auth: 'connection-string',
    tools: [], clients: ['claude-desktop', 'cursor'],
    license: 'Apache-2.0',
    source: 'https://github.com/supabase-community/supabase-mcp',
    rating: 4.6,
  },
  {
    id: uuidv4(), type: 'server', name: 'Slack MCP Server', slug: 'slack',
    publisher: 'Slack Technologies', verified: true,
    summary: 'Send messages, manage channels, and read Slack workspace data',
    description: 'Official Slack MCP Server for AI-driven workspace automation. Send messages, create channels, manage users, read message history, and react to events via Server-Sent Events. Requires Slack OAuth2 app credentials.',
    installs: 27800, sensitivity: 'internal', categories: ['communication', 'team-collaboration', 'messaging'],
    version: '1.2.1', createdAt: PAST(120), updatedAt: PAST(10),
    transports: ['sse'], auth: 'oauth2',
    tools: [], clients: ['claude-desktop', 'cursor', 'vscode'],
    license: 'MIT',
    source: 'https://github.com/slackapi/slack-mcp-server',
    rating: 4.5,
  },
  {
    id: uuidv4(), type: 'server', name: 'Linear MCP Server', slug: 'linear',
    publisher: 'Linear', verified: true,
    summary: 'Manage Linear issues, projects, and cycles via HTTP transport',
    description: 'Integrate AI agents with Linear for issue tracking, project planning, and cycle management. Create, update, and search issues; manage projects and teams; track progress via Linear GraphQL API. Uses API key authentication.',
    installs: 18900, sensitivity: 'internal', categories: ['project-management', 'issue-tracking', 'developer-tools'],
    version: '1.0.4', createdAt: PAST(100), updatedAt: PAST(14),
    transports: ['http'], auth: 'api-key',
    tools: [], clients: ['claude-desktop', 'cursor'],
    license: 'MIT',
    source: 'https://github.com/linear/linear-mcp',
    rating: 4.7,
  },
  {
    id: uuidv4(), type: 'server', name: 'Stripe MCP Server', slug: 'stripe',
    publisher: 'Stripe', verified: true,
    summary: 'Access Stripe payments, customers, subscriptions, and financial data',
    description: 'Official Stripe MCP Server for payment automation and financial data access. Manage customers, payment intents, subscriptions, invoices, and refunds. Read financial reports and webhook events. Supports both HTTP and SSE transports.',
    installs: 15200, sensitivity: 'restricted', categories: ['payments', 'finance', 'e-commerce'],
    version: '0.9.1', createdAt: PAST(80), updatedAt: PAST(4),
    transports: ['http', 'sse'], auth: 'api-key',
    tools: [], clients: ['claude-desktop'],
    license: 'MIT',
    source: 'https://github.com/stripe/stripe-mcp-server',
    rating: 4.4,
  },
  {
    id: uuidv4(), type: 'server', name: 'Filesystem MCP Server', slug: 'filesystem',
    publisher: 'Anthropic', verified: true,
    summary: 'Read and write local filesystem with configurable path sandboxing',
    description: 'The reference MCP filesystem server provides read/write access to local directories. Supports path allowlisting for security sandboxing, file glob patterns, directory listing, and file content operations. No authentication required — access control is via OS permissions.',
    installs: 62100, sensitivity: 'confidential', categories: ['filesystem', 'developer-tools', 'utilities'],
    version: '0.6.2', createdAt: PAST(200), updatedAt: PAST(1),
    transports: ['stdio'], auth: 'none',
    tools: [], clients: ['claude-desktop', 'cursor', 'vscode', 'zed', 'jetbrains'],
    license: 'MIT',
    source: 'https://github.com/anthropics/filesystem-mcp-server',
    rating: 4.9,
  },
  {
    id: uuidv4(), type: 'server', name: 'Sentry MCP Server', slug: 'sentry',
    publisher: 'Sentry', verified: false,
    summary: 'Query Sentry errors, issues, and performance data',
    description: 'Connect AI agents to Sentry for error monitoring and performance analysis. List and search issues, retrieve error details, manage alert rules, and analyze performance transactions. Community-maintained with API key authentication.',
    installs: 8700, sensitivity: 'internal', categories: ['monitoring', 'error-tracking', 'observability'],
    version: '0.3.0', createdAt: PAST(60), updatedAt: PAST(20),
    transports: ['http'], auth: 'api-key',
    tools: [], clients: ['claude-desktop', 'cursor'],
    license: 'MIT',
    source: 'https://github.com/sentry-mcp/sentry-server',
    rating: 3.9,
  },
  {
    id: uuidv4(), type: 'server', name: 'Notion MCP Server', slug: 'notion',
    publisher: 'Notion Labs', verified: false,
    summary: 'Read and write Notion pages, databases, and blocks',
    description: 'Interact with Notion workspaces through AI agents. Create and update pages, query databases, manage blocks, and read workspace content. Supports OAuth2 for user-level access. Community-maintained alpha release.',
    installs: 11300, sensitivity: 'internal', categories: ['productivity', 'knowledge-management', 'documentation'],
    version: '0.5.0-alpha', createdAt: PAST(45), updatedAt: PAST(12),
    transports: ['http'], auth: 'oauth2',
    tools: [], clients: ['claude-desktop'],
    license: 'MIT',
    source: 'https://github.com/notion-community/notion-mcp',
    rating: 3.7,
  },
  {
    id: uuidv4(), type: 'server', name: 'Brave Search', slug: 'brave-search',
    publisher: 'Brave', verified: true,
    summary: 'Privacy-respecting web search and local results via Brave Search API',
    description: 'Perform web searches using the Brave Search API with privacy guarantees. Supports general web search, news search, image search, and local results. Returns structured results including snippets, URLs, and metadata. Requires Brave Search API key.',
    installs: 22400, sensitivity: 'public', categories: ['search', 'web', 'research'],
    version: '1.1.0', createdAt: PAST(90), updatedAt: PAST(8),
    transports: ['http'], auth: 'api-key',
    tools: [], clients: ['claude-desktop', 'cursor', 'vscode'],
    license: 'Apache-2.0',
    source: 'https://github.com/brave/brave-search-mcp',
    rating: 4.6,
  },
];

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const skills: Skill[] = [
  {
    id: uuidv4(), type: 'skill', name: 'PR Review Skill', slug: 'pr-review',
    publisher: 'Anthropic', verified: true,
    summary: 'Automated pull request review with code quality feedback',
    description: 'Provides structured pull request review including code quality analysis, security checks, test coverage assessment, and actionable inline comments. Integrates with GitHub MCP Server to fetch diffs and post review comments.',
    installs: 14200, sensitivity: 'internal', categories: ['code-review', 'developer-tools', 'quality'],
    version: '2.0.1', createdAt: PAST(120), updatedAt: PAST(6),
    triggers: ['pull_request.opened', 'pull_request.synchronize', 'manual'],
    reaches: ['github', 'linear'],
    tokens: 2800,
  },
  {
    id: uuidv4(), type: 'skill', name: 'Incident Response', slug: 'incident-response',
    publisher: 'PagerDuty', verified: true,
    summary: 'Automated incident triage, escalation, and postmortem generation',
    description: 'End-to-end incident response workflow: acknowledges alerts, performs initial triage using Sentry and observability data, escalates to on-call responders via Slack, tracks resolution in Linear, and generates postmortem documents in Notion.',
    installs: 8900, sensitivity: 'confidential', categories: ['incident-management', 'observability', 'sre'],
    version: '1.3.0', createdAt: PAST(100), updatedAt: PAST(9),
    triggers: ['pagerduty.alert', 'manual'],
    reaches: ['sentry', 'slack', 'linear', 'notion'],
    tokens: 3200,
  },
  {
    id: uuidv4(), type: 'skill', name: 'Release Notes Writer', slug: 'release-notes',
    publisher: 'Community', verified: false,
    summary: 'Generates structured release notes from git history and PR descriptions',
    description: 'Analyzes merged pull requests, commit history, and Linear issues since the last release to generate comprehensive, user-friendly release notes. Outputs in Markdown and can post to GitHub Releases, Notion, or Slack.',
    installs: 5600, sensitivity: 'internal', categories: ['documentation', 'developer-tools', 'release-management'],
    version: '0.8.2', createdAt: PAST(75), updatedAt: PAST(15),
    triggers: ['manual', 'github.release.created'],
    reaches: ['github', 'linear', 'notion', 'slack'],
    tokens: 1900,
  },
  {
    id: uuidv4(), type: 'skill', name: 'SQL Optimizer', slug: 'sql-optimizer',
    publisher: 'Community', verified: false,
    summary: 'Analyzes and rewrites SQL queries for performance',
    description: 'Connects to your Postgres database, analyzes slow queries using EXPLAIN ANALYZE, identifies performance bottlenecks (missing indexes, N+1 patterns, inefficient joins), and proposes optimized query rewrites with benchmarks.',
    installs: 4100, sensitivity: 'confidential', categories: ['database', 'sql', 'performance'],
    version: '0.5.0', createdAt: PAST(55), updatedAt: PAST(18),
    triggers: ['manual'],
    reaches: ['postgres'],
    tokens: 2100,
  },
  {
    id: uuidv4(), type: 'skill', name: 'Brand Voice Guide', slug: 'brand-voice',
    publisher: 'Community', verified: false,
    summary: 'Enforces consistent brand voice across written content',
    description: 'Applies your organization\'s brand voice guidelines to any written content. Checks tone, terminology, formatting conventions, and messaging alignment. Can rewrite content to match brand standards and provide inline suggestions.',
    installs: 3200, sensitivity: 'internal', categories: ['content', 'marketing', 'writing'],
    version: '0.3.1', createdAt: PAST(40), updatedAt: PAST(22),
    triggers: ['manual'],
    reaches: ['notion', 'slack'],
    tokens: 1400,
  },
];

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

const agents: Agent[] = [
  {
    id: uuidv4(), type: 'agent', name: 'Release Captain', slug: 'release-captain',
    publisher: 'Anthropic', verified: true,
    summary: 'Orchestrates the full software release lifecycle from branch to deploy',
    description: 'Release Captain automates the entire release process: creates release branches, runs pre-release checks, generates changelogs, coordinates stakeholder approvals via Slack, merges to main, triggers CI/CD, and monitors deployment health.',
    installs: 7800, sensitivity: 'confidential', categories: ['ci-cd', 'release-management', 'developer-tools'],
    version: '1.1.0', createdAt: PAST(90), updatedAt: PAST(5),
    model: 'claude-opus-4-8',
    autonomy: 'medium',
    servers: ['github', 'linear', 'slack'],
    skills: ['release-notes', 'pr-review'],
  },
  {
    id: uuidv4(), type: 'agent', name: 'On-Call SRE', slug: 'oncall-sre',
    publisher: 'Anthropic', verified: true,
    summary: 'AI SRE that monitors, triages, and responds to production incidents',
    description: 'The On-Call SRE agent continuously monitors production systems, correlates alerts across Sentry and infrastructure metrics, performs automated triage, executes runbooks, and escalates to human responders when necessary. Maintains an incident log and communicates status via Slack.',
    installs: 5400, sensitivity: 'restricted', categories: ['sre', 'incident-management', 'observability'],
    version: '0.9.2', createdAt: PAST(70), updatedAt: PAST(3),
    model: 'claude-sonnet-4-6',
    autonomy: 'high',
    servers: ['sentry', 'slack', 'postgres'],
    skills: ['incident-response'],
  },
  {
    id: uuidv4(), type: 'agent', name: 'Support Concierge', slug: 'support-concierge',
    publisher: 'Anthropic', verified: true,
    summary: 'Fully autonomous customer support agent for tier-1 inquiries',
    description: 'Handles customer support tickets end-to-end: understands customer intent, retrieves relevant account data, performs actions like refunds and subscription changes, and resolves tickets without human intervention. Escalates complex issues with full context.',
    installs: 11200, sensitivity: 'restricted', categories: ['customer-support', 'automation', 'e-commerce'],
    version: '2.0.0', createdAt: PAST(110), updatedAt: PAST(2),
    model: 'claude-haiku-4-5-20251001',
    autonomy: 'full',
    servers: ['stripe', 'slack', 'postgres'],
    skills: ['brand-voice'],
  },
  {
    id: uuidv4(), type: 'agent', name: 'Data Analyst', slug: 'data-analyst',
    publisher: 'Anthropic', verified: true,
    summary: 'Explores data, writes SQL, and generates business intelligence reports',
    description: 'Connects to your data warehouse, understands your schema, writes optimized SQL queries, and produces structured analysis reports. Can identify trends, anomalies, and generate visualizations-ready data. Presents findings in natural language with supporting data.',
    installs: 9300, sensitivity: 'confidential', categories: ['data-analysis', 'business-intelligence', 'sql'],
    version: '1.5.0', createdAt: PAST(95), updatedAt: PAST(6),
    model: 'claude-sonnet-4-6',
    autonomy: 'medium',
    servers: ['postgres', 'brave-search'],
    skills: ['sql-optimizer'],
  },
  {
    id: uuidv4(), type: 'agent', name: 'Code Reviewer', slug: 'code-reviewer',
    publisher: 'Anthropic', verified: true,
    summary: 'Systematic code reviewer that enforces standards and catches bugs',
    description: 'Reviews code changes for correctness, security vulnerabilities, performance issues, test coverage, and adherence to coding standards. Posts detailed inline comments on GitHub PRs, scores overall code quality, and suggests specific improvements with code examples.',
    installs: 13700, sensitivity: 'internal', categories: ['code-review', 'developer-tools', 'quality'],
    version: '1.2.3', createdAt: PAST(140), updatedAt: PAST(4),
    model: 'claude-opus-4-8',
    autonomy: 'low',
    servers: ['github', 'linear'],
    skills: ['pr-review'],
  },
];

// ---------------------------------------------------------------------------
// APIs
// ---------------------------------------------------------------------------

const apis: Api[] = [
  {
    id: uuidv4(), type: 'api', name: 'Stripe API', slug: 'stripe-api',
    publisher: 'Stripe', verified: true,
    summary: 'Payment processing, billing, and financial data REST API',
    description: 'The Stripe REST API provides comprehensive payment processing capabilities including charge management, subscription billing, invoicing, refunds, and financial reporting. Version 2024-04-10 supports all core payment flows and the newer Payment Intents API.',
    installs: 42100, sensitivity: 'restricted', categories: ['payments', 'finance', 'e-commerce'],
    version: '2024-04-10', createdAt: PAST(500), updatedAt: PAST(2),
    style: 'REST',
    endpoint: 'https://api.stripe.com',
    wrappedBy: 'stripe',
  },
  {
    id: uuidv4(), type: 'api', name: 'GitHub REST API', slug: 'github-rest',
    publisher: 'GitHub', verified: true,
    summary: 'GitHub platform REST API for repositories, users, and automation',
    description: 'The GitHub REST API v3 provides programmatic access to all GitHub features: repositories, issues, pull requests, actions, packages, and more. Supports fine-grained personal access tokens and GitHub App installation tokens.',
    installs: 89400, sensitivity: 'internal', categories: ['version-control', 'developer-tools', 'ci-cd'],
    version: '2022-11-28', createdAt: PAST(1000), updatedAt: PAST(1),
    style: 'REST',
    endpoint: 'https://api.github.com',
    wrappedBy: 'github',
  },
  {
    id: uuidv4(), type: 'api', name: 'Linear GraphQL', slug: 'linear-graphql',
    publisher: 'Linear', verified: true,
    summary: 'Linear project management GraphQL API with real-time subscriptions',
    description: 'The Linear GraphQL API provides full access to Linear\'s project management features with type-safe queries, mutations, and real-time subscriptions. Supports issues, cycles, projects, teams, comments, and webhooks.',
    installs: 18700, sensitivity: 'internal', categories: ['project-management', 'issue-tracking', 'graphql'],
    version: '1.0.0', createdAt: PAST(300), updatedAt: PAST(5),
    style: 'GraphQL',
    endpoint: 'https://api.linear.app/graphql',
    wrappedBy: 'linear',
  },
  {
    id: uuidv4(), type: 'api', name: 'Twilio API', slug: 'twilio-api',
    publisher: 'Twilio', verified: true,
    summary: 'Programmable SMS, voice calls, email, and WhatsApp messaging',
    description: 'Twilio\'s REST API enables programmatic communication across SMS, MMS, WhatsApp, voice calls, and email via SendGrid. Supports international messaging, phone number management, and real-time webhooks for inbound messages.',
    installs: 31200, sensitivity: 'confidential', categories: ['communication', 'messaging', 'sms'],
    version: '2010-04-01', createdAt: PAST(600), updatedAt: PAST(10),
    style: 'REST',
    endpoint: 'https://api.twilio.com',
  },
  {
    id: uuidv4(), type: 'api', name: 'OpenWeather API', slug: 'openweather-api',
    publisher: 'OpenWeather', verified: true,
    summary: 'Current weather, forecasts, and historical climate data',
    description: 'The OpenWeather REST API provides current weather conditions, 5-day forecasts, hourly forecasts, air quality index, and historical weather data for any location worldwide. Supports geocoding, UV index, and weather maps.',
    installs: 27600, sensitivity: 'public', categories: ['weather', 'geospatial', 'data'],
    version: '3.0', createdAt: PAST(400), updatedAt: PAST(30),
    style: 'REST',
    endpoint: 'https://api.openweathermap.org',
  },
];

// ---------------------------------------------------------------------------
// Pending entries
// ---------------------------------------------------------------------------

const pendingEntries: PendingEntry[] = [
  {
    id: uuidv4(),
    entry: {
      type: 'server',
      name: 'Jira MCP Server',
      slug: 'jira',
      publisher: 'Atlassian',
      summary: 'Manage Jira issues, sprints, and boards via MCP',
      description: 'Official Atlassian MCP server for Jira Software. Create and update issues, manage sprints, query boards, and automate workflows.',
      sensitivity: 'internal',
      categories: ['project-management', 'issue-tracking'],
    },
    submittedBy: 'user-atlassian-submitter',
    submittedAt: PAST(3),
    status: 'pending',
    risk: 'low',
    flags: [],
  },
  {
    id: uuidv4(),
    entry: {
      type: 'agent',
      name: 'Autonomous Deployer',
      slug: 'autonomous-deployer',
      publisher: 'DevOps Labs',
      summary: 'Fully autonomous deployment agent with zero human approval',
      description: 'Deploys code to production automatically based on CI results without requiring human approval. Manages rollbacks, monitors post-deploy metrics, and adjusts traffic routing.',
      sensitivity: 'restricted',
      categories: ['ci-cd', 'deployment'],
    },
    submittedBy: 'user-devops-labs',
    submittedAt: PAST(1),
    status: 'pending',
    risk: 'critical',
    flags: ['full-autonomy', 'restricted-data', 'production-access'],
  },
  {
    id: uuidv4(),
    entry: {
      type: 'skill',
      name: 'Competitor Intelligence',
      slug: 'competitor-intel',
      publisher: 'MarketWatch AI',
      summary: 'Monitors and analyzes competitor activity and pricing',
      description: 'Scrapes competitor websites, pricing pages, and job boards to generate competitive intelligence reports. Identifies feature gaps and pricing opportunities.',
      sensitivity: 'confidential',
      categories: ['research', 'marketing'],
    },
    submittedBy: 'user-marketwatch',
    submittedAt: PAST(5),
    status: 'pending',
    risk: 'medium',
    flags: ['web-scraping', 'confidential-data'],
  },
  {
    id: uuidv4(),
    entry: {
      type: 'api',
      name: 'Internal Analytics API',
      slug: 'internal-analytics',
      publisher: 'Acme Corp',
      summary: 'Internal metrics and user analytics REST API',
      description: 'Proprietary analytics API exposing user behavior data, funnel metrics, and cohort analysis. For internal use only.',
      sensitivity: 'restricted',
      categories: ['analytics', 'internal'],
    },
    submittedBy: 'user-acme-internal',
    submittedAt: PAST(2),
    status: 'pending',
    risk: 'high',
    flags: ['restricted-data', 'internal-only'],
  },
  {
    id: uuidv4(),
    entry: {
      type: 'tool',
      name: 'Execute Shell Command',
      slug: 'exec-shell',
      publisher: 'Unknown',
      summary: 'Executes arbitrary shell commands on the host system',
      description: 'Provides the ability to run any shell command on the host machine with full system access.',
      sensitivity: 'restricted',
      categories: ['utilities'],
    },
    submittedBy: 'user-anonymous-001',
    submittedAt: PAST(0),
    status: 'pending',
    risk: 'critical',
    flags: ['no-auth', 'restricted-data', 'system-access', 'security-risk'],
  },
  {
    id: uuidv4(),
    entry: {
      type: 'server',
      name: 'Figma MCP Server',
      slug: 'figma',
      publisher: 'Figma Community',
      summary: 'Read Figma designs, components, and export assets',
      description: 'Community MCP server for accessing Figma files, reading component metadata, extracting design tokens, and exporting assets. Read-only access using personal access tokens.',
      sensitivity: 'internal',
      categories: ['design', 'developer-tools'],
    },
    submittedBy: 'user-figma-community',
    submittedAt: PAST(7),
    status: 'pending',
    risk: 'low',
    flags: [],
  },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const notifications: Notification[] = [
  {
    id: uuidv4(),
    type: 'security',
    title: 'Critical: Shell Command Tool Submission Flagged',
    body: 'A submission for "Execute Shell Command" tool has been flagged as critical risk. Immediate review required.',
    read: false,
    createdAt: PAST(0),
    link: '/governance/pending',
  },
  {
    id: uuidv4(),
    type: 'governance',
    title: 'High-Risk Agent Awaiting Approval',
    body: 'The "Autonomous Deployer" agent submission is pending admin review. Risk level: critical. 2 flags raised.',
    read: false,
    createdAt: PAST(1),
    link: '/governance/pending',
  },
  {
    id: uuidv4(),
    type: 'update',
    title: 'GitHub MCP Server v1.4.2 Released',
    body: 'The GitHub MCP Server has been updated to v1.4.2 with improved OAuth token refresh and new code search filters.',
    read: false,
    createdAt: PAST(3),
    link: '/registry/server/github',
  },
  {
    id: uuidv4(),
    type: 'skill',
    title: 'PR Review Skill: New Version Available',
    body: 'PR Review Skill v2.0.1 is now available with enhanced security vulnerability detection and test coverage reporting.',
    read: true,
    createdAt: PAST(6),
    link: '/registry/skill/pr-review',
  },
  {
    id: uuidv4(),
    type: 'governance',
    title: 'New Submission: Jira MCP Server',
    body: 'Atlassian has submitted the Jira MCP Server for registry inclusion. Risk level: low. Ready for review.',
    read: true,
    createdAt: PAST(3),
    link: '/governance/pending',
  },
  {
    id: uuidv4(),
    type: 'security',
    title: 'Sentry MCP Server: Verification Pending',
    body: 'The Sentry MCP Server from Sentry has not yet been verified. Consider verifying before wide adoption.',
    read: false,
    createdAt: PAST(20),
    link: '/registry/server/sentry',
  },
  {
    id: uuidv4(),
    type: 'update',
    title: 'Filesystem MCP Server v0.6.2: Path Sandbox Fix',
    body: 'Critical security fix: v0.6.2 patches a path traversal vulnerability in the allowlist validation. Upgrade immediately.',
    read: false,
    createdAt: PAST(1),
    link: '/registry/server/filesystem',
  },
];

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

async function bulkIndex(
  indexName: string,
  documents: unknown[]
): Promise<number> {
  if (documents.length === 0) return 0;

  const body = (documents as Array<Record<string, unknown>>).flatMap((doc) => [
    { index: { _index: indexName, _id: doc['id'] as string } },
    doc,
  ]);

  const response = await esClient.bulk({ body, refresh: 'wait_for' });

  if (response.errors) {
    const errors = response.items
      .filter((item) => item['index']?.error)
      .map((item) => item['index']?.error);
    console.error('Bulk index errors:', JSON.stringify(errors, null, 2));
  }

  return documents.length - response.items.filter((i) => i['index']?.error).length;
}

async function seed(): Promise<void> {
  console.log('Setting up Elasticsearch indices...');
  await setupIndices();
  console.log('Indices ready.\n');

  const allEntries: RegistryEntry[] = [
    ...servers,
    ...skills,
    ...agents,
    ...apis,
    // Also index standalone tools
    ...githubTools,
  ];

  console.log('Seeding registry entries...');
  const registryCount = await bulkIndex(INDEX_NAMES.REGISTRY, allEntries);
  console.log(`  ✓ ${registryCount} registry entries indexed`);

  console.log('Seeding pending submissions...');
  const pendingCount = await bulkIndex(INDEX_NAMES.PENDING, pendingEntries);
  console.log(`  ✓ ${pendingCount} pending entries indexed`);

  console.log('Seeding notifications...');
  const notifCount = await bulkIndex(INDEX_NAMES.NOTIFICATIONS, notifications);
  console.log(`  ✓ ${notifCount} notifications indexed`);

  console.log('\nSeed summary:');
  console.log(`  Servers:       ${servers.length}`);
  console.log(`  Skills:        ${skills.length}`);
  console.log(`  Agents:        ${agents.length}`);
  console.log(`  APIs:          ${apis.length}`);
  console.log(`  Tools:         ${githubTools.length}`);
  console.log(`  Pending:       ${pendingEntries.length}`);
  console.log(`  Notifications: ${notifications.length}`);
  console.log(`\nTotal indexed: ${registryCount + pendingCount + notifCount} documents`);
}

seed()
  .then(() => {
    console.log('\nSeed complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
