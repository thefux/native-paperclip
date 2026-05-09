import type { ApiClient } from "@/lib/api/client";
import type { AuditEntry } from "@/lib/api/types";

export interface CompanyApiKey {
  id: string;
  label: string;
  scopes: string[];
  /** First few characters of the token (e.g. `pck_xxxx…`). Returned by V2. */
  prefix?: string;
  /** Legacy field — pre-V2 servers used `tokenLastEight` instead of `prefix`. */
  tokenLastEight?: string;
  createdAt: string;
  /** Some servers expose this; useful when present. */
  lastUsedAt?: string | null;
  /** Set after a rotation; older versions don't return this. */
  rotatedAt?: string | null;
  /** Set when the key has been revoked. Active keys leave this null/undefined. */
  revokedAt?: string | null;
  createdByUserId?: string | null;
}

/** Response from `POST /api/companies/:cid/api-keys` — the full secret is returned exactly once. */
export interface CreatedApiKey {
  /** Full `pck_…` secret. Display once, never store. */
  token: string;
  key: CompanyApiKey;
}

export const apiKeysApi = {
  list: async (client: ApiClient, companyId: string): Promise<CompanyApiKey[]> => {
    const data = await client.get<
      CompanyApiKey[] | { keys?: CompanyApiKey[]; apiKeys?: CompanyApiKey[] }
    >(`/api/companies/${encodeURIComponent(companyId)}/api-keys`);
    if (Array.isArray(data)) return data;
    return data.keys ?? data.apiKeys ?? [];
  },

  /**
   * Mints a new API key. The plaintext `token` is returned exactly once — the
   * caller is responsible for the copy-once flow on the client.
   */
  create: async (
    client: ApiClient,
    companyId: string,
    body: { label: string; scopes: string[] },
  ): Promise<CreatedApiKey> => {
    return client.post<CreatedApiKey>(
      `/api/companies/${encodeURIComponent(companyId)}/api-keys`,
      body,
    );
  },

  /** Revokes a key. The route returns the updated row with `revokedAt` set. */
  revoke: async (
    client: ApiClient,
    companyId: string,
    keyId: string,
  ): Promise<{ key: CompanyApiKey }> => {
    return client.delete<{ key: CompanyApiKey }>(
      `/api/companies/${encodeURIComponent(companyId)}/api-keys/${encodeURIComponent(keyId)}`,
    );
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

/** Valid scopes accepted by `POST /api/companies/:cid/api-keys` (V2 `COMPANY_API_KEY_SCOPES`). */
export const COMPANY_API_KEY_SCOPES = [
  "issues:read",
  "issues:write",
  "agents:invoke",
  "routines:trigger",
  "*",
] as const;

export type CompanyApiKeyScope = (typeof COMPANY_API_KEY_SCOPES)[number];

/** Friendly presets surfaced in the create form. The wildcard preset is gated by
 * the caller (only board-user keys should see it). */
export interface ScopePreset {
  id: "read-only" | "per-company" | "full";
  label: string;
  scopes: CompanyApiKeyScope[];
  blastRadius: string;
}

export const SCOPE_PRESETS: ScopePreset[] = [
  {
    id: "read-only",
    label: "Read-only",
    scopes: ["issues:read"],
    blastRadius: "Can read issues, comments, and projects. Cannot create or modify anything.",
  },
  {
    id: "per-company",
    label: "Per-company (recommended)",
    scopes: ["issues:read", "issues:write", "agents:invoke", "routines:trigger"],
    blastRadius:
      "Full access within this company: read/write issues, invoke agents, trigger routines. Cannot reach other companies.",
  },
  {
    id: "full",
    label: "Full access",
    scopes: ["*"],
    blastRadius:
      "Wildcard scope — every action this server allows. Use sparingly; treat the secret like a root credential.",
  },
];
