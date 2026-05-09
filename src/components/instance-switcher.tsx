
import { ChevronDown, Plus, Server } from "lucide-react";
import { useMemo, useState } from "react";
import { useInstanceStore, type Instance } from "@/lib/store/instances";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { cn } from "@/lib/utils";

/**
 * Switcher for Paperclip *server connections* (a.k.a. "instances"). One
 * connection holds an API key and points at exactly one Paperclip server, but
 * may surface one or more *companies* on that server (board-user keys span
 * multiple companies; `pck_…` keys are bound to one).
 *
 * For switching between companies on the same connection, use the
 * `<CompanyChip>` rendered next to this switcher in the header.
 */
export function InstanceSwitcher() {
  const instances = useInstanceStore((s) => s.instances);
  const activeId = useInstanceStore((s) => s.activeId);
  const setActive = useInstanceStore((s) => s.setActive);
  const remove = useInstanceStore((s) => s.remove);
  const [open, setOpen] = useState(false);
  const [addingHost, setAddingHost] = useState<string | null>(null);

  const active = instances.find((i) => i.id === activeId);

  const otherConnectionsOnSameHost = useMemo(() => {
    if (!active) return [] as Instance[];
    const host = safeHost(active.baseUrl);
    return instances.filter(
      (i) => i.id !== active.id && safeHost(i.baseUrl) === host,
    );
  }, [instances, active]);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-sm hover:bg-surface"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              active?.health === "degraded" ? "bg-yellow-400" : "bg-green-500",
            )}
            aria-hidden
          />
          <Server size={12} className="text-muted" aria-hidden />
          <span className="truncate max-w-[10rem] sm:max-w-[16rem]">
            {connectionLabel(active) ?? "Select connection"}
          </span>
          <ChevronDown size={14} className="text-muted" />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Server connections"
            className="absolute left-0 top-full z-10 mt-1 w-[22rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg"
            onMouseLeave={() => setOpen(false)}
          >
            <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wide text-muted">
              Server connections — each is one Paperclip server (may host many companies).
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {instances.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => {
                      setActive(i.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-border/40",
                      activeId === i.id && "bg-border/30",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                            i.health === "degraded" ? "bg-yellow-400" : "bg-green-500",
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{connectionLabel(i)}</span>
                      </div>
                      <div className="ml-3 truncate text-xs text-muted">
                        {detailLineFor(i)}
                      </div>
                    </div>
                    <button
                      aria-label={`Forget ${connectionLabel(i)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(i.id);
                      }}
                      className="ml-2 rounded p-1 text-xs text-muted hover:text-red-400"
                    >
                      ✕
                    </button>
                  </button>
                </li>
              ))}
            </ul>

            {active && (
              <button
                onClick={() => {
                  setAddingHost(active.baseUrl);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 border-t border-border bg-bg px-3 py-2 text-left text-xs text-muted hover:bg-border/30"
              >
                <Plus size={12} />
                Add another connection on{" "}
                <span className="font-mono text-fg/80">{safeHost(active.baseUrl)}</span>
                {otherConnectionsOnSameHost.length > 0 && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide">
                    {otherConnectionsOnSameHost.length} connected
                  </span>
                )}
              </button>
            )}

            <div className="border-t border-border bg-bg px-3 py-2 text-xs text-muted">
              Each <code className="font-mono">pck_…</code> API key is its own
              connection. To switch between companies on the same connection
              (board-user keys only), use the Company chip in the header.
            </div>
          </div>
        )}
      </div>

      {addingHost && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
          <OnboardingScreen
            prefillBaseUrl={addingHost}
            onCancel={() => setAddingHost(null)}
          />
        </div>
      )}
    </>
  );
}

function connectionLabel(i: Instance | undefined): string | undefined {
  if (!i) return undefined;
  // Prefer the connection's own label / host, since the active company name now
  // lives in the dedicated company chip. Falls back to "<companyName> @ <host>"
  // when the connection wasn't given an explicit label and we want at least
  // something recognisable in the trigger.
  if (i.label && !i.label.includes("@")) return i.label;
  if (i.identity?.companyName) {
    return `${i.identity.companyName} @ ${safeHost(i.baseUrl)}`;
  }
  return safeHost(i.baseUrl);
}

function detailLineFor(i: Instance): string {
  const parts: string[] = [];
  const companies = i.accessibleCompanies?.length ?? 0;
  if (companies > 1) parts.push(`${companies} companies`);
  if (i.identity?.displayName) parts.push(i.identity.displayName);
  if (i.identity?.role) parts.push(i.identity.role);
  if (parts.length === 0) parts.push(i.baseUrl);
  return parts.join(" · ");
}

function safeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
