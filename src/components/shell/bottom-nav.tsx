import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_TABS, TABS_BY_ID, type Tab } from "./tabs";

/**
 * Mobile bottom-tab bar. Shows the 5 primary tabs (Inbox · Dashboard ·
 * Approvals · Channels · More); tapping More opens the overflow drawer.
 *
 * Hidden at `lg` via the parent's render path — this component itself is always
 * laid out with safe-area bottom padding so it rides above the iOS home
 * indicator / Android gesture bar.
 */
export function BottomNav({
  active,
  onSelect,
  onOpenMore,
  moreActive,
}: {
  active: Tab | null;
  onSelect: (tab: Tab) => void;
  onOpenMore: () => void;
  /** True when the active tab lives inside the More drawer. */
  moreActive: boolean;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface pb-safe pl-safe pr-safe lg:hidden"
      role="tablist"
      aria-label="Primary"
    >
      {PRIMARY_TABS.map((id) => {
        const t = TABS_BY_ID[id];
        const Icon = t.icon;
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors",
              isActive ? "text-accent-strong" : "text-muted hover:text-fg",
            )}
          >
            <Icon size={20} aria-hidden />
            <span>{t.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        aria-label="More tabs"
        aria-haspopup="dialog"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors",
          moreActive ? "text-accent-strong" : "text-muted hover:text-fg",
        )}
      >
        <MoreHorizontal size={20} aria-hidden />
        <span>More</span>
      </button>
    </nav>
  );
}
