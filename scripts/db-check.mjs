// Proves both Neon connection strings work and that writes round-trip.
// Run with: npm run db:check   (loads .env.local)
import pg from "pg";

const { DATABASE_URL, DATABASE_URL_UNPOOLED } = process.env;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!DATABASE_URL) fail("DATABASE_URL is not set");
if (!DATABASE_URL_UNPOOLED) fail("DATABASE_URL_UNPOOLED is not set");

const host = (url) => new URL(url).hostname;
console.log(`pooled host:   ${host(DATABASE_URL)}`);
console.log(`direct host:   ${host(DATABASE_URL_UNPOOLED)}`);

if (!host(DATABASE_URL).includes("-pooler")) fail("DATABASE_URL is not the pooled host");
if (host(DATABASE_URL_UNPOOLED).includes("-pooler")) fail("DATABASE_URL_UNPOOLED is the pooled host");

for (const [label, url] of [
  ["pooled", DATABASE_URL],
  ["direct", DATABASE_URL_UNPOOLED],
]) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    // A temp table lives only for this session, so nothing is left behind.
    await client.query("create temp table db_check (id serial primary key, note text not null)");
    await client.query("insert into db_check (note) values ($1)", [`written via ${label}`]);
    const { rows } = await client.query("select note from db_check");
    if (rows.length !== 1 || rows[0].note !== `written via ${label}`) {
      fail(`${label}: read back unexpected rows ${JSON.stringify(rows)}`);
    }
    const info = await client.query("select current_database() as db, current_user as role");
    console.log(`${label}: write+read OK on database "${info.rows[0].db}" as "${info.rows[0].role}"`);
  } finally {
    await client.end();
  }
}
console.log("db:check passed");
