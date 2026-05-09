import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { agentsApi } from "@/lib/api/agents";
import { apiKeysApi, type CompanyApiKey } from "@/lib/api/api-keys";
import { Badge, Card } from "@/components/ui";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { AgentSummary, AuditEntry } from "@/lib/api/types";

/**
 * Audit tab — two stacked panels:
 *  - Agent audit-log (Phase 7, ROU-57) on top: broader signal, scoped to the
 *    selected agent. Wired to `GET /api/agents/:agentId/audit-log` (the actual
 *    route that ROU-57 shipped). The plan referenced
 *    `/api/companies/:cid/agent-audit-log`, which doesn't exist on master
 *    `0391dd20`; if/when that aggregate route lands the panel can collapse the
 *    agent picker into "all agents."
 *  - Per-api-key audit-log (Phase 6) below: kept as-is from the previous
 *    SkillsView so we don't regress the existing pck_ inspection workflow.
 *
 * The Skills registry browser stays in `<SkillsView>` (tab=skills); this file
 * exists so `tab=audit` no longer mounts a misleadingly-named component.
 */
export function AuditView() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <AgentAuditLogPanel />
      <ApiKeyAuditPanel />
    </div>
  );
}

const DIRECTION_TONE: Record<string, "neutral" | "info" | "warn" | "success"> = {
  inbound: "info",
  in: "info",
  outbound: "success",
  out: "success",
};

function AgentAuditLogPanel() {
  const { instance, client, prefix } = useActiveClient();
  const companyId = instance?.defaultCompanyId ?? instance?.identity?.companyId ?? "";
  const myAgentId = instance?.identity?.id ?? "";

  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const agents = useQuery<AgentSummary[]>({
    queryKey: [prefix, "agents", companyId] as const,
    queryFn: () =>
      client && companyId ? agentsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  useEffect(() => {
    if (selectedAgent) return;
    if (myAgentId && agents.data?.some((a) => a.id === myAgentId)) {
      setSelectedAgent(myAgentId);
      return;
    }
    if (agents.data && agents.data.length > 0) {
      setSelectedAgent(agents.data[0].id);
    }
  }, [selectedAgent, myAgentId, agents.data]);

  const audit = useQuery<AuditEntry[]>({
    queryKey: [prefix, "agent-audit-log", selectedAgent] as const,
    queryFn: () =>
      client && selectedAgent
        ? agentsApi.auditLog(client, selectedAgent, { limit: 200 })
        : Promise.resolve([]),
    enabled: !!client && !!selectedAgent,
    retry: false,
  });

  const agentById = useMemo(() => {
    const map = new Map<string, AgentSummary>();
    agents.data?.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents.data]);

  const filteredEntries = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return audit.data ?? [];
    return (audit.data ?? []).filter((entry) => {
      const haystack = [
        entry.kind,
        entry.direction,
        agentById.get(entry.agentId ?? "")?.name ?? "",
        JSON.stringify(entry.redactedBody ?? entry.body ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [audit.data, filter, agentById]);

  if (!client) return null;
  if (!companyId) return null;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          Agent audit log
        </span>
        <select
          value={selectedAgent}
          onChange={(e) => {
            setSelectedAgent(e.target.value);
            setOpenEntryId(null);
          }}
          aria-label="Filter by agent"
          className="rounded border border-border bg-bg px-2 py-1 text-sm"
        >
          {agents.data?.length === 0 && <option value="">No agents</option>}
          {agents.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.role ? ` · ${a.role}` : ""}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1 text-sm">
          <Search size={14} className="text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter audit entries"
            className="w-40 bg-transparent placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      {agents.isError && (
        <p className="text-xs text-yellow-300">
          Agents unavailable: {(agents.error as Error).message}
        </p>
      )}
      {audit.isError && (
        <Card className="border-yellow-500/40 bg-yellow-500/5 text-sm text-muted">
          Agent audit-log unavailable on this instance:{" "}
          <code className="text-xs">{(audit.error as Error).message}</code>
          {/* Phase 7 (ROU-57) needs to be deployed for this route. */}
        </Card>
      )}

      {audit.isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!audit.isLoading && filteredEntries.length === 0 && (
        <p className="text-sm text-muted">
          {filter
            ? "No entries match the filter."
            : "No audit entries for this agent yet."}
        </p>
      )}

      {filteredEntries.length > 0 && (
        <ul className="max-h-96 space-y-1 overflow-y-auto">
          {filteredEntries.map((entry) => {
            const isOpen = openEntryId === entry.id;
            const agent = agentById.get(entry.agentId ?? "");
            const tone = DIRECTION_TONE[entry.direction] ?? "neutral";
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setOpenEntryId(isOpen ? null : entry.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    "flex w-full items-center gap-2 rounded border border-border/60 bg-bg/50 px-2 py-1.5 text-left text-xs hover:bg-bg",
                    isOpen && "bg-bg",
                  )}
                >
                  {isOpen ? (
                    <ChevronDown size={12} className="text-muted" aria-hidden />
                  ) : (
                    <ChevronRight size={12} className="text-muted" aria-hidden />
                  )}
                  <span className="text-muted">{formatRelativeTime(entry.createdAt)}</span>
                  <span className="truncate font-medium text-fg">
                    {agent?.name ?? entry.agentId ?? "—"}
                  </span>
                  <Badge tone={tone}>{entry.direction}</Badge>
                  <span className="font-mono text-[11px] text-fg">{entry.kind}</span>
                </button>
                {isOpen && (
                  <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-border/40 bg-bg/40 p-2 font-mono text-[11px]">
                    {JSON.stringify(entry.redactedBody ?? entry.body, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ApiKeyAuditPanel() {
  const { instance, client, prefix } = useActiveClient();
  const companyId = instance?.defaultCompanyId ?? instance?.identity?.companyId ?? "";
  const [selectedKey, setSelectedKey] = useState<string>("");

  const keys = useQuery<CompanyApiKey[]>({
    queryKey: [prefix, "api-keys", companyId] as const,
    queryFn: () =>
      client && companyId
        ? apiKeysApi.list(client, companyId)
        : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  // Default-select the first key.
  useEffect(() => {
    if (!selectedKey && keys.data && keys.data.length > 0) {
      setSelectedKey(keys.data[0].id);
    }
  }, [selectedKey, keys.data]);

  const audit = useQuery<AuditEntry[]>({
    queryKey: [prefix, "api-key-audit", companyId, selectedKey] as const,
    queryFn: () =>
      client && companyId && selectedKey
        ? apiKeysApi.auditLog(client, companyId, selectedKey, { limit: 100 })
        : Promise.resolve([]),
    enabled: !!client && !!companyId && !!selectedKey,
    retry: false,
  });

  if (!client) return null;
  if (!companyId) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          API key audit log
        </span>
        {keys.data && keys.data.length > 0 && (
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            aria-label="Filter by API key"
            className="ml-auto rounded border border-border bg-bg px-2 py-1 text-sm"
          >
            {keys.data.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
                {k.tokenLastEight ? ` · …${k.tokenLastEight}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {keys.isError && (
        <p className="text-xs text-yellow-300">
          API keys unavailable: {(keys.error as Error).message}
        </p>
      )}

      {keys.data?.length === 0 && (
        <p className="text-sm text-muted">
          No API keys on this company. Create one from the company settings page on
          the server.
        </p>
      )}

      {audit.isError && (
        <p className="text-xs text-yellow-300">
          Audit log unavailable: {(audit.error as Error).message}
        </p>
      )}

      {audit.data?.length === 0 && selectedKey && (
        <p className="text-sm text-muted">
          No requests recorded for this key yet.
        </p>
      )}

      {audit.data && audit.data.length > 0 && (
        <ul className="max-h-96 space-y-1 overflow-y-auto">
          {audit.data.map((entry) => (
            <li
              key={entry.id}
              className="rounded border border-border bg-bg/50 p-2 text-xs"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                <span className="font-mono">{entry.kind}</span>
                <span>·</span>
                <span>{entry.direction}</span>
                <span className="ml-auto">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {JSON.stringify(entry.redactedBody ?? entry.body, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
