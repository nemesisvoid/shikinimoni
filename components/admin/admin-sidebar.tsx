"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, ExternalLink, House, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ADMIN_NAV } from "@/components/admin/nav";
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

export function AdminSidebar({ user, newInquiries }: { user: AdminSidebarUser; newInquiries: number }) {
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
              render={<Link href="/admin/dashboard" aria-label="ShikiniMoni admin home" />}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <House className="size-4" />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const badge = item.badge === "newInquiries" && newInquiries > 0 ? newInquiries : null;
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
                          <span className="sr-only"> new</span>
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
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function UserMenu({ user }: { user: AdminSidebarUser }) {
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
              <span className="truncate font-medium">{user.name || "Admin"}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={8} className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-medium">{user.name || "Admin"}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
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
