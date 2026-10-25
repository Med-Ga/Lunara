"use client";
import { useState } from "react";
import { bigButtonOutlineClass } from "./styles";

// Owner-level End Session (no controller token): settles and closes the active session.
export function EndSessionButton({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={bigButtonOutlineClass}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" }).catch(() => null);
          if (res?.ok) window.location.reload();
          else {
            setError("Session end not confirmed. Billing still stops at the connection cutoff.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Ending…" : "End session"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
