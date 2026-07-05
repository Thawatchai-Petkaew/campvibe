#!/usr/bin/env node
/**
 * One-way data sync: STAGING product DB -> local dev product DB.
 *
 * Part of the dev-branch workflow (owner-approved 2026-07-05): localhost runs
 * against a LOCAL Postgres (dev DB) so migrations merged to `dev` never touch
 * the staging DB before a promote. This script refreshes the dev DB with the
 * real staging data (real camps, zones, images) whenever the owner wants —
 * the reason localhost pointed at the staging DB before was that seed data
 * was not representative.
 *
 * Direction is STRICTLY staging -> local. Never the reverse: test edits made
 * on localhost must not leak into the staging storefront.
 *
 * Usage:
 *   npm run db:sync-from-staging
 * Requires in .env:
 *   DATABASE_URL          — the LOCAL dev DB (must resolve to localhost)
 *   STAGING_DATABASE_URL  — the staging DB (must NOT resolve to localhost)
 *
 * Mechanism: two Prisma clients over the same generated schema. The target
 * session disables FK enforcement (session_replication_role=replica) so
 * tables can be truncated and bulk-copied without computing a topological
 * order; rows are read with findMany (scalar columns only) and written with
 * createMany, so every column type Prisma supports round-trips as-is.
 * The delivery-ticket DB (DELIVERY_DATABASE_URL) is a different database and
 * is never touched; a guard below refuses to run if it points at the same
 * database as the target.
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

function hostOf(url, label) {
  try {
    // postgres:// URLs parse with the URL class.
    return new URL(url).hostname;
  } catch {
    console.error(`✗ ${label} is not a parseable URL`);
    process.exit(1);
  }
}

function dbNameOf(url) {
  try {
    return new URL(url).pathname.replace(/^\//, "").split("?")[0];
  } catch {
    return "";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const targetUrl = process.env.DATABASE_URL || "";
const sourceUrl = process.env.STAGING_DATABASE_URL || "";

if (!targetUrl || !sourceUrl) {
  console.error(
    "✗ refusing: need both DATABASE_URL (local dev DB) and STAGING_DATABASE_URL (source) in .env"
  );
  process.exit(1);
}

const targetHost = hostOf(targetUrl, "DATABASE_URL");
const sourceHost = hostOf(sourceUrl, "STAGING_DATABASE_URL");

// Never print full URLs — hostname-only diagnostics (same contract as the
// e2e db-guard).
if (!LOCAL_HOSTS.has(targetHost)) {
  console.error(
    `✗ refusing: sync TARGET must be the local dev DB, got host "${targetHost}"`
  );
  process.exit(1);
}
if (LOCAL_HOSTS.has(sourceHost)) {
  console.error(
    `✗ refusing: sync SOURCE must be the remote staging DB, got host "${sourceHost}"`
  );
  process.exit(1);
}

// The delivery-ticket DB must never be the sync target's database — a
// truncate there would wipe the team's ticket board.
const deliveryUrl = process.env.DELIVERY_DATABASE_URL || "";
if (deliveryUrl) {
  const sameHost = hostOf(deliveryUrl, "DELIVERY_DATABASE_URL") === targetHost;
  const sameDb = dbNameOf(deliveryUrl) === dbNameOf(targetUrl);
  if (sameHost && sameDb) {
    console.error(
      "✗ refusing: DELIVERY_DATABASE_URL points at the same database as the sync target — the ticket board would be truncated. Give the delivery DB its own database."
    );
    process.exit(1);
  }
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

const models = Prisma.dmmf.datamodel.models;
const delegateOf = (name) => name.charAt(0).toLowerCase() + name.slice(1);
// The @@map name if present, else the model name — what the table is called in SQL.
const tableOf = (m) => m.dbName || m.name;

const BATCH = 500;

try {
  console.log(
    `Syncing ${models.length} tables: ${sourceHost} -> ${targetHost} (one-way)`
  );

  // Disable FK enforcement for this session so truncate+copy order is free.
  await target.$executeRawUnsafe(`SET session_replication_role = replica`);

  const tableList = models
    .map((m) => `"${tableOf(m).replace(/"/g, "")}"`)
    .join(", ");
  await target.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`
  );

  let total = 0;
  for (const model of models) {
    const delegate = delegateOf(model.name);
    const rows = await source[delegate].findMany();
    for (let i = 0; i < rows.length; i += BATCH) {
      await target[delegate].createMany({ data: rows.slice(i, i + BATCH) });
    }
    total += rows.length;
    console.log(`  ${model.name}: ${rows.length}`);
  }

  await target.$executeRawUnsafe(`SET session_replication_role = origin`);
  console.log(`✓ synced ${total} rows into the local dev DB`);
} catch (err) {
  console.error(`✗ sync failed: ${err.message ?? err}`);
  process.exitCode = 1;
} finally {
  await source.$disconnect();
  await target.$disconnect();
}
