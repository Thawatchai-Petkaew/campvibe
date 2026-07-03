#!/usr/bin/env node
/**
 * scripts/parity-check.mjs — builds the /status UI model BOTH ways (Linear vs the self-hosted
 * delivery database) and diffs them (ADR-010, CAM-280 / T-4).
 *
 * ── Which "both ways" this script actually hits, and why ────────────────────────────────────
 * The task gave three options; this is "simplest reliable", chosen deliberately:
 *
 *   1. Linear side — a STANDALONE GraphQL query (this file makes its own request, no shared
 *      import) that mirrors lib/linear.ts's `fetchStatusIssuesRaw()` EXACTLY, including its
 *      `first: 250` cap and its NOT passing `includeArchived`. This is deliberate: the goal of
 *      this comparison is "does the delivery-DB-backed dashboard match what /status shows
 *      TODAY", and lib/linear.ts is what /status shows today — reproducing its known cap
 *      faithfully (rather than "fixing" it here) keeps the comparison meaningful. See the
 *      FLAG below: team CAM has 282 issues total, but lib/linear.ts's query does not pass
 *      includeArchived, so its real live exposure is the NON-archived count (223, confirmed
 *      live during T-4 research) — under the 250 cap today, but only 27 away from it, and the
 *      cap will start silently truncating the OLDEST issues the moment non-archived issues
 *      cross 250. Not conflating the two numbers matters: this script's own FLAG below only
 *      fires once the live (non-archived) fetch itself hits >= 250, not off the 282 total.
 *
 *   2. DB side — going through `lib/delivery/status-adapter.ts`'s `toStatusIssue()` directly
 *      was considered and rejected: that module is `server-only` + typed against the generated
 *      Prisma client, and importing a TypeScript module from a plain `.mjs` script with zero
 *      build step is unreliable (no ts-node/tsx dependency wanted here — same zero-dependency
 *      reasoning scripts/ticket-sync.mjs already documents for duplicating small pieces of
 *      lib/delivery/* logic rather than importing it). Instead this script calls the REAL
 *      running app's `GET /api/tickets` endpoint (the same STATUS_TOKEN-gated surface
 *      scripts/ticket-sync.mjs already uses) — i.e. "hit BOTH data paths through the real
 *      app" for the DB side — and re-runs the SAME synthesis `toStatusIssue()` performs
 *      (duplicated here, `dbTicketToStatusIssueLike()`), on the raw Ticket rows it returns.
 *      This is "through the real app" in the sense that matters: it exercises the real
 *      route + the real delivery DB, not a second hand-rolled DB connection.
 *
 * ── Graceful degradation (DELIVERY_DATABASE_URL is not provisioned anywhere as of T-4) ──────
 * A non-200 from `GET /api/tickets` (whether because DELIVERY_DATABASE_URL is genuinely unset
 * on the target env — the expected reason right now, see ADR-010 §G2 — or an auth/token
 * mismatch) is treated uniformly as "DB side unavailable": this script prints what it found
 * on the Linear side only ("linear-only mode"), prints the real HTTP status + body it got back,
 * and exits 2. It does NOT throw a raw stack trace and does NOT silently skip the comparison.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────────────────────
 *   node scripts/parity-check.mjs
 *
 * Exit codes: 0 = full parity · 1 = mismatch found (see the printed named diff list) ·
 * 2 = DB side unavailable, linear-only summary printed.
 *
 * Reads LINEAR_API_KEY, LINEAR_TEAM_KEY, APP_BASE_URL, STATUS_TOKEN from .env/.env.local (same
 * dotenv-style parse every other script in this repo uses).
 */
import fs from "node:fs";

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
const LINEAR_KEY = ENV.LINEAR_API_KEY;
const TEAM = ENV.LINEAR_TEAM_KEY || "CAM";
const BASE = (ENV.APP_BASE_URL || "https://campvibe-staging.vercel.app").replace(/\/+$/, "");
const TOKEN = ENV.STATUS_TOKEN;

// ── Linear side — standalone, mirrors lib/linear.ts's fetchStatusIssuesRaw() verbatim ───────

const PRIORITY = ["No priority", "Urgent", "High", "Medium", "Low"];

// Copied verbatim from lib/linear.ts (see that file's own comment for why `first: 250` and no
// `includeArchived` — this script intentionally does NOT "fix" that cap; see header comment).
const LINEAR_QUERY = `query Issues($key: String!) {
  issues(filter: { team: { key: { eq: $key } } }, first: 250) {
    nodes {
      identifier
      title
      priority
      url
      description
      startedAt
      updatedAt
      completedAt
      state { name type }
      labels { nodes { name } }
      assignee { name displayName avatarUrl }
      project { id name }
      parent { id title }
    }
  }
}`;

async function fetchLinearStatusIssues() {
  if (!LINEAR_KEY) throw new Error("LINEAR_API_KEY is not set");
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: LINEAR_KEY },
    body: JSON.stringify({ query: LINEAR_QUERY, variables: { key: TEAM } }),
  });
  if (!res.ok) throw new Error(`Linear API error ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "Linear query failed");
  const nodes = json?.data?.issues?.nodes ?? [];
  return nodes.map((n) => ({
    id: n.identifier,
    title: n.title,
    status: n.state?.name ?? "",
    statusType: n.state?.type ?? "",
    priority: PRIORITY[n.priority ?? 0] ?? "No priority",
    labels: (n.labels?.nodes ?? []).map((l) => l.name),
    url: n.url,
    parentTitle: n.parent?.title ?? null,
    projectName: n.project?.name ?? null,
  }));
}

// ── DB side — GET /api/tickets on the real running app, then duplicate toStatusIssue() ──────

/** Mirrors lib/delivery/status-adapter.ts's roleSlug() (lib/delivery/roles.ts). */
function roleSlug(role) {
  return role ? String(role).toLowerCase().replace(/_/g, "-") : null;
}

/**
 * dbTicketToStatusIssueLike — duplicates lib/delivery/status-adapter.ts's toStatusIssue()
 * label/title synthesis on a raw Ticket row from GET /api/tickets. `idToTicket` resolves
 * epicId (a raw row id, not returned inline by the list endpoint) to the epic's own title —
 * built from the SAME list response (the epic rows are in it too).
 */
function dbTicketToStatusIssueLike(t, idToTicket) {
  const slug = roleSlug(t.currentRole);
  const title = slug ? `[${slug}] ${t.title}` : t.title;

  const labels = [];
  if (t.state === "AWAITING_GATE") labels.push("awaiting-you");
  if (t.changesRequested) labels.push("changes-requested");
  if (t.releasedAt) labels.push("released");
  if (t.blocked) labels.push("blocked");
  if (t.persona) labels.push(String(t.persona).toLowerCase());
  for (const r of t.roleHistory ?? []) labels.push(`role:${String(r).toLowerCase().replace(/_/g, "-")}`);
  if (t.regressionRound > 0 && slug) labels.push(`regression:${slug}:${t.regressionRound}`);
  labels.push(...(t.legacyLabels ?? []));

  const STATE_TO_STATUS = {
    BACKLOG: "Backlog",
    TODO: "Todo",
    IN_PROGRESS: "In Progress",
    AWAITING_GATE: "In Progress",
    DONE: "Done",
    CANCELED: "Canceled",
  };
  const STATE_TO_STATUS_TYPE = {
    BACKLOG: "backlog",
    TODO: "unstarted",
    IN_PROGRESS: "started",
    AWAITING_GATE: "started",
    DONE: "completed",
    CANCELED: "canceled",
  };

  const epic = t.epicId ? idToTicket.get(t.epicId) : null;
  return {
    id: t.identifier,
    title,
    status: STATE_TO_STATUS[t.state] ?? t.state,
    statusType: STATE_TO_STATUS_TYPE[t.state] ?? "",
    priority: PRIORITY[t.priority] ?? "No priority",
    labels,
    url: t.legacyUrl ?? "",
    parentTitle: epic ? epic.title : null,
    projectName: t.featureName ?? null,
  };
}

/**
 * fetchDbStatusIssues — GET /api/tickets on the real app. Returns `{ ok: true, issues }` on a
 * 200, or `{ ok: false, status, body }` on anything else (network error included, status: 0) —
 * never throws; the caller decides linear-only vs full-parity mode.
 */
async function fetchDbStatusIssues() {
  if (!TOKEN) return { ok: false, status: 0, body: "STATUS_TOKEN not set locally" };
  let res;
  try {
    res = await fetch(`${BASE}/api/tickets`, { headers: { "x-status-token": TOKEN } });
  } catch (e) {
    return { ok: false, status: 0, body: e.message };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body — keep null, still report res.status */
  }
  if (res.status !== 200) return { ok: false, status: res.status, body };

  const tickets = body.tickets ?? [];
  const idToTicket = new Map(tickets.map((t) => [t.id, t]));
  const issues = tickets
    .filter((t) => t.type !== "EPIC") // parity target = /status work items, not the epic containers
    .map((t) => dbTicketToStatusIssueLike(t, idToTicket));
  return { ok: true, issues };
}

// ── aggregates + diff ─────────────────────────────────────────────────────────────────────────

function tally(issues, keyFn) {
  const m = new Map();
  for (const i of issues) {
    const k = keyFn(i) ?? "(none)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function idSet(issues, predicate) {
  return new Set(issues.filter(predicate).map((i) => i.id));
}

/** role tallies: role:* labels ∪ the [role] title tag, per issue, deduped — total count per role. */
function workloadTally(issues) {
  const ROLE_TAG_RE = /^\[([a-z-]+)\]/;
  const m = new Map();
  for (const i of issues) {
    const roles = new Set();
    for (const l of i.labels) if (l.startsWith("role:")) roles.add(l.slice(5));
    const tag = i.title.match(ROLE_TAG_RE);
    if (tag) roles.add(tag[1]);
    for (const r of roles) m.set(r, (m.get(r) ?? 0) + 1);
  }
  return m;
}

/** Diff two Map<string, number> aggregates -> named diff lines (keys whose counts differ, incl.
 *  keys present on only one side, treated as 0 on the other). */
function diffCountMaps(name, left, right) {
  const keys = new Set([...left.keys(), ...right.keys()]);
  const diffs = [];
  for (const k of [...keys].sort()) {
    const l = left.get(k) ?? 0;
    const r = right.get(k) ?? 0;
    if (l !== r) diffs.push(`  ${name}["${k}"]: linear=${l} db=${r}`);
  }
  return diffs;
}

/** Diff two id Sets -> named diff lines (symmetric difference). */
function diffIdSets(name, left, right) {
  const diffs = [];
  for (const id of [...left].sort()) if (!right.has(id)) diffs.push(`  ${name}: ${id} in linear only`);
  for (const id of [...right].sort()) if (!left.has(id)) diffs.push(`  ${name}: ${id} in db only`);
  return diffs;
}

export function compare(linearIssues, dbIssues) {
  const allDiffs = [];

  allDiffs.push(...diffCountMaps("byEpic", tally(linearIssues, (i) => i.parentTitle), tally(dbIssues, (i) => i.parentTitle)));
  allDiffs.push(
    ...diffCountMaps("byStateType", tally(linearIssues, (i) => i.statusType), tally(dbIssues, (i) => i.statusType))
  );
  allDiffs.push(
    ...diffIdSets(
      "gates",
      idSet(linearIssues, (i) => i.labels.includes("awaiting-you")),
      idSet(dbIssues, (i) => i.labels.includes("awaiting-you"))
    )
  );
  allDiffs.push(
    ...diffIdSets(
      "released",
      idSet(linearIssues, (i) => i.labels.includes("released")),
      idSet(dbIssues, (i) => i.labels.includes("released"))
    )
  );
  allDiffs.push(...diffCountMaps("workload", workloadTally(linearIssues), workloadTally(dbIssues)));

  return { ok: allDiffs.length === 0, diffs: allDiffs };
}

function printTable(linearIssues, dbIssues) {
  console.log("\n=== parity-check ===");
  console.log(`linear issues: ${linearIssues.length}  ·  db issues: ${dbIssues.length}`);
  console.log("\nmetric            linear   db");
  console.log("-----------------  -------  -------");
  const rows = [
    ["total", linearIssues.length, dbIssues.length],
    [
      "gates (awaiting-you)",
      idSet(linearIssues, (i) => i.labels.includes("awaiting-you")).size,
      idSet(dbIssues, (i) => i.labels.includes("awaiting-you")).size,
    ],
    [
      "released",
      idSet(linearIssues, (i) => i.labels.includes("released")).size,
      idSet(dbIssues, (i) => i.labels.includes("released")).size,
    ],
  ];
  for (const [name, l, r] of rows) {
    console.log(`${name.padEnd(18)} ${String(l).padEnd(8)} ${String(r).padEnd(8)}`);
  }
}

// ── entry ────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const linearIssues = await fetchLinearStatusIssues();
  console.log(
    `linear: fetched ${linearIssues.length} issue(s) (first:250 cap, no includeArchived — mirrors lib/linear.ts today)` +
      (linearIssues.length >= 250
        ? `\n⚠ FLAG: this fetch hit the 250-issue cap (${linearIssues.length} returned) — ` +
          "lib/linear.ts's /status dashboard is silently truncating older issues right now. " +
          "This is a pre-existing bug, out of scope for this story — flagged for a follow-up " +
          "ticket, not fixed here."
        : linearIssues.length >= 220
          ? `\n⚠ NOTE: ${linearIssues.length}/250 of the cap already used (team CAM has 282 ` +
            "issues total incl. archived, which lib/linear.ts's query does not request) — " +
            "close to the ceiling; will start silently truncating soon."
          : "")
  );

  const dbResult = await fetchDbStatusIssues();
  if (!dbResult.ok) {
    console.log(
      `\n✗ DB side unavailable (GET ${BASE}/api/tickets → status ${dbResult.status}) — ` +
        `db not provisioned yet (DELIVERY_DATABASE_URL unset on this env, per ` +
        `docs/adr/ADR-010-self-hosted-delivery-tickets.md §G2 config step) or a STATUS_TOKEN ` +
        `mismatch. Response: ${JSON.stringify(dbResult.body)}`
    );
    console.log(`\nRunning in LINEAR-ONLY mode — nothing to diff against yet:`);
    console.log(`  linear issues fetched: ${linearIssues.length}`);
    console.log(`  by stateType: ${JSON.stringify(Object.fromEntries(tally(linearIssues, (i) => i.statusType)))}`);
    console.log(`  gates (awaiting-you): ${idSet(linearIssues, (i) => i.labels.includes("awaiting-you")).size}`);
    console.log(`  released: ${idSet(linearIssues, (i) => i.labels.includes("released")).size}`);
    process.exit(2);
  }

  const dbIssues = dbResult.issues;
  printTable(linearIssues, dbIssues);
  const { ok, diffs } = compare(linearIssues, dbIssues);
  if (ok) {
    console.log("\n✓ PARITY OK — no mismatch across epic/stateType/gates/released/workload");
    process.exit(0);
  }
  console.log(`\n✗ PARITY MISMATCH — ${diffs.length} diff(s):`);
  for (const d of diffs) console.log(d);
  process.exit(1);
}

// Only auto-run when this file is the actual CLI entry point (`node scripts/parity-check.mjs`)
// — NOT when it is `import`-ed (e.g. to reuse `compare()` for a quick smoke check or a future
// unit test), so importing it never triggers a live Linear/API fetch as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("✗", e.message);
    process.exit(1);
  });
}
