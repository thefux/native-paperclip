
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { approvalsApi } from "@/lib/api/approvals";
import { ApiError } from "@/lib/api/client";
import { Badge, Button, Card } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Approval } from "@/lib/api/types";

type Filter = "pending" | "all";

export function ApprovalsView({ onOpenIssue }: { onOpenIssue?: (id: string) => void } = {}) {
  const { instance, client, prefix, companyId } = useActiveClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const approvals = useQuery<Approval[]>({
    queryKey: [prefix, "approvals", companyId, filter] as const,
    queryFn: async () => {
      if (!client || !companyId) return [];
      return approvalsApi.list(
        client,
        companyId,
        filter === "pending" ? { status: "pending" } : {},
      );
    },
    enabled: !!client && !!companyId,
  });

  if (!client) return null;
  if (!companyId) return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted">Approvals</span>
          <div className="ml-auto flex items-center gap-1 text-xs">
            <FilterChip
              label="Pending"
              active={filter === "pending"}
              onClick={() => setFilter("pending")}
            />
            <FilterChip
              label="All"
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
          </div>
        </div>
        <ul className="overflow-y-auto">
          {approvals.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
          {approvals.data?.length === 0 && (
            <li className="p-3 text-sm text-muted">No approvals.</li>
          )}
          {approvals.data?.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 border-b border-border/60 px-3 py-2 text-left hover:bg-surface",
                  selectedId === a.id && "bg-surface",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="text-sm font-medium">{a.type}</span>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  <span className="ml-auto text-xs text-muted">
                    {formatRelativeTime(a.createdAt)}
                  </span>
                </div>
                {payloadTitle(a) && (
                  <span className="line-clamp-1 text-xs text-muted">
                    {payloadTitle(a)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-y-auto">
        {selectedId ? (
          <ApprovalDetailPanel approvalId={selectedId} onOpenIssue={onOpenIssue} />
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <p className="text-sm">Select an approval</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ApprovalDetailPanel({
  approvalId,
  onOpenIssue,
}: {
  approvalId: string;
  onOpenIssue?: (id: string) => void;
}) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approval = useQuery<Approval | null>({
    queryKey: [prefix, "approval", approvalId] as const,
    queryFn: () => (client ? approvalsApi.get(client, approvalId) : Promise.resolve(null)),
    enabled: !!client,
    retry: false,
  });

  const linkedIssues = useQuery({
    queryKey: [prefix, "approval-issues", approvalId] as const,
    queryFn: () =>
      client ? approvalsApi.issues(client, approvalId) : Promise.resolve([]),
    enabled: !!client,
    retry: false,
  });

  const decide = useMutation({
    mutationFn: async (decision: "approve" | "reject" | "withdraw") => {
      if (!client) throw new Error("No active connection");
      return approvalsApi.decide(client, approvalId, decision, note.trim() || undefined);
    },
    onSuccess: () => {
      setError(null);
      setNote("");
      qc.invalidateQueries({ queryKey: [prefix, "approval", approvalId] });
      qc.invalidateQueries({ queryKey: [prefix, "approvals"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const b = err.body as { message?: string; error?: string } | undefined;
        setError(b?.message ?? b?.error ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to record decision");
      }
    },
  });

  if (approval.isLoading) return <div className="p-4 text-sm text-muted">Loading…</div>;
  if (approval.isError)
    return (
      <div className="p-4 text-sm text-red-400">{(approval.error as Error).message}</div>
    );
  if (!approval.data) return null;
  const a = approval.data;
  const isPending = a.status === "pending";

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{payloadTitle(a) ?? a.type}</h2>
          <Badge tone={statusTone(a.status)}>{a.status}</Badge>
          <span className="ml-auto text-xs text-muted">
            opened {formatRelativeTime(a.createdAt)}
          </span>
        </div>
        <p className="text-xs text-muted">type: {a.type}</p>
      </header>

      {a.payload && (
        <Card className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted">Payload</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-border bg-bg/50 p-2 font-mono text-xs">
            {JSON.stringify(a.payload, null, 2)}
          </pre>
        </Card>
      )}

      <Card className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-muted">
          Linked issues ({linkedIssues.data?.length ?? 0})
        </div>
        {linkedIssues.isError && (
          <p className="text-xs text-yellow-300">
            Linked issues unavailable: {(linkedIssues.error as Error).message}
          </p>
        )}
        {linkedIssues.data?.length === 0 && (
          <p className="text-xs text-muted">No issues linked.</p>
        )}
        {linkedIssues.data?.map((i) => (
          <button
            key={i.id}
            onClick={() => onOpenIssue?.(i.id)}
            className="flex w-full items-center gap-2 text-left text-sm hover:underline"
          >
            <span className="font-mono text-xs text-muted">{i.identifier}</span>
            <Badge tone={statusTone(i.status)}>{i.status}</Badge>
            <span className="truncate">{i.title}</span>
          </button>
        ))}
      </Card>

      {isPending && (
        <Card className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted">Decide</div>
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            rows={3}
            placeholder="Optional rationale (recorded with the decision)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={() => decide.mutate("approve")}
              disabled={decide.isPending}
            >
              {decide.isPending ? "Working…" : "Approve"}
            </Button>
            <Button
              variant="danger"
              onClick={() => decide.mutate("reject")}
              disabled={decide.isPending}
            >
              Reject
            </Button>
            <Button
              variant="ghost"
              onClick={() => decide.mutate("withdraw")}
              disabled={decide.isPending}
            >
              Withdraw
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            The server may reject your decision (`422`) if you aren&apos;t a participant for
            this approval. Some servers expose only `approve`/`reject`; the `withdraw`
            action is available only to the requester.
          </p>
        </Card>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border border-border px-2 py-0.5 transition-colors",
        active ? "bg-accent/15 border-accent text-fg" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function statusTone(
  status: string,
): "neutral" | "info" | "warn" | "danger" | "success" {
  if (status === "approved" || status === "done" || status === "in_progress") return "success";
  if (status === "rejected" || status === "blocked") return "danger";
  if (status === "withdrawn" || status === "cancelled") return "neutral";
  if (status === "pending" || status === "in_review") return "warn";
  return "neutral";
}

function payloadTitle(a: Approval): string | null {
  if (!a.payload || typeof a.payload !== "object") return null;
  const t = (a.payload as Record<string, unknown>).title;
  return typeof t === "string" ? t : null;
}
