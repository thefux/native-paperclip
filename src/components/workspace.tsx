
import { useState } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { InstanceSwitcher } from "@/components/instance-switcher";
import { InboxView } from "@/components/views/inbox-view";
import { IssueDetail } from "@/components/views/issue-detail";
import { RoutinesView } from "@/components/views/routines-view";
import { ApprovalsView } from "@/components/views/approvals-view";
import { cn } from "@/lib/utils";
import { Inbox, ListChecks, ShieldCheck, RefreshCw } from "lucide-react";

type Tab = "inbox" | "routines" | "approvals";

export function Workspace() {
  const active = useInstanceStore((s) => s.active());
  const [tab, setTab] = useState<Tab>("inbox");
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);

  if (!active) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <InstanceSwitcher />
        <nav className="flex items-center gap-1 text-sm">
          <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")} icon={<Inbox size={14} />}>
            Inbox
          </TabButton>
          <TabButton
            active={tab === "routines"}
            onClick={() => setTab("routines")}
            icon={<RefreshCw size={14} />}
          >
            Routines
          </TabButton>
          <TabButton
            active={tab === "approvals"}
            onClick={() => setTab("approvals")}
            icon={<ShieldCheck size={14} />}
          >
            Approvals
          </TabButton>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <ListChecks size={14} />
          <span>{active.label}</span>
        </div>
      </header>

      <main className="flex flex-1">
        <section className="w-full max-w-md border-r border-border">
          {tab === "inbox" && <InboxView onOpen={setOpenIssueId} openId={openIssueId} />}
          {tab === "routines" && <RoutinesView />}
          {tab === "approvals" && <ApprovalsView />}
        </section>
        <section className="flex-1">
          {tab === "inbox" && openIssueId ? (
            <IssueDetail issueId={openIssueId} />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <p className="text-sm">Select an item</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
        active ? "bg-border/50 text-fg" : "text-muted hover:text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
