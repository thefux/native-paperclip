
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useActiveClient } from "@/lib/store/use-active-client";
import { type ApiClient } from "@/lib/api/client";
import { Badge, Button } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { Routine } from "@/lib/api/types";

export function RoutinesView() {
  const { instance, client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const companyId = instance?.defaultCompanyId ?? instance?.identity?.companyId;

  const routines = useQuery<Routine[]>({
    queryKey: [prefix, "routines", companyId ?? "none"] as const,
    queryFn: async () => {
      if (!client || !companyId) return [];
      return client.get<Routine[]>(`/api/companies/${companyId}/routines`);
    },
    enabled: !!client && !!companyId,
  });

  if (!client) return null;
  if (!companyId) return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted">
        Routines
      </div>
      <ul className="flex-1 overflow-y-auto">
        {routines.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
        {routines.data?.length === 0 && (
          <li className="p-3 text-sm text-muted">No routines.</li>
        )}
        {routines.data?.map((r) => (
          <RoutineRow key={r.id} routine={r} client={client} qc={qc} prefix={prefix} />
        ))}
      </ul>
    </div>
  );
}

function RoutineRow({
  routine,
  client,
  qc,
  prefix,
}: {
  routine: Routine;
  client: ApiClient;
  qc: QueryClient;
  prefix: string;
}) {
  const trigger = useMutation({
    mutationFn: () => client.post<{ runId: string }>(`/api/routines/${routine.id}/runs`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [prefix, "routines"] }),
  });

  return (
    <li className="border-b border-border/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{routine.name}</span>
        <Badge tone={routine.status === "active" ? "success" : "neutral"}>{routine.status}</Badge>
        <Button
          variant="ghost"
          className="ml-auto text-xs"
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
        >
          {trigger.isPending ? "Running…" : "Run now"}
        </Button>
      </div>
      <div className="mt-0.5 text-xs text-muted">
        Updated {formatRelativeTime(routine.updatedAt)}
      </div>
    </li>
  );
}
