
import { useInstanceStore } from "@/lib/store/instances";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function InstanceSwitcher() {
  const instances = useInstanceStore((s) => s.instances);
  const activeId = useInstanceStore((s) => s.activeId);
  const setActive = useInstanceStore((s) => s.setActive);
  const remove = useInstanceStore((s) => s.remove);
  const [open, setOpen] = useState(false);

  const active = instances.find((i) => i.id === activeId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-sm hover:bg-surface"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
        <span>{active?.label ?? "Select instance"}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-10 mt-1 w-72 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <ul className="max-h-64 overflow-y-auto py-1">
            {instances.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => {
                    setActive(i.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-border/40",
                    activeId === i.id && "bg-border/30",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate">{i.label}</div>
                    <div className="truncate text-xs text-muted">{i.baseUrl}</div>
                  </div>
                  <button
                    aria-label="Remove instance"
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
          <div className="border-t border-border bg-bg px-3 py-2 text-xs text-muted">
            Add another from the onboarding screen.
          </div>
        </div>
      )}
    </div>
  );
}
