
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { agentsApi } from "@/lib/api/agents";
import {
  routinesApi,
  type CreateRoutineInput,
  type RoutineTriggerInput,
} from "@/lib/api/routines";
import { ApiError } from "@/lib/api/client";
import { Badge, Button, Card, Input } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { AgentSummary, Routine } from "@/lib/api/types";

export function RoutinesView() {
  const { instance, client, prefix, companyId } = useActiveClient();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const routines = useQuery<Routine[]>({
    queryKey: [prefix, "routines", companyId] as const,
    queryFn: () =>
      client && companyId ? routinesApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
  });

  const triggerNow = useMutation({
    mutationFn: async (id: string) => {
      if (!client) throw new Error("No active connection");
      return routinesApi.triggerNow(client, id);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [prefix, "routines", companyId] }),
  });

  if (!client) return null;
  if (!companyId) return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted">Routines</span>
          <Button
            variant="ghost"
            className="ml-auto px-2 py-0.5 text-xs"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={12} className="mr-1" />
            New
          </Button>
        </div>
        <ul className="overflow-y-auto">
          {routines.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
          {routines.data?.length === 0 && (
            <li className="p-3 text-sm text-muted">No routines.</li>
          )}
          {routines.data?.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left hover:bg-surface",
                  selectedId === r.id && "bg-surface",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="text-sm font-medium">{r.name}</span>
                  <Badge tone={r.status === "active" ? "success" : "neutral"}>
                    {r.status}
                  </Badge>
                </div>
                <span className="text-xs text-muted">
                  Updated {formatRelativeTime(r.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-y-auto">
        {selectedId ? (
          <RoutineDetailPanel
            routine={routines.data?.find((r) => r.id === selectedId) ?? null}
            onTriggerNow={() => triggerNow.mutate(selectedId)}
            triggerPending={triggerNow.isPending}
          />
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <p className="text-sm">Select a routine</p>
          </div>
        )}
      </section>

      {showCreate && (
        <CreateRoutineModal
          companyId={companyId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function RoutineDetailPanel({
  routine,
  onTriggerNow,
  triggerPending,
}: {
  routine: Routine | null;
  onTriggerNow: () => void;
  triggerPending: boolean;
}) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(routine?.name ?? "");
  const [draftDesc, setDraftDesc] = useState(routine?.description ?? "");

  const patch = useMutation({
    mutationFn: async (
      body: Partial<CreateRoutineInput & { status: "active" | "paused" | "archived" }>,
    ) => {
      if (!client || !routine) throw new Error("No routine");
      return routinesApi.patch(client, routine.id, body);
    },
    onSuccess: () => {
      setError(null);
      setEditing(false);
      qc.invalidateQueries({ queryKey: [prefix, "routines"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const b = err.body as { message?: string; error?: string } | undefined;
        setError(b?.message ?? b?.error ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!client || !routine) throw new Error("No routine");
      return routinesApi.delete(client, routine.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [prefix, "routines"] });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Failed to delete routine"),
  });

  if (!routine) return null;

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          {editing ? (
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          ) : (
            <h2 className="text-xl font-semibold">{routine.name}</h2>
          )}
          <Badge tone={routine.status === "active" ? "success" : "neutral"}>
            {routine.status}
          </Badge>
        </div>
        <p className="text-xs text-muted">
          {routine.identifier ? `${routine.identifier} · ` : ""}
          updated {formatRelativeTime(routine.updatedAt)}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onTriggerNow} disabled={triggerPending}>
          {triggerPending ? "Triggering…" : "Run now"}
        </Button>
        {routine.status === "active" ? (
          <Button
            variant="ghost"
            onClick={() => patch.mutate({ status: "paused" })}
            disabled={patch.isPending}
          >
            Pause
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => patch.mutate({ status: "active" })}
            disabled={patch.isPending}
          >
            Resume
          </Button>
        )}
        {editing ? (
          <>
            <Button
              onClick={() =>
                patch.mutate({
                  name: draftName.trim() || routine.name,
                  description: draftDesc.trim() || undefined,
                })
              }
              disabled={patch.isPending || !draftName.trim()}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraftName(routine.name);
                setDraftDesc(routine.description ?? "");
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(true);
              setDraftName(routine.name);
              setDraftDesc(routine.description ?? "");
            }}
          >
            Edit
          </Button>
        )}
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm(`Delete routine "${routine.name}"?`)) {
              remove.mutate();
            }
          }}
          disabled={remove.isPending}
          className="ml-auto"
        >
          Delete
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-muted">Description</div>
        {editing ? (
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            rows={3}
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm">
            {routine.description ?? <span className="text-muted">(no description)</span>}
          </p>
        )}
      </Card>

      {routine.triggers && routine.triggers.length > 0 && (
        <Card className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted">Triggers</div>
          <ul className="space-y-1 text-xs">
            {routine.triggers.map((t, idx) => (
              <li key={`${t.type}-${idx}`} className="flex items-center gap-2">
                <Badge tone="info">{t.type}</Badge>
                {t.cron && (
                  <code className="font-mono">{t.cron}</code>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function CreateRoutineModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cron, setCron] = useState("");
  const [agentId, setAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const agents = useQuery<AgentSummary[]>({
    queryKey: [prefix, "agents", companyId] as const,
    queryFn: () =>
      client && companyId ? agentsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No active connection");
      const triggers: RoutineTriggerInput[] = cron.trim()
        ? [{ type: "schedule", cron: cron.trim() }]
        : [];
      return routinesApi.create(client, companyId, {
        name: name.trim(),
        description: description.trim() || undefined,
        agentId: agentId || undefined,
        triggers,
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [prefix, "routines", companyId] });
      onCreated(r.id);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const b = err.body as { message?: string; error?: string } | undefined;
        setError(b?.message ?? b?.error ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create routine");
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <Card className="w-full max-w-md space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">New routine</h2>
          <Button variant="ghost" className="ml-auto text-xs" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              setError("Name is required");
              return;
            }
            setError(null);
            create.mutate();
          }}
          className="space-y-3"
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Description</span>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Agent</span>
            <select
              className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">— pick agent —</option>
              {agents.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.role ? ` · ${a.role}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">
              Schedule (cron, optional) <span className="text-xs">e.g. <code>0 9 * * 1-5</code></span>
            </span>
            <Input
              placeholder="empty = api/webhook trigger only"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? "Creating…" : "Create routine"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
