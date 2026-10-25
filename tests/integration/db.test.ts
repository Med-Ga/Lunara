// Runs against the REAL Supabase Postgres functions (needs SUPABASE_DB_URL).
// Creates two throwaway users, exercises credit/debit/session invariants, then deletes them.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID, createHash } from "node:crypto";

const url = process.env.SUPABASE_DB_URL;
const d = url ? describe : describe.skip;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

let pool: pg.Pool;
const A = randomUUID();
const B = randomUUID();
let packagePrice = "";
let packageAmount = 0;
let packageCurrency = "";
let packageDuration = 0;

async function call<T = Record<string, unknown>>(fn: string, ...args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await pool.query(`select public.${fn}(${params}) as r`, args);
  return rows[0].r as T;
}
async function callErr(fn: string, ...args: unknown[]): Promise<string> {
  try {
    await call(fn, ...args);
    return "NO_ERROR";
  } catch (e) {
    return (e as Error).message;
  }
}
type Snap = {
  balanceMs: number;
  session: null | { id: string; status: string; consumedMs: number; controllerGeneration: number; leaseDeadline: number };
};

async function newPurchase(user: string) {
  const p = await call<{ id: string }>("lunara_reserve_purchase", user, "mars-1m", randomUUID());
  return p.id;
}

d("SQL accounting functions (real database)", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4 });
    for (const id of [A, B]) {
      await pool.query(
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
         values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())`,
        [id, `it-${id}@lunara.test`],
      );
    }
    const { rows } = await pool.query("select * from public.packages where id = 'mars-1m'");
    packagePrice = rows[0].stripe_price_id;
    packageAmount = Number(rows[0].amount_minor);
    packageCurrency = rows[0].currency;
    packageDuration = Number(rows[0].duration_ms);
  });

  afterAll(async () => {
    if (!pool) return;
    for (const id of [A, B]) {
      await pool.query("delete from public.payment_events where purchase_id in (select id from public.purchases where user_id=$1)", [id]);
      for (const t of ["mission_reports", "observations", "mission_telemetry"]) await pool.query(`delete from public.${t} where user_id=$1`, [id]);
      await pool.query("delete from public.destination_balances where user_id=$1", [id]);
      await pool.query("delete from public.exploration_sessions where user_id=$1", [id]);
      await pool.query("delete from public.purchases where user_id=$1", [id]);
      await pool.query("delete from public.accounts where user_id=$1", [id]);
      await pool.query("delete from auth.users where id=$1", [id]);
    }
    await pool.end();
  });

  it("new account starts at zero and cannot start a session", async () => {
    const s = await call<Snap>("lunara_account_snapshot", A);
    expect(s.balanceMs).toBe(0);
    expect(await callErr("lunara_start_session", A, "mars", randomUUID(), hash("x"), 15000)).toBe("INSUFFICIENT_BALANCE");
  });

  it("anon/authenticated roles cannot execute privileged functions", async () => {
    const c = await pool.connect();
    try {
      await c.query("begin; set local role anon");
      await expect(c.query("select public.lunara_account_snapshot($1)", [A])).rejects.toThrow(/permission denied/);
      await c.query("rollback");
      await c.query("begin; set local role authenticated");
      await expect(c.query("select balance_ms from public.accounts")).rejects.toThrow(/permission denied/);
      await c.query("rollback");
    } finally {
      c.release();
    }
  });

  it("verified credit is applied exactly once, even with concurrent and duplicate deliveries", async () => {
    const pid = await newPurchase(A);
    const cs = `cs_test_${randomUUID()}`;
    await call("lunara_bind_checkout", A, pid, cs, "https://example.test");
    const args = [A, pid, cs, packageAmount, packageCurrency, packagePrice];
    const results = await Promise.all([
      call<{ outcome: string }>("lunara_fulfill_purchase", ...args, "evt_1_" + pid, "checkout.session.completed"),
      call<{ outcome: string }>("lunara_fulfill_purchase", ...args, "evt_2_" + pid, "checkout.session.completed"),
      call<{ outcome: string }>("lunara_fulfill_purchase", ...args, null, null),
    ]);
    expect(results.filter((r) => r.outcome === "CREDITED")).toHaveLength(1);
    const dup = await call<{ outcome: string }>("lunara_fulfill_purchase", ...args, "evt_1_" + pid, "checkout.session.completed");
    expect(dup.outcome).toBe("DUPLICATE_EVENT");
    const s = await call<Snap>("lunara_account_snapshot", A);
    expect(s.balanceMs).toBe(packageDuration);
  });

  it("mismatched economics or checkout are rejected with no credit", async () => {
    const pid = await newPurchase(B);
    const cs = `cs_test_${randomUUID()}`;
    await call("lunara_bind_checkout", B, pid, cs, null);
    const wrongAmount = await call<{ outcome: string }>(
      "lunara_fulfill_purchase", B, pid, cs, packageAmount - 1, packageCurrency, packagePrice, "evt_w_" + pid, "x");
    const wrongCheckout = await call<{ outcome: string }>(
      "lunara_fulfill_purchase", B, pid, "cs_other", packageAmount, packageCurrency, packagePrice, null, null);
    expect(wrongAmount.outcome).toBe("REJECTED_ECONOMICS_MISMATCH");
    expect(wrongCheckout.outcome).toBe("REJECTED_CHECKOUT_MISMATCH");
    expect((await call<Snap>("lunara_account_snapshot", B)).balanceMs).toBe(0);
    // expiry/unpaid events can never reverse a credit
    const marked = await call<{ status: string }>("lunara_mark_purchase", B, pid, "CHECKOUT_EXPIRED", null, null, cs);
    expect(marked.status).toBe("CHECKOUT_EXPIRED");
  });

  it("another account cannot touch my purchase", async () => {
    const pid = await newPurchase(A);
    expect(await callErr("lunara_bind_checkout", B, pid, "cs_x", null)).toBe("PURCHASE_NOT_FOUND");
  });

  it("concurrent starts create exactly one ACTIVE session; replay returns the same one", async () => {
    const k1 = randomUUID(), k2 = randomUUID();
    const out = await Promise.allSettled([
      call<Snap>("lunara_start_session", A, "mars", k1, hash("t1"), 15000),
      call<Snap>("lunara_start_session", A, "mars", k2, hash("t2"), 15000),
    ]);
    const ok = out.filter((o) => o.status === "fulfilled");
    const bad = out.filter((o) => o.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(bad[0].reason.message).toBe("SESSION_ALREADY_ACTIVE");
    const { rows } = await pool.query("select count(*)::int n from public.exploration_sessions where user_id=$1 and status='ACTIVE'", [A]);
    expect(rows[0].n).toBe(1);
    const winner = (ok[0] as PromiseFulfilledResult<Snap>).value.session!;
    const winnerKey = winner.id && (await pool.query("select start_request_key k, controller_hash h from public.exploration_sessions where id=$1", [winner.id])).rows[0];
    const replay = await call<Snap & { replayed: boolean }>("lunara_start_session", A, "mars", winnerKey.k, winnerKey.h, 15000);
    expect(replay.session!.id).toBe(winner.id);
    expect(replay.replayed).toBe(true);
  });

  it("stale controller and cross-account requests are refused; duplicate seq does not extend", async () => {
    const snap = await call<Snap>("lunara_account_snapshot", A);
    const s = snap.session!;
    const { rows } = await pool.query("select controller_hash h from public.exploration_sessions where id=$1", [s.id]);
    const h = rows[0].h;
    expect(await callErr("lunara_heartbeat", B, s.id, h, 1, 1, 15000)).toBe("SESSION_NOT_FOUND");
    expect(await callErr("lunara_heartbeat", A, s.id, hash("wrong"), 1, 1, 15000)).toBe("STALE_CONTROLLER");
    const hb1 = await call<Snap>("lunara_heartbeat", A, s.id, h, 1, 5, 15000);
    await sleep(300);
    const hb2 = await call<Snap>("lunara_heartbeat", A, s.id, h, 1, 5, 15000); // replay
    expect(hb2.session!.leaseDeadline).toBe(hb1.session!.leaseDeadline);
  });

  it("takeover is compare-and-swap: one winner, old controller fenced", async () => {
    const s = (await call<Snap>("lunara_account_snapshot", A)).session!;
    const old = (await pool.query("select controller_hash h from public.exploration_sessions where id=$1", [s.id])).rows[0].h;
    const out = await Promise.allSettled([
      call<Snap>("lunara_takeover", A, s.id, s.controllerGeneration, hash("n1"), randomUUID(), 15000),
      call<Snap>("lunara_takeover", A, s.id, s.controllerGeneration, hash("n2"), randomUUID(), 15000),
    ]);
    expect(out.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(await callErr("lunara_heartbeat", A, s.id, old, s.controllerGeneration, 99, 15000)).toBe("STALE_CONTROLLER");
    expect(await callErr("lunara_stop_session", A, s.id, old, s.controllerGeneration)).toBe("STALE_CONTROLLER");
  });

  it("exit settles elapsed time once (stationary time is billed)", async () => {
    const before = (await call<Snap>("lunara_account_snapshot", A)).balanceMs;
    const s = (await call<Snap>("lunara_account_snapshot", A)).session!;
    await sleep(1200);
    const end1 = await call<Snap>("lunara_stop_session", A, s.id, null, null);
    expect(end1.session!.status).toBe("ENDED");
    const spent = before - end1.balanceMs;
    expect(spent).toBeGreaterThanOrEqual(1100);
    expect(spent).toBeLessThan(5000);
    await sleep(300);
    const end2 = await call<Snap>("lunara_stop_session", A, s.id, null, null);
    expect(end2.balanceMs).toBe(end1.balanceMs);
  });

  it("missed heartbeats close the session at the lease cutoff, not at read time", async () => {
    const before = (await call<Snap>("lunara_account_snapshot", A)).balanceMs;
    await call<Snap>("lunara_start_session", A, "mars", randomUUID(), hash("lease"), 1000);
    await sleep(2500);
    const after = await call<Snap>("lunara_account_snapshot", A);
    expect(after.session!.status).toBe("INTERRUPTED");
    expect(before - after.balanceMs).toBeGreaterThanOrEqual(1000);
    expect(before - after.balanceMs).toBeLessThanOrEqual(1100);
  });

  it("balance exhaustion expires the session at zero, never negative", async () => {
    // Test-only fixture: shrink the balance directly (no such public endpoint exists).
    await pool.query("update public.destination_balances set balance_ms = 800 where user_id=$1 and destination_id='mars'", [A]);
    await call<Snap>("lunara_start_session", A, "mars", randomUUID(), hash("exp"), 15000);
    await sleep(1300);
    const s = await call<Snap>("lunara_account_snapshot", A);
    expect(s.session!.status).toBe("EXPIRED");
    expect(s.balanceMs).toBe(0);
    expect(await callErr("lunara_start_session", A, "mars", randomUUID(), hash("again"), 15000)).toBe("INSUFFICIENT_BALANCE");
  });

  it("only mars is startable", async () => {
    expect(await callErr("lunara_start_session", B, "venus", randomUUID(), hash("v"), 15000)).toBe("UNSUPPORTED_DESTINATION");
  });
});
