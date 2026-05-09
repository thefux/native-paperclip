import type { ApiClient } from "@/lib/api/client";
import type {
  InboxIssue,
  Issue,
  IssuePriority,
  IssueStatus,
} from "@/lib/api/types";

export interface IssueListFilters {
  q?: string;
  status?: IssueStatus[];
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
  projectId?: string | null;
  labelId?: string | null;
  parentId?: string | null;
  /** When true, also include `done` and `cancelled`. Default off. */
  includeTerminal?: boolean;
  limit?: number;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
  parentId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  billingCode?: string | null;
  blockedByIssueIds?: string[];
  labelIds?: string[];
  /** Server-side hint: tie the new issue's execution workspace to an existing issue. */
  inheritExecutionWorkspaceFromIssueId?: string | null;
}

export const issuesApi = {
  list: async (
    client: ApiClient,
    companyId: string,
    filters: IssueListFilters = {},
  ): Promise<InboxIssue[]> => {
    const qs = buildQuery(filters);
    return client.get<InboxIssue[]>(
      `/api/companies/${encodeURIComponent(companyId)}/issues${qs ? `?${qs}` : ""}`,
    );
  },

  search: async (
    client: ApiClient,
    companyId: string,
    q: string,
    extra: Omit<IssueListFilters, "q"> = {},
  ): Promise<InboxIssue[]> =>
    issuesApi.list(client, companyId, { ...extra, q }),

  get: async (client: ApiClient, issueId: string): Promise<Issue> =>
    client.get<Issue>(`/api/issues/${encodeURIComponent(issueId)}`),

  create: async (
    client: ApiClient,
    companyId: string,
    body: CreateIssueInput,
  ): Promise<Issue> =>
    client.post<Issue>(`/api/companies/${encodeURIComponent(companyId)}/issues`, body),

  patch: async (
    client: ApiClient,
    issueId: string,
    body: Partial<{
      title: string;
      description: string;
      priority: IssuePriority;
      status: IssueStatus;
      assigneeAgentId: string | null;
      assigneeUserId: string | null;
      parentId: string | null;
      projectId: string | null;
      goalId: string | null;
      billingCode: string | null;
      blockedByIssueIds: string[];
      labelIds: string[];
      comment: string;
    }>,
  ): Promise<Issue> =>
    client.patch<Issue>(`/api/issues/${encodeURIComponent(issueId)}`, body),
};

function buildQuery(filters: IssueListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.assigneeAgentId) params.set("assigneeAgentId", filters.assigneeAgentId);
  if (filters.assigneeUserId) params.set("assigneeUserId", filters.assigneeUserId);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.labelId) params.set("labelId", filters.labelId);
  if (filters.parentId) params.set("parentId", filters.parentId);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (!filters.status?.length && !filters.includeTerminal) {
    params.set("status", "todo,in_progress,in_review,blocked");
  }
  return params.toString();
}
