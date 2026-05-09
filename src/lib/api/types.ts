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

export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  urlKey?: string;
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
}

export interface AgentDetail extends AgentSummary {
  companyId?: string;
  instructionsPath?: string | null;
  chainOfCommand?: string[];
  budgetUsedCents?: number;
  budgetLimitCents?: number;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Skills attached to the agent. */
  skills?: Array<{ id: string; name: string }>;
}

/** Run record. Server may emit either lower-level statuses (running/succeeded/failed) or domain ones. */
export interface AgentRun {
  id: string;
  agentId: string;
  status: string;
  result?: string | null;
  startedAt: string;
  endedAt?: string | null;
  triggerKind?: string;
  triggerIssueId?: string | null;
  triggerCommentId?: string | null;
  budgetCentsSpent?: number;
}

/** Transcript entry — broadly compatible with both V1 control plane and V2 paperclip. */
export interface RunTranscriptEntry {
  id?: string;
  type?: string;
  role?: "system" | "user" | "assistant" | "tool" | string;
  body?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  /** Anything else the server returned. */
  [key: string]: unknown;
}

export interface AgentRunDetail extends AgentRun {
  /** Some servers return transcript entries inline. */
  transcript?: RunTranscriptEntry[];
  /** Some servers expose a separate `messages` array. */
  messages?: RunTranscriptEntry[];
  /** Some servers stash the full log under `events`. */
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
