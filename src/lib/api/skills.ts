import type { ApiClient } from "@/lib/api/client";

export interface SkillDescriptor {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  source?: string;
  version?: string;
  tags?: string[];
}

export const skillsApi = {
  /**
   * Search the per-instance skills registry. Returns up to `limit` results
   * ranked by the server. Errors fall through to the caller — V1 instances
   * return 404, V2 instances pre-Phase 5 return 501.
   */
  search: async (
    client: ApiClient,
    query: string,
    opts: { limit?: number } = {},
  ): Promise<SkillDescriptor[]> => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (opts.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    const data = await client.get<
      | SkillDescriptor[]
      | { skills?: SkillDescriptor[]; results?: SkillDescriptor[] }
    >(`/api/skills/registry/search${qs ? `?${qs}` : ""}`);
    if (Array.isArray(data)) return data;
    return data.skills ?? data.results ?? [];
  },
};
