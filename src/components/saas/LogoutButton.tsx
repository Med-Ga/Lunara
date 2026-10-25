"use client";
import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Server ends any active session first, then signs out.
        await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
        window.location.href = "/";
      }}
      className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
