import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { agentsApi } from "@/lib/api/agents";
import { approvalsApi } from "@/lib/api/approvals";
import { ApiError } from "@/lib/api/client";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { AgentSummary } from "@/lib/api/types";
import {
  type AgentStatusFilter,
  useAgentsSubroute,
} from "@/lib/use-agents-route";
import { AgentDetail } from "@/components/views/agent-detail";

/**
 * Agents tab — Phase D1 / [ROU-101](/ROU/issues/ROU-101).
 *
 * List view shows every agent on the active company, with All/Active/Paused/
 * Error filter chips that persist into the URL (`#agents?status=active`).
 * Tapping a row pushes the detail page (`#agents/{id}`); the detail view owns
 * its sub-tabs (overview/runs/skills/budget) and the run-transcript drilldown
 * underneath.
 *
 * "Request hire" is an approval-only stub: it files a
 * `request_board_approval` for the board to act on via the existing on-server
 * hire workflow. The full inline hire flow (adapter selection, skill
 * assignment, AGENTS.md) is Phase D2.
 *
 * The list filters client-side off the data already loaded for the chip row;
 * URL persistence lets back/forward and deep-links land on the same chip.
 */
export function AgentsView() {
  const subroute = useAgentsSubroute();

  if (subroute.route.kind === "detail") {
    return (
      <AgentDetail
        agentId={subroute.route.agentId}
        section={subroute.route.section}
        runId={subroute.route.runId}
        onSectionChange={(s) => subroute.setSection(s)}
        onOpenRun={(runId) => subroute.enterRun(runId)}
        onCloseRun={() => subroute.exitRun()}
        onBack={() => subroute.exitDetail()}
      />
    );
  }

  return (
    <AgentsList
      statusFilter={subroute.route.statusFilter}
      onStatusFilterChange={subroute.setStatusFilter}
      onOpenAgent={(id) => subroute.enterDetail(id)}
    />
  );
}

const FILTER_TABS: Array<{
  id: AgentStatusFilter;
  label: string;
  matches: (a: AgentSummary) => boolean;
}> = [
  { id: "all", label: "All", matches: () => true },
  { id: "active", label: "Active", matches: (a) => bucket(a) === "active" },
  { id: "paused", label: "Paused", matches: (a) => bucket(a) === "paused" },
  { id: "error", label: "Error", matches: (a) => bucket(a) === "error" },
];

function AgentsList({
  statusFilter,
  onStatusFilterChange,
  onOpenAgent,
}: {
  statusFilter: AgentStatusFilter;
  onStatusFilterChange: (filter: AgentStatusFilter) => void;
  onOpenAgent: (agentId: string) => void;
}) {
  const { instance, client, prefix, companyId } = useActiveClient();
  const [showHire, setShowHire] = useState(false);

  const agents = useQuery<AgentSummary[]>({
    queryKey: [prefix, "agents", companyId] as const,
    queryFn: () =>
      client && companyId ? agentsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  const filtered = useMemo(() => {
    const list = agents.data ?? [];
    const tab = FILTER_TABS.find((t) => t.id === statusFilter) ?? FILTER_TABS[0];
    return list.filter(tab.matches);
  }, [agents.data, statusFilter]);

  const counts = useMemo(() => {
    const list = agents.data ?? [];
    const out: Record<AgentStatusFilter, number> = {
      all: list.length,
      active: 0,
      paused: 0,
      error: 0,
    };
    for (const a of list) {
      const b = bucket(a);
      if (b === "active") out.active += 1;
      else if (b === "paused") out.paused += 1;
      else if (b === "error") out.error += 1;
    }
    return out;
  }, [agents.data]);

  if (!client) return null;
  if (!companyId)
    return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">Agents</span>
        <Button
          variant="ghost"
          onClick={() => agents.refetch()}
          aria-label="Refresh agents"
          className="ml-auto px-2 py-0.5 text-xs"
          disabled={agents.isFetching}
        >
          <RefreshCw
            size={12}
            className={cn("mr-1", agents.isFetching && "animate-spin")}
          />
          Refresh
        </Button>
        {/* "Request hire" makes the approval-only stub explicit — the full
            hire flow (adapter selection, skill assignment, AGENTS.md) lands in
            Phase D2 (UIUXLead review note 1). The button still files a
            `request_board_approval` so a board user can keep the existing
            on-server hiring workflow. */}
        <Button
          variant="ghost"
          className="px-2 py-0.5 text-xs"
          onClick={() => setShowHire(true)}
        >
          <Plus size={12} className="mr-1" />
          Request hire
        </Button>
      </header>

      <FilterChipRow
        active={statusFilter}
        counts={counts}
        onSelect={onStatusFilterChange}
      />

      <ul className="flex-1 overflow-y-auto pl-safe pr-safe">
        {agents.isLoading && <SkeletonRows />}
        {agents.isError && (
          <li className="p-4">
            <Card className="space-y-2 text-sm">
              <p className="text-red-300">
                Couldn&apos;t load agents: {(agents.error as Error).message}
              </p>
              <Button variant="ghost" onClick={() => agents.refetch()}>
                <RefreshCw size={14} className="mr-1" /> Retry
              </Button>
            </Card>
          </li>
        )}
        {!agents.isLoading &&
          !agents.isError &&
          filtered.length === 0 &&
          (agents.data?.length ?? 0) > 0 && (
            <li className="p-4 text-sm text-muted">
              No agents matching this filter.
            </li>
          )}
        {!agents.isLoading &&
          !agents.isError &&
          (agents.data?.length ?? 0) === 0 && (
            <li className="p-4 text-sm text-muted">
              No agents in this company.
            </li>
          )}
        {filtered.map((a) => (
          <AgentRow key={a.id} agent={a} onOpen={() => onOpenAgent(a.id)} />
        ))}
      </ul>

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

function FilterChipRow({
  active,
  counts,
  onSelect,
}: {
  active: AgentStatusFilter;
  counts: Record<AgentStatusFilter, number>;
  onSelect: (filter: AgentStatusFilter) => void;
}) {
  // role="tablist" wraps tabs so the W3C tab pattern parses correctly
  // (UIUXLead review note 5).
  return (
    <nav
      role="tablist"
      aria-label="Filter agents by status"
      className="flex gap-1.5 overflow-x-auto border-b border-border bg-bg/40 px-3 py-2"
    >
      {FILTER_TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs",
              isActive
                ? "border-accent bg-accent/15 text-fg"
                : "border-border bg-bg text-muted hover:text-fg",
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-mono",
                isActive ? "bg-accent/30 text-fg" : "bg-border/40 text-muted",
              )}
            >
              {counts[t.id]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function AgentRow({
  agent,
  onOpen,
}: {
  agent: AgentSummary;
  onOpen: () => void;
}) {
  const status = bucket(agent);
  return (
    <li className="border-b border-border/60">
      <button
        onClick={onOpen}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{agent.name}</span>
            {agent.role && (
              <span className="text-[11px] text-muted">{agent.role}</span>
            )}
          </div>
          {agent.title && (
            <p className="truncate text-[11px] text-muted">{agent.title}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge bucket={status} raw={agent.status} />
          {agent.lastHeartbeatAt && (
            <span className="text-[10px] text-muted">
              {formatRelativeTime(agent.lastHeartbeatAt)}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function StatusBadge({
  bucket,
  raw,
}: {
  bucket: AgentBucket;
  raw?: string;
}) {
  if (bucket === "error") return <Badge tone="danger">{raw ?? "error"}</Badge>;
  if (bucket === "paused") return <Badge tone="warn">{raw ?? "paused"}</Badge>;
  // running shows as live, idle as neutral active.
  if (raw === "running") return <Badge tone="info">running</Badge>;
  return <Badge tone="success">{raw ?? "active"}</Badge>;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="flex animate-pulse items-center gap-3 border-b border-border/60 px-3 py-3"
        >
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-border/60" />
            <div className="h-2.5 w-2/3 rounded bg-border/40" />
          </div>
          <div className="h-4 w-12 rounded-full bg-border/50" />
        </li>
      ))}
    </>
  );
}

type AgentBucket = "active" | "paused" | "error";

/**
 * Map server status (and pause flags) to one of four UI buckets.
 *  - `error`: explicit error status.
 *  - `paused`: `pausedAt` set or status reads `paused`/`stopped`.
 *  - `active`: anything else (`idle`, `running`, missing).
 */
function bucket(a: AgentSummary): AgentBucket {
  if (a.status === "error" || a.status === "errored" || a.status === "failed") {
    return "error";
  }
  if (a.pausedAt || a.status === "paused" || a.status === "stopped") {
    return "paused";
  }
  return "active";
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
    <Sheet open onClose={onClose} title="Request hire (approval-only)">
      <p className="mb-3 text-xs text-muted">
        Submits a <code className="font-mono">request_board_approval</code> to the company
        board. Once approved, follow the team&apos;s on-server hiring workflow to actually
        create the agent (skills + adapter config + AGENTS.md). This screen does not
        create the agent itself — the inline new-agent wizard lands in Phase D2.
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
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Backend, QA"
          />
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.isPending || !name.trim()}>
            {submit.isPending ? "Submitting…" : "Submit hire approval"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
