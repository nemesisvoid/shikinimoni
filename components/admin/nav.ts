import {
  Building2,
  CircleUser,
  ClipboardCheck,
  History,
  LayoutDashboard,
  MessageSquareText,
  PlusCircle,
  Settings,
  Sparkles,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Counts shown beside a menu item: new enquiries, listings to review, an agent's sent-back listings. */
export type NavBadge = "newInquiries" | "pendingReview" | "needsAttention";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Exact match only (otherwise /admin/properties also lights up for /admin/properties/new). */
  exact?: boolean;
  badge?: NavBadge;
};

export type NavArea = "admin" | "agent";

export const ADMIN_NAV: { label: string; items: AdminNavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Listings",
    items: [
      { href: "/admin/properties", label: "Properties", icon: Building2, exact: true },
      { href: "/admin/properties/new", label: "Add property", icon: PlusCircle },
      { href: "/admin/review", label: "Review", icon: ClipboardCheck, badge: "pendingReview" },
      { href: "/admin/amenities", label: "Amenities", icon: Sparkles },
    ],
  },
  {
    label: "Leads",
    items: [{ href: "/admin/inquiries", label: "Enquiries", icon: MessageSquareText, badge: "newInquiries" }],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "Site settings", icon: Settings },
      { href: "/admin/agents", label: "Agents", icon: UserRoundPlus },
      { href: "/admin/team", label: "Team", icon: Users },
      { href: "/admin/activity", label: "Activity log", icon: History },
      { href: "/admin/profile", label: "Your profile", icon: CircleUser },
    ],
  },
];

export const AGENT_NAV: { label: string; items: AdminNavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/agent", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Your listings",
    items: [
      { href: "/agent/properties", label: "Listings", icon: Building2, exact: true, badge: "needsAttention" },
      { href: "/agent/properties/new", label: "Add property", icon: PlusCircle },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/agent/profile", label: "Your profile", icon: CircleUser }],
  },
];

export const NAV_BY_AREA = { admin: ADMIN_NAV, agent: AGENT_NAV } as const;
export const HOME_BY_AREA = { admin: "/admin/dashboard", agent: "/agent" } as const;
export const PROFILE_BY_AREA = { admin: "/admin/profile", agent: "/agent/profile" } as const;

/** Breadcrumb labels for admin path segments. */
export const ADMIN_SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  dashboard: "Dashboard",
  properties: "Properties",
  new: "Add property",
  edit: "Edit",
  amenities: "Amenities",
  inquiries: "Enquiries",
  settings: "Site settings",
  team: "Team",
  profile: "Your profile",
  activity: "Activity log",
  agents: "Agents",
  review: "Review",
};

/** Breadcrumb labels for agent path segments. */
export const AGENT_SEGMENT_LABELS: Record<string, string> = {
  properties: "Listings",
  new: "Add property",
  profile: "Your profile",
};
