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
};

export const goalsApi = {
  list: async (client: ApiClient, companyId: string): Promise<Goal[]> =>
    client
      .get<Goal[] | { goals?: Goal[] }>(`/api/companies/${encodeURIComponent(companyId)}/goals`)
      .then((d) => (Array.isArray(d) ? d : (d.goals ?? []))),
};

export const labelsApi = {
  list: async (client: ApiClient, companyId: string): Promise<Label[]> =>
    client
      .get<Label[] | { labels?: Label[] }>(`/api/companies/${encodeURIComponent(companyId)}/labels`)
      .then((d) => (Array.isArray(d) ? d : (d.labels ?? []))),
};
