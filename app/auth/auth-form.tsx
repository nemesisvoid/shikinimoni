"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";

/** Only allow same-origin relative paths as post-login destinations. */
function safeRedirect(): string {
  const target = new URLSearchParams(window.location.search).get("redirectTo") ?? "/";
  return target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/\\")
    ? target
    : "/";
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      const { error } =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: String(form.get("name")) });
      if (error) {
        setError(error.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.replace(safeRedirect());
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const input = "w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "sign-up" && (
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input name="name" required autoComplete="name" className={input} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            className={input}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {mode === "sign-in" ? (
          <>No account? <Link href="/auth/sign-up" className="underline">Sign up</Link></>
        ) : (
          <>Already registered? <Link href="/auth/sign-in" className="underline">Sign in</Link></>
        )}
      </p>
    </main>
  );
}
