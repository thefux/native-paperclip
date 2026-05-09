import type { ApiClient } from "@/lib/api/client";
import type { Routine } from "@/lib/api/types";

export interface RoutineTriggerInput {
  type: "schedule" | "webhook" | "api" | string;
  cron?: string;
  /** Identifier the webhook trigger uses; some servers auto-generate one. */
  slug?: string;
}

export interface CreateRoutineInput {
  name: string;
  description?: string;
  agentId?: string | null;
  triggers?: RoutineTriggerInput[];
  /** "queue" / "drop" / "replace" — server-defined enum. */
  concurrencyPolicy?: string;
  /** "skip" / "run-once" — server-defined enum. */
  catchUpPolicy?: string;
  /** Optional payload that's passed to the executing agent on every fire. */
  payload?: Record<string, unknown>;
}

export const routinesApi = {
  list: async (client: ApiClient, companyId: string): Promise<Routine[]> => {
    const data = await client.get<Routine[] | { routines?: Routine[] }>(
      `/api/companies/${encodeURIComponent(companyId)}/routines`,
    );
    return Array.isArray(data) ? data : (data.routines ?? []);
  },

  get: async (client: ApiClient, routineId: string): Promise<Routine> =>
    client.get<Routine>(`/api/routines/${encodeURIComponent(routineId)}`),

  create: async (
    client: ApiClient,
    companyId: string,
    body: CreateRoutineInput,
  ): Promise<Routine> =>
    client.post<Routine>(
      `/api/companies/${encodeURIComponent(companyId)}/routines`,
      body,
    ),

  patch: async (
    client: ApiClient,
    routineId: string,
    body: Partial<CreateRoutineInput & { status: "active" | "paused" | "archived" }>,
  ): Promise<Routine> =>
    client.patch<Routine>(`/api/routines/${encodeURIComponent(routineId)}`, body),

  delete: async (client: ApiClient, routineId: string): Promise<void> =>
    client.delete<void>(`/api/routines/${encodeURIComponent(routineId)}`),

  /** Trigger a routine on demand. The server returns the new run id. */
  triggerNow: async (
    client: ApiClient,
    routineId: string,
  ): Promise<{ runId: string }> =>
    client.post<{ runId: string }>(`/api/routines/${encodeURIComponent(routineId)}/runs`, {}),
};
