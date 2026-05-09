import type { ApiClient } from "@/lib/api/client";
import type { BudgetOverview } from "@/lib/api/types";

export const budgetsApi = {
  overview: async (
    client: ApiClient,
    companyId: string,
  ): Promise<BudgetOverview> =>
    client.get<BudgetOverview>(
      `/api/companies/${encodeURIComponent(companyId)}/budgets/overview`,
    ),
};
