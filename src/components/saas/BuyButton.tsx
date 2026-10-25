"use client";
import { useRef, useState } from "react";

export function BuyButton({
  packageId,
  label,
  signedIn,
  className,
}: {
  packageId: string;
  label: string;
  signedIn: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One request key per click intent; retries reuse it so only one purchase exists.
  const requestKey = useRef<string | null>(null);

  async function buy() {
    if (!signedIn) {
      window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    setBusy(true);
    setError(null);
    requestKey.current ??= crypto.randomUUID();
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, requestKey: requestKey.current }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Checkout could not be started.");
      window.location.href = json.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={buy} disabled={busy} className={className}>
        {busy ? "Opening checkout…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
