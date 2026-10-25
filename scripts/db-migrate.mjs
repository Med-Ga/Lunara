// Applies pending supabase/migrations/*.sql in order (each recorded once in
// public.lunara_schema_migrations), then re-applies the idempotent supabase/seed.sql.
// Usage: node --env-file=.env scripts/db-migrate.mjs
import pg from "pg";
import { readdirSync, readFileSync, existsSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is missing in .env");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`create table if not exists public.lunara_schema_migrations (
  name text primary key, applied_at timestamptz not null default now())`);
await client.query("alter table public.lunara_schema_migrations enable row level security");
await client.query("revoke all on public.lunara_schema_migrations from anon, authenticated");

// Databases created before this tracking existed already have 0001 applied.
const { rows: tracked } = await client.query("select name from public.lunara_schema_migrations");
const { rows: hasCore } = await client.query("select to_regclass('public.accounts') is not null as ok");
if (tracked.length === 0 && hasCore[0].ok) {
  await client.query("insert into public.lunara_schema_migrations (name) values ('0001_lunara_core.sql')");
  tracked.push({ name: "0001_lunara_core.sql" });
}
const done = new Set(tracked.map((r) => r.name));

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  if (done.has(f)) {
    console.log(`skip ${f} (already applied)`);
    continue;
  }
  await client.query(readFileSync(new URL(f, dir), "utf8"));
  await client.query("insert into public.lunara_schema_migrations (name) values ($1) on conflict do nothing", [f]);
  console.log(`applied ${f}`);
}
const seed = new URL("../supabase/seed.sql", import.meta.url);
if (existsSync(seed)) {
  await client.query(readFileSync(seed, "utf8"));
  console.log("applied seed.sql");
}
const { rows } = await client.query(
  "select id, active, duration_ms, amount_minor, currency, stripe_price_id from public.packages order by active desc, sort_order",
);
console.table(rows);
await client.end();
