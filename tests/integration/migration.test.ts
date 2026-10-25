// Rehearses migration 0002 on isolated legacy fixtures INSIDE A TRANSACTION THAT IS ROLLED BACK.
// Works before and after 0002 has been applied to the database (it re-creates legacy state).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";

const url = process.env.SUPABASE_DB_URL;
const d = url ? describe : describe.skip;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const strip = (sql: string) => sql.replace(/^\s*(begin|commit);\s*$/gim, "");
const MIGRATION = strip(readFileSync("supabase/migrations/0002_destinations_discovery.sql", "utf8"));
const SEED = readFileSync("supabase/seed.sql", "utf8");

let c: pg.Client;
const U1 = randomUUID(); // legacy balance + ACTIVE session during cutover
const U2 = randomUUID(); // outstanding legacy Checkout (EUR demo-pass snapshot)
const U3 = randomUUID(); // zero balance; used for stale-writer and cross-destination checks
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await c.query(sql, args)).rows as T[];
const bal = async (u: string, dest: string) =>
  Number((await q<{ b: string }>("select balance_ms b from public.destination_balances where user_id=$1 and destination_id=$2", [u, dest]))[0]?.b ?? -1);

d("migration 0002 rehearsal (rolled back)", () => {
  beforeAll(async () => {
    c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
    await q("begin");
    const applied = (await q<{ ok: boolean }>("select to_regclass('public.destination_balances') is not null ok"))[0].ok;
    if (applied) {
      // Recreate the pre-0002 world for the fixtures only.
      await q("alter table public.accounts drop constraint accounts_legacy_balance_retired");
      await q("alter table public.purchases alter column destination_id drop not null");
    }
    for (const u of [U1, U2, U3]) {
      await q(
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
         values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now())`,
        [u, `mig-${u}@lunara.test`],
      );
    }
    await q("insert into public.accounts (user_id, balance_ms) values ($1, 45000), ($2, 0), ($3, 0)", [U1, U2, U3]);
    if (applied) await q("update public.accounts set balance_migrated_at = null where user_id = any($1)", [[U1, U2, U3]]);
    // Active legacy session, settled 2 s ago, lease still valid.
    await q(
      `insert into public.exploration_sessions (user_id, destination_id, start_request_key, status, started_at,
         accounted_through, lease_deadline, controller_hash)
       values ($1,'mars',$2,'ACTIVE', now() - interval '10 seconds', now() - interval '2 seconds', now() + interval '13 seconds', $3)`,
      [U1, randomUUID(), hash("legacy")],
    );
    // Outstanding legacy Checkout created before the upgrade (original EUR snapshot).
    const legacyPrice = (await q<{ p: string }>("select stripe_price_id p from public.packages where id='demo-pass'"))[0].p;
    await q(
      `insert into public.purchases (id, user_id, package_id, ${applied ? "destination_id," : ""} request_key, stripe_checkout_id,
         expected_price_id, expected_duration_ms, expected_amount_minor, expected_currency)
       values ('11111111-1111-4111-8111-${U2.slice(-12)}', $1, 'demo-pass', ${applied ? "null," : ""} $2, 'cs_legacy_${U2.slice(0, 8)}', $3, 60000, 100, 'eur')`,
      [U2, randomUUID(), legacyPrice],
    );
    await q(MIGRATION);
    await q(SEED);
  });

  afterAll(async () => {
    if (c) {
      await q("rollback");
      await c.end();
    }
  });

  it("legacy unused time becomes the same amount of Mars time; Moon starts at 0", async () => {
    expect(await bal(U1, "mars")).toBe(45000);
    expect(await bal(U1, "moon")).toBe(0);
    const a = await q<{ b: string }>("select balance_ms b from public.accounts where user_id=$1", [U1]);
    expect(Number(a[0].b)).toBe(0);
  });

  it("re-running the migration does not duplicate balances", async () => {
    await q(MIGRATION);
    expect(await bal(U1, "mars")).toBe(45000);
    expect(await bal(U1, "moon")).toBe(0);
  });

  it("the active session keeps billing correctly across the cutover (conservation)", async () => {
    const snap = (await q<{ r: { session: { status: string; consumedMs: number }; balances: Record<string, number> } }>(
      "select public.lunara_account_snapshot($1) r", [U1]))[0].r;
    expect(snap.session.status).toBe("ACTIVE");
    expect(snap.session.consumedMs).toBeGreaterThanOrEqual(2000);
    expect(snap.balances.mars + snap.session.consumedMs).toBe(45000);
  });

  it("an outstanding legacy Checkout fulfills once, at its original snapshot, into Mars", async () => {
    const pid = `11111111-1111-4111-8111-${U2.slice(-12)}`;
    const p = (await q<{ destination_id: string; expected_currency: string; expected_amount_minor: string }>(
      "select * from public.purchases where id=$1", [pid]))[0];
    expect(p.destination_id).toBe("mars");
    expect(p.expected_currency).toBe("eur");
    const legacyPrice = (await q<{ p: string }>("select stripe_price_id p from public.packages where id='demo-pass'"))[0].p;
    const args = [U2, pid, `cs_legacy_${U2.slice(0, 8)}`, 100, "eur", legacyPrice];
    const r1 = (await q<{ r: { outcome: string } }>("select public.lunara_fulfill_purchase($1,$2,$3,$4,$5,$6,$7,$8) r", [...args, "evt_mig_1", "checkout.session.completed"]))[0].r;
    const r2 = (await q<{ r: { outcome: string } }>("select public.lunara_fulfill_purchase($1,$2,$3,$4,$5,$6,$7,$8) r", [...args, "evt_mig_2", "checkout.session.completed"]))[0].r;
    expect(r1.outcome).toBe("CREDITED");
    expect(r2.outcome).toBe("ALREADY_CREDITED");
    expect(await bal(U2, "mars")).toBe(60000);
    expect(await bal(U2, "moon")).toBe(0);
    const hist = (await q<{ expected_amount_minor: string; expected_currency: string; package_id: string }>(
      "select * from public.purchases where id=$1", [pid]))[0];
    expect([Number(hist.expected_amount_minor), hist.expected_currency, hist.package_id]).toEqual([100, "eur", "demo-pass"]);
  });

  it("legacy packages are no longer sold; new packages carry the new rates", async () => {
    const rows = await q<{ id: string; active: boolean; amount_minor: string; currency: string; destination_id: string }>(
      "select * from public.packages");
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId["demo-pass"].active).toBe(false);
    expect([Number(byId["mars-1m"].amount_minor), byId["mars-1m"].currency]).toEqual([1000, "usd"]);
    expect([Number(byId["moon-1m"].amount_minor), byId["moon-1m"].currency]).toEqual([700, "usd"]);
    expect(Number(byId["moon-10m"].amount_minor)).toBe(7000);
    await q("savepoint s1");
    await expect(q("select public.lunara_reserve_purchase($1,'demo-pass',$2)", [U3, randomUUID()])).rejects.toThrow("PACKAGE_UNAVAILABLE");
    await q("rollback to savepoint s1");
  });

  it("stale writers cannot credit the retired account balance", async () => {
    await q("savepoint s2");
    await expect(q("update public.accounts set balance_ms = balance_ms + 1000 where user_id=$1", [U3])).rejects.toThrow(/accounts_legacy_balance_retired/);
    await q("rollback to savepoint s2");
  });

  it("an old Mars-only client cannot spend Moon credit", async () => {
    await q("update public.destination_balances set balance_ms = 5000 where user_id=$1 and destination_id='moon'", [U3]);
    await q("savepoint s3");
    await expect(q("select public.lunara_start_session($1,'mars',$2,$3,15000)", [U3, randomUUID(), hash("old")])).rejects.toThrow("INSUFFICIENT_BALANCE");
    await q("rollback to savepoint s3");
    const ok = (await q<{ r: { session: { destinationId: string } } }>("select public.lunara_start_session($1,'moon',$2,$3,15000) r", [U3, randomUUID(), hash("new")]))[0].r;
    expect(ok.session.destinationId).toBe("moon");
  });
});
