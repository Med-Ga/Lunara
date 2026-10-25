import { connection } from "next/server";
import { Suspense } from "react";
import { PageFallback, SiteFooter, SiteHeader, TestModeBadge, bigButton } from "@/components/saas/chrome";
import { BuyButton } from "@/components/saas/BuyButton";
import { getActor } from "@/server/auth";
import { listPackages } from "@/server/db";
import { formatDuration, formatPrice, type PackageDTO } from "@/shared/contracts";


const blurbs: Record<string, string> = {
  "demo-pass": "Enough to drive a short loop and watch the session end on its own.",
  explorer: "Time to cross the valley floor and climb toward the ridge.",
  horizon: "A long window for a slow survey of the whole area.",
};

async function PricingContent() {
  const actor = await getActor().catch(() => null);
  let packages: PackageDTO[] | null = null;
  try {
    await connection();
    packages = await listPackages();
  } catch (e) {
    console.error("[lunara] pricing catalog unavailable", (e as Error).message);
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-extrabold sm:text-5xl">Exploration time</h1>
          <TestModeBadge />
        </div>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Buy minutes once, use them across as many sessions as you like. Prices are test fixtures: pay with
          Stripe&rsquo;s test card <span className="tabular font-mono text-foreground">4242 4242 4242 4242</span>, any
          future date and any CVC.
        </p>

        {packages === null ? (
          <div role="alert" className="mt-12 rounded-lg border border-destructive/40 bg-destructive/10 p-6">
            <p className="font-semibold">Prices could not be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing has been charged. Reload the page to try again.</p>
          </div>
        ) : packages.length === 0 ? (
          <p className="mt-12 text-muted-foreground">No packages are available right now.</p>
        ) : (
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {packages.map((p, i) => (
              <li
                key={p.id}
                className={`flex flex-col rounded-xl border p-6 ${
                  i === 1 ? "border-primary/60 bg-panel" : "border-border bg-panel/50"
                }`}
              >
                <h2 className="text-xl font-bold">{p.label}</h2>
                <p className="mt-4 font-heading text-5xl font-extrabold tabular">
                  {Math.round(p.durationMs / 60000)}
                  <span className="ml-2 text-lg font-semibold text-muted-foreground">
                    {p.durationMs === 60000 ? "minute" : "minutes"}
                  </span>
                </p>
                <p className="mt-2 text-muted-foreground">
                  {formatPrice(p.amountMinor, p.currency)} <span className="text-xs">(test price)</span>
                </p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{blurbs[p.id]}</p>
                <div className="mt-6">
                  <BuyButton
                    packageId={p.id}
                    signedIn={!!actor}
                    label={`Buy ${formatDuration(p.durationMs)}`}
                    className={`${bigButton(i === 1 ? "default" : "secondary")} w-full`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-14 grid gap-6 border-t border-border pt-8 text-sm text-muted-foreground md:grid-cols-3">
          <p>
            <strong className="block text-foreground">Billing runs while a session is active</strong>
            Standing still still uses time. Press Escape to free the mouse; use Exit to stop the clock.
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

export default function Page() {
  return (
    <Suspense fallback={<PageFallback />}>
      <PricingContent  />
    </Suspense>
  );
}
