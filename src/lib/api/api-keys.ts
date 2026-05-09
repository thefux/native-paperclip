import type { ApiClient } from "@/lib/api/client";
import type { AuditEntry } from "@/lib/api/types";

export interface CompanyApiKey {
  id: string;
  label: string;
  scopes: string[];
  tokenLastEight?: string;
  createdAt: string;
  /** Some servers expose this; useful when present. */
  lastUsedAt?: string | null;
  /** Set after a rotation; older versions don't return this. */
  rotatedAt?: string | null;
}

export const apiKeysApi = {
  list: async (client: ApiClient, companyId: string): Promise<CompanyApiKey[]> => {
    const data = await client.get<
      CompanyApiKey[] | { keys?: CompanyApiKey[]; apiKeys?: CompanyApiKey[] }
    >(`/api/companies/${encodeURIComponent(companyId)}/api-keys`);
    if (Array.isArray(data)) return data;
    return data.keys ?? data.apiKeys ?? [];
  },

  auditLog: async (
    client: ApiClient,
    companyId: string,
    keyId: string,
    opts: { limit?: number } = {},
  ): Promise<AuditEntry[]> => {
    const qs = opts.limit ? `?limit=${opts.limit}` : "";
    const data = await client.get<AuditEntry[] | { entries?: AuditEntry[] }>(
      `/api/companies/${encodeURIComponent(companyId)}/api-keys/${encodeURIComponent(keyId)}/audit-log${qs}`,
    );
    return Array.isArray(data) ? data : (data.entries ?? []);
  },
};
