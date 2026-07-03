#!/usr/bin/env node
/**
 * scripts/import-linear.mjs — ONE-SHOT, IDEMPOTENT import of every Linear team-CAM issue
 * (+ its comments) into the self-hosted delivery-ticket database (ADR-010, CAM-280 / T-4,
 * docs/adr/ADR-010-self-hosted-delivery-tickets.md "Import risk (T-4)").
 *
 * ── SANCTIONED DIRECT-DB WRITER ─────────────────────────────────────────────────────────────
 * This is the ONE script in this repo allowed to import and use the generated delivery Prisma
 * client directly, bypassing lib/delivery/tickets.ts's single-mutation-path service layer
 * (__tests__/delivery-boundary.test.ts only guards the lib, app, and components trees — a
 * plain top-level script is outside that boundary by construction, and this is the intended, noted
 * exception: a one-time DATA MIGRATION tool, not a live application write path). There is no
 * verb in the ADR-010 state machine for "insert a ticket exactly as it already existed on day
 * one, including its full historical timestamps" — replaying 9 guarded transitions per
 * imported ticket to reconstruct history would be slower AND lossier (createdAt/startedAt/
 * completedAt would all become "now" instead of the real historical values). Every OTHER
 * script/route in this repo must go through lib/delivery/tickets.ts or /api/tickets/*.
 *
 * ── DO NOT RUN FOR REAL YET ──────────────────────────────────────────────────────────────────
 * DELIVERY_DATABASE_URL does not exist anywhere as of T-4 (the owner provisions it later — see
 * ADR-010 §G2 config step). This script MUST NOT be run without --dry-run until that env var is
 * set on the target environment. --dry-run fetches + maps + prints summary counts WITHOUT
 * writing anything, and needs only LINEAR_API_KEY (+ optionally LINEAR_TEAM_KEY, default "CAM").
 *
 * ── Idempotent ───────────────────────────────────────────────────────────────────────────────
 * Every run upserts by `identifier` (never creates a duplicate CAM-N row) and fully replaces
 * each ticket's comments (delete + reinsert from the current Linear state) — safe to re-run at
 * any time, including after a partial failure. A "created" TicketEvent is written exactly once,
 * only on the run that first inserts a given identifier.
 *
 * ── Pagination ───────────────────────────────────────────────────────────────────────────────
 * Cursor-paginated at 100/page (`includeArchived: true`) — the old dashboard code's `first:250`
 * cap (lib/linear.ts) is deliberately NOT replicated here: the team is already past 250 issues
 * (282 confirmed live during T-4 research), so a single-page fetch would silently drop the
 * oldest ~30+ issues from this one-time migration.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────────────────────
 *   node scripts/import-linear.mjs --dry-run     # fetch + map + print summary, no writes
 *   node scripts/import-linear.mjs               # real import (requires DELIVERY_DATABASE_URL)
 *
 * Reads LINEAR_API_KEY (+ optional LINEAR_TEAM_KEY) from .env/.env.local — same dotenv-style
 * parse every other script in this repo uses (no extra deps).
 */
import fs from "node:fs";
import {
  mapIssueToTicketInput,
  mapComment,
  resolveEpicId,
} from "./lib/import-mapping.mjs";

// ── env (dotenv-style parse, no deps — copied from scripts/linear-sync.mjs) ───────────────

function loadEnv() {
  const out = {};
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (/^[A-Z]/.test(line) && line.includes("=")) {
        const i = line.indexOf("=");
        out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return out;
}
const ENV = { ...loadEnv(), ...process.env };
const LINEAR_API = "https://api.linear.app/graphql";
const KEY = ENV.LINEAR_API_KEY;
const TEAM = ENV.LINEAR_TEAM_KEY || "CAM";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Linear GraphQL fetch (cursor-paginated, 100/page, includeArchived) ─────────────────────

const ISSUES_QUERY = `
  query($k: String!, $cursor: String) {
    issues(filter: { team: { key: { eq: $k } } }, first: 100, after: $cursor, includeArchived: true) {
      nodes {
        identifier
        number
        title
        description
        priority
        url
        createdAt
        updatedAt
        startedAt
        completedAt
        archivedAt
        state { name type }
        labels { nodes { name } }
        parent { id identifier title }
        project { id name }
        assignee { name displayName }
        comments(first: 50) {
          nodes { body createdAt user { name displayName } }
          pageInfo { hasNextPage }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

async function gql(query, variables) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: KEY },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

/** Fetch every team-CAM issue (incl. archived), cursor-paginated. Never caps at a page count. */
async function fetchAllIssues() {
  const all = [];
  let cursor = null;
  let pages = 0;
  let commentsTruncated = 0;
  while (true) {
    pages++;
    const data = await gql(ISSUES_QUERY, { k: TEAM, cursor });
    for (const n of data.issues.nodes) {
      if (n.comments?.pageInfo?.hasNextPage) commentsTruncated++;
      all.push(n);
    }
    if (!data.issues.pageInfo.hasNextPage) break;
    cursor = data.issues.pageInfo.endCursor;
  }
  return { issues: all, pages, commentsTruncated };
}

// ── summary (shared by --dry-run and the real run) ─────────────────────────────────────────

function tally(items, keyFn) {
  const m = {};
  for (const it of items) {
    const k = keyFn(it) ?? "(none)";
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function printSummary(mapped, commentCounts, opts) {
  const totalComments = commentCounts.reduce((a, b) => a + b, 0);
  console.log(`\n=== import-linear ${opts.dryRun ? "(DRY RUN — no writes)" : "(REAL RUN)"} ===`);
  console.log(`issues fetched:      ${mapped.length}  (${opts.pages} page(s) of 100, includeArchived:true)`);
  console.log(`comments fetched:    ${totalComments}${opts.commentsTruncated ? `  (WARNING: ${opts.commentsTruncated} issue(s) have >50 comments — truncated, see header comment)` : ""}`);
  console.log(`\nby state:            ${JSON.stringify(tally(mapped, (t) => t.state))}`);
  console.log(`by type:             ${JSON.stringify(tally(mapped, (t) => t.type))}`);
  console.log(`by persona:          ${JSON.stringify(tally(mapped, (t) => t.persona))}`);
  console.log(`by currentRole:      ${JSON.stringify(tally(mapped, (t) => t.currentRole))}`);
  console.log(`released:            ${mapped.filter((t) => t.releasedAt).length}`);
  console.log(`blocked:             ${mapped.filter((t) => t.blocked).length}`);
  console.log(`changesRequested:    ${mapped.filter((t) => t.changesRequested).length}`);
  console.log(`archived:            ${mapped.filter((t) => t.archivedAt).length}`);
  console.log(`regressionRound > 0: ${mapped.filter((t) => t.regressionRound > 0).length}`);

  const withParent = mapped.filter((t) => t._parentIdentifier);
  const legacyDotNoParent = mapped.filter((t) => !t._parentIdentifier && t._epicPrefix);
  console.log(`\nepic resolution inputs:`);
  console.log(`  has real parent:          ${withParent.length}  (resolved via parent identifier, pass 2)`);
  console.log(`  legacy "Epic · Story" (no parent): ${legacyDotNoParent.length}  (resolved via epic-title match, pass 2, best-effort)`);
  console.log(`  neither (epicId stays null): ${mapped.length - withParent.length - legacyDotNoParent.length}`);

  const knownEdgeCase = mapped.filter((t) => !t._parentIdentifier && t._epicPrefix && t.type === "EPIC");
  if (knownEdgeCase.length) {
    console.log(
      `\n⚠ KNOWN EDGE CASE (flagged, see scripts/lib/import-mapping.mjs mapType() comment): ` +
        `${knownEdgeCase.length} legacy "Epic · Story"-titled, parentless, project-bearing ticket(s) ` +
        `classified as type=EPIC by this story's literal rule, though they are real STORY-level work: ` +
        `${knownEdgeCase.map((t) => t.identifier).join(", ")}`
    );
  }
}

// ── pass 1 + pass 2 (real run only) ─────────────────────────────────────────────────────────

async function getDb() {
  if (!ENV.DELIVERY_DATABASE_URL) {
    throw new Error(
      "DELIVERY_DATABASE_URL is not set — the delivery database is not provisioned yet " +
        "(see docs/adr/ADR-010-self-hosted-delivery-tickets.md §G2 config step). " +
        "Re-run with --dry-run to fetch + map without writing."
    );
  }
  // Dynamic import: keep --dry-run fully independent of the generated client even existing
  // (mirrors lib/delivery/client.ts's lazy-connect reasoning) and give a clear, actionable
  // error instead of a raw import-time crash when DELIVERY_DATABASE_URL is genuinely unset.
  const mod = await import("../prisma/delivery/generated/delivery-client/index.js");
  // Explicit datasource override (rather than a bare `new PrismaClient()`): this script loads
  // .env itself into a local ENV object (see loadEnv() above) rather than mutating
  // process.env, so the generated client's schema-declared `env("DELIVERY_DATABASE_URL")`
  // would not see it unless the shell itself already exports the var. This override works
  // either way (shell-exported or .env-file-only) and never touches the product DATABASE_URL.
  return new mod.PrismaClient({ datasources: { db: { url: ENV.DELIVERY_DATABASE_URL } } });
}

/** Strip the two pass-2-only `_`-prefixed fields before handing a mapped object to Prisma. */
function toPrismaCreateData(t) {
  const { _parentIdentifier, _epicPrefix, ...rest } = t;
  void _parentIdentifier;
  void _epicPrefix;
  return rest;
}

async function runImport() {
  const { issues, pages, commentsTruncated } = await fetchAllIssues();
  const mapped = issues.map(mapIssueToTicketInput);
  const commentsByIdentifier = new Map(
    issues.map((n) => [n.identifier, (n.comments?.nodes ?? []).map(mapComment)])
  );

  if (DRY_RUN) {
    printSummary(mapped, [...commentsByIdentifier.values()].map((c) => c.length), {
      dryRun: true,
      pages,
      commentsTruncated,
    });
    return;
  }

  const db = await getDb();
  let created = 0;
  let updated = 0;

  // ── pass 1: upsert every ticket row (epicId left unset — wired in pass 2) ────────────────
  const byIdentifier = new Map(); // identifier -> { id }
  const epicTitleIndex = new Map(); // title -> { id }  (EPIC-type tickets only)

  for (const t of mapped) {
    const data = toPrismaCreateData(t);
    const isNew = await db.$transaction(async (tx) => {
      const existing = await tx.ticket.findUnique({ where: { identifier: t.identifier } });
      const row = await tx.ticket.upsert({
        where: { identifier: t.identifier },
        create: data,
        update: data,
      });
      if (!existing) {
        await tx.ticketEvent.create({
          data: {
            ticketId: row.id,
            kind: "created",
            fromValue: null,
            toValue: row.state,
            actor: "import:linear",
          },
        });
      }
      byIdentifier.set(t.identifier, { id: row.id });
      if (t.type === "EPIC") epicTitleIndex.set(t.title, { id: row.id });
      return !existing;
    });
    if (isNew) created++;
    else updated++;
  }

  // ── pass 2: wire epicId now that every ticket row (incl. every possible parent) exists ───
  let epicsWired = 0;
  for (const t of mapped) {
    if (!t._parentIdentifier && !t._epicPrefix) continue;
    const epicId = resolveEpicId(
      { parentIdentifier: t._parentIdentifier, epicPrefix: t._epicPrefix },
      byIdentifier,
      epicTitleIndex
    );
    await db.ticket.update({ where: { identifier: t.identifier }, data: { epicId } });
    if (epicId) epicsWired++;
  }

  // ── pass 3: comments — full replace per ticket (delete + reinsert), idempotent ───────────
  let commentsImported = 0;
  for (const [identifier, comments] of commentsByIdentifier) {
    if (comments.length === 0) continue;
    const ticket = byIdentifier.get(identifier);
    if (!ticket) continue;
    await db.$transaction(async (tx) => {
      await tx.ticketComment.deleteMany({ where: { ticketId: ticket.id } });
      await tx.ticketComment.createMany({
        data: comments.map((c) => ({ ticketId: ticket.id, ...c })),
      });
    });
    commentsImported += comments.length;
  }

  // Best-effort pulse bump so a connected /status dashboard refreshes after import — this is
  // the tiny upsert-increment lib/delivery/pulse.ts's bumpDeliveryPulse() performs, duplicated
  // here (this plain .mjs script cannot import that server-only TS module directly — same
  // zero-dependency reasoning scripts/ticket-sync.mjs already documents for its own duplicated
  // helpers). Never throws — a pulse-bump failure must never fail the import.
  try {
    await db.deliveryPulse.upsert({
      where: { id: "singleton" },
      update: { version: { increment: 1 } },
      create: { id: "singleton", version: 1 },
    });
  } catch (e) {
    console.error("pulse bump failed (non-fatal):", e.message);
  }

  console.log(`\n=== import-linear (REAL RUN) complete ===`);
  console.log(`tickets: ${created} created, ${updated} updated (${mapped.length} total)`);
  console.log(`epics wired: ${epicsWired}`);
  console.log(`comments imported: ${commentsImported}`);
  printSummary(mapped, [...commentsByIdentifier.values()].map((c) => c.length), {
    dryRun: false,
    pages,
    commentsTruncated,
  });

  await db.$disconnect();
}

// ── entry ────────────────────────────────────────────────────────────────────────────────────

if (!KEY) {
  console.error("✗ LINEAR_API_KEY missing in .env");
  process.exit(1);
}

runImport().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
