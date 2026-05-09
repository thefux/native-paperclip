import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { skillsApi, type SkillDescriptor } from "@/lib/api/skills";
import { Badge, Card } from "@/components/ui";

/**
 * Skills tab — registry browser only. Phase 5 (`/api/skills/registry/search`)
 * shows a phase-stub banner when the route is not yet deployed on this
 * instance.
 *
 * The api-key audit panel that previously shared this file moved to
 * `<AuditView>` (tab=audit) so each tab has a single responsibility.
 */
export function SkillsView() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <SkillsRegistryPanel />
    </div>
  );
}

function SkillsRegistryPanel() {
  const { client, prefix } = useActiveClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const results = useQuery<SkillDescriptor[]>({
    queryKey: [prefix, "skills-registry", debounced] as const,
    queryFn: () =>
      client ? skillsApi.search(client, debounced, { limit: 30 }) : Promise.resolve([]),
    enabled: !!client,
    retry: false,
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          Skills registry
        </span>
        <div className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1 text-sm">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            aria-label="Search skills registry"
            className="w-48 bg-transparent placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      {results.isLoading && <p className="text-sm text-muted">Searching…</p>}

      {results.isError && (
        <Card className="border-yellow-500/40 bg-yellow-500/5 text-sm text-muted">
          Skills registry unavailable on this instance:{" "}
          <code className="text-xs">{(results.error as Error).message}</code>{" "}
          {/* Phase 5 (ROU-41) needs to be deployed for this route to work. */}
        </Card>
      )}

      {results.data?.length === 0 && !results.isLoading && (
        <p className="text-sm text-muted">
          {debounced ? "No matching skills." : "Type to search the registry."}
        </p>
      )}

      <ul className="space-y-2">
        {results.data?.map((s, idx) => (
          <li
            key={s.id ?? `${s.name}-${idx}`}
            className="rounded-md border border-border bg-bg/50 p-2 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.name}</span>
              {s.version && <Badge tone="info">v{s.version}</Badge>}
              {s.source && (
                <span className="font-mono text-xs text-muted">{s.source}</span>
              )}
            </div>
            {s.description && (
              <p className="mt-1 text-xs text-muted">{s.description}</p>
            )}
            {s.tags && s.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {s.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
