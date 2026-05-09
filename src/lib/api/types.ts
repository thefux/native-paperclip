// Mirrors the Paperclip control-plane types we consume.
// Source of truth lives in `packages/shared` of the paperclip monorepo;
// these are shaped to match the JSON wire format and intentionally narrow.

export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

export type IssuePriority = "critical" | "high" | "medium" | "low";

export interface Identity {
  id: string;
  companyId: string;
  role?: string;
  shortName?: string;
  displayName?: string;
}

export interface InboxIssue {
  id: string;
  identifier: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  updatedAt: string;
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
  parentId?: string | null;
  goalId?: string | null;
  projectId?: string | null;
  labelIds?: string[];
}

export interface IssueLink {
  id: string;
  identifier: string;
  title: string;
  status: IssueStatus;
  priority?: IssuePriority;
  assigneeAgentId?: string | null;
}

export interface Issue extends InboxIssue {
  description?: string;
  /** Issues blocking this one. Server returns full link records. */
  blockedBy?: IssueLink[];
  /** Issues this one blocks. */
  blocks?: IssueLink[];
  /** Direct children (subtasks). */
  children?: IssueLink[];
  createdAt: string;
  billingCode?: string | null;
}

/** Issue document — `key` is unique within an issue (e.g. `plan`, `api-keys`). */
export interface IssueDocument {
  id: string;
  issueId: string;
  key: string;
  title?: string;
  format: "markdown" | "json" | "text" | string;
  body: string;
  latestRevisionId: string;
  latestRevisionNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IssueDocumentSummary {
  id: string;
  issueId?: string;
  key: string;
  title?: string;
  latestRevisionId: string;
  latestRevisionNumber?: number;
  updatedAt?: string;
}

export type ProjectStatus =
  | "planned"
  | "in_progress"
  | "paused"
  | "completed"
  | "archived"
  | string;

/** Workspace nested inside a project payload (matches the wire shape from `GET /api/projects/:id`). */
export interface ProjectWorkspace {
  id: string;
  companyId?: string;
  projectId?: string;
  name: string;
  /** "git_repo" | "cwd" | other server-managed source kinds. */
  sourceType?: string;
  cwd?: string | null;
  repoUrl?: string | null;
  repoRef?: string | null;
  defaultRef?: string | null;
  visibility?: string | null;
  setupCommand?: string | null;
  cleanupCommand?: string | null;
  isPrimary?: boolean;
  remoteProvider?: string | null;
  remoteWorkspaceRef?: string | null;
  metadata?: Record<string, unknown> | null;
  runtimeConfig?: Record<string, unknown> | null;
  runtimeServices?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Project summary as returned by `GET /api/companies/:cid/projects` and
 * `GET /api/projects/:id`. The wire shape is wider than this but Phase E1
 * only consumes the fields below.
 */
export interface Project {
  id: string;
  companyId?: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  urlKey?: string;
  goalId?: string | null;
  goalIds?: string[];
  goals?: Array<{ id: string; title: string }>;
  leadAgentId?: string | null;
  targetDate?: string | null;
  color?: string | null;
  archivedAt?: string | null;
  pauseReason?: string | null;
  pausedAt?: string | null;
  /**
   * Server-side parsed `ProjectExecutionWorkspacePolicy` object, opaque to
   * native-paperclip until Phase E2 surfaces a concrete editor for it.
   */
  executionWorkspacePolicy?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  codebase?: {
    workspaceId?: string | null;
    repoUrl?: string | null;
    repoRef?: string | null;
    defaultRef?: string | null;
    repoName?: string | null;
    localFolder?: string | null;
    managedFolder?: string | null;
    effectiveLocalFolder?: string | null;
    origin?: string | null;
  } | null;
  workspaces?: ProjectWorkspace[];
  primaryWorkspace?: ProjectWorkspace | null;
  /** Free-text billing code (the web shows it on the Configuration tab). */
  billingCode?: string | null;
}

/** Subset of `BudgetPolicySummary` we render on the Project Budget tab. */
export interface BudgetPolicySummary {
  policyId: string;
  companyId: string;
  scopeType: "company" | "agent" | "project" | string;
  scopeId: string;
  scopeName?: string;
  metric: string;
  windowKind: string;
  amount: number;
  observedAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
  warnPercent?: number;
  hardStopEnabled?: boolean;
  notifyEnabled?: boolean;
  isActive?: boolean;
  status: "ok" | "warning" | "hard_stop" | string;
  paused?: boolean;
  pauseReason?: string | null;
  windowStart?: string;
  windowEnd?: string;
}

export interface BudgetOverview {
  companyId: string;
  policies: BudgetPolicySummary[];
  activeIncidents?: unknown[];
  pausedAgentCount?: number;
  pausedProjectCount?: number;
  pendingApprovalCount?: number;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status?: string;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
}

/** Compact agent record returned by /api/companies/:cid/agents and used by pickers. */
export interface AgentSummary {
  id: string;
  name: string;
  role?: string;
  title?: string | null;
  urlKey?: string;
  /**
   * Server-emitted runtime status. Observed values: `running`, `idle`, `error`.
   * The native filter chip set ({@link AgentStatusFilter}) maps these to
   * Active/Paused/Error buckets. Older agents may omit it — treat absent as
   * "active" / "idle".
   */
  status?: string;
  icon?: string | null;
  /** Cents spent this billing month. */
  spentMonthlyCents?: number;
  /** Cents allowed per billing month (0 / null = uncapped). */
  budgetMonthlyCents?: number;
  /** Set when the agent has been paused (manually or by budget). */
  pausedAt?: string | null;
  pauseReason?: string | null;
  reportsTo?: string | null;
  adapterType?: string | null;
  lastHeartbeatAt?: string | null;
}

export interface AgentDetail extends AgentSummary {
  companyId?: string;
  instructionsPath?: string | null;
  chainOfCommand?: string[];
  /** @deprecated Use {@link spentMonthlyCents}. Kept for older API responses. */
  budgetUsedCents?: number;
  /** @deprecated Use {@link budgetMonthlyCents}. */
  budgetLimitCents?: number;
  description?: string;
  capabilities?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Skills attached to the agent. */
  skills?: Array<{ id: string; name: string }>;
}

/**
 * Heartbeat run record returned by `/api/companies/:cid/heartbeat-runs`. Server
 * status values are `queued | running | succeeded | failed | cancelled`. We
 * keep the field permissive because older paperclip v1 deployments may emit
 * domain statuses (`done`, `errored`, …); the transcript view normalises them.
 */
export interface AgentRun {
  id: string;
  companyId?: string;
  agentId: string;
  status: string;
  startedAt: string | null;
  finishedAt?: string | null;
  invocationSource?: string | null;
  triggerDetail?: string | null;
  wakeupRequestId?: string | null;
  exitCode?: number | null;
  signal?: string | null;
  error?: string | null;
  errorCode?: string | null;
  /** Server stuffs the adapter's terminal payload here when the run finishes. */
  resultJson?: {
    result?: string;
    summary?: string;
    subtype?: string;
    is_error?: boolean;
    total_cost_usd?: number;
    duration_ms?: number;
    [key: string]: unknown;
  } | null;
  usageJson?: Record<string, unknown> | null;
  contextSnapshot?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Transcript-equivalent entry. The heartbeat events feed
 * (`/api/heartbeat-runs/:id/events`) emits this shape; the older v1 transcript
 * routes used `role` / `body`. We accept either via the optional fields.
 */
export interface RunTranscriptEntry {
  id?: string | number;
  /** Heartbeat event type, e.g. `lifecycle`, `adapter.invoke`, `adapter.message`. */
  eventType?: string;
  type?: string;
  role?: "system" | "user" | "assistant" | "tool" | string;
  /** Heartbeat events: `stdout` / `stderr` / `system`. */
  stream?: string;
  level?: string;
  message?: string;
  body?: string;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
  /** Anything else the server returned. */
  [key: string]: unknown;
}

export interface AgentRunDetail extends AgentRun {
  /** v1 transcript array (rare). */
  transcript?: RunTranscriptEntry[];
  /** v1 messages array (rare). */
  messages?: RunTranscriptEntry[];
  /** Heartbeat-events feed, the canonical "transcript" on v2. */
  events?: RunTranscriptEntry[];
}

export interface Comment {
  id: string;
  issueId: string;
  body: string;
  authorAgentId?: string | null;
  authorUserId?: string | null;
  createdAt: string;
}

export interface Routine {
  id: string;
  identifier?: string;
  name: string;
  description?: string;
  agentId?: string | null;
  status: "active" | "paused" | "archived";
  triggers?: { type: string; cron?: string }[];
  updatedAt: string;
}

export interface Approval {
  id: string;
  type: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  payload?: Record<string, unknown>;
  requestedByAgentId?: string | null;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  prefix?: string;
}

export interface PaperclipEvent {
  type: string;
  payload?: unknown;
  at?: string;
}

// V2 — Channels (ROU-53 Nostr, ROU-54 Telegram).
export type ChannelType = "nostr" | "telegram";

export interface ChannelTypeDescriptor {
  type: ChannelType | string;
  label: string;
  description?: string;
  credentialSchemaSummary?: string;
  phase?: number;
}

export interface Channel {
  id: string;
  agentId: string;
  type: ChannelType | string;
  label?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
}

// V2 — Layers (ROU-40).
export interface LayerTypeDescriptor {
  type: string;
  label: string;
  description: string;
  configSchemaSummary: string;
}

export interface Layer {
  id: string;
  agentId: string;
  companyId: string;
  layerType: string;
  enabled: boolean;
  position: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  companyId: string;
  agentId: string | null;
  runId?: string | null;
  direction: string;
  kind: string;
  body: Record<string, unknown>;
  redactedBody?: Record<string, unknown> | null;
  createdAt: string;
}

export interface V2Stub {
  error: string;
  message: string;
  feature?: string;
  phase?: number;
}
