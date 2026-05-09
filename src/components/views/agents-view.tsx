import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { agentsApi } from "@/lib/api/agents";
import { approvalsApi } from "@/lib/api/approvals";
import { ApiError } from "@/lib/api/client";
import { Badge, Button, Card, Input } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type {
  AgentDetail,
  AgentRun,
  AgentSummary,
  AuditEntry,
} from "@/lib/api/types";
import { RunTranscript } from "@/components/views/run-transcript";

export function AgentsView() {
  const { instance, client, prefix, companyId } = useActiveClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHire, setShowHire] = useState(false);

  const agents = useQuery<AgentSummary[]>({
    queryKey: [prefix, "agents", companyId] as const,
    queryFn: () =>
      client && companyId ? agentsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
  });

  if (!client) return null;
  if (!companyId) return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted">Agents</span>
          <Button
            variant="ghost"
            className="ml-auto px-2 py-0.5 text-xs"
            onClick={() => setShowHire(true)}
          >
            <Plus size={12} className="mr-1" />
            Hire
          </Button>
        </div>
        <ul className="overflow-y-auto">
          {agents.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
          {agents.data?.length === 0 && (
            <li className="p-3 text-sm text-muted">No agents in this company.</li>
          )}
          {agents.data?.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left hover:bg-surface",
                  selectedId === a.id && "bg-surface",
                )}
              >
                <span className="text-sm font-medium">{a.name}</span>
                {a.role && <span className="text-xs text-muted">{a.role}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-y-auto">
        {selectedId ? (
          <AgentDetailPanel agentId={selectedId} />
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <p className="text-sm">Select an agent</p>
          </div>
        )}
      </section>

      {showHire && (
        <HireModal
          companyId={companyId}
          requestedByAgentId={instance?.identity?.id ?? ""}
          onClose={() => setShowHire(false)}
        />
      )}
    </div>
  );
}

function AgentDetailPanel({ agentId }: { agentId: string }) {
  const { client, prefix } = useActiveClient();
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const detail = useQuery<AgentDetail | null>({
    queryKey: [prefix, "agent", agentId] as const,
    queryFn: () => (client ? agentsApi.get(client, agentId) : Promise.resolve(null)),
    enabled: !!client,
    retry: false,
  });

  const runs = useQuery<AgentRun[]>({
    queryKey: [prefix, "agent-runs", agentId] as const,
    queryFn: () =>
      client ? agentsApi.runs(client, agentId, { limit: 50 }) : Promise.resolve([]),
    enabled: !!client,
    retry: false,
  });

  const audit = useQuery<AuditEntry[]>({
    queryKey: [prefix, "agent-audit", agentId] as const,
    queryFn: () =>
      client ? agentsApi.auditLog(client, agentId, { limit: 50 }) : Promise.resolve([]),
    enabled: !!client,
    retry: false,
  });

  if (detail.isLoading) return <div className="p-4 text-sm text-muted">Loading…</div>;
  if (detail.isError) {
    return (
      <div className="p-4 text-sm text-red-400">
        {(detail.error as Error).message}
      </div>
    );
  }
  if (!detail.data) return null;

  const a = detail.data;

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{a.name}</h2>
          {a.role && <Badge tone="info">{a.role}</Badge>}
          {a.title && <span className="text-sm text-muted">{a.title}</span>}
          <span className="ml-auto text-xs text-muted">
            {a.id.slice(0, 8)}…
          </span>
        </div>
        {a.description && <p className="text-sm text-muted">{a.description}</p>}
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted">Identity</div>
          <KV k="Company" v={a.companyId} />
          <KV k="Active" v={a.isActive === undefined ? "?" : a.isActive ? "yes" : "no"} />
          {a.instructionsPath !== undefined && (
            <KV k="Instructions" v={a.instructionsPath ?? "—"} />
          )}
          {a.chainOfCommand && a.chainOfCommand.length > 0 && (
            <KV
              k="Chain of command"
              v={a.chainOfCommand.map((id) => id.slice(0, 8)).join(" → ")}
            />
          )}
          {(a.budgetUsedCents !== undefined || a.budgetLimitCents !== undefined) && (
            <KV
              k="Budget"
              v={`${(a.budgetUsedCents ?? 0) / 100}$ / ${(a.budgetLimitCents ?? 0) / 100}$`}
            />
          )}
          {a.skills && a.skills.length > 0 && (
            <KV
              k="Skills"
              v={a.skills.map((s) => s.name).join(", ")}
            />
          )}
        </Card>

        <Card className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted">
            Recent runs ({runs.data?.length ?? 0})
          </div>
          {runs.isLoading && <p className="text-sm text-muted">Loading…</p>}
          {runs.isError && (
            <p className="text-xs text-yellow-300">
              Runs unavailable: {(runs.error as Error).message}
            </p>
          )}
          <ul className="space-y-1">
            {runs.data?.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <button
                  className="font-mono text-muted hover:underline"
                  onClick={() => setOpenRunId(r.id)}
                >
                  {r.id.slice(0, 8)}…
                </button>
                <Badge tone={runTone(r.status)}>{r.status}</Badge>
                {r.result && (
                  <Badge tone={r.result === "success" ? "success" : "danger"}>
                    {r.result}
                  </Badge>
                )}
                <span className="ml-auto text-muted">
                  {formatRelativeTime(r.endedAt ?? r.startedAt)}
                </span>
              </li>
            ))}
            {runs.data?.length === 0 && (
              <li className="text-xs text-muted">No runs recorded.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Audit log</span>
          <span className="text-xs text-muted">
            ({audit.data?.length ?? 0} entries)
          </span>
        </div>
        {audit.isError && (
          <p className="text-xs text-yellow-300">
            Audit log unavailable: {(audit.error as Error).message}
          </p>
        )}
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {audit.data?.slice(0, 50).map((entry) => (
            <li key={entry.id} className="rounded border border-border bg-bg/50 p-2 text-xs">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                <span className="font-mono">{entry.kind}</span>
                <span>·</span>
                <span>{entry.direction}</span>
                <span className="ml-auto">{formatRelativeTime(entry.createdAt)}</span>
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {JSON.stringify(entry.redactedBody ?? entry.body, null, 2)}
              </pre>
            </li>
          ))}
          {audit.data?.length === 0 && (
            <li className="text-xs text-muted">No audit entries.</li>
          )}
        </ul>
      </Card>

      {openRunId && (
        <RunTranscript runId={openRunId} onClose={() => setOpenRunId(null)} />
      )}
    </div>
  );
}

function HireModal({
  companyId,
  requestedByAgentId,
  onClose,
}: {
  companyId: string;
  requestedByAgentId: string;
  onClose: () => void;
}) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [summary, setSummary] = useState("");
  const [recommendedAction, setRecommendedAction] = useState("Hire and onboard.");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No active connection");
      if (!requestedByAgentId)
        throw new Error("This connection's identity has no agentId — re-onboard first.");
      return approvalsApi.create(client, companyId, {
        type: "request_board_approval",
        requestedByAgentId,
        payload: {
          title: `Hire ${name}${role ? ` — ${role}` : ""}`,
          summary: summary || undefined,
          recommendedAction,
          proposedAgent: { name, role: role || undefined },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [prefix, "approvals"] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const b = err.body as { message?: string; error?: string } | undefined;
        setError(b?.message ?? b?.error ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit approval");
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <Card className="w-full max-w-md space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Submit hire request</h2>
          <Button variant="ghost" className="ml-auto text-xs" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-muted">
          Submits a <code className="font-mono">request_board_approval</code> to the company
          board. Once approved, follow the team&apos;s on-server hiring workflow to actually
          create the agent (skills + adapter config + AGENTS.md). This screen does not
          create the agent itself.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              setError("Name is required");
              return;
            }
            setError(null);
            submit.mutate();
          }}
          className="space-y-3"
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Role</span>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Backend, QA" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Why?</span>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short justification — what gap does this hire close?"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Recommended action</span>
            <Input
              value={recommendedAction}
              onChange={(e) => setRecommendedAction(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={submit.isPending || !name.trim()}>
              {submit.isPending ? "Submitting…" : "Submit hire approval"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function KV({ k, v }: { k: string; v?: string | number | null }) {
  if (v === undefined || v === null || v === "") return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted min-w-[6rem]">{k}</span>
      <span className="font-mono">{String(v)}</span>
    </div>
  );
}

function runTone(status: string): "neutral" | "info" | "warn" | "danger" | "success" {
  if (status === "running" || status === "in_progress") return "info";
  if (status === "succeeded" || status === "done") return "success";
  if (status === "failed" || status === "errored") return "danger";
  if (status === "cancelled") return "neutral";
  return "neutral";
}
