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
  list: async (client: ApiClient, companyId: string): Promise<Approval[]> =>
    client.get<Approval[]>(`/api/companies/${encodeURIComponent(companyId)}/approvals`),

  get: async (client: ApiClient, approvalId: string): Promise<Approval> =>
    client.get<Approval>(`/api/approvals/${encodeURIComponent(approvalId)}`),

  create: async (
    client: ApiClient,
    companyId: string,
    body: CreateBoardApprovalInput,
  ): Promise<Approval> =>
    client.post<Approval>(
      `/api/companies/${encodeURIComponent(companyId)}/approvals`,
      body,
    ),
};
