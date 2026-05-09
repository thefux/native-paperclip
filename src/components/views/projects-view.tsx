import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { projectsApi } from "@/lib/api/agents";
import { Badge, Button, Card, Input } from "@/components/ui";
import { isMobileShell, useBreakpoint } from "@/lib/use-breakpoint";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useProjectsSubroute } from "@/lib/use-projects-route";
import {
  ProjectDetailView,
  isValidProjectDetailSub,
  type ProjectDetailSub,
} from "@/components/views/project-detail-view";
import type { Project } from "@/lib/api/types";

const DEFAULT_SUB: ProjectDetailSub = "overview";

const STATUS_TONE: Record<string, "neutral" | "info" | "warn" | "danger" | "success"> = {
  planned: "neutral",
  in_progress: "info",
  paused: "warn",
  completed: "success",
  archived: "neutral",
};

/**
 * Projects tab (Phase E1 / [ROU-102](/ROU/issues/ROU-102)).
 *
 * Renders the project list as the root view; tapping a row pushes
 * `#projects/{projectId}/{sub}` via `useProjectsSubroute`. The detail page
 * itself owns the five sub-tabs and the back gesture.
 *
 * Mobile (sm + md): single-pane stack. Detail replaces the list.
 * Desktop (lg+): two-pane — left list rail (max-w-3xl content) + right detail
 * pane. The left rail stays visible during detail navigation so users can
 * jump between projects without popping back.
 */
export function ProjectsView({ onOpenIssue }: { onOpenIssue: (id: string) => void }) {
  const { client, prefix, companyId } = useActiveClient();
  const subroute = useProjectsSubroute();
  const bp = useBreakpoint();
  const isMobile = isMobileShell(bp);
  const [showCreate, setShowCreate] = useState(false);

  const projects = useQuery<Project[]>({
    queryKey: [prefix, "projects", companyId] as const,
    queryFn: () =>
      client && companyId ? projectsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  if (!client) return null;
  if (!companyId)
    return <div className="p-3 text-sm text-muted">No company selected.</div>;

  const route = subroute.route;
  const detailProjectId = route.kind === "detail" ? route.projectId : null;
  const rawSub = route.kind === "detail" ? route.sub : null;
  const detailSub: ProjectDetailSub = isValidProjectDetailSub(rawSub)
    ? rawSub
    : DEFAULT_SUB;

  const list = (
    <ProjectsList
      projects={projects.data ?? []}
      isLoading={projects.isLoading}
      isError={projects.isError}
      error={projects.error as Error | null}
      activeId={detailProjectId}
      onSelect={(id) => subroute.enterDetail(id, DEFAULT_SUB)}
      onNew={() => setShowCreate(true)}
    />
  );

  if (isMobile) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {detailProjectId ? (
          <ProjectDetailView
            projectId={detailProjectId}
            sub={detailSub}
            onSubChange={(s) => subroute.setSub(s)}
            onBack={() => subroute.exitDetail()}
            onOpenIssue={onOpenIssue}
          />
        ) : (
          list
        )}
        {showCreate && !detailProjectId && (
          <CreateProjectModal
            companyId={companyId}
            onClose={() => setShowCreate(false)}
            onCreated={(id) => {
              setShowCreate(false);
              subroute.enterDetail(id, DEFAULT_SUB);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-80 shrink-0 border-r border-border">{list}</aside>
      <section className="min-w-0 flex-1">
        {detailProjectId ? (
          <ProjectDetailView
            projectId={detailProjectId}
            sub={detailSub}
            onSubChange={(s) => subroute.setSub(s)}
            onBack={() => subroute.exitDetail()}
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
            subroute.enterDetail(id, DEFAULT_SUB);
          }}
        />
      )}
    </div>
  );
}

function ProjectsList({
  projects,
  isLoading,
  isError,
  error,
  activeId,
  onSelect,
  onNew,
}: {
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">Projects</span>
        <Button
          variant="ghost"
          className="ml-auto px-2 py-0.5 text-xs"
          onClick={onNew}
        >
          <Plus size={12} className="mr-1" />
          New
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {isLoading && (
          <>
            <ListSkeleton />
            <ListSkeleton />
            <ListSkeleton />
          </>
        )}
        {isError && (
          <li className="p-3 text-sm text-yellow-300">
            Projects unavailable: {error?.message ?? "unknown error"}
          </li>
        )}
        {!isLoading && !isError && projects.length === 0 && (
          <li className="p-4 text-center text-sm text-muted">
            No projects yet. Create one to get started.
          </li>
        )}
        {projects.map((p) => (
          <li key={p.id}>
            <ProjectRow
              project={p}
              active={p.id === activeId}
              onSelect={() => onSelect(p.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectRow({
  project,
  active,
  onSelect,
}: {
  project: Project;
  active: boolean;
  onSelect: () => void;
}) {
  const tone = project.status ? (STATUS_TONE[project.status] ?? "neutral") : "neutral";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left hover:bg-surface",
        active && "bg-surface",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {project.color && (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
          )}
          <span className="truncate text-sm font-medium">{project.name}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
          {project.status && <Badge tone={tone}>{project.status}</Badge>}
          {project.archivedAt && <Badge tone="neutral">archived</Badge>}
          {project.updatedAt && (
            <span className="truncate">{formatRelativeTime(project.updatedAt)}</span>
          )}
        </div>
      </div>
      <ChevronRight size={14} className="mt-1 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

function ListSkeleton() {
  return (
    <li className="border-b border-border/60 px-3 py-2.5">
      <div className="h-3 w-3/4 animate-pulse rounded bg-border/40" />
      <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-border/30" />
    </li>
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
