import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInstanceStore, type Instance } from "@/lib/store/instances";
import { ApiError, createClient } from "@/lib/api/client";
import { resolveIdentity } from "@/lib/api/me";

/**
 * Refresh the active instance's identity (company name, role, displayName)
 * whenever the active connection changes. Marks the connection `degraded` on
 * 401/403 and `ok` on success.
 *
 * Side-effect: flushes the per-instance TanStack Query cache when the active
 * instance changes so two pck_ tokens for the same baseUrl don't show each
 * other's stale data during a switch.
 */
export function useActiveIdentityRefresh(): void {
  const active = useInstanceStore((s) => s.active());
  const update = useInstanceStore((s) => s.update);
  const setHealth = useInstanceStore((s) => s.setHealth);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!active) return;

    queryClient.removeQueries({
      predicate: (q) => {
        const key = q.queryKey;
        return Array.isArray(key) && key[0] !== active.id;
      },
    });

    let cancelled = false;
    void (async () => {
      const client = createClient(active);
      try {
        const identity = await resolveIdentity(client, active.defaultCompanyId ?? null);
        if (cancelled) return;
        const nowIso = new Date().toISOString();
        update(active.id, {
          identity: {
            id: identity.id ?? active.identity?.id ?? "",
            companyId: identity.companyId,
            companyName: identity.companyName ?? active.identity?.companyName,
            role: identity.role ?? active.identity?.role,
            displayName: identity.displayName ?? active.identity?.displayName,
            source: identity.source,
            lastValidatedAt: nowIso,
          },
          defaultCompanyId: identity.companyId,
          health: "ok",
          lastSeenAt: nowIso,
        });
      } catch (err) {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 401 || status === 403) {
          setHealth(active.id, "degraded");
        }
        // Network errors leave the prior health alone — could be a transient blip.
      }
    })();

    return () => {
      cancelled = true;
    };
    // We only want to refresh on activation. Watching `active.id` is enough;
    // identity field churn would cause an infinite loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);
}

/** Tiny helper for views that observed a 401 response so the chrome can surface a re-auth banner. */
export function flagInstanceDegraded(instance: Pick<Instance, "id"> | null | undefined): void {
  if (!instance) return;
  useInstanceStore.getState().setHealth(instance.id, "degraded");
}
