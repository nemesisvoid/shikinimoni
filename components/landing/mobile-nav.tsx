"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MAIN_NAV } from "@/components/landing/nav-items";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** `footer` is rendered by the server (the sign-in button, which depends on the session). */
export function MobileNav({ footer }: { footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close after navigating to another page (e.g. the footer sign-in link).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Close if the viewport grows past the breakpoint where the desktop nav takes over.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    const onChange = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  // Most links jump to a section on this same page, which wouldn't dismiss the sheet on its own.
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Open menu" />}
      >
        <MenuIcon className="size-6" />
      </SheetTrigger>

      <SheetContent side="right" className="w-[85vw] max-w-sm gap-0">
        <SheetHeader className="border-b px-5 py-4">
          <Logo className="h-11 w-fit" />
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Browse listings or sign in</SheetDescription>
        </SheetHeader>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className="flex min-h-12 items-center rounded-xl px-3 font-heading text-lg font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/#sell"
                onClick={close}
                className="flex min-h-12 items-center rounded-xl px-3 font-heading text-lg font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
              >
                Sell with us
              </Link>
            </li>
          </ul>
        </nav>

        {footer}
      </SheetContent>
    </Sheet>
  );
}
