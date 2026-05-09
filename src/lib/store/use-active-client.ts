import { useMemo } from "react";
import { useInstanceStore, type Instance } from "@/lib/store/instances";
import { createClient, type ApiClient } from "@/lib/api/client";
import { flagInstanceDegraded } from "@/lib/store/identity-refresh";

/**
 * Returns `{ instance, client, prefix }` for the currently active connection.
 *
 * - `instance` is `null` when no connection is active.
 * - `client` is `null` when no connection is active; otherwise it auto-flags
 *   the active instance `degraded` on any 401/403 response.
 * - `prefix` is the per-connection cache key — every view should prepend this
 *   to its `useQuery` `queryKey` array so two pck_ tokens for the same baseUrl
 *   don't collide and stale data doesn't bleed across a switch.
 *
 * The hook intentionally takes `instance.id` (not the entire instance object)
 * as the memo key so swapping a token in place doesn't tear the client down.
 */
export function useActiveClient(): {
  instance: Instance | null;
  client: ApiClient | null;
  prefix: string;
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

  return { instance, client, prefix: id ?? "none" };
}
