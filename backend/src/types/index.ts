export type EntryType = 'server' | 'tool' | 'skill' | 'agent' | 'api';
export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';
export type TransportType = 'stdio' | 'http' | 'sse';
export type AutonomyLevel = 'low' | 'medium' | 'high' | 'full';
export type ApiStyle = 'REST' | 'GraphQL';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Visibility = 'private' | 'org' | 'public';

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
  /** Server-controlled: set from policy.defaultVisibility at submission. */
  visibility?: Visibility;
  /** Server-controlled: when the entry must be re-reviewed (republishAfterDays). */
  reviewDueAt?: string;
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

export interface ApiEndpoint {
  method: string; // GET | POST | PUT | PATCH | DELETE | QUERY | MUTATION
  path: string;
  summary?: string;
}

export interface Api extends BaseEntry {
  type: 'api';
  style: ApiStyle;
  endpoint?: string;
  wrappedBy?: string;
  baseUrl?: string;
  auth?: string;
  endpoints?: ApiEndpoint[];
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
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  /** Distinct approver subs recorded so far (for two-approver enforcement). */
  approvals?: string[];
  /** Whether an admin overrode a policy block to approve. */
  policyOverride?: boolean;
  /** Justification supplied when a policy block was overridden. */
  overrideReason?: string;
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

/**
 * Per-user read/dismissal receipt for a notification. Used so that read state on
 * shared global notifications (those without a userId) is tracked per user
 * instead of mutating the shared document.
 */
export interface NotificationRead {
  userId: string;
  notificationId: string;
  read: boolean;
  dismissed: boolean;
  updatedAt: string;
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

export type RuleAction = 'flag' | 'review' | 'block' | 'reject';
export type RuleSeverity = 'high' | 'medium' | 'low';

export interface PolicyState {
  readOnlyDefault: boolean;
  perToolApproval: boolean;
  blockWriteUntilReview: boolean;
  quarantineHighRisk: boolean;
  requireReview: boolean;
  autoApproveVerified: boolean;
  autoApproveSkills: boolean;
  twoApproversHighRisk: boolean;
  republishAfterDays: number;
  defaultVisibility: 'private' | 'org' | 'public';
  transports: Record<string, boolean>;
  auth: Record<string, boolean>;
  scanInjection: boolean;
  requireTriggers: boolean;
  tokenCap: boolean;
}

export interface PolicyRule {
  id: string;
  name: string;
  cond: string;
  desc: string;
  severity: RuleSeverity;
  action: RuleAction;
  enabled: boolean;
  flag: string | null;
}

export interface TrustDomain {
  d: string;
  verified: boolean;
}

export interface PolicyDocument {
  id: string;
  policy: PolicyState;
  rules: PolicyRule[];
  domains: TrustDomain[];
  updatedAt: string;
  updatedBy: string;
}

export interface PendingStats {
  pendingCount: number;
  approvedCount: number;
  approvedThisWeek: number;
  avgReviewTimeMinutes: number | null;
  highRiskPending: number;
}

export type CollectionMemberKind = 'server' | 'skill' | 'agent' | 'api';

export interface CollectionMember {
  kind: CollectionMemberKind;
  id: string;
}

export interface CollectionDefinition {
  id: string;
  title: string;
  desc: string;
  blurb: string;
  icon: string;
  curator: string;
  accent: string;
  members: CollectionMember[];
}

export interface Collection extends CollectionDefinition {
  entries: RegistryEntry[];
  count: number;
  installs: number;
  sensitivity: SensitivityLevel;
}
