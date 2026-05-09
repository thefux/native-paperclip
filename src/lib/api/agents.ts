import type { ApiClient } from "@/lib/api/client";
import type {
  AgentDetail,
  AgentRun,
  AgentRunDetail,
  AgentSummary,
  AuditEntry,
  Goal,
  Label,
  Project,
  RunTranscriptEntry,
} from "@/lib/api/types";

export const agentsApi = {
  list: async (client: ApiClient, companyId: string): Promise<AgentSummary[]> =>
    client.get<AgentSummary[]>(`/api/companies/${encodeURIComponent(companyId)}/agents`),

  get: async (client: ApiClient, agentId: string): Promise<AgentDetail> =>
    client.get<AgentDetail>(`/api/agents/${encodeURIComponent(agentId)}`),

  /**
   * List recent heartbeat runs for an agent, scoped to its company. The server
   * route is `GET /api/companies/:cid/heartbeat-runs?agentId=:id` (`heartbeat`
   * is the only run kind today). We require companyId so we don't have to
   * round-trip `/api/agents/:id` to discover it on every call.
   */
  runs: async (
    client: ApiClient,
    companyId: string,
    agentId: string,
    opts: { limit?: number } = {},
  ): Promise<AgentRun[]> => {
    const qs = new URLSearchParams({ agentId });
    if (opts.limit) qs.set("limit", String(opts.limit));
    return client.get<AgentRun[]>(
      `/api/companies/${encodeURIComponent(companyId)}/heartbeat-runs?${qs.toString()}`,
    );
  },

  /**
   * Per-agent audit log (V2 paperclip — ROU-57). Route is
   * `GET /api/agents/:id/audit-log?limit=N`. Falls back to graceful empty/error
   * surfaces on V1 deployments where the route is unavailable.
   */
  auditLog: async (
    client: ApiClient,
    agentId: string,
    opts: { limit?: number } = {},
  ): Promise<AuditEntry[]> => {
    const qs = opts.limit ? `?limit=${opts.limit}` : "";
    const data = await client.get<AuditEntry[] | { entries?: AuditEntry[] }>(
      `/api/agents/${encodeURIComponent(agentId)}/audit-log${qs}`,
    );
    return Array.isArray(data) ? data : (data.entries ?? []);
  },
};

/**
 * Heartbeat-run detail + events feed. The server returns run records under
 * `/api/heartbeat-runs/:runId`, and the transcript-equivalent feed lives at
 * `/api/heartbeat-runs/:runId/events`. We pull both and stitch them into the
 * `AgentRunDetail` the transcript view consumes.
 */
export const runsApi = {
  get: async (client: ApiClient, runId: string): Promise<AgentRunDetail> => {
    const run = await client.get<AgentRunDetail>(
      `/api/heartbeat-runs/${encodeURIComponent(runId)}`,
    );
    try {
      const events = await client.get<RunTranscriptEntry[]>(
        `/api/heartbeat-runs/${encodeURIComponent(runId)}/events?limit=500`,
      );
      return { ...run, events };
    } catch {
      // Events endpoint optional — surface the run record even if events 404.
      return run;
    }
  },
};

export const projectsApi = {
  list: async (client: ApiClient, companyId: string): Promise<Project[]> =>
    client
      .get<Project[] | { projects?: Project[] }>(
        `/api/companies/${encodeURIComponent(companyId)}/projects`,
      )
      .then((d) => (Array.isArray(d) ? d : (d.projects ?? []))),

  get: async (client: ApiClient, projectId: string): Promise<Project> =>
    client.get<Project>(`/api/projects/${encodeURIComponent(projectId)}`),

  create: async (
    client: ApiClient,
    companyId: string,
    body: { name: string; description?: string },
  ): Promise<Project> =>
    client.post<Project>(
      `/api/companies/${encodeURIComponent(companyId)}/projects`,
      body,
    ),
};

export const goalsApi = {
  list: async (client: ApiClient, companyId: string): Promise<Goal[]> =>
    client
      .get<Goal[] | { goals?: Goal[] }>(`/api/companies/${encodeURIComponent(companyId)}/goals`)
      .then((d) => (Array.isArray(d) ? d : (d.goals ?? []))),

  get: async (client: ApiClient, goalId: string): Promise<Goal> =>
    client.get<Goal>(`/api/goals/${encodeURIComponent(goalId)}`),

  create: async (
    client: ApiClient,
    companyId: string,
    body: { title: string; description?: string },
  ): Promise<Goal> =>
    client.post<Goal>(`/api/companies/${encodeURIComponent(companyId)}/goals`, body),
};

export const labelsApi = {
  list: async (client: ApiClient, companyId: string): Promise<Label[]> =>
    client
      .get<Label[] | { labels?: Label[] }>(`/api/companies/${encodeURIComponent(companyId)}/labels`)
      .then((d) => (Array.isArray(d) ? d : (d.labels ?? []))),
};
