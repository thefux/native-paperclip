
import { useEffect, useMemo, useState } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { useActiveIdentityRefresh } from "@/lib/store/identity-refresh";
import { useRealtimeNotifications } from "@/lib/desktop/use-realtime-notifications";
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
import { AuditView } from "@/components/views/audit-view";
import { CompaniesView } from "@/components/views/companies-view";
import { CompanyChip } from "@/components/company-chip";
import { BottomNav } from "@/components/shell/bottom-nav";
import { MoreDrawer } from "@/components/shell/more-drawer";
import { ALL_TABS, PRIMARY_TABS } from "@/components/shell/tabs";
import { isMobileShell, useBreakpoint } from "@/lib/use-breakpoint";
import { useTabHash } from "@/lib/use-tab-hash";
import { useDrilldown } from "@/lib/use-drilldown";
import { cn } from "@/lib/utils";
import { ListChecks } from "lucide-react";

export function Workspace() {
  const active = useInstanceStore((s) => s.active());
  const [tab, setTab] = useTabHash("inbox");
  const [moreOpen, setMoreOpen] = useState(false);
  const bp = useBreakpoint();
  // Mobile shell at sm + md (incl. iPad portrait); desktop two-pane only at lg.
  // Convention is documented on `useBreakpoint`; views must follow `isMobileShell`.
  const isMobile = isMobileShell(bp);
  useActiveIdentityRefresh();

  // Inbox drill-down stack: empty = list, [issueId] = detail. The hook wires
  // OS back gestures via `popstate` on mobile so swipe-back pops the detail.
  const inboxStack = useDrilldown<string>({ wireHistory: isMobile });
  const openIssueId = inboxStack.top;

  const setOpenIssueId = (id: string | null) => {
    if (id === null) {
      if (!inboxStack.isEmpty) inboxStack.pop();
      return;
    }
    if (inboxStack.isEmpty) inboxStack.push(id);
    else inboxStack.replace(id);
  };

  function openIssueAndFocusInbox(issueId: string) {
    setTab("inbox");
    setOpenIssueId(issueId);
  }

  useRealtimeNotifications(openIssueAndFocusInbox);

  // Reserve room at the bottom of mobile content for the bottom-nav so the
  // last list row isn't hidden under the bar. The bar itself is ~54px of
  // chrome plus `env(safe-area-inset-bottom)` on devices with a home
  // indicator / gesture nav (iOS ≈34px, Android ≈24–48px), so a flat `pb-16`
  // (64px) leaves the last row jammed under the safe-area band. Stack the
  // chrome height against the env() value so it's pixel-correct on every device.
  const mobilePad = isMobile
    ? "pb-[calc(theme(spacing.16)+env(safe-area-inset-bottom,0px))]"
    : "";

  const moreActive = useMemo(
    () => tab !== null && !PRIMARY_TABS.includes(tab),
    [tab],
  );

  // Close the More drawer if a tab change happens elsewhere (e.g. realtime
  // notification selecting Inbox).
  useEffect(() => {
    if (moreOpen) setMoreOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!active) return null;

  const headerLabel = active.identity?.displayName
    ? `${active.identity.displayName}${active.identity.role ? ` · ${active.identity.role}` : ""}`
    : active.label;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Desktop top-nav (≥lg). On mobile we render a slimmer header with just the
          instance switcher + search; primary nav lives in the bottom bar. */}
      <header
        className={cn(
          "flex items-center gap-2 border-b border-border bg-surface px-4 py-2 pt-safe",
          isMobile && "gap-2 px-3",
        )}
      >
        <InstanceSwitcher />
        <CompanyChip onOpenCompaniesTab={() => setTab("companies")} />
        {!isMobile && (
          <nav className="flex items-center gap-1 text-sm" role="tablist" aria-label="Workspace tabs">
            {ALL_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabButton
                  key={t.id}
                  active={tab === t.id}
                  onClick={() => setTab(t.id)}
                  icon={<Icon size={14} />}
                >
                  {t.label}
                </TabButton>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          <SearchBar onOpen={openIssueAndFocusInbox} />
          {!isMobile && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <ListChecks size={14} />
              <span>{headerLabel}</span>
            </div>
          )}
        </div>
      </header>

      <ConnectionHealthBanner />

      <main className={cn("flex flex-1", mobilePad)}>
        {tab === "dashboard" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <DashboardView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "inbox" && (
          <InboxPane
            isMobile={isMobile}
            openIssueId={openIssueId}
            setOpenIssueId={setOpenIssueId}
            onBack={() => setOpenIssueId(null)}
          />
        )}
        {tab === "projects" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <ProjectsView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "goals" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <GoalsView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "agents" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <AgentsView />
          </section>
        )}
        {tab === "routines" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <RoutinesView />
          </section>
        )}
        {tab === "approvals" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <ApprovalsView onOpenIssue={openIssueAndFocusInbox} />
          </section>
        )}
        {tab === "channels" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <ChannelsView />
          </section>
        )}
        {tab === "layers" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <LayersView />
          </section>
        )}
        {tab === "skills" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <SkillsView />
          </section>
        )}
        {tab === "audit" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <AuditView />
          </section>
        )}
        {tab === "companies" && (
          <section className="flex-1 lg:border-r lg:border-border">
            <CompaniesView />
          </section>
        )}
      </main>

      {isMobile && (
        <>
          <BottomNav
            active={tab}
            onSelect={(next) => setTab(next)}
            onOpenMore={() => setMoreOpen((o) => !o)}
            moreActive={moreActive}
          />
          <MoreDrawer
            open={moreOpen}
            active={tab}
            onSelect={(next) => setTab(next)}
            onClose={() => setMoreOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function InboxPane({
  isMobile,
  openIssueId,
  setOpenIssueId,
  onBack,
}: {
  isMobile: boolean;
  openIssueId: string | null;
  setOpenIssueId: (id: string | null) => void;
  onBack: () => void;
}) {
  if (isMobile) {
    if (openIssueId) {
      return (
        <section className="flex-1">
          <IssueDetail
            issueId={openIssueId}
            onOpen={setOpenIssueId}
            onBack={onBack}
          />
        </section>
      );
    }
    return (
      <section className="flex-1">
        <InboxView onOpen={setOpenIssueId} openId={openIssueId} />
      </section>
    );
  }
  return (
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
      role="tab"
      aria-selected={active}
    >
      {icon}
      {children}
    </button>
  );
}
