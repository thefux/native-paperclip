import { useMemo } from "react";
import { useInstanceStore, type Instance, type InstanceCompany } from "@/lib/store/instances";
import { createClient, type ApiClient } from "@/lib/api/client";
import { flagInstanceDegraded } from "@/lib/store/identity-refresh";

/**
 * Returns chrome state for the currently active connection — the instance, an
 * authenticated `ApiClient`, the active company id, and a per-(instance,company)
 * cache prefix.
 *
 * - `instance` is `null` when no connection is active.
 * - `client` is `null` when no connection is active; otherwise it auto-flags
 *   the active instance `degraded` on any 401/403 response.
 * - `companyId` is the company the user is currently looking at. For a
 *   `company_api_key`/`agent` connection this is always the bound company; for
 *   `board` connections it tracks the user's last `setActiveCompany` choice.
 * - `companies` is the list of companies this connection's API key can access
 *   (refreshed by `useActiveIdentityRefresh` from `/api/me`).
 * - `prefix` is the per-(instance, company) cache key — every view should
 *   prepend this to its `useQuery` `queryKey` array so:
 *     - two pck_ tokens for the same baseUrl don't collide, and
 *     - switching companies on a board-user connection doesn't bleed stale
 *       data from the previous company.
 *
 * The hook intentionally takes `instance.id` (not the entire instance object)
 * as the memo key so swapping a token in place doesn't tear the client down.
 */
export function useActiveClient(): {
  instance: Instance | null;
  client: ApiClient | null;
  prefix: string;
  companyId: string;
  companies: InstanceCompany[];
} {
  const instance = useInstanceStore((s) => s.active()) ?? null;
  const id = instance?.id ?? null;

  const client = useMemo<ApiClient | null>(() => {
    if (!instance) return null;
    return createClient(instance, {
      onUnauthorized: () => flagInstanceDegraded(instance),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, instance?.baseUrl, instance?.apiKey]);

  const companyId =
    instance?.activeCompanyId ??
    instance?.identity?.companyId ??
    instance?.defaultCompanyId ??
    "";

  const companies = instance?.accessibleCompanies ?? [];
  const prefix = id ? `${id}:${companyId || "?"}` : "none";

  return { instance, client, prefix, companyId, companies };
}
