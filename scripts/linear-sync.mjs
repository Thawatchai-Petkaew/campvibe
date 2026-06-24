#!/usr/bin/env node
/**
 * linear-sync — deterministic Linear writer for the CampVibe AI delivery team.
 *
 * Linear is the SINGLE SOURCE OF TRUTH for delivery status. The /status dashboard
 * reads it live; the orchestrator + CI + hooks WRITE to it through this CLI so that
 * "agent finished / gate moved" actually lands in Linear without an in-session MCP.
 *
 * Reads LINEAR_API_KEY + LINEAR_TEAM_KEY from .env (no extra deps).
 *
 * Usage:
 *   node scripts/linear-sync.mjs list
 *   node scripts/linear-sync.mjs set CAM-7 --state "In Progress"
 *   node scripts/linear-sync.mjs set CAM-11 --add-label awaiting-you
 *   node scripts/linear-sync.mjs set CAM-7 --state Done --remove-label awaiting-you
 *   node scripts/linear-sync.mjs release CAM-7                     # promoted to prod: state Done + label `released`
 *   node scripts/linear-sync.mjs audit                            # flag story issues missing ## Story / ## AC (exit 11)
 *   node scripts/linear-sync.mjs label CAM-5 --add camper          (alias of set)
 *   node scripts/linear-sync.mjs pull [outfile]   # snapshot Linear -> JSON (default .claude/linear-snapshot.json)
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://api.linear.app/graphql";

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
const ENV = loadEnv();
const KEY = ENV.LINEAR_API_KEY;
const TEAM = ENV.LINEAR_TEAM_KEY || "CAM";
if (!KEY) { console.error("✗ LINEAR_API_KEY missing in .env"); process.exit(1); }

async function gql(query, variables) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: KEY },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// Telegram escalation notify — no-throw. Fires when a gate gets `awaiting-you`.
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

// Best-effort: nudge the live /status + /map pulse so connected dashboards refresh immediately
// after a write — independent of the Linear webhook (the primary pulse trigger), so freshness
// survives the webhook being down/unconfigured. No-throw; needs APP_BASE_URL + STATUS_TOKEN.
async function nudgePulse() {
  const base = ENV.APP_BASE_URL || "https://campvibe-staging.vercel.app";
  const token = ENV.STATUS_TOKEN;
  if (!token) return;
  try {
    await fetch(`${base}/api/status/pulse`, { method: "POST", headers: { "x-status-token": token } });
  } catch { /* a dashboard-refresh nudge must never fail a Linear write */ }
}

async function ctx() {
  // Split into two queries — fetching team meta + 250 issues with nested labels in
  // one shot trips Linear's "Query too complex" limit.
  const meta = await gql(
    `query($k:String!){ teams(filter:{key:{eq:$k}}){ nodes{ id name
      states{ nodes{ id name type } } labels{ nodes{ id name } } } } }`,
    { k: TEAM }
  );
  const team = meta.teams?.nodes?.[0];
  if (!team) throw new Error(`team "${TEAM}" not found`);
  const iss = await gql(
    `query($k:String!){ issues(filter:{team:{key:{eq:$k}}}, first:100){ nodes{
      id identifier title url priority startedAt updatedAt description
      parent{ id identifier title } project{ id name }
      state{ name type } labels{ nodes{ id name } } } } }`,
    { k: TEAM }
  );
  team.issues = { nodes: iss.issues?.nodes ?? [] };
  return team;
}

function parseFlags(args) {
  const f = { add: [], remove: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--state") f.state = args[++i];
    else if (a === "--add-label" || a === "--add") f.add.push(args[++i]);
    else if (a === "--remove-label" || a === "--remove") f.remove.push(args[++i]);
  }
  return f;
}

async function ensureLabel(team, name) {
  const found = team.labels.nodes.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  const d = await gql(
    `mutation($name:String!,$teamId:String!){ issueLabelCreate(input:{name:$name,teamId:$teamId}){ issueLabel{ id name } } }`,
    { name, teamId: team.id }
  );
  const lbl = d.issueLabelCreate.issueLabel;
  team.labels.nodes.push(lbl);
  return lbl.id;
}

async function cmdSet(id, flags) {
  const team = await ctx();
  const issue = team.issues.nodes.find((i) => i.identifier.toUpperCase() === id.toUpperCase());
  if (!issue) throw new Error(`issue ${id} not found in ${TEAM}`);

  const input = {};
  if (flags.state) {
    const st = team.states.nodes.find((s) => s.name.toLowerCase() === flags.state.toLowerCase());
    if (!st) throw new Error(`state "${flags.state}" not found. Available: ${team.states.nodes.map((s) => s.name).join(", ")}`);
    if (st.name !== issue.state.name) input.stateId = st.id;
  }
  if (flags.add.length || flags.remove.length) {
    const current = new Set(issue.labels.nodes.map((l) => l.id));
    for (const name of flags.add) current.add(await ensureLabel(team, name));
    for (const name of flags.remove) {
      const l = team.labels.nodes.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (l) current.delete(l.id);
    }
    input.labelIds = [...current];
  }
  if (!Object.keys(input).length) { console.log(`= ${id} already in sync (no change)`); return; }
  await gql(`mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`, { id: issue.id, input });
  const bits = [flags.state ? `state→${flags.state}` : "", flags.add.length ? `+[${flags.add}]` : "", flags.remove.length ? `-[${flags.remove}]` : ""].filter(Boolean);
  console.log(`✓ ${id} updated: ${bits.join(" ")}`);
  await nudgePulse();
  // NOTE: Telegram event notifications (gate / done / handoff / released / etc.) are sent
  // exclusively by the Linear webhook (app/api/linear-webhook/route.ts), which fires for any
  // actor. This script only sets state/labels/title; those changes trigger the webhook which
  // notifies the owner. Do NOT add event sends here — that causes double-sends.
}

// Released = promoted to production. The story stays in state `Done` (set at merge→staging) and
// additionally carries the `released` label. "Done" (on Staging) and "Released" (on prod) are
// separate dimensions — see .claude/SYNC-ARCHITECTURE.md §Definition of Done.
async function cmdRelease(id) {
  if (!id) throw new Error("usage: release <CAM-id>");
  await cmdSet(id, { state: "Done", add: ["released"], remove: [] });
}

// Push a free-form message to Telegram (used by CI to report a headless run's result).
// Appends a /status button so the owner can jump to the live board. No-op if Telegram unset.
async function cmdNotify(text) {
  if (!text) throw new Error("usage: notify <text>");
  await notifyTelegram(text, [[{ text: "📊 /status", url: statusUrl() }]]);
  console.log("✓ telegram notified");
}

function epicOf(t) { const x = t.split("·"); return x.length > 1 ? x[0].trim() : "(ungrouped)"; }
function roleOf(t) { const m = t.match(/\[([a-z-]+)\]/); return m ? m[1] : ""; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function cleanTitle(t) { return t.replace(/\[[a-z-]+\]\s*/g, "").trim(); }

// ── Work-issue classification (must match lib/status-model.ts buildModel) ──
// The team migrated from legacy "·"-prefixed issues to a parent/project hierarchy:
//   • new story    = a child issue (has a parent) — grouped under parent.title / project.
//   • new epic      = a parentless issue WITH a Linear project + no "·" (the grouping container).
//   • legacy story  = a "·"-titled active-loop issue (no parent), grouped by the "·" prefix.
// A trackable WORK STORY is therefore (has a parent) OR ("·" in title), excluding gate issues
// and the new-structure epic container. Before this, every command keyed on `title.includes("·")`
// alone, so parented stories (the current convention) were invisible to list/pull/index/audit.
function isGateIssue(i) { return /Gate\s*G\d/i.test(i.title); }
function isWorkStory(i) { return !isGateIssue(i) && (!!i.parent || i.title.includes("·")); }

// ── Delivery artifact store: docs/delivery/<feature>/<epic>/<CAM-id>-<story>/ ──
// feature = Linear project · epic = parent issue (fallback: the "·" title prefix) · persona = label.
const PERSONAS = ["host", "camper", "admin", "platform"];
function slug(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/[^\w฀-๿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "untitled";
}
function personaOf(issue) {
  const ls = issue.labels.nodes.map((l) => l.name.toLowerCase());
  return PERSONAS.find((p) => ls.includes(p)) || "";
}
function featureName(issue) { return issue.project?.name || epicOf(issue.title); }
function epicName(issue) { return issue.parent?.title || epicOf(issue.title); }
function storyName(issue) { return cleanTitle(issue.title.replace(/^[^·]*·\s*/, "")); }
function deliveryDirs(issue) {
  const fSlug = slug(featureName(issue)), eSlug = slug(epicName(issue));
  const fdir = path.join("docs", "delivery", fSlug);
  // collapse the epic level when feature == epic (legacy "·" issues with no Linear project + no parent)
  const edir = eSlug === fSlug ? fdir : path.join(fdir, eSlug);
  const sdir = path.join(edir, `${issue.identifier}-${slug(storyName(issue))}`);
  return { fdir, edir, sdir };
}
function today() { return new Date().toISOString().slice(0, 10); }
function applyVars(tpl, vars) { return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`)); }
function writeIfAbsent(file, content) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}
const TPL = (name) => path.join(".claude", "templates", `${name}.md`);

// Map role slug → human-readable label for Telegram messages (no leading emoji per owner preference).
const ROLE_LABEL = {
  architect: "Architect",
  "ux-designer": "Designer",
  "frontend-engineer": "Frontend",
  "backend-engineer": "Backend",
  "qa-engineer": "QA",
  "security-reviewer": "Security",
  "devops-release": "DevOps",
  "product-owner": "Product Owner",
  analyst: "Analyst",
};

// Build a link to the live /status dashboard (token-gated). Used in Telegram messages so the
// owner can jump straight to the board. APP_BASE_URL falls back to the staging deploy.
function statusUrl(epic) {
  const base = ENV.APP_BASE_URL || "https://campvibe-staging.vercel.app";
  const q = new URLSearchParams();
  if (ENV.STATUS_TOKEN) q.set("token", ENV.STATUS_TOKEN);
  if (epic && epic !== "(ungrouped)") { q.set("tab", "epic"); q.set("epic", epic); }
  const s = q.toString();
  return `${base}/status${s ? "?" + s : ""}`;
}

async function cmdList() {
  const team = await ctx();
  const rows = team.issues.nodes.filter(isWorkStory).sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
  const byEpic = {};
  rows.forEach((i) => (byEpic[epicName(i)] = byEpic[epicName(i)] || []).push(i));
  for (const [epic, items] of Object.entries(byEpic)) {
    const done = items.filter((i) => i.state.type === "completed").length;
    console.log(`\n● ${epic}  (${done}/${items.length} done)`);
    for (const i of items) {
      const labels = i.labels.nodes.map((l) => l.name).join(",");
      console.log(`  ${i.identifier.padEnd(7)} ${i.state.name.padEnd(12)} [${roleOf(i.title) || "—"}]${labels ? " {" + labels + "}" : ""}  ${storyName(i).slice(0, 54)}`);
    }
  }
}

async function cmdPull(outfile) {
  const team = await ctx();
  const work = team.issues.nodes.filter(isWorkStory);
  const epics = {};
  work.forEach((i) => {
    const e = epicName(i);
    (epics[e] = epics[e] || []).push({
      id: i.identifier, role: roleOf(i.title), state: i.state.name, statusType: i.state.type,
      labels: i.labels.nodes.map((l) => l.name), startedAt: i.startedAt, url: i.url,
      title: storyName(i),
    });
  });
  const snapshot = {
    _generated: "GENERATED by `npm run status:pull` from Linear — do not hand-edit. Linear is the source of truth.",
    team: TEAM, pulledFrom: "linear", issueCount: work.length,
    epics: Object.fromEntries(Object.entries(epics).map(([e, items]) => {
      const done = items.filter((x) => x.statusType === "completed").length;
      return [e, { total: items.length, done, pct: Math.round((done / items.length) * 100), stories: items }];
    })),
  };
  const out = outfile || path.join(".claude", "linear-snapshot.json");
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`✓ pulled ${work.length} issues across ${Object.keys(epics).length} epics → ${out}`);
}

async function cmdGates() {
  // The closed-loop signal: which human gates are WAITING vs APPROVED-and-need-continuation.
  // Convention: a gate carries label "awaiting-you" while it waits. You approve in Linear by
  // removing that label (or moving the issue to Done). This command surfaces the transition so
  // the orchestrator (a /loop run, a cron agent, or you saying "continue") knows what to resume.
  const team = await ctx();
  const gates = team.issues.nodes
    .filter((i) => i.labels.nodes.some((l) => l.name === "awaiting-you") || /Gate\s*G\d/i.test(i.title))
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
  if (!gates.length) { console.log("no gates defined (no issue with label awaiting-you or 'Gate G#' in title)"); return; }
  let waiting = 0, ready = 0;
  for (const g of gates) {
    const aw = g.labels.nodes.some((l) => l.name === "awaiting-you");
    const done = g.state.type === "completed";
    const gate = (g.title.match(/Gate\s*G\d/i) || [""])[0];
    const status = aw ? "WAITING-ON-YOU" : done ? "APPROVED (done)" : "CLEARED → orchestrator should CONTINUE";
    if (aw) waiting++; else ready++;
    console.log(`${aw ? "⏳" : "✅"} ${g.identifier.padEnd(7)} ${status.padEnd(38)} ${epicOf(g.title)}${gate ? " · " + gate : ""}`);
  }
  console.log(`\n${waiting} waiting on you · ${ready} cleared. Cleared gates whose stage hasn't advanced => resume next stage.`);
  // exit 10 when there is at least one cleared (non-done) gate => a watcher/loop can branch on it
  if (gates.some((g) => !g.labels.nodes.some((l) => l.name === "awaiting-you") && g.state.type !== "completed")) process.exitCode = 10;
}

async function cmdAudit() {
  // Template conformance: an ACTIVE work story (isWorkStory = has a parent OR "·"-titled, not a
  // gate, not the epic container, not completed) must carry the §7.1 ticket template — at minimum
  // ## Story + ## AC. Shipped issues are exempt. Template: .claude/templates/story.md. Exit 11 if
  // any active story fails. (Before: filter required "·" + `!i.parent`, so parented stories — the
  // current convention — were never audited.)
  const team = await ctx();
  const REQ = ["## Story", "## AC"];
  const NICE = ["## Why", "## Rules", "## Data", "## Out of scope", "## Self-verify"];
  const stories = team.issues.nodes
    .filter((i) => isWorkStory(i) && i.state.type !== "completed")
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
  if (!stories.length) { console.log("no active story-level issues to audit (parented or '·'-titled work story, not a gate)"); return; }
  let bad = 0;
  for (const s of stories) {
    const d = s.description || "";
    const miss = REQ.filter((h) => !d.includes(h));
    const warn = NICE.filter((h) => !d.includes(h));
    if (miss.length) bad++;
    const head = miss.length ? "MISSING " + miss.join(",") : "template ok";
    console.log(`${miss.length ? "✗" : "✓"} ${s.identifier.padEnd(7)} ${head.padEnd(26)}${warn.length ? " warn:" + warn.join(",") : ""}  ${s.title.replace(/^[^·]*·\s*/, "").slice(0, 40)}`);
  }
  console.log(`\n${stories.length} story issue(s) · ${bad} not template-conformant (require ${REQ.join(" + ")}) — see .claude/templates/story.md`);
  if (bad) process.exitCode = 11;

  // ── Handoff discipline ── a story showing a [role] tag MUST carry the matching role:<role>
  // label, which only `handoff` writes. A bare title edit that skips `handoff` leaves the tag
  // without the label — and /status + the Telegram loop never fire. Flag it so "the team handed
  // off" is provable, not assumed. (Addresses: roles not advancing in headless/solo runs.)
  let noHandoff = 0;
  for (const s of stories) {
    const tag = roleOf(s.title);
    if (!tag) continue;
    const hasLabel = s.labels.nodes.some((l) => l.name.toLowerCase() === `role:${tag.toLowerCase()}`);
    if (!hasLabel) {
      noHandoff++;
      console.log(`  ⚠ ${s.identifier} title shows [${tag}] but has no role:${tag} label — handoff was skipped (run: linear-sync handoff ${s.identifier} --role ${tag})`);
    }
  }
  if (noHandoff) { console.log(`handoff: ${noHandoff} active story(ies) changed [role] without a handoff call`); process.exitCode = 11; }

  // ── Delivery artifact-store consistency (docs/delivery/) — ON-DEMAND / role-driven ──
  // story.md always; a role artifact is expected ONLY when the matching role:* label proves
  // that role acted. Checks ACTIVE stories INCL. parented children (CAM-129 — was parentless-only,
  // so child stories like CAM-127 went unchecked); completed stories are exempt. Also flags
  // feature.md/epic.md left as scaffold <placeholder> stubs — the PO must fill them (CAM-127 gap).
  const ROLE_ART = [["designer", "design.md"], ["qa", "test.md"], ["security", "review.md"], ["devops", "delivery.md"]];
  const STUB_RE = /<[a-zA-Z][^>\n]{2,}>/; // an unfilled angle-bracket placeholder from the scaffold
  const artStories = team.issues.nodes.filter((i) => isWorkStory(i) && i.state.type !== "completed");
  let notYet = 0, broken = 0, stale = 0, stub = 0;
  const stubSeen = new Set();
  for (const s of artStories) {
    const { fdir, edir, sdir } = deliveryDirs(s);
    const storyFile = path.join(sdir, "story.md");
    if (!fs.existsSync(storyFile)) { notYet++; console.log(`  · ${s.identifier} no artifact folder yet  (scaffold ${s.identifier})`); continue; }
    const roleLabels = s.labels.nodes.map((l) => l.name.toLowerCase()).filter((n) => n.startsWith("role:"));
    const missing = ROLE_ART.filter(([k, f]) => roleLabels.some((n) => n.includes(k)) && !fs.existsSync(path.join(sdir, f))).map(([, f]) => f);
    if (missing.length) { broken++; console.log(`  ✗ ${s.identifier} a role acted but its artifact is missing: ${missing.join(",")}`); }
    const m = fs.readFileSync(storyFile, "utf8").match(/^status:\s*(.+)$/m);
    if (m && !m[1].toLowerCase().includes(s.state.name.toLowerCase())) { stale++; console.log(`  ⚠ ${s.identifier} status "${m[1].trim()}" ≠ Linear "${s.state.name}"`); }
    // PO-authored feature.md/epic.md must be FILLED, not scaffold stubs (CAM-129; dedup across stories).
    for (const f of [path.join(fdir, "feature.md"), path.join(edir, "epic.md")]) {
      if (stubSeen.has(f) || !fs.existsSync(f)) continue;
      stubSeen.add(f);
      if (STUB_RE.test(fs.readFileSync(f, "utf8"))) { stub++; console.log(`  ✗ stub not filled (PO owns): ${path.relative(process.cwd(), f)} still has <placeholder> markers`); }
    }
  }
  console.log(`artifacts: ${notYet} not-yet-scaffolded · ${broken} role-artifact-missing · ${stale} status-stale · ${stub} feature/epic stub`);
  if (broken || stale || stub) process.exitCode = 11;
}

// handoff <CAM-id> --role <role> [--state "In Progress"] [--note "..."]
// Swaps the [role] tag in the title, accumulates a role:<role> label, optionally sets state,
// and fires a Telegram notification.
async function cmdHandoff(id, args) {
  if (!id) {
    console.log("usage: linear-sync handoff <CAM-id> --role <role> [--state <state>] [--note <note>]");
    process.exit(1);
  }

  // Parse handoff-specific flags.
  let role = "", state = "", note = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--role") role = args[++i] || "";
    else if (args[i] === "--state") state = args[++i] || "";
    else if (args[i] === "--note") note = args[++i] || "";
  }
  if (!role) {
    console.log("usage: linear-sync handoff <CAM-id> --role <role> [--state <state>] [--note <note>]");
    process.exit(1);
  }
  // Validate against the canonical role set (the 9 keys /status + the webhook map to a stage/icon).
  // An unknown or short-form token ("qa" vs "qa-engineer", or a typo) would write a junk role:*
  // label and a [role] tag that /status can't map and that mis-ranks the regression bump — reject.
  if (!(role in ROLE_LABEL)) {
    console.error(`✗ unknown role "${role}". Use one of: ${Object.keys(ROLE_LABEL).join(", ")}`);
    process.exit(1);
  }

  const team = await ctx();
  const issue = team.issues.nodes.find((i) => i.identifier.toUpperCase() === id.toUpperCase());
  if (!issue) throw new Error(`issue ${id} not found in ${TEAM}`);

  // Swap [role] tag in the title.
  let newTitle = issue.title;
  if (/\[[a-z-]+\]/.test(newTitle)) {
    // Replace the first existing [role] tag.
    newTitle = newTitle.replace(/\[[a-z-]+\]/, `[${role}]`);
  } else {
    // No existing tag: insert after the epic prefix (after ·) or at start.
    const dotIdx = newTitle.indexOf("·");
    if (dotIdx !== -1) {
      newTitle = newTitle.slice(0, dotIdx + 1) + ` [${role}]` + newTitle.slice(dotIdx + 1);
    } else {
      newTitle = `[${role}] ${newTitle}`;
    }
  }

  // Build update input.
  const input = { title: newTitle };

  // Set state if provided.
  if (state) {
    const st = team.states.nodes.find((s) => s.name.toLowerCase() === state.toLowerCase());
    if (!st) throw new Error(`state "${state}" not found. Available: ${team.states.nodes.map((s) => s.name).join(", ")}`);
    if (st.name !== issue.state.name) input.stateId = st.id;
  }

  // Accumulate role:<role> label WITHOUT removing existing labels.
  const labelName = `role:${role}`;
  const labelId = await ensureLabel(team, labelName);
  const current = new Set(issue.labels.nodes.map((l) => l.id));
  current.add(labelId);

  // -- Regression label bump (keep in sync with lib/status-derive.ts ROLE_STAGE) --
  // Inline stage rank for this .mjs script (mirrors ROLE_STAGE in status-derive.ts).
  const STAGES_MJS = ["Design", "Gate", "Build", "Verify", "Ship"];
  const ROLE_STAGE_MJS = {
    architect: "Design",
    "ux-designer": "Design",
    human: "Gate",
    "frontend-engineer": "Build",
    "backend-engineer": "Build",
    "qa-engineer": "Verify",
    "security-reviewer": "Verify",
    "devops-release": "Ship",
  };
  const stageRankMjs = (r) => {
    const s = ROLE_STAGE_MJS[r] ?? "Design";
    const i = STAGES_MJS.indexOf(s);
    return i >= 0 ? i : 0;
  };
  const oldRole = roleOf(issue.title);
  const extraBits = [];
  if (oldRole && stageRankMjs(role) < stageRankMjs(oldRole)) {
    // Backward move — find existing regression:<role>:k, remove it, add k+1.
    // String-split match (not new RegExp(role)) so a role with regex metacharacters can't misbehave.
    const existingLabel = issue.labels.nodes.find((l) => {
      const parts = l.name.split(":");
      return parts.length === 3 && parts[0] === "regression" && parts[1] === role && /^\d+$/.test(parts[2]);
    });
    if (existingLabel) {
      const k = parseInt(existingLabel.name.split(":")[2], 10);
      current.delete(existingLabel.id);
      const nextLabelId = await ensureLabel(team, `regression:${role}:${k + 1}`);
      current.add(nextLabelId);
      extraBits.push(`regression:${role}:${k + 1}`);
    } else {
      const nextLabelId = await ensureLabel(team, `regression:${role}:1`);
      current.add(nextLabelId);
      extraBits.push(`regression:${role}:1`);
    }
  }

  input.labelIds = [...current];

  await gql(
    `mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`,
    { id: issue.id, input }
  );

  const roleLabel = ROLE_LABEL[role] || role;
  const bits = [`role→${roleLabel}`, `+[${labelName}]`, ...extraBits.map((l) => `+[${l}]`), state ? `state→${state}` : ""].filter(Boolean);
  console.log(`✓ ${id} handoff: ${bits.join(" ")} | title: ${newTitle}`);
  await nudgePulse();
  // NOTE: The Telegram handoff notification is sent by the Linear webhook (app/api/linear-webhook/route.ts)
  // which detects the `role:*` label addition and calls buildEventMessage("handoff", ...).
  // Do NOT send it here — that causes double-sends.
}

// scaffold <CAM-id> — create the delivery-artifact folder + files for a story (idempotent).
async function cmdScaffold(id) {
  if (!id) { console.log("usage: linear-sync scaffold <CAM-id>"); process.exit(1); }
  const team = await ctx();
  const issue = team.issues.nodes.find((i) => i.identifier.toUpperCase() === id.toUpperCase());
  if (!issue) throw new Error(`issue ${id} not found in ${TEAM}`);
  const { fdir, edir, sdir } = deliveryDirs(issue);
  const vars = {
    linear: issue.identifier, feature: slug(featureName(issue)), featureName: featureName(issue),
    epic: slug(epicName(issue)), epicId: issue.parent?.identifier || "—", epicTitle: epicName(issue),
    persona: personaOf(issue) || "—", status: issue.state.name, date: today(), title: storyName(issue),
  };
  const made = [];
  if (writeIfAbsent(path.join(fdir, "feature.md"), applyVars(fs.readFileSync(TPL("feature"), "utf8"), vars))) made.push("feature.md");
  if (writeIfAbsent(path.join(edir, "epic.md"), applyVars(fs.readFileSync(TPL("epic"), "utf8"), vars))) made.push(`${slug(epicName(issue))}/epic.md`);
  // story.md = sync header + the reused story-template body (strip its HTML comment)
  const header = applyVars(
    "---\nlinear: {{linear}}\nfeature: {{feature}}\nepic: {{epic}} ({{epicId}})\npersona: {{persona}}\nartifact: story\nowner: product-owner\nstatus: {{status}}\nversion: v1\nupdated: {{date}}\n---\n# {{title}} ({{linear}})\n\n",
    vars
  );
  // Seed story.md from the real Linear description if present (backfill of existing work);
  // otherwise fall back to the blank story template (a brand-new story to fill).
  const desc = (issue.description || "").trim();
  const body = desc || fs.readFileSync(TPL("story"), "utf8").replace(/^<!--[\s\S]*?-->\s*/, "");
  if (writeIfAbsent(path.join(sdir, "story.md"), header + body + "\n")) made.push("story.md");
  // Role artifacts (design/tech/test/review/delivery) are created ON-DEMAND by the role that
  // works the story (copy from `.claude/templates/<artifact>.md`) — NOT pre-created here. This
  // keeps the folder to what the work actually has (no forced N/A files).
  console.log(`✓ scaffold ${issue.identifier} → ${sdir}`);
  console.log(`  created: ${made.join(", ") || "(story.md + containers already existed)"}`);
  console.log("  role artifacts on-demand: design (UI) · tech (rich API) · test (qa) · review (security) · delivery (devops)");
}

// index — regenerate docs/delivery/INDEX.md from Linear (feature→epic→story tree + by-persona view).
async function cmdIndex() {
  const team = await ctx();
  const work = team.issues.nodes.filter(isWorkStory);
  const feats = {};
  for (const i of work) { const f = featureName(i), e = epicName(i); ((feats[f] = feats[f] || {})[e] = feats[f][e] || []).push(i); }
  const sortId = (a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true });
  const artLink = (i) => {
    const sdir = deliveryDirs(i).sdir;
    const rel = sdir.split(path.sep).join("/") + "/story.md";
    return `[${i.identifier}](${i.url})` + (fs.existsSync(path.join(sdir, "story.md")) ? ` · [artifact](${rel})` : " · _(not scaffolded)_");
  };
  const L = ["<!-- GENERATED by `node scripts/linear-sync.mjs index` from Linear — do not hand-edit. Linear is the live-status SoT. -->",
    "# Delivery Index", "", `_${work.length} stories · generated ${today()}._`, "", "## By feature → epic → story", ""];
  for (const [f, epics] of Object.entries(feats).sort()) {
    L.push(`### ${esc(f)}`, "");
    for (const [e, items] of Object.entries(epics).sort()) {
      L.push(`- **${esc(e)}**`);
      for (const i of items.sort(sortId)) {
        const labels = i.labels.nodes.map((l) => l.name).filter((n) => !n.startsWith("role:")).join(",");
        L.push(`  - ${i.state.name} · [${roleOf(i.title) || "—"}]${labels ? " {" + labels + "}" : ""} · ${artLink(i)} — ${esc(storyName(i)).slice(0, 60)}`);
      }
    }
    L.push("");
  }
  L.push("## By persona", "");
  for (const p of PERSONAS) {
    const items = work.filter((i) => personaOf(i) === p).sort(sortId);
    if (!items.length) continue;
    L.push(`### ${p} (${items.length})`);
    for (const i of items) L.push(`- ${i.state.name} · ${esc(featureName(i))} · ${artLink(i)} — ${esc(storyName(i)).slice(0, 50)}`);
    L.push("");
  }
  const out = path.join("docs", "delivery", "INDEX.md");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, L.join("\n") + "\n");
  console.log(`✓ index → ${out} (${work.length} stories · ${Object.keys(feats).length} features)`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "list") await cmdList();
  else if (cmd === "set" || cmd === "label") await cmdSet(rest[0], parseFlags(rest.slice(1)));
  else if (cmd === "notify") await cmdNotify(rest.join(" "));
  else if (cmd === "release") await cmdRelease(rest[0]);
  else if (cmd === "gates") await cmdGates();
  else if (cmd === "audit") await cmdAudit();
  else if (cmd === "pull") await cmdPull(rest[0]);
  else if (cmd === "handoff") await cmdHandoff(rest[0], rest.slice(1));
  else if (cmd === "scaffold") await cmdScaffold(rest[0]);
  else if (cmd === "index") await cmdIndex();
  else { console.log("usage: linear-sync <list | gates | audit | set <CAM-id> [--state S] [--add-label L] [--remove-label L] | notify <text> | release <CAM-id> | pull [outfile] | handoff <CAM-id> --role <role> [--state S] [--note N] | scaffold <CAM-id> | index>"); process.exit(1); }
} catch (e) { console.error("✗", e.message); process.exit(1); }
