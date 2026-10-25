import { describe, expect, it } from "vitest";
import {
  credit,
  displaySeconds,
  formatMMSS,
  heartbeat,
  reconcile,
  start,
  stop,
} from "../../src/server/sessions/accounting";

const LEASE = 15_000;

describe("time accounting (ARCHITECTURE §5.5 deterministic examples)", () => {
  it("60s balance, 20s active (even stationary), exit -> 40s retained", () => {
    let s = start(60_000, 0, LEASE);
    s = heartbeat(s, 5_000, LEASE);
    s = heartbeat(s, 10_000, LEASE);
    s = heartbeat(s, 15_000, LEASE);
    s = stop(s, 20_000);
    expect(s.status).toBe("ENDED");
    expect(s.consumedMs).toBe(20_000);
    expect(s.balanceMs).toBe(40_000);
  });

  it("repeated exit settles once", () => {
    let s = start(60_000, 0, LEASE);
    s = heartbeat(s, 10_000, LEASE);
    s = stop(s, 20_000);
    const again = stop(s, 25_000);
    expect(again).toEqual(s);
  });

  it("renewal at 10s, no more renewals -> closed at 25s even if read at 200s", () => {
    let s = start(600_000, 0, LEASE);
    s = heartbeat(s, 10_000, LEASE);
    s = reconcile(s, 200_000);
    expect(s.status).toBe("INTERRUPTED");
    expect(s.endedAt).toBe(25_000);
    expect(s.consumedMs).toBe(25_000);
    expect(s.balanceMs).toBe(575_000);
  });

  it("12s balance with 15s lease expires at 12s, never negative", () => {
    let s = start(12_000, 0, LEASE);
    s = reconcile(s, 30_000);
    expect(s.status).toBe("EXPIRED");
    expect(s.endedAt).toBe(12_000);
    expect(s.balanceMs).toBe(0);
  });

  it("equal exhaustion and lease cutoff classify EXPIRED", () => {
    const s = reconcile(start(15_000, 0, LEASE), 15_000);
    expect(s.status).toBe("EXPIRED");
  });

  it("reads every 100ms for 1s consume exactly 1000ms (no per-call rounding)", () => {
    let s = start(60_000, 0, LEASE);
    for (let t = 100; t <= 1_000; t += 100) s = reconcile(s, t);
    expect(s.consumedMs).toBe(1_000);
    expect(s.balanceMs).toBe(59_000);
  });

  it("second reconcile at the same instant charges zero", () => {
    const a = reconcile(start(60_000, 0, LEASE), 7_000);
    expect(reconcile(a, 7_000)).toEqual(a);
  });

  it("backward clock is clamped (no negative delta)", () => {
    const a = reconcile(start(60_000, 0, LEASE), 7_000);
    const b = reconcile(a, 3_000);
    expect(b.balanceMs).toBe(a.balanceMs);
  });

  it("terminal sessions never accrue or reopen", () => {
    const ended = stop(start(60_000, 0, LEASE), 5_000);
    expect(heartbeat(ended, 6_000, LEASE)).toEqual(ended);
    expect(reconcile(ended, 99_000)).toEqual(ended);
  });

  it("credit while active settles prior use first and keeps the lease", () => {
    let s = start(10_000, 0, LEASE);
    s = credit(s, 4_000, 60_000);
    expect(s.status).toBe("ACTIVE");
    expect(s.balanceMs).toBe(66_000);
    expect(s.leaseDeadline).toBe(15_000);
  });

  it("credit after exhaustion closes the old session; credit is kept for a new start", () => {
    let s = start(5_000, 0, LEASE);
    s = credit(s, 8_000, 60_000);
    expect(s.status).toBe("EXPIRED");
    expect(s.balanceMs).toBe(60_000);
  });

  it("conservation: credited - consumed = balance", () => {
    let s = start(60_000, 0, LEASE);
    s = heartbeat(s, 5_000, LEASE);
    s = credit(s, 7_000, 300_000);
    s = heartbeat(s, 10_000, LEASE);
    s = stop(s, 13_000);
    expect(60_000 + 300_000 - s.consumedMs).toBe(s.balanceMs);
  });

  it("zero balance cannot start", () => {
    expect(() => start(0, 0, LEASE)).toThrow("INSUFFICIENT_BALANCE");
  });

  it("countdown rounds up and never shows negative", () => {
    expect(displaySeconds(59_001)).toBe(60);
    expect(displaySeconds(1)).toBe(1);
    expect(displaySeconds(0)).toBe(0);
    expect(displaySeconds(-50)).toBe(0);
    expect(formatMMSS(61_000)).toBe("01:01");
    expect(formatMMSS(0)).toBe("00:00");
  });
});
