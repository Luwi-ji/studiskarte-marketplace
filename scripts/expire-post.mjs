// Dev only: makes one post look expired, so the Relist button can be tried without waiting 30 days.
//
//   node scripts/expire-post.mjs <postId>
//
// Reads DATABASE_URL_UNPOOLED (or DATABASE_URL) from .env.local, the dev database, never from the shell. Refuses to
// run with NODE_ENV=production, or when the host name contains "prod".
import { readFileSync } from "node:fs";
import pg from "pg";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") fail("Refusing to run with NODE_ENV=production.");

const postId = process.argv[2]?.trim();
if (!postId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
  fail("Usage: node scripts/expire-post.mjs <postId>   (the id is the uuid in the listing's address)");
}

let file;
try {
  file = readFileSync(".env.local", "utf8");
} catch {
  fail("Could not read .env.local. Run this from the project folder.");
}
const env = Object.fromEntries(
  file
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
if (!url) fail("No DATABASE_URL in .env.local.");

const host = new URL(url).hostname;
if (/prod/i.test(host) || /prod/i.test(new URL(url).pathname)) fail(`Refusing: ${host} looks like production.`);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    "update post set status = 'expired', expires_at = now() - interval '1 day' where id = $1 returning title",
    [postId],
  );
  if (rows.length === 0) fail(`No post with the id ${postId}.`);
  console.log(`"${rows[0].title}" is now expired on ${host}. Open it from Me > My posts and tap Relist.`);
} finally {
  await client.end();
}
