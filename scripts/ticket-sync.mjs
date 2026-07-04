#!/usr/bin/env node
/**
 * ticket-sync — thin HTTP client over `/api/tickets/*` for the CampVibe self-hosted
 * delivery-ticket system (ADR-010, docs/adr/ADR-010-self-hosted-delivery-tickets.md).
 * Replaces scripts/linear-sync.mjs as the orchestrator/CI writer (T-5 retires that script
 * once CI + the AI-team conventions are repointed at this one).
 *
 * NEVER touches the DB directly — every command is a fetch() call against
 * `${APP_BASE_URL}/api/tickets*`, guarded by the same shared STATUS_TOKEN every existing
 * /api/status/* mutation route already uses (lib/status-auth.ts). No Prisma import here on
 * purpose: this file must stay a pure client so it can run from CI / a laptop with no DB
 * credentials at all — only the token.
 *
 * Reads APP_BASE_URL + STATUS_TOKEN (+ TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID for `notify`,
 * + optional TICKET_SYNC_ACTOR) from .env / .env.local — same dotenv-style parse
 * scripts/linear-sync.mjs uses (no extra deps).
 *
 * ── Usage ────────────────────────────────────────────────────────────────────────────────
 *   node scripts/ticket-sync.mjs list
 *   node scripts/ticket-sync.mjs set CAM-7 --state "In Progress"
 *   node scripts/ticket-sync.mjs set CAM-11 --add-label awaiting-you
 *   node scripts/ticket-sync.mjs set CAM-7 --state Done --remove-label awaiting-you
 *   node scripts/ticket-sync.mjs handoff CAM-7 --role backend-engineer --state "In Progress"
 *   node scripts/ticket-sync.mjs release CAM-7
 *   node scripts/ticket-sync.mjs gates                      # exit 10 when a gate is "cleared"
 *   node scripts/ticket-sync.mjs audit                       # exit 11 on template/artifact drift
 *   node scripts/ticket-sync.mjs pull [outfile]
 *   node scripts/ticket-sync.mjs index
 *   node scripts/ticket-sync.mjs scaffold CAM-7
 *   node scripts/ticket-sync.mjs notify "text"
 *   node scripts/ticket-sync.mjs create --type story --title "..." --epic CAM-276 --role backend-engineer
 *   node scripts/ticket-sync.mjs comment CAM-7 --body "..."
 *   node scripts/ticket-sync.mjs show CAM-7
 *
 * ── Legacy state/label → ADR-010 verb mapping (linear-sync parity) ─────────────────────────
 * The decision tables themselves live in scripts/lib/ticket-sync-mapping.mjs (pure, unit
 * tested — see __tests__/ticket-sync-mapping.test.ts). Summary:
 *
 *   `set --state <legacy Linear name>` — one of Backlog|Todo|"In Progress"|Done|Canceled,
 *   mapped onto the closest ADR-010 verb given the ticket's CURRENT state (fetched first):
 *     Backlog      : CANCELED → reopen()  (needs --note; API 400s "note_required" without one)
 *                    already Backlog → no-op · anything else → no verb, local 400 + exit 1
 *     Todo         : BACKLOG → start()  (no role) · already Todo → no-op · else → no verb
 *     In Progress  : BACKLOG/TODO → start(role?) · AWAITING_GATE → approve(nextRole?)
 *                    (role/nextRole = the ticket's own currentRole — "keeps current", never
 *                    invented client-side) · already In Progress → no-op · else → no verb
 *     Done         : AWAITING_GATE → complete() · already Done → no-op · else → no verb
 *     Canceled     : anything non-terminal → cancel() · DONE → refused (terminal) · already
 *                    Canceled → no-op
 *   A "no verb exists" result is printed as `✗ <id> 400 <reason>` and exits 1 WITHOUT ever
 *   calling the API (there is nothing for it to accept) — anything else calls the API and
 *   any real rejection is printed the same way, with the API's own reason.
 *
 *   `set --add-label X` / `--remove-label X`:
 *     awaiting-you  add→raiseGate · remove→approve
 *     released      add→release   · remove→warn (releasedAt is a one-way stamp), no-op exit 0
 *     blocked       add→setBlocked(true) · remove→setBlocked(false)
 *     <persona>     (host|camper|admin|platform) add→updateFields(persona) · remove→updateFields(persona:null)
 *     anything else → warn "labels are columns now", no-op, exit 0
 *
 * Errors: any non-2xx API response prints `✗ <id> <status> <reason>` to stderr and sets
 * exit 1 (except the documented special exit codes: gates=10, audit=11). The token is never
 * echoed anywhere (.claude/rules/security.md).
 */
import fs from "node:fs";
import path from "node:path";
import {
  mapLegacyState,
  mapLegacyLabel,
  ACTIONS_ACCEPTING_NOTE,
} from "./lib/ticket-sync-mapping.mjs";
import {
  parseSetFlags,
  parseHandoffFlags,
  parseCreateFlags,
  parseCommentFlags,
  parseActorFlag,
} from "./lib/ticket-sync-args.mjs";

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
const BASE = (ENV.APP_BASE_URL || "https://campvibe-staging.vercel.app").replace(/\/+$/, "");
const TOKEN = ENV.STATUS_TOKEN;
const DEFAULT_ACTOR = ENV.TICKET_SYNC_ACTOR || "ticket-sync-cli";
if (!TOKEN) { console.error("✗ STATUS_TOKEN missing in .env"); process.exit(1); }

// ── HTTP client (the ONLY way this script ever touches ticket data) ───────────────────────

async function apiFetch(method, urlPath, body) {
  const headers = { "x-status-token": TOKEN };
  if (body !== undefined) headers["content-type"] = "application/json";
  let res;
  try {
    res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Network/DNS failure (offline, bad APP_BASE_URL) — surface the same way an HTTP error
    // would, so callers have one uniform failure path.
    return { status: 0, data: { error: "network_error", message: e.message } };
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body, e.g. a 204 — never expected here */ }
  return { status: res.status, data };
}

function reasonOf(data) {
  if (!data) return "(no body)";
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return JSON.stringify(data);
}

/** Print the standard error line + mark the run failed. Never throws — caller decides next. */
function apiFail(id, status, data) {
  console.error(`✗ ${id} ${status} ${reasonOf(data)}`);
  process.exitCode = 1;
}

/** Bounded list read (GET /api/tickets, no filter — the API itself caps at 500 rows). */
async function getAllTickets() {
  const { status, data } = await apiFetch("GET", "/api/tickets");
  if (status !== 200) { apiFail("-", status, data); process.exit(1); }
  return data.tickets;
}

/** GET /api/tickets/[id] — ticket + comments + events. Exits (this is always a hard prerequisite). */
async function getTicketDetail(id) {
  const { status, data } = await apiFetch("GET", `/api/tickets/${encodeURIComponent(id)}`);
  if (status !== 200) { apiFail(id, status, data); process.exit(1); }
  return data; // { ticket, comments, events }
}

/** PATCH /api/tickets/[id] — one state-machine verb. Returns the updated ticket, or null on failure. */
async function patchTicket(id, action, params, actor) {
  const { status, data } = await apiFetch("PATCH", `/api/tickets/${encodeURIComponent(id)}`, {
    action,
    actor,
    ...params,
  });
  if (status !== 200) { apiFail(id, status, data); return null; }
  return data.ticket;
}

function usage(msg) {
  console.log(`usage: ${msg}`);
  process.exit(1);
}
function usageErr(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ── small duplicated constants (mirrors lib/delivery/validations.ts — this is a plain .mjs
//    script with zero dependency on the TS build, same reasoning that file's own header
//    comment gives for hand-writing its enum literal lists rather than importing the
//    generated Prisma client) ────────────────────────────────────────────────────────────

const DELIVERY_ROLES = [
  "PRODUCT_OWNER", "ANALYST", "ARCHITECT", "UX_DESIGNER", "FRONTEND_ENGINEER",
  "BACKEND_ENGINEER", "QA_ENGINEER", "SECURITY_REVIEWER", "DEVOPS_RELEASE",
];
const ROLE_SLUGS = DELIVERY_ROLES.map((r) => r.toLowerCase().replace(/_/g, "-"));
function roleSlugToEnum(s) {
  const i = ROLE_SLUGS.indexOf(String(s ?? "").toLowerCase());
  return i === -1 ? null : DELIVERY_ROLES[i];
}
/** Mirrors lib/delivery/roles.ts roleSlug() — trivial, duplicated for the same zero-dep reason. */
function roleSlug(roleEnum) {
  return roleEnum ? roleEnum.toLowerCase().replace(/_/g, "-") : null;
}

const PERSONA_ENUMS = ["HOST", "CAMPER", "ADMIN", "PLATFORM"];
const PERSONAS_LC = PERSONA_ENUMS.map((p) => p.toLowerCase());

const STATE_LABEL = {
  BACKLOG: "Backlog", TODO: "Todo", IN_PROGRESS: "In Progress",
  AWAITING_GATE: "Awaiting Gate", DONE: "Done", CANCELED: "Canceled",
};
const STATE_TO_TYPE = {
  BACKLOG: "backlog", TODO: "unstarted", IN_PROGRESS: "started",
  AWAITING_GATE: "started", DONE: "completed", CANCELED: "canceled",
};

function sortByIdentifier(a, b) {
  return a.identifier.localeCompare(b.identifier, undefined, { numeric: true });
}

/** Display-only synthesis of "what would have been labels" — mirrors
 *  lib/delivery/status-adapter.ts's labels[] composition (not imported: that file is
 *  server-only + Prisma-typed, unreachable from a plain .mjs script). Used for human-readable
 *  CLI output only — never fed back into an API call. */
function synthesizeLabels(t) {
  const labels = [];
  if (t.state === "AWAITING_GATE") labels.push("awaiting-you");
  if (t.changesRequested) labels.push("changes-requested");
  if (t.releasedAt) labels.push("released");
  if (t.blocked) labels.push("blocked");
  if (t.persona) labels.push(t.persona.toLowerCase());
  if (t.regressionRound > 0) labels.push(`regression:${t.regressionRound}`);
  return labels;
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function today() { return new Date().toISOString().slice(0, 10); }
function slug(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/[^\w฀-๿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "untitled";
}
function applyVars(tpl, vars) { return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`)); }
function writeIfAbsent(file, content) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}
const TPL = (name) => path.join(".claude", "templates", `${name}.md`);

// ── ticket classification + delivery-artifact-store paths (docs/delivery/<feature>/<epic>/<id-title>/) ──

function isGateTicket(t) { return /Gate\s*G\d/i.test(t.title); }
/** A trackable work ticket = STORY or TASK (excludes the EPIC grouping container + any legacy-imported Gate-title row). */
function isWorkTicket(t) { return t.type !== "EPIC" && !isGateTicket(t); }
function buildEpicIndex(all) {
  const m = new Map();
  for (const t of all) if (t.type === "EPIC") m.set(t.id, t);
  return m;
}
function epicOf(t, byId) { return t.epicId ? byId.get(t.epicId) ?? null : null; }
function featureNameOf(t, byId) { return t.featureName || epicOf(t, byId)?.title || "(ungrouped)"; }
function epicNameOf(t, byId) { const e = epicOf(t, byId); return e ? e.title : featureNameOf(t, byId); }
function personaOf(t) { return t.persona ? t.persona.toLowerCase() : ""; }
function deliveryDirsFor(t, byId) {
  const fSlug = slug(featureNameOf(t, byId));
  const eSlug = slug(epicNameOf(t, byId));
  const fdir = path.join("docs", "delivery", fSlug);
  const edir = eSlug === fSlug ? fdir : path.join(fdir, eSlug);
  const sdir = path.join(edir, `${t.identifier}-${slug(t.title)}`);
  return { fdir, edir, sdir };
}

// ── Telegram notify (unchanged pattern — direct call, same env, reused verbatim from
//    scripts/linear-sync.mjs; no lib/notify.ts import possible from a plain .mjs script) ──

async function notifyTelegram(text, buttons) {
  const tok = ENV.TELEGRAM_BOT_TOKEN, chat = ENV.TELEGRAM_CHAT_ID;
  if (!tok || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true,
        ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    });
  } catch (e) { console.error("telegram notify failed:", e.message); }
}
function statusUrl() {
  const q = new URLSearchParams();
  if (TOKEN) q.set("token", TOKEN);
  const s = q.toString();
  return `${BASE}/status${s ? "?" + s : ""}`;
}

// ── commands ───────────────────────────────────────────────────────────────────────────────

async function cmdList() {
  const all = await getAllTickets();
  const byId = buildEpicIndex(all);
  const stories = all.filter((t) => t.type !== "EPIC").sort(sortByIdentifier);
  if (!stories.length) { console.log("no tickets found"); return; }

  const byEpic = new Map();
  for (const t of stories) {
    const epic = epicOf(t, byId);
    const label = epic ? `${epic.identifier} ${epic.title}` : "(ungrouped)";
    if (!byEpic.has(label)) byEpic.set(label, []);
    byEpic.get(label).push(t);
  }
  for (const [label, items] of byEpic) {
    const done = items.filter((t) => t.state === "DONE").length;
    console.log(`\n● ${label}  (${done}/${items.length} done)`);
    for (const t of items) {
      const labels = synthesizeLabels(t).join(",");
      const state = STATE_LABEL[t.state] || t.state;
      console.log(
        `  ${t.identifier.padEnd(7)} ${state.padEnd(14)} [${roleSlug(t.currentRole) || "—"}]${labels ? " {" + labels + "}" : ""}  ${t.title.slice(0, 54)}`
      );
    }
  }
}

async function cmdSet(id, args) {
  let flags;
  try { flags = parseSetFlags(args); } catch (e) { usageErr(e.message); return; }
  const actor = flags.actor || DEFAULT_ACTOR;
  const changeLines = [];

  if (flags.state) {
    const { ticket } = await getTicketDetail(id);
    const decision = mapLegacyState(flags.state, ticket);
    if (decision.noop) {
      console.log(`= ${id} already "${flags.state}"`);
    } else if (!decision.ok) {
      console.error(`✗ ${id} 400 ${decision.reason}`);
      process.exitCode = 1;
    } else {
      const params = { ...(decision.params || {}) };
      if (flags.note && ACTIONS_ACCEPTING_NOTE.has(decision.action)) params.note = flags.note;
      const updated = await patchTicket(id, decision.action, params, actor);
      if (updated) changeLines.push(`state→"${flags.state}" (${decision.action})`);
    }
  }

  for (const label of flags.add) {
    const decision = mapLegacyLabel(label, "add");
    if (decision.warn) { console.log(`⚠ ${id} ${decision.warn}`); continue; }
    const params = { ...(decision.params || {}) };
    if (flags.note && ACTIONS_ACCEPTING_NOTE.has(decision.action)) params.note = flags.note;
    const updated = await patchTicket(id, decision.action, params, actor);
    if (updated) changeLines.push(`+${label} (${decision.action})`);
  }
  for (const label of flags.remove) {
    const decision = mapLegacyLabel(label, "remove");
    if (decision.warn) { console.log(`⚠ ${id} ${decision.warn}`); continue; }
    const params = { ...(decision.params || {}) };
    if (flags.note && ACTIONS_ACCEPTING_NOTE.has(decision.action)) params.note = flags.note;
    const updated = await patchTicket(id, decision.action, params, actor);
    if (updated) changeLines.push(`-${label} (${decision.action})`);
  }

  if (!flags.state && !flags.add.length && !flags.remove.length) {
    console.log(`= ${id} no changes requested`);
    return;
  }
  if (changeLines.length) console.log(`✓ ${id} updated: ${changeLines.join(" ")}`);
}

async function cmdHandoff(id, args) {
  if (!id) usage('handoff <CAM-id> --role <role> [--state "In Progress"] [--note "..."] [--actor <actor>]');
  let flags;
  try { flags = parseHandoffFlags(args); } catch (e) { usageErr(e.message); return; }
  if (!flags.role) usage('handoff <CAM-id> --role <role> [--state "In Progress"] [--note "..."] [--actor <actor>]');

  const roleEnum = roleSlugToEnum(flags.role);
  if (!roleEnum) { usageErr(`unknown role "${flags.role}". Use one of: ${ROLE_SLUGS.join(", ")}`); return; }

  const actor = flags.actor || DEFAULT_ACTOR;
  const { ticket } = await getTicketDetail(id);
  const notStarted = ticket.state === "BACKLOG" || ticket.state === "TODO";

  let updated, verb;
  if (flags.state && notStarted) {
    // Not started yet: start(role) both begins the ticket AND assigns the role in one call —
    // a following `handoff` would be a same-role no-op (handoff also requires IN_PROGRESS,
    // which start() just entered), so we call start() instead of handoff() here.
    verb = "start";
    updated = await patchTicket(id, "start", { role: roleEnum }, actor);
  } else {
    verb = "handoff";
    updated = await patchTicket(id, "handoff", { role: roleEnum, ...(flags.note ? { note: flags.note } : {}) }, actor);
  }
  if (updated) {
    console.log(`✓ ${id} handoff: role→${flags.role} (${verb})${flags.state ? ` state→"${flags.state}"` : ""}`);
  }
}

async function cmdRelease(id, args) {
  if (!id) usage("release <CAM-id> [--actor <actor>]");
  let flags;
  try { flags = parseActorFlag(args); } catch (e) { usageErr(e.message); return; }
  const updated = await patchTicket(id, "release", {}, flags.actor || DEFAULT_ACTOR);
  if (updated) console.log(`✓ ${id} released`);
}

/**
 * gates — list tickets currently gate-related: `state=AWAITING_GATE` (waiting on the human,
 * same meaning as legacy's `awaiting-you` label) OR `changesRequested=true` (a gate was
 * `reject`ed and bounced back to IN_PROGRESS for rework — the closest ADR-010 analog of
 * legacy's "label cleared but the story's own state never advanced" limbo).
 *
 * Structural note (why there is no 3rd "approved but not yet advanced" bucket here, unlike
 * legacy): under ADR-010, `approve`/`complete` clear the gate AND advance state AND fire the
 * orchestrator-continue repository_dispatch in the SAME service-layer transaction (see
 * lib/delivery/tickets.ts dispatchApproved) — there is no window where a ticket can be
 * "cleared" yet stuck, because Linear's independently-settable state+label pair (the actual
 * root cause that made polling for that limbo necessary) no longer exists. Exit 10 is kept
 * for interface parity and fires on the `changesRequested` bucket instead — a real signal
 * that the assigned role should resume work on this ticket.
 */
async function cmdGates() {
  const all = await getAllTickets();
  const gates = all
    .filter((t) => t.state === "AWAITING_GATE" || t.changesRequested === true)
    .sort(sortByIdentifier);
  if (!gates.length) {
    console.log("no gates open (no ticket AWAITING_GATE or changesRequested)");
    return;
  }
  let waiting = 0, cleared = 0;
  for (const g of gates) {
    const aw = g.state === "AWAITING_GATE";
    const status = aw ? "WAITING-ON-YOU" : "CLEARED → role should CONTINUE (rejected, rework in progress)";
    if (aw) waiting++; else cleared++;
    console.log(`${aw ? "⏳" : "🔁"} ${g.identifier.padEnd(7)} ${status.padEnd(58)} [${roleSlug(g.currentRole) || "—"}] ${g.title.slice(0, 40)}`);
  }
  console.log(`\n${waiting} waiting on you · ${cleared} cleared (rework in progress). Cleared => the assigned role should CONTINUE.`);
  if (cleared) process.exitCode = 10;
}

async function cmdAudit() {
  const all = await getAllTickets();
  const byId = buildEpicIndex(all);
  const REQ = ["## Story", "## AC"];
  const NICE = ["## Rules", "## Edge cases", "## Data", "## Seams & refs", "## Out of scope", "## Self-verify"];
  // Parity with legacy: "active" excludes only DONE (the sole `completed`-typed state) —
  // CANCELED tickets are still audited, matching linear-sync's `state.type !== "completed"`.
  const stories = all.filter((t) => isWorkTicket(t) && t.state !== "DONE").sort(sortByIdentifier);
  if (!stories.length) {
    console.log("no active story-level tickets to audit (STORY/TASK, not an EPIC container, not DONE)");
    return;
  }

  let bad = 0;
  for (const s of stories) {
    const d = s.description || "";
    const miss = REQ.filter((h) => !d.includes(h));
    const warn = NICE.filter((h) => !d.includes(h));
    if (miss.length) bad++;
    const head = miss.length ? "MISSING " + miss.join(",") : "template ok";
    console.log(`${miss.length ? "✗" : "✓"} ${s.identifier.padEnd(7)} ${head.padEnd(26)}${warn.length ? " warn:" + warn.join(",") : ""}  ${s.title.slice(0, 40)}`);
  }
  console.log(`\n${stories.length} story ticket(s) · ${bad} not template-conformant (require ${REQ.join(" + ")}) — see .claude/templates/story.md`);
  if (bad) process.exitCode = 11;

  // Handoff/role-history integrity: every ADR-010 verb that sets currentRole (start/approve/
  // handoff) also pushes it into roleHistory in the SAME transaction (lib/delivery/tickets.ts
  // computeRoleChange) — so under normal API usage this can never actually mismatch. Kept as
  // a defensive check for a future legacy import (T-4) or a direct DB edit, mirroring the
  // legacy "title shows [role] but no role:<role> label" handoff-discipline check.
  let noHandoff = 0;
  for (const s of stories) {
    if (!s.currentRole) continue;
    if (!s.roleHistory.includes(s.currentRole)) {
      noHandoff++;
      console.log(`  ⚠ ${s.identifier} currentRole=${s.currentRole} missing from roleHistory — data-integrity gap (not reachable via the API's own verbs)`);
    }
  }
  if (noHandoff) {
    console.log(`handoff: ${noHandoff} active ticket(s) with a currentRole/roleHistory mismatch`);
    process.exitCode = 11;
  }

  // Delivery artifact-store consistency (docs/delivery/) — filesystem checks unchanged,
  // sourced from the API's tickets instead of Linear's issues.
  const ROLE_ART = [["designer", "design.md"], ["qa", "test.md"], ["security", "review.md"], ["devops", "delivery.md"]];
  const STUB_RE = /<[a-zA-Z][^>\n]{2,}>/;
  let notYet = 0, broken = 0, stale = 0, stub = 0;
  const stubSeen = new Set();
  for (const s of stories) {
    const { fdir, edir, sdir } = deliveryDirsFor(s, byId);
    const storyFile = path.join(sdir, "story.md");
    if (!fs.existsSync(storyFile)) { notYet++; console.log(`  · ${s.identifier} no artifact folder yet  (scaffold ${s.identifier})`); continue; }
    const roleSlugs = s.roleHistory.map((r) => r.toLowerCase().replace(/_/g, "-"));
    const missing = ROLE_ART.filter(([k, f]) => roleSlugs.some((n) => n.includes(k)) && !fs.existsSync(path.join(sdir, f))).map(([, f]) => f);
    if (missing.length) { broken++; console.log(`  ✗ ${s.identifier} a role acted but its artifact is missing: ${missing.join(",")}`); }
    const m = fs.readFileSync(storyFile, "utf8").match(/^status:\s*(.+)$/m);
    const displayState = STATE_LABEL[s.state] || s.state;
    if (m && !m[1].toLowerCase().includes(displayState.toLowerCase())) { stale++; console.log(`  ⚠ ${s.identifier} status "${m[1].trim()}" ≠ ticket "${displayState}"`); }
    for (const f of [path.join(fdir, "feature.md"), path.join(edir, "epic.md")]) {
      if (stubSeen.has(f) || !fs.existsSync(f)) continue;
      stubSeen.add(f);
      if (STUB_RE.test(fs.readFileSync(f, "utf8"))) { stub++; console.log(`  ✗ stub not filled (PO owns): ${path.relative(process.cwd(), f)} still has <placeholder> markers`); }
    }
  }
  console.log(`artifacts: ${notYet} not-yet-scaffolded · ${broken} role-artifact-missing · ${stale} status-stale · ${stub} feature/epic stub`);
  if (broken || stale || stub) process.exitCode = 11;
}

async function cmdPull(outfile) {
  const all = await getAllTickets();
  const byId = buildEpicIndex(all);
  const work = all.filter(isWorkTicket);
  const epics = {};
  for (const t of work) {
    const e = epicNameOf(t, byId);
    (epics[e] = epics[e] || []).push({
      id: t.identifier,
      role: roleSlug(t.currentRole) || "",
      state: STATE_LABEL[t.state] || t.state,
      statusType: STATE_TO_TYPE[t.state],
      labels: synthesizeLabels(t),
      startedAt: t.startedAt,
      url: t.legacyUrl || "",
      title: t.title,
    });
  }
  const snapshot = {
    _generated: "GENERATED by `npm run tickets:pull` from /api/tickets — do not hand-edit. The self-hosted delivery ticket DB is the source of truth.",
    source: "delivery-tickets-api",
    issueCount: work.length,
    epics: Object.fromEntries(Object.entries(epics).map(([e, items]) => {
      const done = items.filter((x) => x.statusType === "completed").length;
      return [e, { total: items.length, done, pct: items.length ? Math.round((done / items.length) * 100) : 0, stories: items }];
    })),
  };
  const out = outfile || path.join(".claude", "linear-snapshot.json");
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`✓ pulled ${work.length} tickets across ${Object.keys(epics).length} epics → ${out}`);
}

async function cmdIndex() {
  const all = await getAllTickets();
  const byId = buildEpicIndex(all);
  const work = all.filter(isWorkTicket);
  const feats = {};
  for (const t of work) {
    const f = featureNameOf(t, byId), e = epicNameOf(t, byId);
    ((feats[f] = feats[f] || {})[e] = feats[f][e] || []).push(t);
  }
  const artLink = (t) => {
    const sdir = deliveryDirsFor(t, byId).sdir;
    const rel = sdir.split(path.sep).join("/") + "/story.md";
    return `[${t.identifier}](${t.legacyUrl || "#"})` + (fs.existsSync(path.join(sdir, "story.md")) ? ` · [artifact](${rel})` : " · _(not scaffolded)_");
  };
  const L = [
    "<!-- GENERATED by `node scripts/ticket-sync.mjs index` from /api/tickets — do not hand-edit. The self-hosted ticket DB is the live-status SoT. -->",
    "# Delivery Index", "", `_${work.length} tickets · generated ${today()}._`, "", "## By feature → epic → story", "",
  ];
  for (const [f, epicsMap] of Object.entries(feats).sort()) {
    L.push(`### ${esc(f)}`, "");
    for (const [e, items] of Object.entries(epicsMap).sort()) {
      L.push(`- **${esc(e)}**`);
      for (const t of items.sort(sortByIdentifier)) {
        const labels = synthesizeLabels(t).join(",");
        L.push(`  - ${STATE_LABEL[t.state] || t.state} · [${roleSlug(t.currentRole) || "—"}]${labels ? " {" + labels + "}" : ""} · ${artLink(t)} — ${esc(t.title).slice(0, 60)}`);
      }
    }
    L.push("");
  }
  L.push("## By persona", "");
  for (const p of PERSONAS_LC) {
    const items = work.filter((t) => personaOf(t) === p).sort(sortByIdentifier);
    if (!items.length) continue;
    L.push(`### ${p} (${items.length})`);
    for (const t of items) L.push(`- ${STATE_LABEL[t.state] || t.state} · ${esc(featureNameOf(t, byId))} · ${artLink(t)} — ${esc(t.title).slice(0, 50)}`);
    L.push("");
  }
  const out = path.join("docs", "delivery", "INDEX.md");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, L.join("\n") + "\n");
  console.log(`✓ index → ${out} (${work.length} tickets · ${Object.keys(feats).length} features)`);
}

async function cmdScaffold(id) {
  if (!id) usage("scaffold <CAM-id>");
  const all = await getAllTickets();
  const byId = buildEpicIndex(all);
  const ticket = all.find((t) => t.identifier.toUpperCase() === id.toUpperCase());
  if (!ticket) { console.error(`✗ ${id} 404 ticket not found`); process.exit(1); }

  const { fdir, edir, sdir } = deliveryDirsFor(ticket, byId);
  const epic = epicOf(ticket, byId);
  const vars = {
    linear: ticket.identifier,
    feature: slug(featureNameOf(ticket, byId)),
    featureName: featureNameOf(ticket, byId),
    epic: slug(epicNameOf(ticket, byId)),
    epicId: epic ? epic.identifier : "—",
    epicTitle: epicNameOf(ticket, byId),
    persona: personaOf(ticket) || "—",
    status: STATE_LABEL[ticket.state] || ticket.state,
    date: today(),
    title: ticket.title,
  };
  const made = [];
  if (writeIfAbsent(path.join(fdir, "feature.md"), applyVars(fs.readFileSync(TPL("feature"), "utf8"), vars))) made.push("feature.md");
  if (writeIfAbsent(path.join(edir, "epic.md"), applyVars(fs.readFileSync(TPL("epic"), "utf8"), vars))) made.push(`${slug(epicNameOf(ticket, byId))}/epic.md`);
  const header = applyVars(
    "---\nlinear: {{linear}}\nfeature: {{feature}}\nepic: {{epic}} ({{epicId}})\npersona: {{persona}}\nartifact: story\nowner: product-owner\nstatus: {{status}}\nversion: v1\nupdated: {{date}}\n---\n# {{title}} ({{linear}})\n\n",
    vars
  );
  const desc = (ticket.description || "").trim();
  const body = desc || fs.readFileSync(TPL("story"), "utf8").replace(/^<!--[\s\S]*?-->\s*/, "");
  if (writeIfAbsent(path.join(sdir, "story.md"), header + body + "\n")) made.push("story.md");

  console.log(`✓ scaffold ${ticket.identifier} → ${sdir}`);
  console.log(`  created: ${made.join(", ") || "(story.md + containers already existed)"}`);
  console.log("  role artifacts on-demand: design (UI) · tech (rich API) · test (qa) · review (security) · delivery (devops)");
}

async function cmdNotify(text) {
  if (!text) usage("notify <text>");
  await notifyTelegram(text, [[{ text: "📊 /status", url: statusUrl() }]]);
  console.log("✓ telegram notified");
}

const CREATE_TYPE_MAP = { epic: "EPIC", story: "STORY", task: "TASK" };

async function cmdCreate(args) {
  let flags;
  try { flags = parseCreateFlags(args); } catch (e) { usageErr(e.message); return; }
  const typeKey = String(flags.type || "").toLowerCase();
  if (!CREATE_TYPE_MAP[typeKey]) { usageErr(`--type must be one of epic|story|task (got "${flags.type ?? ""}")`); return; }
  if (!flags.title) { usageErr("--title is required"); return; }

  const actor = flags.actor || DEFAULT_ACTOR;

  let epicId;
  if (flags.epic) {
    const { ticket } = await getTicketDetail(flags.epic);
    epicId = ticket.id;
  }
  let currentRole;
  if (flags.role) {
    currentRole = roleSlugToEnum(flags.role);
    if (!currentRole) { usageErr(`unknown role "${flags.role}". Use one of: ${ROLE_SLUGS.join(", ")}`); return; }
  }
  let persona;
  if (flags.persona) {
    const p = flags.persona.toUpperCase();
    if (!PERSONA_ENUMS.includes(p)) { usageErr(`unknown persona "${flags.persona}". Use one of: ${PERSONAS_LC.join(", ")}`); return; }
    persona = p;
  }
  let description = flags.description;
  if (flags.descriptionFile) description = fs.readFileSync(flags.descriptionFile, "utf8");

  const body = {
    actor,
    title: flags.title,
    type: CREATE_TYPE_MAP[typeKey],
    ...(description !== undefined ? { description } : {}),
    ...(epicId ? { epicId } : {}),
    ...(persona ? { persona } : {}),
    ...(flags.feature ? { featureName: flags.feature } : {}),
    ...(flags.priority !== undefined ? { priority: Number(flags.priority) } : {}),
    ...(currentRole ? { currentRole } : {}),
  };

  const { status, data } = await apiFetch("POST", "/api/tickets", body);
  if (status !== 201) { apiFail("-", status, data); return; }
  console.log(`✓ created ${data.ticket.identifier}: ${data.ticket.title}`);
}

async function cmdComment(id, args) {
  if (!id) usage('comment <CAM-id> --body "..." [--body-file F] [--actor A]');
  let flags;
  try { flags = parseCommentFlags(args); } catch (e) { usageErr(e.message); return; }
  let body = flags.body;
  if (flags.bodyFile) body = fs.readFileSync(flags.bodyFile, "utf8");
  if (!body) { usageErr("--body or --body-file is required"); return; }

  const { status, data } = await apiFetch("POST", `/api/tickets/${encodeURIComponent(id)}/comments`, {
    actor: flags.actor || DEFAULT_ACTOR,
    body,
  });
  if (status !== 201) { apiFail(id, status, data); return; }
  console.log(`✓ ${id} comment added`);
}

async function cmdShow(id) {
  if (!id) usage("show <CAM-id>");
  const { status, data } = await apiFetch("GET", `/api/tickets/${encodeURIComponent(id)}`);
  if (status !== 200) { apiFail(id, status, data); return; }

  const { ticket: t, comments, events } = data;
  console.log(`${t.identifier}  ${t.title}`);
  console.log(`  type=${t.type} state=${STATE_LABEL[t.state] || t.state} role=${roleSlug(t.currentRole) || "—"} persona=${t.persona || "—"} priority=${t.priority}`);
  console.log(`  feature=${t.featureName || "—"} epicId=${t.epicId || "—"} blocked=${t.blocked} changesRequested=${t.changesRequested} regressionRound=${t.regressionRound}`);
  console.log(`  startedAt=${t.startedAt || "—"} gateRaisedAt=${t.gateRaisedAt || "—"} completedAt=${t.completedAt || "—"} releasedAt=${t.releasedAt || "—"}`);
  if (t.description) console.log(`\n${t.description}`);

  console.log(`\n-- last comments (${comments.length}) --`);
  for (const c of comments.slice(-5)) console.log(`  [${c.createdAt}] ${c.authorName}: ${String(c.body).slice(0, 200)}`);

  console.log(`\n-- last events (${events.length}) --`);
  for (const e of events.slice(-10)) {
    console.log(`  [${e.createdAt}] ${e.kind} ${e.fromValue ?? "—"} → ${e.toValue ?? "—"} by ${e.actor}${e.note ? ` note="${e.note}"` : ""}`);
  }
}

// ── dispatch ─────────────────────────────────────────────────────────────────────────────

const USAGE =
  "usage: ticket-sync <list | gates | audit | pull [outfile] | index | show <CAM-id> | " +
  "set <CAM-id> [--state S] [--add-label L] [--remove-label L] [--note N] [--actor A] | " +
  "handoff <CAM-id> --role <role> [--state S] [--note N] [--actor A] | " +
  "release <CAM-id> [--actor A] | scaffold <CAM-id> | notify <text> | " +
  "create --type epic|story|task --title T [--epic E] [--role R] [--persona P] [--feature F] " +
  "[--priority N] [--description-file F | --description D] [--actor A] | " +
  "comment <CAM-id> --body B [--body-file F] [--actor A]>";

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "list") await cmdList();
  else if (cmd === "set") await cmdSet(rest[0], rest.slice(1));
  else if (cmd === "handoff") await cmdHandoff(rest[0], rest.slice(1));
  else if (cmd === "release") await cmdRelease(rest[0], rest.slice(1));
  else if (cmd === "gates") await cmdGates();
  else if (cmd === "audit") await cmdAudit();
  else if (cmd === "pull") await cmdPull(rest[0]);
  else if (cmd === "index") await cmdIndex();
  else if (cmd === "scaffold") await cmdScaffold(rest[0]);
  else if (cmd === "notify") await cmdNotify(rest.join(" "));
  else if (cmd === "create") await cmdCreate(rest);
  else if (cmd === "comment") await cmdComment(rest[0], rest.slice(1));
  else if (cmd === "show") await cmdShow(rest[0]);
  else { console.log(USAGE); process.exit(1); }
} catch (e) {
  console.error("✗", e.message);
  process.exit(1);
}
