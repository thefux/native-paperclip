import type { ApiClient } from "@/lib/api/client";
import type { AuditEntry, Layer, LayerTypeDescriptor } from "@/lib/api/types";

/**
 * V2 layers API (ROU-40 — shipped).
 *
 * Mounts under `/api/layers/types` and `/api/agents/:agentId/layers[/:layerId]`.
 */
export const layers = {
  listTypes: (api: ApiClient) =>
    api.get<{ types: LayerTypeDescriptor[]; phase?: number }>("/api/layers/types"),

  listForAgent: (api: ApiClient, agentId: string) =>
    api.get<{ layers: Layer[] }>(`/api/agents/${agentId}/layers`),

  create: (
    api: ApiClient,
    agentId: string,
    body: { layerType: string; config?: Record<string, unknown>; enabled?: boolean; position?: number },
  ) => api.post<Layer>(`/api/agents/${agentId}/layers`, body),

  update: (
    api: ApiClient,
    agentId: string,
    layerId: string,
    body: { config?: Record<string, unknown>; enabled?: boolean; position?: number },
  ) => api.patch<Layer>(`/api/agents/${agentId}/layers/${layerId}`, body),

  remove: (api: ApiClient, agentId: string, layerId: string) =>
    api.delete<void>(`/api/agents/${agentId}/layers/${layerId}`),

  reorder: (api: ApiClient, agentId: string, orderedIds: string[]) =>
    api.post<void>(`/api/agents/${agentId}/layers/reorder`, { orderedIds }),

  /**
   * Audit-log reader — `audit_log` (per-agent layer-runtime sink) is populated
   * by the audit layer (ROU-40) but the read endpoint is pending. The UI calls
   * this URL and degrades gracefully when the server returns 404 / 501.
   */
  audit: (api: ApiClient, agentId: string, limit = 50) =>
    api.get<{ entries: AuditEntry[] } | AuditEntry[]>(
      `/api/agents/${agentId}/audit-log?limit=${limit}`,
    ),
};

export function unwrapAudit(payload: { entries: AuditEntry[] } | AuditEntry[]): AuditEntry[] {
  return Array.isArray(payload) ? payload : payload.entries ?? [];
}
