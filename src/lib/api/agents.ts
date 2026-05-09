import type { ApiClient } from "@/lib/api/client";
import type { AgentSummary, Goal, Label, Project } from "@/lib/api/types";

export const agentsApi = {
  list: async (client: ApiClient, companyId: string): Promise<AgentSummary[]> =>
    client.get<AgentSummary[]>(`/api/companies/${encodeURIComponent(companyId)}/agents`),
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
