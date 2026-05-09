import {
  ArrowLeft,
  Database,
  Download,
  KeyRound,
  Mail,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import type { InstanceCompany } from "@/lib/store/instances";
import { Badge, Button, Card } from "@/components/ui";
import { ApiKeysList } from "@/components/views/api-keys-list";
import { isMobileShell, useBreakpoint } from "@/lib/use-breakpoint";
import { cn } from "@/lib/utils";

/**
 * Company Settings shell (Phase C1 / ROU-98 §C1.1).
 *
 * Mobile (sm + md): single-pane stack. Section pills horizontal-scroll at the
 * top. Active pill highlights; tap switches.
 *
 * Desktop (lg+): left rail of section labels + right content pane (matches the
 * existing two-pane drilldown convention used by Inbox).
 *
 * Section ids are stable URL segments — we route to them via
 * `useCompaniesSubroute` (`#companies/{cid}/settings/{section}`). Six sections
 * are defined to reserve the routes mid-phase; only `api-keys` is implemented.
 * The other five render placeholder cards so deep-links don't 404.
 */
export type SettingsSection =
  | "api-keys"
  | "invites"
  | "access"
  | "environments"
  | "export"
  | "import";

export const SETTINGS_SECTIONS: ReadonlyArray<{
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  status: "live" | "placeholder";
  description?: string;
}> = [
  {
    id: "api-keys",
    label: "API keys",
    icon: KeyRound,
    status: "live",
  },
  {
    id: "invites",
    label: "Invites",
    icon: Mail,
    status: "placeholder",
    description: "Invite teammates and pending invitation queue.",
  },
  {
    id: "access",
    label: "Access",
    icon: Users,
    status: "placeholder",
    description: "Membership, roles, and access control.",
  },
  {
    id: "environments",
    label: "Environments",
    icon: Database,
    status: "placeholder",
    description: "Managed environments and secrets.",
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    status: "placeholder",
    description: "Download a portable archive of this company.",
  },
  {
    id: "import",
    label: "Import",
    icon: Upload,
    status: "placeholder",
    description: "Restore from a Paperclip export bundle.",
  },
];

const DEFAULT_SECTION: SettingsSection = "api-keys";
const VALID_SECTION_IDS = new Set<string>(SETTINGS_SECTIONS.map((s) => s.id));

export function isValidSettingsSection(id: string | null): id is SettingsSection {
  return id !== null && VALID_SECTION_IDS.has(id);
}

export function CompanySettingsView({
  company,
  section,
  selectedKeyId,
  onSectionChange,
  onOpenKey,
  onCloseKey,
  onBack,
}: {
  company: InstanceCompany;
  section: SettingsSection | null;
  selectedKeyId: string | null;
  onSectionChange: (section: SettingsSection) => void;
  onOpenKey: (keyId: string) => void;
  onCloseKey: () => void;
  onBack: () => void;
}) {
  const bp = useBreakpoint();
  const isMobile = isMobileShell(bp);
  const activeSection = section ?? DEFAULT_SECTION;

  // Normalise the URL once: `#companies/{cid}/settings` → `/api-keys` so deep
  // links land on a section instead of an empty content pane.
  useEffect(() => {
    if (section === null) onSectionChange(DEFAULT_SECTION);
  }, [section, onSectionChange]);

  const sectionDef =
    SETTINGS_SECTIONS.find((s) => s.id === activeSection) ?? SETTINGS_SECTIONS[0];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header
        className={cn(
          "flex items-center gap-3 border-b border-border bg-surface px-4 py-3",
          isMobile && "px-3",
        )}
      >
        <Button
          variant="ghost"
          onClick={onBack}
          aria-label="Back to companies list"
          className="px-2"
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Settings size={14} aria-hidden className="text-muted" />
            <h1 className="truncate text-base font-semibold">
              {company.name ?? company.id} · Settings
            </h1>
          </div>
          <p className="truncate text-[11px] text-muted">
            {company.issuePrefix ? `${company.issuePrefix} · ` : ""}
            <span className="font-mono">{company.id}</span>
          </p>
        </div>
      </header>

      {isMobile ? (
        <SectionPills
          activeId={activeSection}
          onSelect={(id) => onSectionChange(id)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {!isMobile && (
          <nav
            aria-label="Settings sections"
            className="w-56 shrink-0 border-r border-border bg-bg/40 p-3"
          >
            <ul className="space-y-1" role="tablist">
              {SETTINGS_SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = s.id === activeSection;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onSectionChange(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm",
                        active
                          ? "bg-accent/15 text-fg"
                          : "text-muted hover:bg-surface hover:text-fg",
                      )}
                    >
                      <Icon size={14} aria-hidden />
                      <span className="flex-1 truncate">{s.label}</span>
                      {s.status === "placeholder" && (
                        <Badge tone="neutral" className="text-[9px] uppercase">
                          C2
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <section className="flex min-h-0 flex-1 flex-col">
          {sectionDef.id === "api-keys" ? (
            <ApiKeysList
              companyId={company.id}
              selectedKeyId={selectedKeyId}
              onOpenKey={onOpenKey}
              onCloseKey={onCloseKey}
            />
          ) : (
            <PlaceholderSection
              icon={sectionDef.icon}
              label={sectionDef.label}
              description={sectionDef.description}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function SectionPills({
  activeId,
  onSelect,
}: {
  activeId: SettingsSection;
  onSelect: (id: SettingsSection) => void;
}) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1.5 overflow-x-auto border-b border-border bg-bg/40 px-3 py-2"
    >
      {SETTINGS_SECTIONS.map((s) => {
        const Icon = s.icon;
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs",
              active
                ? "border-accent bg-accent/15 text-fg"
                : "border-border bg-bg text-muted",
            )}
          >
            <Icon size={12} aria-hidden />
            {s.label}
            {s.status === "placeholder" && (
              <span className="text-[9px] uppercase">· C2</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function PlaceholderSection({
  icon: Icon,
  label,
  description,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-6">
      <Card className="w-full max-w-md space-y-3 text-center">
        <Icon size={28} className="mx-auto text-muted" aria-hidden />
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{label}</h2>
          {description && (
            <p className="text-sm text-muted">{description}</p>
          )}
          <p className="text-xs text-muted">Coming in Phase C2.</p>
        </div>
      </Card>
    </div>
  );
}
