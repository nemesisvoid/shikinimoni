"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LayoutDashboard, LogOut } from "lucide-react";
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
import { authClient } from "@/lib/auth/client";
import { initialsFor } from "@/lib/format";

export type UserMenuUser = {
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

/** Avatar button + account dropdown for the public site header. */
export function UserMenu({ user }: { user: UserMenuUser }) {
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();

  const signOut = () =>
    startSignOut(async () => {
      await authClient.signOut();
      // Re-render server components (the header) without the session.
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-11 items-center justify-center rounded-full outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-accent"
      >
        <Avatar className="size-9">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-plum-100 text-sm font-semibold text-plum-900">
            {initialsFor(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium text-foreground">{user.name || "Your account"}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user.isAdmin && (
          <>
            <DropdownMenuItem render={<Link href="/admin/dashboard" />}>
              <LayoutDashboard />
              Admin dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={signOut} disabled={signingOut}>
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
