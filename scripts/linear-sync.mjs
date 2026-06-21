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
 *   node scripts/linear-sync.mjs pull [outfile]   # snapshot Linear -> JSON (default ai-planning/linear-snapshot.json)
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
      id identifier title url priority startedAt description parent{ id }
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

  // Escalation: a gate just got `awaiting-you` → ping Telegram with Approve/Reject buttons.
  if (flags.add.some((l) => l.toLowerCase() === "awaiting-you")) {
    const gate = (issue.title.match(/Gate\s*G\d/i) || ["Gate"])[0];
    await notifyTelegram(
      `⏳ <b>${id}</b> รออนุมัติ — ${gate}\n${issue.title}\n\nReview ใน Linear แล้ว <b>ลบ label awaiting-you</b> เพื่ออนุมัติ (ระบบจะเดินงานต่อ) หรือกดปุ่มด้านล่าง`,
      [
        [{ text: "✅ Approve", callback_data: `approve:${id}` }, { text: "🚫 Reject", callback_data: `reject:${id}` }],
        [{ text: "🔗 เปิดใน Linear", url: issue.url }],
        [{ text: "📊 /status", url: statusUrl(epicOf(issue.title)) }],
      ]
    );
  }
}

// Released = promoted to production. The story stays in state `Done` (set at merge→staging) and
// additionally carries the `released` label. "Done" (on Staging) and "Released" (on prod) are
// separate dimensions — see ai-planning/SYNC-ARCHITECTURE.md §Definition of Done.
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
  const rows = team.issues.nodes.filter((i) => i.title.includes("·")).sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
  const byEpic = {};
  rows.forEach((i) => (byEpic[epicOf(i.title)] = byEpic[epicOf(i.title)] || []).push(i));
  for (const [epic, items] of Object.entries(byEpic)) {
    const done = items.filter((i) => i.state.type === "completed").length;
    console.log(`\n● ${epic}  (${done}/${items.length} done)`);
    for (const i of items) {
      const labels = i.labels.nodes.map((l) => l.name).join(",");
      console.log(`  ${i.identifier.padEnd(7)} ${i.state.name.padEnd(12)} [${roleOf(i.title) || "—"}]${labels ? " {" + labels + "}" : ""}  ${i.title.replace(/^[^·]*·\s*/, "").slice(0, 54)}`);
    }
  }
}

async function cmdPull(outfile) {
  const team = await ctx();
  const work = team.issues.nodes.filter((i) => i.title.includes("·"));
  const epics = {};
  work.forEach((i) => {
    const e = epicOf(i.title);
    (epics[e] = epics[e] || []).push({
      id: i.identifier, role: roleOf(i.title), state: i.state.name, statusType: i.state.type,
      labels: i.labels.nodes.map((l) => l.name), startedAt: i.startedAt, url: i.url,
      title: i.title.replace(/^[^·]*·\s*/, ""),
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
  const out = outfile || path.join("ai-planning", "linear-snapshot.json");
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
  // Template conformance: an ACTIVE story-level issue (work item with "·", not a gate, no parent,
  // not completed) must carry the §7.1 ticket template — at minimum ## Story + ## AC. Sub-tasks
  // (have a parent) and shipped issues are exempt. Template: ai-planning/templates/STORY-TICKET.md.
  // Exit 11 if any active story fails.
  const team = await ctx();
  const REQ = ["## Story", "## AC"];
  const NICE = ["## ทำไม", "## Rules", "## Data", "## Out of scope", "## Self-verify"];
  const stories = team.issues.nodes
    .filter((i) => i.title.includes("·") && !/Gate\s*G\d/i.test(i.title) && !i.parent && i.state.type !== "completed")
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
  if (!stories.length) { console.log("no story-level issues to audit (work issue with '·', no parent, not a gate)"); return; }
  let bad = 0;
  for (const s of stories) {
    const d = s.description || "";
    const miss = REQ.filter((h) => !d.includes(h));
    const warn = NICE.filter((h) => !d.includes(h));
    if (miss.length) bad++;
    const head = miss.length ? "MISSING " + miss.join(",") : "template ok";
    console.log(`${miss.length ? "✗" : "✓"} ${s.identifier.padEnd(7)} ${head.padEnd(26)}${warn.length ? " warn:" + warn.join(",") : ""}  ${s.title.replace(/^[^·]*·\s*/, "").slice(0, 40)}`);
  }
  console.log(`\n${stories.length} story issue(s) · ${bad} not template-conformant (require ${REQ.join(" + ")}) — see ai-planning/templates/STORY-TICKET.md`);
  if (bad) process.exitCode = 11;
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
  else { console.log("usage: linear-sync <list | gates | audit | set <CAM-id> [--state S] [--add-label L] [--remove-label L] | notify <text> | release <CAM-id> | pull [outfile]>"); process.exit(1); }
} catch (e) { console.error("✗", e.message); process.exit(1); }
