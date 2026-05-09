import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import {
  useInstanceStore,
  type Instance,
  type InstanceCompany,
} from "@/lib/store/instances";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { cn } from "@/lib/utils";

/**
 * Header pill that shows the active company name and, on click, opens a
 * popover listing every company this connection's API key can reach.
 *
 * Behaviour by actor type:
 *   - `board`: the popover lists each company from `/api/me`'s `companies`
 *     array. Selecting one switches the active company in-place — no new
 *     network credentials, just a re-keyed query cache.
 *   - `company_api_key` / `agent` / `manual-cid`: the API key is bound to a
 *     single company. The chip hides itself in this case (the connection
 *     switcher already shows `<companyName> @ <host>` and the popover has
 *     nothing to switch to).
 */
export function CompanyChip({
  onOpenCompaniesTab,
}: {
  /** Optional callback wired by the chrome to navigate to the Companies tab. */
  onOpenCompaniesTab?: () => void;
}) {
  const active = useInstanceStore((s) => s.active());
  const setActiveCompany = useInstanceStore((s) => s.setActiveCompany);
  const [open, setOpen] = useState(false);
  const [addingHost, setAddingHost] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!active) return null;

  const companies = active.accessibleCompanies ?? [];
  // Single-company non-board actors can't switch in place and the connection
  // trigger already shows their company; the chip would be a dead label.
  if (active.actorType !== "board" && companies.length <= 1) return null;

  const activeCompanyId =
    active.activeCompanyId ?? active.identity?.companyId ?? active.defaultCompanyId ?? "";
  const activeCompany =
    companies.find((c) => c.id === activeCompanyId) ??
    ({
      id: activeCompanyId,
      name: active.identity?.companyName,
    } as InstanceCompany);
  const canSwitchInPlace = active.actorType === "board" && companies.length > 1;
  const host = safeHost(active.baseUrl);

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium",
            "hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent",
            canSwitchInPlace && "border-accent/40 bg-accent/10 text-fg",
          )}
        >
          <Building2 size={12} aria-hidden />
          <span className="max-w-[7rem] truncate sm:max-w-[10rem]">
            {displayName(activeCompany, active)}
          </span>
          {canSwitchInPlace && (
            <span className="rounded bg-bg/60 px-1 text-[10px] text-muted">
              {companies.length}
            </span>
          )}
          <ChevronDown size={12} className="text-muted" />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Companies on this connection"
            className="absolute left-0 top-full z-20 mt-1 w-[20rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          >
            <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wide text-muted">
              Companies on this connection ({host})
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {companies.length === 0 && (
                <li className="px-3 py-2 text-xs text-muted">
                  No companies discovered. Tap Refresh on the Companies page or
                  paste another API key.
                </li>
              )}
              {companies.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === activeCompanyId}
                    onClick={() => {
                      setActiveCompany(active.id, c.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-border/40",
                      c.id === activeCompanyId && "bg-border/30",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{c.name ?? c.id}</div>
                      <div className="truncate text-[11px] text-muted">
                        {c.issuePrefix
                          ? `${c.issuePrefix} · ${c.id.slice(0, 8)}…`
                          : c.id}
                      </div>
                    </div>
                    {c.id === activeCompanyId && (
                      <Check size={14} className="shrink-0 text-accent" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-px border-t border-border bg-bg">
              <button
                type="button"
                onClick={() => {
                  setAddingHost(active.baseUrl);
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-left text-xs text-muted hover:bg-border/30"
              >
                <Plus size={12} />
                Add another connection on this server
              </button>
              {onOpenCompaniesTab && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenCompaniesTab();
                    setOpen(false);
                  }}
                  className="px-3 py-2 text-left text-xs text-muted hover:bg-border/30"
                >
                  Manage companies
                </button>
              )}
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

function displayName(c: InstanceCompany, instance: Instance): string {
  return c.name ?? instance.identity?.companyName ?? "Unnamed company";
}

function safeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
