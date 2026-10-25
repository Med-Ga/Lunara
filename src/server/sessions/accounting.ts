// Pure reference model of the settlement rule in ARCHITECTURE §5.5.
// The authoritative implementation is the SQL function lunara_reconcile; this
// mirror exists so the arithmetic can be unit tested deterministically.

export type SessionStatus = "ACTIVE" | "ENDED" | "INTERRUPTED" | "EXPIRED";

export interface LedgerState {
  balanceMs: number; // B: settled balance
  accountedThrough: number; // A
  leaseDeadline: number; // L: raw lease
  status: SessionStatus;
  consumedMs: number;
  endedAt: number | null;
}

export function reconcile(state: LedgerState, now: number): LedgerState {
  if (state.status !== "ACTIVE") return state;
  const A = state.accountedThrough;
  const B = state.balanceMs;
  const N = Math.max(now, A);
  const E = A + B;
  const C = Math.min(state.leaseDeadline, E);
  const T = Math.min(N, C);
  const delta = Math.max(0, T - A);
  const next: LedgerState = {
    ...state,
    balanceMs: B - delta,
    consumedMs: state.consumedMs + delta,
    accountedThrough: T,
  };
  if (N >= C) {
    next.status = E <= state.leaseDeadline ? "EXPIRED" : "INTERRUPTED";
    next.endedAt = C;
  }
  return next;
}

export function start(balanceMs: number, now: number, leaseMs: number): LedgerState {
  if (balanceMs <= 0) throw new Error("INSUFFICIENT_BALANCE");
  return {
    balanceMs,
    accountedThrough: now,
    leaseDeadline: now + leaseMs,
    status: "ACTIVE",
    consumedMs: 0,
    endedAt: null,
  };
}

export function heartbeat(state: LedgerState, now: number, leaseMs: number): LedgerState {
  const s = reconcile(state, now);
  if (s.status !== "ACTIVE") return s;
  return { ...s, leaseDeadline: Math.max(now, s.accountedThrough) + leaseMs };
}

export function stop(state: LedgerState, now: number): LedgerState {
  const s = reconcile(state, now);
  if (s.status !== "ACTIVE") return s;
  return { ...s, status: "ENDED", endedAt: s.accountedThrough };
}

export function credit(state: LedgerState, now: number, ms: number): LedgerState {
  const s = reconcile(state, now); // settle prior use before adding credit
  return { ...s, balanceMs: s.balanceMs + ms };
}

/** Countdown display: whole seconds rounded up while positive, 0 at zero. */
export function displaySeconds(remainingMs: number): number {
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export function formatMMSS(remainingMs: number): string {
  const s = displaySeconds(remainingMs);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
