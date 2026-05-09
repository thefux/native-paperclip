import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMobileShell, useBreakpoint } from "@/lib/use-breakpoint";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal primitive that adapts to the active breakpoint:
 *  - mobile (sm + md): bottom sheet that slides up, full-width, max 80vh.
 *  - desktop (lg+):     centered dialog, max-w-md.
 *
 * Behaviours shared with `<MoreDrawer>`:
 *  - Locks body scroll while open so swipes inside the sheet don't bleed
 *    through to the list behind it.
 *  - Traps Tab focus inside the sheet; Escape closes.
 *  - Focuses the first focusable element on open.
 *
 * Use this for any Phase C+ modal/sheet (create-key, revoke-confirm,
 * settings-sub-actions). Keeps a single a11y contract across the app instead
 * of each view re-implementing the focus trap.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Falls back to `title` if it's a string. Required when `title` is omitted. */
  ariaLabel?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bp = useBreakpoint();
  const isMobile = isMobileShell(bp);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
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

  const label = ariaLabel ?? (typeof title === "string" ? title : undefined);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        isMobile ? "" : "grid place-items-center px-4",
      )}
      role="dialog"
      aria-modal
      aria-label={label}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={sheetRef}
        className={cn(
          "relative bg-surface",
          isMobile
            ? "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-border pb-safe pl-safe pr-safe"
            : "w-full max-w-md rounded-lg border border-border shadow-2xl",
        )}
      >
        {title !== undefined && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            {title && <span className="text-sm font-medium">{title}</span>}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto rounded p-1 text-muted hover:bg-bg hover:text-fg"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
