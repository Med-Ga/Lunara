import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageFallback, SiteFooter, SiteHeader, TestModeBadge, bigButton } from "@/components/saas/chrome";
import { BuyButton } from "@/components/saas/BuyButton";
import { getActor } from "@/server/auth";
import { listPackages } from "@/server/db";
import { formatDuration, formatPrice, type PackageDTO } from "@/shared/contracts";
import { DESTINATIONS, DESTINATION_IDS, isDestinationId, type DestinationId } from "@/config/destinations";

async function PricingContent({ searchParams }: { searchParams: Promise<{ destination?: string }> }) {
  const { destination: q } = await searchParams;
  const selected: DestinationId | null = isDestinationId(q) ? q : null;
  const actor = await getActor().catch(() => null);
  let packages: PackageDTO[] | null = null;
  try {
    await connection();
    packages = await listPackages();
  } catch (e) {
    console.error("[lunara] pricing catalog unavailable", (e as Error).message);
  }
  const perMinute = (id: DestinationId) => packages?.find((p) => p.destinationId === id && p.durationMs === 60000);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-extrabold sm:text-5xl">Exploration time</h1>
          <TestModeBadge />
        </div>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Time is bought per destination and can only be used there. Prices are test fixtures: pay with Stripe&rsquo;s
          test card <span className="tabular font-mono text-foreground">4242 4242 4242 4242</span>, any future date and
          any CVC.
        </p>

        <nav aria-label="Choose a destination" className="mt-10">
          <h2 className="text-sm font-semibold text-muted-foreground">1. Choose a destination</h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {DESTINATION_IDS.map((id) => {
              const d = DESTINATIONS[id];
              const pm = perMinute(id);
              const on = selected === id;
              return (
                <li key={id}>
                  <Link
                    href={`/pricing?destination=${id}`}
                    aria-current={on ? "true" : undefined}
                    className={`relative block overflow-hidden rounded-xl border p-5 ${on ? "border-primary ring-2 ring-primary/50" : "border-border"}`}
                  >
                    <span className={`${d.previewClass} absolute inset-0 opacity-80`} aria-hidden="true" />
                    <span className="relative block">
                      <span className="block text-2xl font-extrabold">{d.name}</span>
                      <span className="mt-1 block text-sm text-foreground/85">{d.tagline}, simulated</span>
                      <span className="mt-3 block font-semibold">
                        {pm ? `${formatPrice(pm.amountMinor, pm.currency)} per minute` : "Price unavailable"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {packages === null ? (
          <div role="alert" className="mt-12 rounded-lg border border-destructive/40 bg-destructive/10 p-6">
            <p className="font-semibold">Prices could not be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing has been charged. Reload the page to try again.</p>
          </div>
        ) : !selected ? (
          <p className="mt-10 text-muted-foreground">Select Mars or Moon above to see its packages.</p>
        ) : (
          <section aria-labelledby="pkgs" className="mt-10">
            <h2 id="pkgs" className="text-sm font-semibold text-muted-foreground">
              2. Choose {DESTINATIONS[selected].name} time
            </h2>
            <ul className="mt-3 grid gap-5 md:grid-cols-3">
              {packages
                .filter((p) => p.destinationId === selected)
                .map((p, i) => (
                  <li
                    key={p.id}
                    className={`flex flex-col rounded-xl border p-6 ${i === 1 ? "border-primary/60 bg-panel" : "border-border bg-panel/50"}`}
                  >
                    <h3 className="text-xl font-bold">
                      {DESTINATIONS[selected].name}, {p.label}
                    </h3>
                    <p className="mt-4 font-heading text-5xl font-extrabold tabular">
                      {Math.round(p.durationMs / 60000)}
                      <span className="ml-2 text-lg font-semibold text-muted-foreground">
                        {p.durationMs === 60000 ? "minute" : "minutes"}
                      </span>
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      {formatPrice(p.amountMinor, p.currency)} <span className="text-xs">(test price)</span>
                    </p>
                    <div className="mt-6">
                      <BuyButton
                        packageId={p.id}
                        signedIn={!!actor}
                        label={`Buy ${formatDuration(p.durationMs)} of ${DESTINATIONS[selected].name}`}
                        className={`${bigButton(i === 1 ? "default" : "secondary")} w-full`}
                        returnTo={`/pricing?destination=${selected}`}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="mt-14 grid gap-6 border-t border-border pt-8 text-sm text-muted-foreground md:grid-cols-3">
          <p>
            <strong className="block text-foreground">Billing runs while a session is active</strong>
            Standing still or scanning still uses time. Press Escape to free the mouse; use Exit to stop the clock.
          </p>
          <p>
            <strong className="block text-foreground">Connection drops are capped</strong>
            If your browser stops responding, billing ends no later than 15 seconds after the last confirmed check.
          </p>
          <p>
            <strong className="block text-foreground">Credit only after verification</strong>
            Minutes appear once Stripe confirms the test payment. A cancelled checkout adds nothing.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export default function Page(props: { searchParams: Promise<{ destination?: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PricingContent {...props} />
    </Suspense>
  );
}
