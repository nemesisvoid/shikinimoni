import { Building2, LayoutDashboard, MessageSquareText, PlusCircle, Settings, Sparkles, type LucideIcon } from "lucide-react";

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
    label: "Account",
    items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
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
  settings: "Settings",
};
