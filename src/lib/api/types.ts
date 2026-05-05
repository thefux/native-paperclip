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
}

export interface Issue extends InboxIssue {
  description?: string;
  blockedBy?: { id: string; identifier: string; title: string; status: IssueStatus }[];
  blocks?: { id: string; identifier: string; title: string; status: IssueStatus }[];
  createdAt: string;
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
