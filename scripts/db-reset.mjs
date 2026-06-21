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
 */
import { execSync } from "node:child_process";

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

const masked = url.replace(/:\/\/[^@]*@/, "://***@");
console.log(`⚠️  Resetting DB (drop + migrate deploy + seed): ${masked}`);
try {
  execSync("npx prisma migrate reset --force --skip-generate", { stdio: "inherit" });
  console.log("✓ DB reset + reseeded");
} catch {
  console.error("✗ reset failed");
  process.exit(1);
}
