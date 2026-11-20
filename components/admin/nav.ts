import { Building2, CircleUser, History, LayoutDashboard, MessageSquareText, PlusCircle, Settings, Sparkles, Users, type LucideIcon } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Exact match only (otherwise /admin/properties also lights up for /admin/properties/new). */
  exact?: boolean;
  badge?: "newInquiries";
};

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
      { href: "/admin/team", label: "Team", icon: Users },
      { href: "/admin/activity", label: "Activity log", icon: History },
      { href: "/admin/profile", label: "Your profile", icon: CircleUser },
    ],
  },
];

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
};
