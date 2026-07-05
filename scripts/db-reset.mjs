#!/usr/bin/env node
/**
 * Guarded DB reset for NON-PRODUCTION envs (Atomic Schema epic — pre-launch migrations).
 *
 * Drops the database, re-applies all migrations, and re-seeds. Used by the per-story
 * reset+reseed runbook (docs/RUNBOOK-db-migrations.md) because the schema refactor ships
 * breaking migrations while there is no real prod data.
 *
 * Usage (staging):
 *   ALLOW_DB_RESET=1 DATABASE_URL="<staging-connection-string>" npm run db:reset:staging
 *
 * Refuses unless ALL of:
 *   - ALLOW_DB_RESET=1            (explicit destructive opt-in)
 *   - DATABASE_URL is set
 *   - target does NOT look like production (url contains "prod", NODE_ENV/VERCEL_ENV=production)
 *
 * CAM-369: the console output must NEVER echo the full connection string. A
 * mask that only replaces the userinfo segment before the "@" still leaks a
 * query-string secret (`?api_key=...`, `?password=...` — Prisma Postgres
 * URLs carry an `api_key` param) straight into console/CI logs. Same intent
 * as `e2e/regression/db-guard.ts`'s `describeUrlShape()`: print scheme +
 * hostname only, never path/query/credentials.
 */
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Scheme + hostname only — never path/query/userinfo, which can carry a
 * secret a naive "mask everything before @" transform would miss.
 */
export function describeUrlShape(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const scheme = parsed.protocol.replace(/:$/, "");
    const hostname =
      parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]")
        ? parsed.hostname.slice(1, -1)
        : parsed.hostname;
    return `${scheme}://${hostname}`;
  } catch {
    return "(unparseable)";
  }
}

export function main() {
  const allow = process.env.ALLOW_DB_RESET === "1";
  const url = process.env.DATABASE_URL || "";
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (!allow) {
    console.error("✗ refusing: set ALLOW_DB_RESET=1 to confirm a destructive reset");
    process.exit(1);
  }
  if (!url) {
    console.error("✗ refusing: DATABASE_URL is not set");
    process.exit(1);
  }
  if (looksProd) {
    console.error("✗ refusing: target looks like PRODUCTION — reset blocked for safety");
    process.exit(1);
  }

  console.log(`⚠️  Resetting DB (drop + migrate deploy + seed): ${describeUrlShape(url)}`);
  try {
    execSync("npx prisma migrate reset --force --skip-generate", { stdio: "inherit" });
    console.log("✓ DB reset + reseeded");
  } catch {
    console.error("✗ reset failed");
    process.exit(1);
  }
}

// Only auto-run when executed directly (`node scripts/db-reset.mjs` /
// `npm run db:reset:staging`) — not when imported for its exports (tests).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
