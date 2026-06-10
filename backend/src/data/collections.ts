import { CollectionDefinition } from '../types/index.js';

/** Curated stacks — member ids match registry entry slugs. */
export const COLLECTION_DEFINITIONS: CollectionDefinition[] = [
  {
    id: 'dev-essentials',
    title: 'Developer essentials',
    desc: 'The toolbox every coding agent reaches for — repos, files, and a database, with a reviewer on top.',
    blurb:
      'Start here if you are wiring up a coding agent. These are the governed servers and the review skill that show up in nearly every developer workflow, bundled so you can connect them in one pass.',
    icon: 'code',
    curator: 'Anthropic',
    accent: '#5a63d8',
    members: [
      { kind: 'agent', id: 'code-reviewer' },
      { kind: 'server', id: 'github' },
      { kind: 'server', id: 'filesystem' },
      { kind: 'server', id: 'postgres' },
      { kind: 'skill', id: 'pr-review' },
    ],
  },
  {
    id: 'incident-stack',
    title: 'Incident response stack',
    desc: 'Everything the on-call needs to go from first alert to all-clear without leaving the registry.',
    blurb:
      'Wired for the 3am page: observability to find the failing error, messaging to coordinate, source control to correlate deploys — and the playbook that ties them together under an approval policy.',
    icon: 'warning',
    curator: 'Anthropic',
    accent: '#d44a3f',
    members: [
      { kind: 'agent', id: 'oncall-sre' },
      { kind: 'server', id: 'sentry' },
      { kind: 'server', id: 'slack' },
      { kind: 'server', id: 'github' },
      { kind: 'skill', id: 'incident-response' },
    ],
  },
  {
    id: 'data-team',
    title: 'Data team starter',
    desc: 'Ask the warehouse questions in plain English — read-only, with the SQL always shown.',
    blurb:
      'A read-only analytics bundle. The Postgres server is pinned read-only, search fills in context, and the optimization skill keeps queries fast. Nothing here can mutate your data.',
    icon: 'box',
    curator: 'Anthropic',
    accent: '#0d9aa6',
    members: [
      { kind: 'agent', id: 'data-analyst' },
      { kind: 'server', id: 'postgres' },
      { kind: 'server', id: 'brave-search' },
      { kind: 'skill', id: 'sql-optimizer' },
    ],
  },
  {
    id: 'release-train',
    title: 'Ship the release',
    desc: 'Cut the branch, draft the notes in your voice, and shepherd the PRs to a clean merge.',
    blurb:
      'The release-day kit. Source control and issue tracking for the mechanics, two skills for judgement and house voice, and the captain that runs the train under a human sign-off.',
    icon: 'install',
    curator: 'Anthropic',
    accent: '#1f9d62',
    members: [
      { kind: 'agent', id: 'release-captain' },
      { kind: 'server', id: 'github' },
      { kind: 'server', id: 'linear' },
      { kind: 'skill', id: 'release-notes' },
      { kind: 'skill', id: 'pr-review' },
    ],
  },
  {
    id: 'support-desk',
    title: 'Customer support desk',
    desc: 'Triage the inbox, answer in your brand voice, and file the bug when it is real.',
    blurb:
      'Front-line support that drafts but never sends. Messaging and a knowledge base for context, issue tracking to escalate, and a voice skill so replies sound like you — read-mostly by design.',
    icon: 'inbox',
    curator: 'Acme Co',
    accent: '#8b46d6',
    members: [
      { kind: 'agent', id: 'support-concierge' },
      { kind: 'server', id: 'slack' },
      { kind: 'server', id: 'notion' },
      { kind: 'skill', id: 'brand-voice' },
    ],
  },
  {
    id: 'payments-ops',
    title: 'Payments & billing',
    desc: 'High-blast-radius financial tools, every write behind an explicit allowlist.',
    blurb:
      'Money moves carefully here. The Stripe server ships read tools on and writes off by default — the recommended pattern is a virtual server exposing only the one operation an agent needs.',
    icon: 'lock',
    curator: 'Stripe',
    accent: '#c2820b',
    members: [
      { kind: 'server', id: 'stripe' },
      { kind: 'api', id: 'stripe-api' },
    ],
  },
];
