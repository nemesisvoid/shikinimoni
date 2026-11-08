import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { HeaderAccount, HeaderAccountFallback, MobileSignIn } from "@/components/landing/header-account";
import { MobileNav } from "@/components/landing/mobile-nav";
import { MAIN_NAV } from "@/components/landing/nav-items";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo className="h-12 sm:h-13" preload />
        <nav aria-label="Main" className="ml-4 hidden md:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground hover:text-foreground")}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Suspense fallback={<HeaderAccountFallback />}>
            <HeaderAccount />
          </Suspense>
          <MobileNav
            footer={
              <Suspense fallback={null}>
                <MobileSignIn />
              </Suspense>
            }
          />
        </div>
      </div>
    </header>
  );
}
