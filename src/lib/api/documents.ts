import type { ApiClient } from "@/lib/api/client";
import type { IssueDocument, IssueDocumentSummary } from "@/lib/api/types";

export const documentsApi = {
  list: async (client: ApiClient, issueId: string): Promise<IssueDocumentSummary[]> => {
    const data = await client.get<IssueDocumentSummary[] | { documents?: IssueDocumentSummary[] }>(
      `/api/issues/${encodeURIComponent(issueId)}/documents`,
    );
    if (Array.isArray(data)) return data;
    return data.documents ?? [];
  },

  get: async (
    client: ApiClient,
    issueId: string,
    key: string,
  ): Promise<IssueDocument> =>
    client.get<IssueDocument>(
      `/api/issues/${encodeURIComponent(issueId)}/documents/${encodeURIComponent(key)}`,
    ),

  /**
   * Create or update a document. Pass the current `latestRevisionId` as
   * `baseRevisionId` to optimistically guard against concurrent edits;
   * pass `null` for the very first revision.
   */
  put: async (
    client: ApiClient,
    issueId: string,
    key: string,
    body: {
      title?: string;
      format?: string;
      body: string;
      baseRevisionId: string | null;
    },
  ): Promise<IssueDocument> =>
    client.put<IssueDocument>(
      `/api/issues/${encodeURIComponent(issueId)}/documents/${encodeURIComponent(key)}`,
      body,
    ),
};
