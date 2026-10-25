"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bigButtonClass } from "./styles";

function safeNext(next: string | null): string {
  // Only allow internal paths.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const dest = safeNext(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(true); // project requires email confirmation
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      window.location.href = dest;
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        /invalid login/i.test(msg)
          ? "That email and password don't match an account."
          : /already registered/i.test(msg)
            ? "An account with this email already exists. Log in instead."
            : msg || "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (confirmSent) {
    return (
      <div role="status" className="rounded-lg border border-primary/40 bg-primary/10 p-5">
        <p className="font-semibold">Check your inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a confirmation link to {email}. Open it to activate your account, then log in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-md border border-input bg-background px-3 text-base"
          aria-invalid={!!error}
          aria-describedby={error ? "auth-error" : undefined}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-md border border-input bg-background px-3 text-base"
          aria-invalid={!!error}
          aria-describedby={error ? "auth-error" : mode === "register" ? "pw-hint" : undefined}
        />
        {mode === "register" && (
          <p id="pw-hint" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        )}
      </div>
      {error && (
        <p id="auth-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${bigButtonClass} w-full`}>
        {busy ? "Please wait…" : mode === "register" ? "Create account" : "Log in"}
      </button>
      <p className="text-sm text-muted-foreground">
        {mode === "register" ? "Already have an account? " : "New to LUNARA? "}
        <Link
          href={`${mode === "register" ? "/login" : "/register"}${next ? `?next=${encodeURIComponent(dest)}` : ""}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {mode === "register" ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
