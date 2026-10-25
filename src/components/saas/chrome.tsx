import Link from "next/link";
import { Suspense } from "react";
import { getActor } from "@/server/auth";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "./LogoutButton";

export const bigButton = (variant: "default" | "outline" | "secondary" = "default") =>
  buttonVariants({ variant, className: "h-11 px-5 text-[0.95rem] rounded-md" });

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-sm" aria-label="LUNARA home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="11" fill="none" stroke="#64d8f5" strokeWidth="1.5" />
        <path d="M2 15.5c5-3 17-3 22 0" fill="none" stroke="#e58b66" strokeWidth="2" />
        <circle cx="17" cy="9" r="2" fill="#f3f6fc" />
      </svg>
      <span className="font-heading text-base font-extrabold tracking-[0.14em] sm:text-lg sm:tracking-[0.18em]">LUNARA</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<HeaderShell />}>
      <HeaderInner />
    </Suspense>
  );
}

function HeaderShell() {
  return (
    <header className="border-b border-border/70 sticky top-0 z-30 bg-background/80">
      <nav className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6" aria-label="Main">
        <Wordmark />
      </nav>
    </header>
  );
}

async function HeaderInner() {
  const actor = await getActor().catch(() => null);
  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Wordmark />
        <div className="flex items-center gap-1 sm:gap-3 text-sm">
          <Link href="/pricing" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:inline-block">
            Pricing
          </Link>
          {actor ? (
            <>
              <Link href="/dashboard" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="whitespace-nowrap rounded-md px-2 py-2 text-muted-foreground hover:text-foreground sm:px-3">
                Log in
              </Link>
              <Link href="/register" className={buttonVariants({ className: "h-9 px-3 rounded-md sm:px-4" })}>
                <span className="sm:hidden">Sign up</span>
                <span className="hidden sm:inline">Create account</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-muted-foreground sm:grid-cols-[1fr_auto] sm:px-6">
        <p className="max-w-2xl">
          LUNARA is a hackathon prototype. Exploration is a browser simulation of a Mars-like landscape, not live
          imagery or a real robot. All payments run in Stripe test mode; no real money moves.
        </p>
        <p>Lumen 2.0 · Beyond 2030</p>
      </div>
    </footer>
  );
}

export function TestModeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn">
      <span className="size-1.5 rounded-full bg-warn" aria-hidden="true" />
      Test mode
    </span>
  );
}

export function PageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-32 text-muted-foreground" role="status">
      Loading…
    </div>
  );
}
