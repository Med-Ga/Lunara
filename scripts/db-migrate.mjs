// Applies supabase/migrations/*.sql (in order) and supabase/seed.sql to the database.
// Every file is idempotent. Usage: node --env-file=.env scripts/db-migrate.mjs
import pg from "pg";
import { readdirSync, readFileSync, existsSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is missing in .env");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  await client.query(readFileSync(new URL(f, dir), "utf8"));
  console.log(`applied ${f}`);
}
const seed = new URL("../supabase/seed.sql", import.meta.url);
if (existsSync(seed)) {
  await client.query(readFileSync(seed, "utf8"));
  console.log("applied seed.sql");
}
const { rows } = await client.query(
  "select id, duration_ms, amount_minor, currency, stripe_price_id from public.packages order by sort_order",
);
console.table(rows);
await client.end();
