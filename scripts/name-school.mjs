// Gives a school its readable name (until then the app shows its email domain).
// The admin pages arrive in Phase 14; until then the owner runs this.
//
//   npm run school:name -- tup.edu.ph "Technological University of the Philippines"
//   npm run school:name -- --list
//
// Uses DATABASE_URL_UNPOOLED from the env file given with --env-file
// (the npm script passes .env.local, the dev database). For production:
//   node --env-file=%USERPROFILE%\.studiskarte\production.env scripts/name-school.mjs <domain> "<name>"
import pg from "pg";

const [first, ...rest] = process.argv.slice(2);
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (first === "--list" || !first) {
    const { rows } = await client.query(
      `select s.domain, s.name, count(st.id)::int as students
         from school s left join student st on st.school_domain = s.domain
        group by s.domain, s.name order by students desc, s.domain`,
    );
    console.table(rows);
  } else {
    const domain = first.trim().toLowerCase();
    const name = rest.join(" ").trim();
    if (!name || name.length > 120) {
      console.error('Give a name of 1 to 120 characters, e.g. "Technological University of the Philippines".');
      process.exitCode = 1;
    } else {
      const { rowCount } = await client.query("update school set name = $2 where domain = $1", [domain, name]);
      if (rowCount === 0) {
        console.error(`No school "${domain}" yet. It is created when its first student signs in. Try --list.`);
        process.exitCode = 1;
      } else {
        console.log(`${domain} is now "${name}".`);
      }
    }
  }
} finally {
  await client.end();
}
