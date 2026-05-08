import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { ApiError, createClient } from "@/lib/api/client";
import { layers, unwrapAudit } from "@/lib/api/layers";
import { Badge, Button, Card } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditEntry, Layer, LayerTypeDescriptor } from "@/lib/api/types";
import { ArrowDown, ArrowUp, Save, Trash2 } from "lucide-react";

interface AgentSummary {
  id: string;
  name: string;
  role?: string;
}

export function LayersView() {
  const active = useInstanceStore((s) => s.active());
  const client = useMemo(() => (active ? createClient(active) : null), [active]);
  const companyId = active?.identity?.companyId ?? active?.defaultCompanyId ?? "";
  const [agentId, setAgentId] = useState<string>(active?.identity?.id ?? "");
  const [layerFilter, setLayerFilter] = useState<string>("");

  const agents = useQuery<AgentSummary[]>({
    queryKey: ["agents", client?.baseUrl, companyId] as const,
    queryFn: async () =>
      client && companyId ? client.get<AgentSummary[]>(`/api/companies/${companyId}/agents`) : [],
    enabled: !!client && !!companyId,
  });

  if (!client || !companyId) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">Layers</span>
        <select
          className="rounded border border-border bg-bg px-2 py-1 text-sm"
          value={agentId}
          onChange={(e) => {
            setAgentId(e.target.value);
            setLayerFilter("");
          }}
        >
          <option value="">— pick agent —</option>
          {agents.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!agentId && (
          <p className="text-sm text-muted">Pick an agent above to view their layer stack.</p>
        )}
        {agentId && (
          <LayersForAgent
            agentId={agentId}
            layerFilter={layerFilter}
            setLayerFilter={setLayerFilter}
          />
        )}
      </div>
    </div>
  );
}

function LayersForAgent({
  agentId,
  layerFilter,
  setLayerFilter,
}: {
  agentId: string;
  layerFilter: string;
  setLayerFilter: (v: string) => void;
}) {
  const active = useInstanceStore((s) => s.active());
  const client = useMemo(() => (active ? createClient(active) : null), [active]);
  const qc = useQueryClient();

  const types = useQuery<LayerTypeDescriptor[]>({
    queryKey: ["layer-types", client?.baseUrl] as const,
    queryFn: async () => (client ? (await layers.listTypes(client)).types : []),
    enabled: !!client,
  });

  const stack = useQuery<Layer[]>({
    queryKey: ["layers", client?.baseUrl, agentId] as const,
    queryFn: async () => (client ? (await layers.listForAgent(client, agentId)).layers : []),
    enabled: !!client && !!agentId,
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!client) throw new Error("No client");
      return layers.reorder(client, agentId, orderedIds);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["layers", client?.baseUrl, agentId] }),
  });

  function moveLayer(idx: number, delta: -1 | 1) {
    const list = stack.data ?? [];
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    reorder.mutate(next.map((l) => l.id));
  }

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">Stack</h3>
        {stack.isLoading && <p className="text-sm text-muted">Loading…</p>}
        {stack.error && (
          <p className="text-sm text-red-400">{(stack.error as Error).message}</p>
        )}
        {stack.data && stack.data.length === 0 && (
          <Card>
            <p className="text-sm text-muted">No layers configured.</p>
          </Card>
        )}
        <div className="space-y-2">
          {stack.data?.map((layer, idx) => (
            <LayerCard
              key={layer.id}
              layer={layer}
              agentId={agentId}
              isFirst={idx === 0}
              isLast={idx === (stack.data?.length ?? 0) - 1}
              onMoveUp={() => moveLayer(idx, -1)}
              onMoveDown={() => moveLayer(idx, 1)}
              onSelect={() => setLayerFilter(layer.layerType)}
            />
          ))}
        </div>
      </section>

      <AddLayerForm agentId={agentId} types={types.data ?? []} />

      <AuditLogPanel agentId={agentId} layerFilter={layerFilter} />
    </div>
  );
}

function LayerCard({
  layer,
  agentId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onSelect,
}: {
  layer: Layer;
  agentId: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSelect: () => void;
}) {
  const active = useInstanceStore((s) => s.active());
  const client = useMemo(() => (active ? createClient(active) : null), [active]);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftConfig, setDraftConfig] = useState(JSON.stringify(layer.config ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: async (body: { config?: Record<string, unknown>; enabled?: boolean }) => {
      if (!client) throw new Error("No client");
      return layers.update(client, agentId, layer.id, body);
    },
    onSuccess: () => {
      setError(null);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["layers", client?.baseUrl, agentId] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string } | undefined;
        setError(body?.message ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No client");
      return layers.remove(client, agentId, layer.id);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["layers", client?.baseUrl, agentId] }),
  });

  function saveConfig() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draftConfig);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("config must be a JSON object");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }
    update.mutate({ config: parsed });
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">#{layer.position}</span>
        <Badge tone="info">{layer.layerType}</Badge>
        <Badge tone={layer.enabled ? "success" : "neutral"}>
          {layer.enabled ? "enabled" : "disabled"}
        </Badge>
        <span className="ml-auto text-xs text-muted">
          updated {formatRelativeTime(layer.updatedAt)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <Button
          variant="ghost"
          className="px-1.5 py-1"
          aria-label="Move up"
          onClick={onMoveUp}
          disabled={isFirst}
        >
          <ArrowUp size={12} />
        </Button>
        <Button
          variant="ghost"
          className="px-1.5 py-1"
          aria-label="Move down"
          onClick={onMoveDown}
          disabled={isLast}
        >
          <ArrowDown size={12} />
        </Button>
        <Button
          variant="ghost"
          className="px-1.5 py-1"
          onClick={() => update.mutate({ enabled: !layer.enabled })}
          disabled={update.isPending}
        >
          {layer.enabled ? "Disable" : "Enable"}
        </Button>
        <Button
          variant="ghost"
          className="px-1.5 py-1"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Cancel" : "Edit config"}
        </Button>
        <Button
          variant="ghost"
          className="px-1.5 py-1"
          onClick={onSelect}
          aria-label="Filter audit log"
        >
          Audit ↓
        </Button>
        <Button
          variant="danger"
          className="px-1.5 py-1"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label="Delete layer"
        >
          <Trash2 size={12} />
        </Button>
      </div>
      {editing && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs"
            rows={6}
            value={draftConfig}
            onChange={(e) => setDraftConfig(e.target.value)}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button onClick={saveConfig} disabled={update.isPending}>
            <Save size={12} className="mr-1" />
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function AddLayerForm({ agentId, types }: { agentId: string; types: LayerTypeDescriptor[] }) {
  const active = useInstanceStore((s) => s.active());
  const client = useMemo(() => (active ? createClient(active) : null), [active]);
  const qc = useQueryClient();
  const [layerType, setLayerType] = useState<string>(types[0]?.type ?? "audit");
  const [config, setConfig] = useState("{}");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No client");
      let cfg: Record<string, unknown> = {};
      try {
        cfg = JSON.parse(config || "{}");
      } catch (err) {
        throw err instanceof Error ? err : new Error("Invalid JSON");
      }
      return layers.create(client, agentId, { layerType, config: cfg });
    },
    onSuccess: () => {
      setError(null);
      setConfig("{}");
      qc.invalidateQueries({ queryKey: ["layers", client?.baseUrl, agentId] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string } | undefined;
        setError(body?.message ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed");
      }
    },
  });

  const selected = types.find((t) => t.type === layerType);

  return (
    <Card className="space-y-2">
      <header className="text-sm font-medium">Add layer</header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-2 text-sm"
      >
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-border bg-bg px-2 py-1"
            value={layerType}
            onChange={(e) => setLayerType(e.target.value)}
          >
            {(types.length
              ? types
              : ([
                  { type: "identity", label: "identity" },
                  { type: "payment", label: "payment" },
                  { type: "audit", label: "audit" },
                  { type: "defence", label: "defence" },
                ] as LayerTypeDescriptor[])
            ).map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
          {selected && (
            <span className="text-xs text-muted">{selected.configSchemaSummary}</span>
          )}
        </div>
        <textarea
          className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs"
          rows={4}
          value={config}
          onChange={(e) => setConfig(e.target.value)}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add layer"}
        </Button>
      </form>
    </Card>
  );
}

function AuditLogPanel({ agentId, layerFilter }: { agentId: string; layerFilter: string }) {
  const active = useInstanceStore((s) => s.active());
  const client = useMemo(() => (active ? createClient(active) : null), [active]);

  const audit = useQuery<AuditEntry[]>({
    queryKey: ["layer-audit", client?.baseUrl, agentId] as const,
    queryFn: async () =>
      client ? unwrapAudit(await layers.audit(client, agentId, 50)) : [],
    enabled: !!client && !!agentId,
    retry: false,
  });

  let body: React.ReactNode;
  if (audit.isLoading) {
    body = <p className="text-sm text-muted">Loading…</p>;
  } else if (audit.error) {
    const err = audit.error as Error;
    const status = err instanceof ApiError ? err.status : null;
    if (status === 404 || status === 501) {
      body = (
        <p className="text-xs text-muted">
          Per-agent audit-log read endpoint is not deployed on this instance yet. The
          `audit_log` table is populated by the audit layer; the desktop reader will
          light up once the backend ships <code>/api/agents/:id/audit-log</code>.
        </p>
      );
    } else {
      body = <p className="text-sm text-red-400">{err.message}</p>;
    }
  } else {
    const filtered = (audit.data ?? []).filter(
      (e) => !layerFilter || e.kind.includes(layerFilter),
    );
    body = filtered.length === 0 ? (
      <p className="text-sm text-muted">
        No audit entries{layerFilter ? ` for ${layerFilter}` : ""}.
      </p>
    ) : (
      <ul className="divide-y divide-border/60">
        {filtered.map((entry) => (
          <li key={entry.id} className="py-2 text-xs">
            <div className="flex items-center gap-2 text-muted">
              <Badge tone="neutral">{entry.direction}</Badge>
              <span className="font-mono">{entry.kind}</span>
              <span className="ml-auto">{formatRelativeTime(entry.createdAt)}</span>
            </div>
            <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-surface px-2 py-1 font-mono">
              {JSON.stringify(entry.redactedBody ?? entry.body, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="space-y-2">
      <header className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Audit log</h3>
        {layerFilter && (
          <Badge tone="info" className="ml-auto">
            filter: {layerFilter}
          </Badge>
        )}
      </header>
      {body}
    </Card>
  );
}
