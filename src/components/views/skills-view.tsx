import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { skillsApi, type SkillDescriptor } from "@/lib/api/skills";
import { apiKeysApi, type CompanyApiKey } from "@/lib/api/api-keys";
import { Badge, Card } from "@/components/ui";
import type { AuditEntry } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/utils";

/**
 * Combined "Audit + Skills" tab — two stacked panes:
 *  - Skills registry browser (Phase 5, /api/skills/registry/search). Shows
 *    a phase-stub banner when the route is not deployed yet.
 *  - Per-api-key audit log (Phase 6, /api/companies/:cid/api-keys/:id/audit-log).
 *    The pck_ token in use is auto-selected from the keys list when its
 *    tokenLastEight matches; otherwise the user picks any key to inspect.
 */
export function SkillsView() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <SkillsRegistryPanel />
      <ApiKeyAuditPanel />
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
  if (!companyId)
    return null;

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
