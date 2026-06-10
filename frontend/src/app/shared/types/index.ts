// ─── Entry domain types (must stay in sync with backend src/types/index.ts) ───

export type EntryType = 'server' | 'tool' | 'skill' | 'agent' | 'api';
export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';
export type TransportType = 'stdio' | 'http' | 'sse';
export type AutonomyLevel = 'low' | 'medium' | 'high' | 'full';
export type ApiStyle = 'REST' | 'GraphQL';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface BaseEntry {
  id: string;
  type: EntryType;
  name: string;
  slug: string;
  publisher: string;
  verified: boolean;
  summary: string;
  description: string;
  installs: number;
  sensitivity: SensitivityLevel;
  categories: string[];
  version?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tool extends BaseEntry {
  type: 'tool';
  parentServer: string;
  params: ToolParam[];
  returns: string;
  readOnly: boolean;
}

export interface Server extends BaseEntry {
  type: 'server';
  transports: TransportType[];
  auth: string;
  tools: Tool[];
  clients: string[];
  license: string;
  source: string;
  rating: number;
}

export interface Skill extends BaseEntry {
  type: 'skill';
  triggers: string[];
  reaches: string[];
  tokens: number;
}

export interface Agent extends BaseEntry {
  type: 'agent';
  model: string;
  autonomy: AutonomyLevel;
  servers: string[];
  skills: string[];
}

export interface Api extends BaseEntry {
  type: 'api';
  style: ApiStyle;
  endpoint?: string;
  wrappedBy?: string;
}

export type RegistryEntry = Server | Tool | Skill | Agent | Api;

export interface PendingEntry {
  id: string;
  entry: Partial<RegistryEntry>;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  risk: RiskLevel;
  flags: string[];
  rejectReason?: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  result: 'success' | 'failure';
  responseTime?: number;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  userId?: string;
  type: 'governance' | 'security' | 'update' | 'skill';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface SearchParams {
  q?: string;
  type?: EntryType;
  category?: string;
  client?: string;
  sort?: 'installs' | 'recent' | 'rating' | 'name';
  page?: number;
  size?: number;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
  page: number;
  size: number;
}

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  name?: string;
  roles?: string[];
}

export interface AppStats {
  totalByType: Record<EntryType, number>;
  totalInstalls: number;
  verifiedCount: number;
  totalEntries: number;
}

// ─── Frontend-only types ──────────────────────────────────────────────────────

export type AccentColor = 'cobalt' | 'iris' | 'emerald' | 'ember' | 'mono';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppTheme {
  mode: ThemeMode;
  accent: AccentColor;
}

export type CollectionMemberKind = 'server' | 'skill' | 'agent' | 'api';

export interface CollectionMember {
  kind: CollectionMemberKind;
  id: string;
}

export interface Collection {
  id: string;
  title: string;
  desc: string;
  blurb: string;
  icon: string;
  curator: string;
  accent: string;
  members: CollectionMember[];
  entries: RegistryEntry[];
  count: number;
  installs: number;
  sensitivity: SensitivityLevel;
}
