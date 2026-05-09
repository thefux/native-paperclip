import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { apiKeysApi, type CompanyApiKey } from "@/lib/api/api-keys";
import { Card } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditEntry } from "@/lib/api/types";

/**
 * Per-API-key audit log panel. Originally lived inside `<AuditView>` (Phase 6 /
 * ROU-42); extracted in Phase C1 (ROU-98) so it can be reused inside the
 * Company Settings → API Keys drilldown without duplicating the query/render
 * logic.
 *
 * When `keyId` is provided the panel renders the audit log for that key
 * directly. When omitted, it falls back to the original AuditView behaviour:
 * list every key on the company and let the user pick one from a dropdown.
 */
export function ApiKeyAuditPanel({ keyId: forcedKeyId }: { keyId?: string } = {}) {
  const { client, prefix, companyId } = useActiveClient();
  const [selectedKey, setSelectedKey] = useState<string>(forcedKeyId ?? "");

  // Keep the dropdown in sync if the parent flips the forced key.
  useEffect(() => {
    if (forcedKeyId) setSelectedKey(forcedKeyId);
  }, [forcedKeyId]);

  const showPicker = !forcedKeyId;

  const keys = useQuery<CompanyApiKey[]>({
    queryKey: [prefix, "api-keys", companyId] as const,
    queryFn: () =>
      client && companyId ? apiKeysApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId && showPicker,
    retry: false,
  });

  // Default-select the first key when in picker mode.
  useEffect(() => {
    if (forcedKeyId) return;
    if (!selectedKey && keys.data && keys.data.length > 0) {
      setSelectedKey(keys.data[0].id);
    }
  }, [selectedKey, keys.data, forcedKeyId]);

  const audit = useQuery<AuditEntry[]>({
    queryKey: [prefix, "api-keys", companyId, selectedKey, "audit"] as const,
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
        {showPicker && keys.data && keys.data.length > 0 && (
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            aria-label="Filter by API key"
            className="ml-auto rounded border border-border bg-bg px-2 py-1 text-sm"
          >
            {keys.data.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
                {keyTrailLabel(k) ? ` · ${keyTrailLabel(k)}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {showPicker && keys.isError && (
        <p className="text-xs text-yellow-300">
          API keys unavailable: {(keys.error as Error).message}
        </p>
      )}

      {showPicker && keys.data?.length === 0 && (
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

/** Returns "pck_xxx…" or "…12345678" depending on which field the server populated. */
function keyTrailLabel(k: CompanyApiKey): string {
  if (k.prefix) return k.prefix;
  if (k.tokenLastEight) return `…${k.tokenLastEight}`;
  return "";
}
