"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDuration, type PurchaseDTO } from "@/shared/contracts";
import { bigButtonClass, bigButtonSecondaryClass } from "./styles";

// Polls with backoff (2, 4, 8 s… up to 60 s). Each check asks the server to verify
// the payment with Stripe through the same idempotent fulfillment path as the webhook.
export function PurchaseStatusView({ purchaseId, canceled }: { purchaseId: string | null; canceled: boolean }) {
  const [purchase, setPurchase] = useState<PurchaseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  const check = useCallback(async () => {
    if (!purchaseId) return null;
    setChecking(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/reconcile`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Status unavailable");
      setPurchase(json.purchase);
      setError(null);
      return json.purchase as PurchaseDTO;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setChecking(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    let delay = 2000;
    let timer: number;
    let stop = false;
    const startedAt = Date.now();
    const loop = async () => {
      const p = await check();
      if (stop || (p && p.status !== "PENDING")) return;
      if (Date.now() - startedAt > 60_000) {
        setGaveUp(true);
        return;
      }
      timer = window.setTimeout(loop, delay);
      delay = Math.min(delay * 2, 8000);
    };
    void loop();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [check]);

  if (!purchaseId) {
    return <p>No purchase selected. <Link href="/dashboard" className="text-primary">Back to dashboard</Link></p>;
  }

  const status = purchase?.status;
  return (
    <div aria-live="polite">
      {status === "CREDITED" ? (
        <>
          <h1 className="text-4xl font-extrabold">Time added</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Stripe confirmed your test payment. {formatDuration(purchase!.durationMs)} of exploration time is now on
            your account.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/explore/mars" className={bigButtonClass}>
              Explore Mars
            </Link>
            <Link href="/dashboard" className={bigButtonSecondaryClass}>
              Go to dashboard
            </Link>
          </div>
        </>
      ) : status === "UNPAID" || status === "CHECKOUT_EXPIRED" ? (
        <>
          <h1 className="text-4xl font-extrabold">{status === "UNPAID" ? "Payment not completed" : "Checkout expired"}</h1>
          <p className="mt-3 text-lg text-muted-foreground">No time was added and nothing was charged.</p>
          <Link href="/pricing" className={`${bigButtonClass} mt-8`}>
            Choose a package
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-4xl font-extrabold">{canceled ? "Checkout closed" : "Confirming payment"}</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {canceled
              ? "You left the checkout before paying, so no time has been added. If you did complete payment, it will still be credited once Stripe confirms it."
              : "Waiting for Stripe to confirm your test payment. Time is added only after verification."}
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => void check()} disabled={checking} className={bigButtonClass}>
              {checking ? "Checking…" : "Check payment"}
            </button>
            <Link href={canceled ? "/pricing" : "/dashboard"} className={bigButtonSecondaryClass}>
              {canceled ? "Back to packages" : "Go to dashboard"}
            </Link>
          </div>
          {gaveUp && (
            <p className="mt-4 text-sm text-muted-foreground">
              Still pending. You can check again later; nothing is lost.
            </p>
          )}
        </>
      )}
    </div>
  );
}
