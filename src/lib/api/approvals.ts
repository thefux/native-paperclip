import type { ApiClient } from "@/lib/api/client";
import type { Approval } from "@/lib/api/types";

export interface BoardApprovalPayload {
  title: string;
  summary?: string;
  recommendedAction?: string;
  risks?: string[];
  /** Free-form additional fields some approval types expect (e.g. hire). */
  [key: string]: unknown;
}

export interface CreateBoardApprovalInput {
  type: string;
  requestedByAgentId: string;
  issueIds?: string[];
  payload: BoardApprovalPayload;
}

export const approvalsApi = {
  list: async (
    client: ApiClient,
    companyId: string,
    opts: { status?: "pending" | "approved" | "rejected" | "withdrawn" } = {},
  ): Promise<Approval[]> => {
    const qs = opts.status ? `?status=${encodeURIComponent(opts.status)}` : "";
    const data = await client.get<Approval[] | { approvals?: Approval[] }>(
      `/api/companies/${encodeURIComponent(companyId)}/approvals${qs}`,
    );
    return Array.isArray(data) ? data : (data.approvals ?? []);
  },

  get: async (client: ApiClient, approvalId: string): Promise<Approval> =>
    client.get<Approval>(`/api/approvals/${encodeURIComponent(approvalId)}`),

  /** Linked issues attached to an approval. Renders with click-through to issue detail. */
  issues: async (
    client: ApiClient,
    approvalId: string,
  ): Promise<Array<{ id: string; identifier: string; title: string; status: string }>> => {
    const data = await client.get<
      | Array<{ id: string; identifier: string; title: string; status: string }>
      | { issues?: Array<{ id: string; identifier: string; title: string; status: string }> }
    >(`/api/approvals/${encodeURIComponent(approvalId)}/issues`);
    return Array.isArray(data) ? data : (data.issues ?? []);
  },

  create: async (
    client: ApiClient,
    companyId: string,
    body: CreateBoardApprovalInput,
  ): Promise<Approval> =>
    client.post<Approval>(
      `/api/companies/${encodeURIComponent(companyId)}/approvals`,
      body,
    ),

  /** Approve, reject, or withdraw an approval. `note` is an optional rationale. */
  decide: async (
    client: ApiClient,
    approvalId: string,
    decision: "approve" | "reject" | "withdraw",
    note?: string,
  ): Promise<Approval> =>
    client.post<Approval>(
      `/api/approvals/${encodeURIComponent(approvalId)}/${decision}`,
      note ? { note } : {},
    ),
};
