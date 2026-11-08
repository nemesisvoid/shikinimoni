import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

/**
 * Reads the session, so it renders per request: wrap it in <Suspense>.
 * The rest of the header stays in the static shell.
 */
export async function HeaderAccount() {
  const user = await getCurrentUser();

  if (!user) {
    // On phones, Sign in lives inside the menu sheet (see MobileSignIn).
    return (
      <Link href="/auth/sign-in" className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}>
        Sign in
      </Link>
    );
  }

  return (
    <UserMenu
      user={{ name: user.name, email: user.email, image: user.image ?? null, isAdmin: isAdmin(user) }}
    />
  );
}

/** Sign-in button at the foot of the mobile menu sheet. Signed-in users get the avatar menu instead. */
export async function MobileSignIn() {
  const user = await getCurrentUser();
  if (user) return null;

  return (
    <div className="border-t p-5">
      <Link href="/auth/sign-in" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
        Sign in
      </Link>
    </div>
  );
}

/** Same footprint as the avatar button, so nothing shifts when the session resolves. */
export function HeaderAccountFallback() {
  return <div aria-hidden className="size-11" />;
}
