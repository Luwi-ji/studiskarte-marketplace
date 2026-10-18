// Makes a student an admin, or takes it away. The app never sets this flag itself.
//
//   npm run admin:set -- someone@school.edu.ph          make them an admin
//   npm run admin:set -- someone@school.edu.ph --off    take it away
//   npm run admin:set -- --list                         who is an admin now
//
// Uses DATABASE_URL_UNPOOLED from the env file given with --env-file
// (the npm script passes .env.local, the dev database). For production:
//   node --env-file=%USERPROFILE%\.studiskarte\production.env scripts/make-admin.mjs <email>
import pg from "pg";

const args = process.argv.slice(2);
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (args.includes("--list") || args.length === 0) {
    const { rows } = await client.query(
      "select email, handle, account_status from student where is_admin order by email",
    );
    console.table(rows);
  } else {
    const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
    const on = !args.includes("--off");
    if (!email) {
      console.error("Give the student's school email.");
      process.exitCode = 1;
    } else {
      const { rowCount } = await client.query("update student set is_admin = $2 where email = $1", [email, on]);
      if (rowCount === 0) {
        console.error(`No student with the email "${email}". They are created at their first sign-in.`);
        process.exitCode = 1;
      } else {
        console.log(`${email} ${on ? "is now an admin" : "is no longer an admin"}.`);
      }
    }
  }
} finally {
  await client.end();
}
