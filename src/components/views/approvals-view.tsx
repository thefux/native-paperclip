
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { createClient } from "@/lib/api/client";
import { Badge } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { Approval } from "@/lib/api/types";

export function ApprovalsView() {
  const active = useInstanceStore((s) => s.active());
  const client = useMemo(() => (active ? createClient(active) : null), [active]);
  const companyId = active?.defaultCompanyId ?? active?.identity?.companyId;

  const approvals = useQuery<Approval[]>({
    queryKey: ["approvals", client?.baseUrl ?? "none", companyId ?? "none"] as const,
    queryFn: async () => {
      if (!client || !companyId) return [];
      return client.get<Approval[]>(`/api/companies/${companyId}/approvals`);
    },
    enabled: !!client && !!companyId,
  });

  if (!client) return null;
  if (!companyId) return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted">
        Approvals
      </div>
      <ul className="flex-1 overflow-y-auto">
        {approvals.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
        {approvals.data?.length === 0 && (
          <li className="p-3 text-sm text-muted">No approvals.</li>
        )}
        {approvals.data?.map((a) => (
          <li key={a.id} className="border-b border-border/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{a.type}</span>
              <Badge
                tone={
                  a.status === "approved"
                    ? "success"
                    : a.status === "rejected"
                      ? "danger"
                      : "warn"
                }
              >
                {a.status}
              </Badge>
              <span className="ml-auto text-xs text-muted">
                {formatRelativeTime(a.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
