import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FUTURE_PLACEHOLDERS,
  MORE_TABS,
  TABS_BY_ID,
  type Tab,
} from "./tabs";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Bottom-sheet drawer listing every tab that's not in the bottom-nav, plus
 * placeholders for the parity-plan tabs (Companies, Workspaces, etc.) that
 * later phases will implement. Phase A only navigates the implemented set;
 * placeholders render disabled with a phase hint.
 */
export function MoreDrawer({
  open,
  active,
  onSelect,
  onClose,
}: {
  open: boolean;
  active: Tab | null;
  onSelect: (tab: Tab) => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock the underlying page scroll while the sheet is open so swipes inside
  // the modal don't bleed through to the inbox/dashboard list behind it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes; Tab is trapped inside the sheet so focus can't leak to the
  // chrome behind it.
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    // Move focus into the sheet on open so screen-reader / keyboard users
    // start from inside the modal.
    if (sheet) {
      const first = sheet.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheet) return;
      const focusables = Array.from(
        sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal aria-label="More tabs">
      <button
        type="button"
        aria-label="Close more drawer"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={sheetRef}
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl border-t border-border bg-surface pb-safe pl-safe pr-safe",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-sm font-medium">More</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1 text-muted hover:bg-bg hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-2">
          <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {MORE_TABS.map((id) => {
              const t = TABS_BY_ID[id];
              const Icon = t.icon;
              const isActive = active === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(id);
                      onClose();
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-xs transition-colors",
                      isActive
                        ? "border-accent bg-accent/15 text-fg"
                        : "border-border bg-bg/40 text-muted hover:bg-bg hover:text-fg",
                    )}
                  >
                    <Icon size={20} aria-hidden />
                    <span>{t.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 px-2 text-[10px] uppercase tracking-wide text-muted">
            Coming soon
          </div>
          <ul className="mt-1 grid grid-cols-3 gap-1 sm:grid-cols-4">
            {FUTURE_PLACEHOLDERS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled
                    title={`Planned in ${p.hint}`}
                    className="flex aspect-square w-full cursor-not-allowed flex-col items-center justify-center gap-1 rounded-lg border border-border bg-bg/20 px-2 py-3 text-xs text-muted/70 opacity-60"
                  >
                    <Icon size={20} aria-hidden />
                    <span>{p.label}</span>
                    <span className="text-[9px] uppercase">{p.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
