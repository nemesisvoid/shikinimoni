"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, CircleUser, ExternalLink, House, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { HOME_BY_AREA, NAV_BY_AREA, PROFILE_BY_AREA, type NavArea, type NavBadge } from "@/components/admin/nav";
import { initialsFor } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth/client";

export type AdminSidebarUser = { name: string; email: string; image: string | null };

const BADGE_SR: Record<NavBadge, string> = { newInquiries: " new", pendingReview: " to review", needsAttention: " need your attention" };

/** The admin's and the agent's sidebar: same shell, different menu. */
export function AdminSidebar({
  user,
  area = "admin",
  badges = {},
}: {
  user: AdminSidebarUser;
  area?: NavArea;
  badges?: Partial<Record<NavBadge, number>>;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  // The mobile sidebar is a sheet; close it after picking a page.
  const onNavigate = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Full logo when expanded; a brand tile when collapsed to icons. */}
            <div className="flex h-12 items-center px-2 group-data-[collapsible=icon]:hidden">
              <Logo className="h-11" />
            </div>
            <SidebarMenuButton
              tooltip="ShikiniMoni"
              className="hidden size-8! rounded-full! p-0! group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:p-0!"
              render={<Link href={HOME_BY_AREA[area]} aria-label={area === "admin" ? "ShikiniMoni admin home" : "Your agent dashboard"} />}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <House className="size-4" />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_BY_AREA[area].map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const count = item.badge ? (badges[item.badge] ?? 0) : 0;
                  const badge = count > 0 ? count : null;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={<Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} />}
                        className="data-active:bg-plum-50 data-active:text-plum-900 data-active:[&_svg]:text-plum-700"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {badge !== null && (
                        <SidebarMenuBadge className="bg-highlight text-highlight-foreground font-semibold tabular-nums">
                          {badge}
                          <span className="sr-only">{item.badge ? BADGE_SR[item.badge] : ""}</span>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} area={area} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function UserMenu({ user, area }: { user: AdminSidebarUser; area: NavArea }) {
  const fallbackName = area === "admin" ? "Admin" : "Agent";
  const router = useRouter();
  const { isMobile } = useSidebar();

  async function signOut() {
    await authClient.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" aria-label="Account menu" />
            }
          >
            <Avatar className="size-8 rounded-lg">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback className="rounded-lg bg-plum-100 text-xs font-semibold text-plum-900">
                {initialsFor(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{user.name || fallbackName}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={8} className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-medium">{user.name || fallbackName}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={PROFILE_BY_AREA[area]} />}>
              <CircleUser />
              Your profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/" target="_blank" rel="noreferrer" />}>
              <ExternalLink />
              View site
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
