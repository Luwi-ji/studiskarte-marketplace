// Database tests insert and delete rows. Never let them run on production.
if (process.env.NEON_BRANCH === "production") {
  throw new Error(
    "Refusing to run tests: NEON_BRANCH is 'production'. Use .env.development.local (the dev branch).",
  );
}
