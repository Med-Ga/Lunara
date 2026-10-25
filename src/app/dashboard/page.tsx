import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageFallback, SiteFooter, SiteHeader, TestModeBadge, bigButton } from "@/components/saas/chrome";
import { EndSessionButton } from "@/components/saas/EndSessionButton";
import { getActor } from "@/server/auth";
import { listOwnedPurchases, listPackages, toPurchaseDTO } from "@/server/db";
import { sessions } from "@/server/sessions/service";
import { formatDuration, formatPrice, type AccountSnapshot, type PackageDTO } from "@/shared/contracts";
import { formatMMSS } from "@/server/sessions/accounting";
import { DESTINATIONS, DESTINATION_IDS } from "@/config/destinations";

const STATUS_TEXT: Record<string, string> = {
  CREDITED: "Credited",
  PENDING: "Confirming",
  UNPAID: "Not paid",
  CHECKOUT_EXPIRED: "Checkout expired",
};

async function DashboardContent() {
  const actor = await getActor();
  if (!actor) redirect("/login?next=/dashboard");

  let snap: AccountSnapshot | null = null;
  let purchases: ReturnType<typeof toPurchaseDTO>[] = [];
  let packages: PackageDTO[] = [];
  try {
    snap = await sessions.snapshot(actor.id);
    purchases = (await listOwnedPurchases(actor.id)).map(toPurchaseDTO);
    packages = await listPackages();
  } catch (e) {
    console.error("[lunara] dashboard data unavailable", (e as Error).message);
  }
  const active = snap?.session?.status === "ACTIVE" ? snap.session : null;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold">Mission console</h1>
            <p className="mt-2 text-muted-foreground">Signed in as {actor.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/missions" className="text-sm text-primary underline-offset-4 hover:underline">
              My discoveries
            </Link>
            <TestModeBadge />
          </div>
        </div>

        {!snap && (
          <div role="alert" className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <p className="font-semibold">Balance unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn&rsquo;t reach the account service. Your time is safe; reload to try again.
            </p>
          </div>
        )}

        {active && (
          <div className="mt-8 rounded-lg border border-ok/40 bg-ok/10 p-4">
            <p className="font-semibold text-ok">
              {DESTINATIONS[active.destinationId].name} session active, time is running
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A session is open in another tab or was interrupted by a refresh. Only one session can run at a time.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/explore/${active.destinationId}`} className={bigButton()}>
                Return to session
              </Link>
              <EndSessionButton sessionId={active.id} />
            </div>
          </div>
        )}

        <section aria-labelledby="dest" className="mt-8">
          <h2 id="dest" className="sr-only">
            Destinations
          </h2>
          <ul className="grid gap-6 md:grid-cols-2">
            {DESTINATION_IDS.map((id) => {
              const d = DESTINATIONS[id];
              const bal = snap?.balances[id] ?? 0;
              const perMinute = packages.find((p) => p.destinationId === id && p.durationMs === 60000);
              const busyElsewhere = active && active.destinationId !== id;
              return (
                <li key={id} className="relative flex flex-col overflow-hidden rounded-xl border border-border">
                  <div className={`${d.previewClass} absolute inset-0`} aria-hidden="true" />
                  <div className="relative flex flex-1 flex-col p-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-3xl font-extrabold">{d.name}</h3>
                      <span className="text-sm text-foreground/80">{d.tagline}</span>
                    </div>
                    <p className="mt-2 max-w-md text-sm text-foreground/85">
                      {d.description} Simulated exploration, desktop keyboard and mouse.
                    </p>
                    <dl className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-xs text-foreground/70">Your {d.name} time</dt>
                        <dd className="font-heading text-4xl font-extrabold tabular">{snap ? formatMMSS(bal) : "--:--"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-foreground/70">Price</dt>
                        <dd className="mt-2 text-lg font-semibold">
                          {perMinute ? `${formatPrice(perMinute.amountMinor, perMinute.currency)} / minute` : "Unavailable"}
                          <span className="block text-xs font-normal text-foreground/70">test mode</span>
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap gap-3 pt-6">
                      <Link href={`/pricing?destination=${id}`} className={bigButton(bal > 0 ? "secondary" : "default")}>
                        Buy {d.name} time
                      </Link>
                      {bal > 0 && !busyElsewhere && (
                        <Link href={`/explore/${id}`} className={bigButton()}>
                          Explore {d.name}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="history" className="mt-10">
          <h2 id="history" className="text-lg font-bold">
            Recent purchases
          </h2>
          {purchases.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No purchases yet.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Destination</th>
                  <th className="py-2 font-medium">Time</th>
                  <th className="py-2 font-medium">Test price</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2.5 tabular">{new Date(p.createdAt).toLocaleString("en-GB")}</td>
                    <td className="py-2.5">{DESTINATIONS[p.destinationId]?.name ?? p.destinationId}</td>
                    <td className="py-2.5">{formatDuration(p.durationMs)}</td>
                    <td className="py-2.5 tabular">{formatPrice(p.amountMinor, p.currency)}</td>
                    <td className="py-2.5">
                      {p.status === "PENDING" ? (
                        <Link href={`/purchase-status?purchase=${p.id}`} className="text-primary hover:underline">
                          Confirming, check status
                        </Link>
                      ) : (
                        STATUS_TEXT[p.status] ?? p.status
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
