import { AlertTriangle } from "lucide-react";
import { useInstanceStore } from "@/lib/store/instances";
import { Button } from "@/components/ui";

/**
 * Inline banner shown whenever the active connection is `degraded`. Triggered
 * by 401/403 responses observed by the api client (via `useActiveClient` /
 * `flagInstanceDegraded`). Removing the connection re-opens the onboarding
 * screen; clearing the flag without a re-onboard is intentionally not offered.
 */
export function ConnectionHealthBanner() {
  const active = useInstanceStore((s) => s.active());
  const remove = useInstanceStore((s) => s.remove);

  if (!active || active.health !== "degraded") return null;

  const host = active.identity?.companyName
    ? `${active.identity.companyName} @ ${safeHost(active.baseUrl)}`
    : safeHost(active.baseUrl);

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200"
    >
      <AlertTriangle size={14} />
      <div className="flex flex-1 flex-col">
        <span className="font-medium">Connection unauthorized</span>
        <span className="text-xs text-yellow-200/80">
          The API key for <span className="font-mono">{host}</span> was rejected (401/403).
          Re-paste it from the company API-keys page or remove this connection.
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="text-xs"
        onClick={() => remove(active.id)}
      >
        Remove connection
      </Button>
    </div>
  );
}

function safeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
