import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Plus, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useInstanceStore, type Instance, type InstanceCompany } from "@/lib/store/instances";
import { useActiveClient } from "@/lib/store/use-active-client";
import { resolveIdentity } from "@/lib/api/me";
import { ApiError } from "@/lib/api/client";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { Button, Card, Input, Badge } from "@/components/ui";
import {
  CompanySettingsView,
  isValidSettingsSection,
  type SettingsSection,
} from "@/components/views/company-settings-view";
import { useCompaniesSubroute } from "@/lib/use-companies-route";
import { cn } from "@/lib/utils";

/**
 * Companies management page (Phase B / [ROU-95](/ROU/issues/ROU-95)) plus the
 * Phase C1 Settings drilldown ([ROU-98](/ROU/issues/ROU-98)).
 *
 * Lists every company the active connection's API key can access and offers
 * actions to switch, leave, add another, or open Settings. Two add paths:
 *  - "Add another pck_ key" — appends a sibling Instance bound to the same
 *    `baseUrl`. Works for any actor type.
 *  - "Create new company" — `POST /api/companies`. Only visible when the
 *    active key is a board user with instance-admin scope.
 *
 * Routing: list state is implicit (`#companies`); selecting Settings on a row
 * pushes `#companies/{cid}/settings/{section}` via `useCompaniesSubroute`.
 *
 * Mobile (<lg): full-width single column. Desktop (≥lg): centered max-w-3xl
 * for the list; Settings expands to fill the pane.
 */
export function CompaniesView() {
  const { instance, client, companyId } = useActiveClient();
  const setActiveCompany = useInstanceStore((s) => s.setActiveCompany);
  const removeInstance = useInstanceStore((s) => s.remove);
  const setActiveInstance = useInstanceStore((s) => s.setActive);
  const allInstances = useInstanceStore((s) => s.instances);
  const updateInstance = useInstanceStore((s) => s.update);
  const [addingPckKey, setAddingPckKey] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const subroute = useCompaniesSubroute();

  const companies = useMemo(
    () => instance?.accessibleCompanies ?? [],
    [instance],
  );
  const isBoard = instance?.actorType === "board";
  const sameHostInstances = instance
    ? allInstances.filter(
        (i) => i.id !== instance.id && safeHost(i.baseUrl) === safeHost(instance.baseUrl),
      )
    : [];

  const settingsCompany = useMemo(() => {
    const route = subroute.route;
    if (route.kind !== "settings") return null;
    return (
      companies.find((c) => c.id === route.companyId) ?? {
        id: route.companyId,
        name: null,
      }
    );
  }, [subroute.route, companies]);

  // If the user navigates back to a company they no longer have access to
  // (e.g. via stale deep-link), bounce them out of settings.
  useEffect(() => {
    const route = subroute.route;
    if (route.kind !== "settings") return;
    if (!instance) return;
    const stillAccessible = companies.some((c) => c.id === route.companyId);
    if (!stillAccessible && companies.length > 0) {
      subroute.exitSettings();
    }
  }, [companies, instance, subroute]);

  const refreshIdentity = async () => {
    if (!client || !instance) return;
    setRefreshing(true);
    try {
      const identity = await resolveIdentity(
        client,
        instance.activeCompanyId ?? instance.defaultCompanyId ?? null,
      );
      updateInstance(instance.id, {
        accessibleCompanies: identity.accessibleCompanies,
        actorType: identity.actorType,
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (!instance) {
    return (
      <div className="grid h-full place-items-center text-muted">
        <p className="text-sm">Connect an instance to manage companies.</p>
      </div>
    );
  }

  if (subroute.route.kind === "settings" && settingsCompany) {
    const section: SettingsSection | null = isValidSettingsSection(
      subroute.route.section,
    )
      ? subroute.route.section
      : null;
    return (
      <CompanySettingsView
        company={settingsCompany as InstanceCompany}
        section={section}
        selectedKeyId={subroute.route.keyId}
        onSectionChange={(s) => subroute.setSection(s)}
        onOpenKey={(keyId) => subroute.enterKey(keyId)}
        onCloseKey={() => subroute.exitKey()}
        onBack={() => subroute.exitSettings()}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto pl-safe pr-safe">
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 lg:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Building2 size={18} aria-hidden /> Companies
            </h1>
            <p className="text-sm text-muted">
              Companies reachable from this connection ({safeHost(instance.baseUrl)}). A{" "}
              <em>connection</em> points at one Paperclip server, which may host one or more{" "}
              <em>companies</em>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={isBoard ? "info" : "neutral"}>
              {isBoard
                ? "Board user"
                : instance.actorType === "company_api_key"
                  ? "Company API key"
                  : instance.actorType === "agent"
                    ? "Agent JWT"
                    : "Manual company ID"}
            </Badge>
            <Button variant="ghost" onClick={refreshIdentity} disabled={refreshing}>
              <RefreshCw size={14} className={cn("mr-1", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </header>

        <Card className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted">
            Companies on this connection
          </div>
          <ul className="space-y-2">
            {companies.length === 0 && (
              <li className="text-sm text-muted">
                No companies yet. Try Refresh, or add another API key below.
              </li>
            )}
            {companies.map((c) => (
              <CompanyRow
                key={c.id}
                company={c}
                isActive={c.id === companyId}
                onSelect={() => setActiveCompany(instance.id, c.id)}
                onOpenSettings={() => subroute.enterSettings(c.id, "api-keys")}
              />
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button onClick={() => setAddingPckKey(true)} variant="ghost">
              <Plus size={14} className="mr-1" />
              Add another API key on this server
            </Button>
            {isBoard && (
              <Button onClick={() => setCreatingCompany(true)} variant="ghost">
                <Plus size={14} className="mr-1" />
                Create new company
              </Button>
            )}
          </div>
        </Card>

        {sameHostInstances.length > 0 && (
          <Card className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted">
              Other connections on {safeHost(instance.baseUrl)}
            </div>
            <ul className="space-y-2">
              {sameHostInstances.map((other) => (
                <SiblingInstanceRow
                  key={other.id}
                  instance={other}
                  onActivate={() => setActiveInstance(other.id)}
                  onRemove={() => removeInstance(other.id)}
                />
              ))}
            </ul>
            <p className="text-xs text-muted">
              Each <code className="font-mono">pck_…</code> key is its own connection. Removing
              a connection here only forgets it locally — the API key continues to work on the
              server until you revoke it.
            </p>
          </Card>
        )}
      </div>

      {addingPckKey && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
          <OnboardingScreen
            prefillBaseUrl={instance.baseUrl}
            onCancel={() => setAddingPckKey(false)}
          />
        </div>
      )}

      {creatingCompany && (
        <CreateCompanyModal
          onClose={(created) => {
            setCreatingCompany(false);
            if (created) void refreshIdentity();
          }}
        />
      )}
    </div>
  );
}

function CompanyRow({
  company,
  isActive,
  onSelect,
  onOpenSettings,
}: {
  company: InstanceCompany;
  isActive: boolean;
  onSelect: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <li>
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-md border border-border bg-bg",
          isActive && "border-accent/60 bg-accent/10",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isActive}
          className="flex flex-1 items-center justify-between gap-3 rounded-l-md px-3 py-2 text-left hover:bg-surface"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{company.name ?? company.id}</div>
            <div className="truncate text-[11px] text-muted">
              {company.issuePrefix ? `${company.issuePrefix} · ` : ""}
              <span className="font-mono">{company.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {isActive ? (
              <span className="inline-flex items-center gap-1 text-accent">
                <Check size={14} aria-hidden /> Active
              </span>
            ) : (
              <span className="text-muted">Switch</span>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={`Settings for ${company.name ?? company.id}`}
          className="flex items-center gap-1 rounded-r-md px-3 py-2 text-xs text-muted hover:bg-surface hover:text-fg"
        >
          <Settings size={14} aria-hidden />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </li>
  );
}

function SiblingInstanceRow({
  instance,
  onActivate,
  onRemove,
}: {
  instance: Instance;
  onActivate: () => void;
  onRemove: () => void;
}) {
  const label =
    instance.identity?.companyName ?? instance.label ?? instance.identity?.displayName ?? "Connection";
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm">{label}</div>
        <div className="truncate text-[11px] text-muted">
          {instance.actorType ?? "unknown"} ·{" "}
          <span className="font-mono">{instance.id.slice(0, 8)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onActivate}>
          Activate
        </Button>
        <Button
          variant="ghost"
          onClick={onRemove}
          aria-label="Forget this connection"
          className="text-red-300 hover:text-red-200"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </li>
  );
}

function CreateCompanyModal({
  onClose,
}: {
  onClose: (created: boolean) => void;
}) {
  const { instance, client } = useActiveClient();
  const updateInstance = useInstanceStore((s) => s.update);
  const setActiveCompany = useInstanceStore((s) => s.setActiveCompany);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !instance) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await client.post<{ id: string; name: string; issuePrefix?: string }>(
        "/api/companies",
        { name: name.trim() },
      );
      // Refresh /api/me so accessibleCompanies picks up the new membership
      // (the create route auto-grants the calling board user `owner`).
      const identity = await resolveIdentity(client, created.id);
      updateInstance(instance.id, {
        accessibleCompanies: identity.accessibleCompanies,
        actorType: identity.actorType,
      });
      setActiveCompany(instance.id, created.id);
      onClose(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(
          "Creating a company requires instance-admin scope. Ask your CEO to grant it, or paste a different board-user key.",
        );
      } else if (err instanceof ApiError) {
        setError(`Server returned ${err.status}.`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create company.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4"
      role="dialog"
      aria-modal
    >
      <Card className="w-full max-w-md space-y-3">
        <header>
          <h2 className="text-lg font-semibold">Create new company</h2>
          <p className="text-sm text-muted">
            POST /api/companies — only available to board users with instance-admin scope. The
            calling user is granted owner membership automatically.
          </p>
        </header>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
            />
          </label>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()} className="flex-1">
              {submitting ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function safeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
