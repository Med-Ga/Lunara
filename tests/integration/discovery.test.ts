// LUNARA 2.0 guarantees against the REAL database functions (needs SUPABASE_DB_URL).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID, createHash } from "node:crypto";
import { DESTINATIONS, findSite, type GeoSite } from "../../src/config/destinations";
import { buildReport, type MissionData } from "../../src/server/missions/report";

const url = process.env.SUPABASE_DB_URL;
const d = url ? describe : describe.skip;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

let pool: pg.Pool;
const A = randomUUID();
const B = randomUUID();
type Snap = {
  balances: Record<string, number>;
  balanceMs: number;
  session: null | { id: string; status: string; destinationId: string; controllerGeneration: number; distanceMu: number; scannedSites: string[] };
};

async function call<T = Record<string, unknown>>(fn: string, args: Record<string, unknown>): Promise<T> {
  const keys = Object.keys(args);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(",")}) as r`;
  const { rows } = await pool.query(sql, keys.map((k) => args[k]));
  return rows[0].r as T;
}
async function err(fn: string, args: Record<string, unknown>) {
  try {
    await call(fn, args);
    return "NO_ERROR";
  } catch (e) {
    return (e as Error).message;
  }
}
const setBal = (u: string, dest: string, ms: number) =>
  pool.query("update public.destination_balances set balance_ms=$3 where user_id=$1 and destination_id=$2", [u, dest, ms]);
const start = (u: string, dest: string, token: string, lease = 15000) =>
  call<Snap>("lunara_start_session", { p_user: u, p_destination: dest, p_request_key: randomUUID(), p_controller_hash: hash(token), p_lease_ms: lease });
const stop = (u: string, sid: string) => call<Snap>("lunara_stop_session", { p_user: u, p_session: sid, p_controller_hash: null, p_generation: null });
function scanArgs(u: string, sid: string, token: string, site: GeoSite, x = site.x, z = site.z, gen = 1) {
  const dd = DESTINATIONS[site.destinationId];
  return {
    p_user: u, p_session: sid, p_controller_hash: hash(token), p_generation: gen,
    p_site_id: site.id, p_site_destination: site.destinationId, p_site_x: site.x, p_site_z: site.z,
    p_site_radius: site.radius, p_dataset_version: dd.datasetVersion,
    p_snapshot: JSON.stringify({ name: site.name, category: site.category, attributes: site.attributes, interpretation: site.interpretation, source: "simulated-predefined-dataset" }),
    p_x: x, p_z: z, p_spawn_x: dd.spawn.x, p_spawn_z: dd.spawn.z, p_max_speed: dd.speed,
  };
}
const backdate = (sid: string, sec: number) =>
  pool.query("update public.exploration_sessions set started_at = started_at - make_interval(secs => $2) where id=$1", [sid, sec]);
const hb = (u: string, sid: string, token: string, seq: number, tel: object | null) =>
  call<Snap>("lunara_heartbeat", {
    p_user: u, p_session: sid, p_controller_hash: hash(token), p_generation: 1, p_seq: seq, p_lease_ms: 15000,
    p_telemetry: tel ? JSON.stringify(tel) : null, p_max_speed: 5,
  });

d("LUNARA 2.0 destinations, scans, telemetry, reports (real database)", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4 });
    for (const id of [A, B]) {
      await pool.query(
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
         values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now())`,
        [id, `it2-${id}@lunara.test`],
      );
      await call("lunara_account_snapshot", { p_user: id });
    }
  });

  afterAll(async () => {
    if (!pool) return;
    for (const id of [A, B]) {
      await pool.query("delete from public.payment_events where purchase_id in (select id from public.purchases where user_id=$1)", [id]);
      for (const t of ["mission_reports", "observations", "mission_telemetry", "exploration_sessions", "purchases", "destination_balances", "accounts"])
        await pool.query(`delete from public.${t} where user_id=$1`, [id]);
      await pool.query("delete from auth.users where id=$1", [id]);
    }
    await pool.end();
  });

  it("new accounts start with Mars 0 and Moon 0", async () => {
    const s = await call<Snap>("lunara_account_snapshot", { p_user: A });
    expect(s.balances).toEqual({ mars: 0, moon: 0 });
  });

  it("a Moon purchase credits only Moon time, at the Moon snapshot ($7.00 / minute)", async () => {
    const p = await call<{ id: string; destination_id: string; expected_amount_minor: number; expected_currency: string; expected_price_id: string }>(
      "lunara_reserve_purchase", { p_user: A, p_package: "moon-1m", p_request_key: randomUUID() });
    expect([p.destination_id, Number(p.expected_amount_minor), p.expected_currency]).toEqual(["moon", 700, "usd"]);
    const mars = await call<{ expected_amount_minor: number }>("lunara_reserve_purchase", { p_user: A, p_package: "mars-1m", p_request_key: randomUUID() });
    expect(Number(mars.expected_amount_minor)).toBe(1000);
    const cs = `cs_test_${randomUUID()}`;
    await call("lunara_bind_checkout", { p_user: A, p_purchase: p.id, p_checkout: cs, p_url: null });
    const r = await call<{ outcome: string }>("lunara_fulfill_purchase", {
      p_user: A, p_purchase: p.id, p_checkout: cs, p_amount_total: 700, p_currency: "usd", p_price_id: p.expected_price_id,
      p_event_id: `evt_${randomUUID()}`, p_event_type: "checkout.session.completed",
    });
    expect(r.outcome).toBe("CREDITED");
    const s = await call<Snap>("lunara_account_snapshot", { p_user: A });
    expect(s.balances).toEqual({ mars: 0, moon: 60000 });
  });

  it("a forged Mars price/amount on a Moon purchase is rejected with no credit", async () => {
    const p = await call<{ id: string }>("lunara_reserve_purchase", { p_user: B, p_package: "moon-1m", p_request_key: randomUUID() });
    const marsPrice = (await pool.query("select stripe_price_id p from public.packages where id='mars-1m'")).rows[0].p;
    const r = await call<{ outcome: string }>("lunara_fulfill_purchase", {
      p_user: B, p_purchase: p.id, p_checkout: "cs_forged", p_amount_total: 1000, p_currency: "usd", p_price_id: marsPrice,
      p_event_id: null, p_event_type: null,
    });
    expect(r.outcome).toBe("REJECTED_ECONOMICS_MISMATCH");
    expect((await call<Snap>("lunara_account_snapshot", { p_user: B })).balances).toEqual({ mars: 0, moon: 0 });
  });

  it("Moon time cannot start a Mars session; consumption debits only the session destination", async () => {
    expect(await err("lunara_start_session", { p_user: A, p_destination: "mars", p_request_key: randomUUID(), p_controller_hash: hash("x"), p_lease_ms: 15000 })).toBe("INSUFFICIENT_BALANCE");
    await setBal(A, "mars", 30000);
    const s = await start(A, "moon", "moon-1");
    await sleep(1100);
    const end = await stop(A, s.session!.id);
    expect(end.balances.mars).toBe(30000);
    expect(end.balances.moon).toBeLessThanOrEqual(60000 - 1000);
    expect(end.balances.moon).toBeGreaterThan(55000);
  });

  it("simultaneous cross-destination starts cannot bypass the one-active-session rule", async () => {
    const out = await Promise.allSettled([start(A, "mars", "race-m"), start(A, "moon", "race-n")]);
    expect(out.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect((out.find((o) => o.status === "rejected") as PromiseRejectedResult).reason.message).toBe("SESSION_ALREADY_ACTIVE");
    const active = (await pool.query("select id from public.exploration_sessions where user_id=$1 and status='ACTIVE'", [A])).rows;
    expect(active).toHaveLength(1);
    await stop(A, active[0].id);
  });

  it("scans: nearby succeeds once (retries/concurrency); wrong destination, out of range, implausible, cross-user fail", async () => {
    const s = await start(A, "moon", "scan-1");
    const sid = s.session!.id;
    await backdate(sid, 30);
    const near = findSite("moon-central-regolith")!;
    const marsSite = findSite("mars-ridge-regolith")!;
    const results = await Promise.all([
      call<{ outcome: string }>("lunara_record_observation", scanArgs(A, sid, "scan-1", near)),
      call<{ outcome: string }>("lunara_record_observation", scanArgs(A, sid, "scan-1", near)),
      call<{ outcome: string }>("lunara_record_observation", scanArgs(A, sid, "scan-1", near)),
    ]);
    expect(results.filter((r) => r.outcome === "SAVED")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "ALREADY_SAVED")).toHaveLength(2);
    expect(await err("lunara_record_observation", scanArgs(A, sid, "scan-1", marsSite))).toBe("WRONG_DESTINATION");
    const far = findSite("moon-east-basalt")!;
    expect(await err("lunara_record_observation", scanArgs(A, sid, "scan-1", far, far.x + 20, far.z))).toBe("OUT_OF_RANGE");
    // anchor the last accepted position at the near site, then claim to be 90+ mu away instantly
    await hb(A, sid, "scan-1", 1, { segment: randomUUID(), dist: 26, ms: 6000, x: near.x, z: near.z, heading: 0 });
    expect(await err("lunara_record_observation", scanArgs(A, sid, "scan-1", far))).toBe("IMPLAUSIBLE_POSITION");
    expect(await err("lunara_record_observation", scanArgs(B, sid, "scan-1", near))).toBe("SESSION_NOT_FOUND");
    expect(await err("lunara_record_observation", scanArgs(A, sid, "wrong-token", near))).toBe("STALE_CONTROLLER");
    const n = (await pool.query("select count(*)::int n from public.observations where session_id=$1", [sid])).rows[0].n;
    expect(n).toBe(1);
    const snap = await call<Snap>("lunara_account_snapshot", { p_user: A });
    expect(snap.session!.scannedSites).toEqual([near.id]);
    await stop(A, sid);
    // after closure: new scans are refused, retry of the saved one still reports it
    const other = findSite("moon-sw-ilmenite")!;
    expect(await err("lunara_record_observation", scanArgs(A, sid, "scan-1", other))).toBe("SESSION_NOT_ACTIVE");
    expect((await call<{ outcome: string }>("lunara_record_observation", scanArgs(A, sid, "scan-1", near))).outcome).toBe("ALREADY_SAVED");
  });

  it("telemetry: retries and replays never double-count; refresh segments start fresh; teleports are excluded", async () => {
    const s = await start(A, "moon", "tel-1");
    const sid = s.session!.id;
    const seg1 = randomUUID();
    await sleep(1200);
    await hb(A, sid, "tel-1", 1, { segment: seg1, dist: 4, ms: 1000, x: 0, z: -4, heading: 0 });
    await hb(A, sid, "tel-1", 1, { segment: seg1, dist: 4, ms: 1000, x: 0, z: -4, heading: 0 }); // replayed seq
    await sleep(1200);
    await hb(A, sid, "tel-1", 2, { segment: seg1, dist: 9, ms: 2100, x: 0, z: -9, heading: 0 }); // cumulative → +5
    await hb(A, sid, "tel-1", 3, { segment: seg1, dist: 9, ms: 2100, x: 0, z: -9, heading: 0 }); // retry with new seq → +0
    let t = (await pool.query("select * from public.mission_telemetry where session_id=$1", [sid])).rows[0];
    expect(Number(t.distance_mu)).toBeCloseTo(9);
    // refresh → new segment counts from its own zero, no double count of seg1
    await sleep(1200);
    await hb(A, sid, "tel-1", 4, { segment: randomUUID(), dist: 3, ms: 900, x: 0, z: -12, heading: 0 });
    t = (await pool.query("select * from public.mission_telemetry where session_id=$1", [sid])).rows[0];
    expect(Number(t.distance_mu)).toBeCloseTo(12);
    // teleport: huge jump in position with tiny reported distance is not counted
    await sleep(300);
    await hb(A, sid, "tel-1", 5, { segment: randomUUID(), dist: 1, ms: 300, x: 150, z: 150, heading: 0 });
    t = (await pool.query("select * from public.mission_telemetry where session_id=$1", [sid])).rows[0];
    expect(Number(t.distance_mu)).toBeCloseTo(12);
    expect(Number(t.rejected_count)).toBeGreaterThanOrEqual(1);
    await stop(A, sid);
    // after closure, telemetry is ignored (finalization boundary)
    await hb(A, sid, "tel-1", 6, { segment: randomUUID(), dist: 2, ms: 300, x: 150, z: 151, heading: 0 });
    expect(Number((await pool.query("select distance_mu from public.mission_telemetry where session_id=$1", [sid])).rows[0].distance_mu)).toBeCloseTo(12);
  });

  it("scan-vs-expiry race: a scan after the cutoff is rejected and the report holds only accepted scans", async () => {
    await setBal(A, "moon", 900);
    const s = await start(A, "moon", "race-1");
    const sid = s.session!.id;
    await backdate(sid, 30);
    const near = findSite("moon-central-regolith")!;
    await call("lunara_record_observation", scanArgs(A, sid, "race-1", near));
    await sleep(1300); // past the 0.9 s exhaustion cutoff, no request in between
    const west = findSite("moon-west-highland")!;
    expect(await err("lunara_record_observation", scanArgs(A, sid, "race-1", west))).toBe("SESSION_NOT_ACTIVE");
    // the rejected scan rolled back its own closure; the app reconciles before reading (same cutoff)
    await call("lunara_account_snapshot", { p_user: A });
    const data = await call<MissionData & { report: unknown }>("lunara_mission_data", { p_user: A, p_session: sid });
    expect(data.session.status).toBe("EXPIRED");
    expect(data.session.consumedMs).toBe(900);
    const report = buildReport(data, "test");
    expect(report.observations.map((o) => o.siteId)).toEqual([near.id]);
    expect(report.mission.endReason).toBe("Time exhaustion");
  });

  it("reports: refused while active; one canonical READY report; FAILED can be replaced; READY is immutable", async () => {
    await setBal(A, "mars", 30000);
    const s = await start(A, "mars", "rep-1");
    const sid = s.session!.id;
    expect(await err("lunara_save_report", { p_user: A, p_session: sid, p_status: "READY", p_report: "{}", p_error: null })).toBe("SESSION_NOT_CLOSED");
    await stop(A, sid); // billing is final before any report exists
    expect((await pool.query("select count(*)::int n from public.mission_reports where session_id=$1", [sid])).rows[0].n).toBe(0);
    await call("lunara_save_report", { p_user: A, p_session: sid, p_status: "FAILED", p_report: null, p_error: "boom" });
    const ready = await call<{ status: string }>("lunara_save_report", { p_user: A, p_session: sid, p_status: "READY", p_report: JSON.stringify({ v: 1 }), p_error: null });
    expect(ready.status).toBe("READY");
    const again = await call<{ status: string; report: { v: number } }>("lunara_save_report", { p_user: A, p_session: sid, p_status: "READY", p_report: JSON.stringify({ v: 2 }), p_error: null });
    expect(again.report.v).toBe(1);
    const failedLater = await call<{ status: string }>("lunara_save_report", { p_user: A, p_session: sid, p_status: "FAILED", p_report: null, p_error: "x" });
    expect(failedLater.status).toBe("READY");
    expect((await pool.query("select count(*)::int n from public.mission_reports where session_id=$1", [sid])).rows[0].n).toBe(1);
  });

  it("interrupted missions are closed by lazy reconciliation at the lease cutoff and can then be finalized", async () => {
    const s = await start(A, "mars", "int-1", 1000);
    const sid = s.session!.id;
    await sleep(2200);
    await call("lunara_account_snapshot", { p_user: A }); // what the archive/report path calls first
    const data = await call<MissionData>("lunara_mission_data", { p_user: A, p_session: sid });
    expect(data.session.status).toBe("INTERRUPTED");
    expect(data.session.consumedMs).toBeLessThanOrEqual(1100);
    const r = buildReport(data, "test");
    const saved = await call<{ status: string }>("lunara_save_report", { p_user: A, p_session: sid, p_status: "READY", p_report: JSON.stringify(r), p_error: null });
    expect(saved.status).toBe("READY");
  });

  it("archive/report/observation data is private; reports stay readable with zero time", async () => {
    const list = await call<{ id: string }[]>("lunara_list_missions", { p_user: A, p_limit: 50, p_before: null });
    expect(list.length).toBeGreaterThan(0);
    expect(await call<unknown[]>("lunara_list_missions", { p_user: B, p_limit: 50, p_before: null })).toEqual([]);
    expect(await err("lunara_mission_data", { p_user: B, p_session: list[0].id })).toBe("SESSION_NOT_FOUND");
    expect(await err("lunara_save_report", { p_user: B, p_session: list[0].id, p_status: "READY", p_report: "{}", p_error: null })).toBe("SESSION_NOT_FOUND");
    await setBal(A, "mars", 0);
    await setBal(A, "moon", 0);
    const data = await call<{ observations: unknown[] }>("lunara_mission_data", { p_user: A, p_session: list[list.length - 1].id });
    expect(Array.isArray(data.observations)).toBe(true);
    const c = await pool.connect();
    try {
      await c.query("begin; set local role authenticated");
      await expect(c.query("select * from public.observations")).rejects.toThrow(/permission denied/);
      await c.query("rollback");
      await c.query("begin; set local role anon");
      await expect(c.query("select public.lunara_mission_data($1,$2)", [A, list[0].id])).rejects.toThrow(/permission denied/);
      await c.query("rollback");
    } finally {
      c.release();
    }
  });
});
