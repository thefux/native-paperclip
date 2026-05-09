
import { ChevronDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useInstanceStore, type Instance } from "@/lib/store/instances";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { cn } from "@/lib/utils";

export function InstanceSwitcher() {
  const instances = useInstanceStore((s) => s.instances);
  const activeId = useInstanceStore((s) => s.activeId);
  const setActive = useInstanceStore((s) => s.setActive);
  const remove = useInstanceStore((s) => s.remove);
  const [open, setOpen] = useState(false);
  const [addingHost, setAddingHost] = useState<string | null>(null);

  const active = instances.find((i) => i.id === activeId);

  const otherCompaniesOnSameHost = useMemo(() => {
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
          className="flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-sm hover:bg-surface"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              active?.health === "degraded" ? "bg-yellow-400" : "bg-green-500",
            )}
            aria-hidden
          />
          <span className="truncate max-w-[16rem]">
            {labelFor(active) ?? "Select instance"}
          </span>
          <ChevronDown size={14} className="text-muted" />
        </button>

        {open && (
          <div
            className="absolute left-0 top-full z-10 mt-1 w-[22rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg"
            onMouseLeave={() => setOpen(false)}
          >
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
                        <span className="truncate">{labelFor(i)}</span>
                      </div>
                      <div className="ml-3 truncate text-xs text-muted">
                        {detailLineFor(i)}
                      </div>
                    </div>
                    <button
                      aria-label={`Remove ${labelFor(i)}`}
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
                Add another company on{" "}
                <span className="font-mono text-fg/80">{safeHost(active.baseUrl)}</span>
                {otherCompaniesOnSameHost.length > 0 && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide">
                    {otherCompaniesOnSameHost.length} already
                  </span>
                )}
              </button>
            )}

            <div className="border-t border-border bg-bg px-3 py-2 text-xs text-muted">
              Or pick another connection from the onboarding screen.
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

function labelFor(i: Instance | undefined): string | undefined {
  if (!i) return undefined;
  if (i.identity?.companyName) {
    return `${i.identity.companyName} @ ${safeHost(i.baseUrl)}`;
  }
  return i.label;
}

function detailLineFor(i: Instance): string {
  const parts: string[] = [];
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
