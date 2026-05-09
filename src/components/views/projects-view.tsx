import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { projectsApi } from "@/lib/api/agents";
import { issuesApi } from "@/lib/api/issues";
import { Badge, Button, Card, Input } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { InboxIssue, IssueStatus, Project } from "@/lib/api/types";

const STATUS_TONE: Record<IssueStatus, "neutral" | "info" | "warn" | "danger" | "success"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "info",
  in_review: "warn",
  blocked: "danger",
  done: "success",
  cancelled: "neutral",
};

export function ProjectsView({ onOpenIssue }: { onOpenIssue: (id: string) => void }) {
  const { instance, client, prefix, companyId } = useActiveClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const projects = useQuery<Project[]>({
    queryKey: [prefix, "projects", companyId] as const,
    queryFn: () =>
      client && companyId ? projectsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  if (!client) return null;
  if (!companyId) return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted">Projects</span>
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
          {projects.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
          {projects.isError && (
            <li className="p-3 text-sm text-yellow-300">
              Projects unavailable: {(projects.error as Error).message}
            </li>
          )}
          {projects.data?.length === 0 && (
            <li className="p-3 text-sm text-muted">No projects yet.</li>
          )}
          {projects.data?.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left hover:bg-surface",
                  selectedId === p.id && "bg-surface",
                )}
              >
                <span className="text-sm font-medium">{p.name}</span>
                {p.status && (
                  <span className="text-xs text-muted">{p.status}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-y-auto">
        {selectedId ? (
          <ProjectDetail
            project={projects.data?.find((p) => p.id === selectedId) ?? null}
            onOpenIssue={onOpenIssue}
          />
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <p className="text-sm">Select a project</p>
          </div>
        )}
      </section>

      {showCreate && (
        <CreateProjectModal
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

function ProjectDetail({
  project,
  onOpenIssue,
}: {
  project: Project | null;
  onOpenIssue: (id: string) => void;
}) {
  const { instance, client, prefix, companyId } = useActiveClient();

  const issues = useQuery<InboxIssue[]>({
    queryKey: [prefix, "project-issues", project?.id] as const,
    queryFn: async () => {
      if (!client || !companyId || !project) return [];
      return issuesApi.list(client, companyId, {
        projectId: project.id,
        includeTerminal: true,
        limit: 100,
      });
    },
    enabled: !!client && !!companyId && !!project,
  });

  if (!project) return null;

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{project.name}</h2>
        {project.description && (
          <p className="text-sm text-muted">{project.description}</p>
        )}
        {project.status && <Badge tone="info">{project.status}</Badge>}
      </header>

      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">
          Issues in this project ({issues.data?.length ?? 0})
        </h3>
        {issues.isLoading && <p className="text-sm text-muted">Loading…</p>}
        {issues.data?.length === 0 && (
          <Card>
            <p className="text-sm text-muted">No issues attached to this project yet.</p>
          </Card>
        )}
        <ul className="divide-y divide-border/40 rounded-md border border-border bg-surface text-sm">
          {issues.data?.map((issue) => (
            <li key={issue.id}>
              <button
                onClick={() => onOpenIssue(issue.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-border/30"
              >
                <span className="font-mono text-xs text-muted">{issue.identifier}</span>
                <Badge tone={STATUS_TONE[issue.status]}>{issue.status}</Badge>
                <span className="truncate">{issue.title}</span>
                <span className="ml-auto text-xs text-muted">
                  {formatRelativeTime(issue.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CreateProjectModal({
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
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No active connection");
      return projectsApi.create(client, companyId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: [prefix, "projects", companyId] });
      onCreated(p.id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <Card className="w-full max-w-md space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">New project</h2>
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
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
