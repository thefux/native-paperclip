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
} from "@/lib/api/types";

export const agentsApi = {
  list: async (client: ApiClient, companyId: string): Promise<AgentSummary[]> =>
    client.get<AgentSummary[]>(`/api/companies/${encodeURIComponent(companyId)}/agents`),

  get: async (client: ApiClient, agentId: string): Promise<AgentDetail> =>
    client.get<AgentDetail>(`/api/agents/${encodeURIComponent(agentId)}`),

  runs: async (
    client: ApiClient,
    agentId: string,
    opts: { limit?: number } = {},
  ): Promise<AgentRun[]> => {
    const qs = opts.limit ? `?limit=${opts.limit}` : "";
    const data = await client.get<AgentRun[] | { runs?: AgentRun[] }>(
      `/api/agents/${encodeURIComponent(agentId)}/runs${qs}`,
    );
    return Array.isArray(data) ? data : (data.runs ?? []);
  },

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

export const runsApi = {
  get: async (client: ApiClient, runId: string): Promise<AgentRunDetail> =>
    client.get<AgentRunDetail>(`/api/runs/${encodeURIComponent(runId)}`),
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
