// Exit 0 when the database accepts the connection in SUPABASE_DB_URL.
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
try { await c.connect(); await c.query("select 1"); await c.end(); console.log("CONNECTED"); process.exit(0); }
catch (e) { console.log("FAIL:", e.message); process.exit(1); }
