import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageFallback, SiteFooter, SiteHeader, TestModeBadge, bigButton } from "@/components/saas/chrome";
import { EndSessionButton } from "@/components/saas/EndSessionButton";
import { getActor } from "@/server/auth";
import { listOwnedPurchases, toPurchaseDTO } from "@/server/db";
import { sessions } from "@/server/sessions/service";
import { formatDuration, formatPrice, type AccountSnapshot } from "@/shared/contracts";
import { formatMMSS } from "@/server/sessions/accounting";


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
  try {
    snap = await sessions.snapshot(actor.id);
    purchases = (await listOwnedPurchases(actor.id)).map(toPurchaseDTO);
  } catch (e) {
    console.error("[lunara] dashboard data unavailable", (e as Error).message);
  }
  const active = snap?.session?.status === "ACTIVE" ? snap.session : null;
  const balance = snap?.balanceMs ?? 0;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold">Mission console</h1>
            <p className="mt-2 text-muted-foreground">Signed in as {actor.email}</p>
          </div>
          <TestModeBadge />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section aria-labelledby="balance" className="rounded-xl border border-border bg-panel p-6">
            <h2 id="balance" className="text-lg font-bold">
              Exploration time
            </h2>
            {snap ? (
              <>
                <p className="mt-4 font-heading text-6xl font-extrabold tabular" aria-live="polite">
                  {formatMMSS(balance)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">minutes : seconds remaining on your account</p>
                {active ? (
                  <div className="mt-6 rounded-lg border border-ok/40 bg-ok/10 p-4">
                    <p className="font-semibold text-ok">Session active, time is running</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A Mars session is open in another tab or was interrupted by a refresh.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href="/explore/mars" className={bigButton()}>
                        Return to session
                      </Link>
                      <EndSessionButton sessionId={active.id} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/pricing" className={bigButton(balance > 0 ? "secondary" : "default")}>
                      Buy time
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <p className="font-semibold">Balance unavailable</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We couldn&rsquo;t reach the account service. Your time is safe; reload to try again.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="dest" className="relative overflow-hidden rounded-xl border border-border">
            <div className="horizon absolute inset-0" aria-hidden="true" />
            <div className="horizon-ridge absolute inset-x-0 bottom-0 h-28" aria-hidden="true" />
            <div className="relative p-6 pb-36">
              <h2 id="dest" className="text-3xl font-extrabold">
                Mars
              </h2>
              <p className="mt-2 max-w-md text-sm text-foreground/85">
                A simulated rocky basin about 400 m across. First-person camera, keyboard and mouse, desktop only.
              </p>
              <div className="mt-6">
                {active ? (
                  <Link href="/explore/mars" className={bigButton()}>
                    Return to Mars
                  </Link>
                ) : balance > 0 ? (
                  <Link href="/explore/mars" className={bigButton()}>
                    Explore Mars
                  </Link>
                ) : (
                  <p className="text-sm">
                    <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
                      Buy a package
                    </Link>{" "}
                    to unlock exploration.
                  </p>
                )}
              </div>
              <p className="mt-6 text-xs text-foreground/70">Moon, Europa and Titan are not available in this prototype.</p>
            </div>
          </section>
        </div>

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
                  <th className="py-2 font-medium">Time</th>
                  <th className="py-2 font-medium">Test price</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2.5 tabular">{new Date(p.createdAt).toLocaleString("en-GB")}</td>
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
      <DashboardContent  />
    </Suspense>
  );
}
