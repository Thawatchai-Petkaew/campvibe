/**
 * CAM-578 — one-command local setup for the e2e-regression harness's seeded
 * database. Before this script existed, the harness's own README described
 * the steps (`.env.e2e` + `prisma migrate reset --force`) but `.env.e2e`
 * itself was never committed anywhere, even as a template — so the
 * regression project could not run for anyone (agent or human) who followed
 * the README literally. That silent gap cost two stories real time: CAM-558
 * shipped a spec against a throwaway DB nobody else could reproduce, and
 * CAM-570 edited two specs it could not execute and broke six of them.
 *
 * What this script does, in order:
 *   1. Loads `.env.e2e` (dotenv) — a no-op if the file is absent or if a var
 *      is already set in the parent shell (dotenv never overrides an
 *      existing value), so this never fights the CI job's own env.
 *   2. Reuses `e2e/regression/db-guard.ts`'s localhost-only check (BR-1 of
 *      CAM-359) instead of re-implementing it — aborts loudly, before
 *      touching anything, unless DATABASE_URL is local.
 *   3. `npx prisma migrate deploy` — creates the target database if it does
 *      not exist yet (verified empirically against the installed 5.22.0
 *      CLI) and applies every migration. Deliberately NOT `migrate dev` /
 *      `migrate reset`: neither is needed, and — unlike those two —
 *      `migrate deploy` does not invoke `prisma generate`, so it is safe to
 *      run while `node_modules` is a shared symlink with another live agent
 *      mid-build (CAM-579; generating a fresh client there would corrupt
 *      its in-flight run).
 *   4. `npx tsx prisma/seed.ts` — the project's existing seed runner, proven
 *      idempotent (CAM-359 BR-3): safe to run again on an already-seeded DB.
 *
 * Usage:
 *   cp .env.e2e.example .env.e2e   # once — fill in your local Postgres user
 *   npm run e2e:db:setup
 *   PW_REGRESSION=1 npm run test:e2e:regression
 */
import { config as loadDotenv } from "dotenv";
import { execFileSync } from "node:child_process";
import { assertLocalDatabaseOrExit } from "../e2e/regression/db-guard";

loadDotenv({ path: ".env.e2e" });

assertLocalDatabaseOrExit();

const databaseUrl = process.env.DATABASE_URL as string;
const hostname = new URL(databaseUrl).hostname;
console.log(`→ e2e DB setup: migrating + seeding the local database on ${hostname} ...`);

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

execFileSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
});

console.log(
  "\n✓ e2e database ready. Next: PW_REGRESSION=1 npm run test:e2e:regression"
);
