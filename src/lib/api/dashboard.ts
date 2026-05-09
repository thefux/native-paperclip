import type { ApiClient } from "@/lib/api/client";

/**
 * Server-shape varies between V1 and V2 builds; we surface a structurally
 * permissive type and let the view drive what it can render. Anything the
 * server returns under one of these keys is shown; everything else is ignored.
 */
export interface DashboardSummary {
  /** Counts keyed by status (e.g. { todo: 12, in_progress: 3 }). */
  issueCountsByStatus?: Record<string, number>;
  /** Counts keyed by priority. */
  issueCountsByPriority?: Record<string, number>;
  /** Recent issues, freshest first. */
  recentIssues?: Array<{
    id: string;
    identifier: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: string;
  }>;
  /** Active agents in the company (id + name + run state). */
  activeAgents?: Array<{
    id: string;
    name: string;
    role?: string;
    activeRunCount?: number;
    lastSeenAt?: string;
  }>;
  /** Recent runs (any agent). */
  recentRuns?: Array<{
    id: string;
    agentId: string;
    status: string;
    startedAt: string;
    endedAt?: string;
  }>;
  /** Pending approvals count. */
  pendingApprovals?: number;
  /** Anything else the server feels like sending — we just ignore. */
  [key: string]: unknown;
}

export const dashboardApi = {
  get: async (client: ApiClient, companyId: string): Promise<DashboardSummary> =>
    client.get<DashboardSummary>(
      `/api/companies/${encodeURIComponent(companyId)}/dashboard`,
    ),
};
