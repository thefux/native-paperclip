
import { useState } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { useActiveIdentityRefresh } from "@/lib/store/identity-refresh";
import { InstanceSwitcher } from "@/components/instance-switcher";
import { SearchBar } from "@/components/search-bar";
import { ConnectionHealthBanner } from "@/components/connection-health-banner";
import { InboxView } from "@/components/views/inbox-view";
import { IssueDetail } from "@/components/views/issue-detail";
import { RoutinesView } from "@/components/views/routines-view";
import { ApprovalsView } from "@/components/views/approvals-view";
import { ChannelsView } from "@/components/views/channels-view";
import { LayersView } from "@/components/views/layers-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { ProjectsView } from "@/components/views/projects-view";
import { GoalsView } from "@/components/views/goals-view";
import { AgentsView } from "@/components/views/agents-view";
import { SkillsView } from "@/components/views/skills-view";
import { cn } from "@/lib/utils";
import {
  Inbox,
  LayoutDashboard,
  Layers as LayersIcon,
  ListChecks,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Target,
  Briefcase,
  Users,
  ScrollText,
} from "lucide-react";

type Tab =
  | "dashboard"
  | "inbox"
  | "projects"
  | "goals"
  | "agents"
  | "routines"
  | "approvals"
  | "channels"
  | "layers"
  | "audit";

export function Workspace() {
  const active = useInstanceStore((s) => s.active());
  const [tab, setTab] = useState<Tab>("inbox");
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  useActiveIdentityRefresh();

  function openIssueAndFocusInbox(issueId: string) {
    setTab("inbox");
    setOpenIssueId(issueId);
  }

  if (!active) return null;

  const headerLabel = active.identity?.displayName
    ? `${active.identity.displayName}${active.identity.role ? ` · ${active.identity.role}` : ""}`
    : active.label;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <InstanceSwitcher />
        <nav className="flex items-center gap-1 text-sm">
          <TabButton
            active={tab === "dashboard"}
            onClick={() => setTab("dashboard")}
            icon={<LayoutDashboard size={14} />}
          >
            Dashboard
          </TabButton>
          <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")} icon={<Inbox size={14} />}>
            Inbox
          </TabButton>
          <TabButton
            active={tab === "projects"}
            onClick={() => setTab("projects")}
            icon={<Briefcase size={14} />}
          >
            Projects
          </TabButton>
          <TabButton
            active={tab === "goals"}
            onClick={() => setTab("goals")}
            icon={<Target size={14} />}
          >
            Goals
          </TabButton>
          <TabButton
            active={tab === "agents"}
            onClick={() => setTab("agents")}
            icon={<Users size={14} />}
          >
            Agents
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
          <TabButton
            active={tab === "channels"}
            onClick={() => setTab("channels")}
            icon={<MessageSquare size={14} />}
          >
            Channels
          </TabButton>
          <TabButton
            active={tab === "layers"}
            onClick={() => setTab("layers")}
            icon={<LayersIcon size={14} />}
          >
            Layers
          </TabButton>
          <TabButton
            active={tab === "audit"}
            onClick={() => setTab("audit")}
            icon={<ScrollText size={14} />}
          >
            Audit
          </TabButton>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SearchBar onOpen={openIssueAndFocusInbox} />
          <div className="flex items-center gap-2 text-xs text-muted">
            <ListChecks size={14} />
            <span>{headerLabel}</span>
          </div>
        </div>
      </header>

      <ConnectionHealthBanner />

      <main className="flex flex-1">
        {tab === "dashboard" && (
          <section className="flex-1 border-r border-border">
            <DashboardView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "inbox" && (
          <>
            <section className="w-full max-w-md border-r border-border">
              <InboxView onOpen={setOpenIssueId} openId={openIssueId} />
            </section>
            <section className="flex-1">
              {openIssueId ? (
                <IssueDetail issueId={openIssueId} onOpen={setOpenIssueId} />
              ) : (
                <div className="grid h-full place-items-center text-muted">
                  <p className="text-sm">Select an issue</p>
                </div>
              )}
            </section>
          </>
        )}
        {tab === "projects" && (
          <section className="flex-1 border-r border-border">
            <ProjectsView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "goals" && (
          <section className="flex-1 border-r border-border">
            <GoalsView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "agents" && (
          <section className="flex-1 border-r border-border">
            <AgentsView />
          </section>
        )}
        {tab === "routines" && (
          <section className="flex-1 border-r border-border">
            <RoutinesView />
          </section>
        )}
        {tab === "approvals" && (
          <section className="flex-1 border-r border-border">
            <ApprovalsView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "channels" && (
          <section className="flex-1 border-r border-border">
            <ChannelsView />
          </section>
        )}
        {tab === "layers" && (
          <section className="flex-1 border-r border-border">
            <LayersView />
          </section>
        )}
        {tab === "audit" && (
          <section className="flex-1 border-r border-border">
            <SkillsView />
          </section>
        )}
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
