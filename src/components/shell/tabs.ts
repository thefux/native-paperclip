import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Briefcase,
  Building2,
  CircleDollarSign,
  Inbox,
  Layers as LayersIcon,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Network,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

export type Tab =
  | "dashboard"
  | "inbox"
  | "projects"
  | "goals"
  | "agents"
  | "routines"
  | "approvals"
  | "channels"
  | "layers"
  | "audit"
  | "skills"
  | "companies";

export interface TabDescriptor {
  id: Tab;
  label: string;
  icon: LucideIcon;
}

/** All implemented tabs, in canonical order. */
export const ALL_TABS: TabDescriptor[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "goals", label: "Goals", icon: Target },
  { id: "agents", label: "Agents", icon: Users },
  { id: "routines", label: "Routines", icon: RefreshCw },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
  { id: "channels", label: "Channels", icon: MessageSquare },
  { id: "layers", label: "Layers", icon: LayersIcon },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "audit", label: "Audit", icon: ScrollText },
  { id: "companies", label: "Companies", icon: Building2 },
];

/** Mobile primary bottom-tab bar (Inbox · Dashboard · Approvals · Channels · More). */
export const PRIMARY_TABS: Tab[] = ["inbox", "dashboard", "approvals", "channels"];

/** Tabs that show inside the More drawer (rest of ALL_TABS minus the primaries). */
export const MORE_TABS: Tab[] = ALL_TABS
  .map((t) => t.id)
  .filter((id) => !PRIMARY_TABS.includes(id));

/** Future tabs from the parity plan — rendered as disabled placeholders so users
 * can see what's coming in later phases (Companies, Workspaces, etc.). */
export interface PlaceholderDescriptor {
  id: string;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const FUTURE_PLACEHOLDERS: PlaceholderDescriptor[] = [
  { id: "workspaces", label: "Workspaces", icon: ListChecks, hint: "Phase F" },
  { id: "activity", label: "Activity", icon: Activity, hint: "Phase G" },
  { id: "costs", label: "Costs", icon: CircleDollarSign, hint: "Phase G" },
  { id: "search", label: "Search", icon: Search, hint: "Phase G" },
  { id: "org", label: "Org", icon: Network, hint: "Phase G" },
  { id: "settings", label: "Settings", icon: Settings, hint: "Phase C" },
];

export const TABS_BY_ID: Record<Tab, TabDescriptor> = ALL_TABS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<Tab, TabDescriptor>,
);

export const VALID_TAB_IDS = new Set<Tab>(ALL_TABS.map((t) => t.id));
