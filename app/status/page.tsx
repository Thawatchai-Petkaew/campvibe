/* CampVibe — Live Delivery dashboard. Server-rendered from Linear, refreshed every 60s.
 * Look & feel: design/campvibe-delivery.html. Data: lib/linear.ts (real, no mock numbers).
 * Protected by STATUS_TOKEN (visit /status?token=YOUR_TOKEN). Tabs: ?tab=overview|epic&epic=<name>.
 * Note: this page renders self-contained CSS (dangerouslySetInnerHTML) and is intentionally
 * immune to the .dark class applied by ThemeProvider — its appearance is fixed by design. */
import { fetchStatusIssues, type StatusIssue } from "@/lib/linear";
import { readPulse } from "@/lib/status-pulse";
import { CSS, SCENE, LOGO } from "./dashboard-assets";
import { buildTrail, buildWorkload, envOf, type EnvLane } from "@/lib/status-derive";
import StatusClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "CampVibe — Live Delivery" };

// ---------- title-convention parsing ----------
const epicOf = (t: string) => { const x = t.split("·"); return x.length > 1 ? x[0].trim() : ""; };
const roleOf = (t: string) => { const m = t.match(/\[([a-z-]+)\]/); return m ? m[1] : ""; };
const gateOf = (t: string) => (t.match(/Gate\s*G\d/i) || [""])[0];
const clean = (t: string) => {
  const dot = t.indexOf("·");
  const afterEpic = dot >= 0 ? t.slice(dot + 1) : t;        // drop "Epic ·"
  return afterEpic.replace(/\[[a-z-]+\]\s*/i, "").trim() || t; // drop "[role] "
};
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m] as string));
const hasAwait = (i: StatusIssue) => i.labels.includes("awaiting-you");
const isActive = (i: StatusIssue) => i.status === "In Progress";
const isDone = (i: StatusIssue) => i.statusType === "completed" || i.status === "Done";

// ---------- persona + feature (new Linear hierarchy: project=feature, parent=epic, labels=persona) ----------
const PERSONAS = ["host", "camper", "admin", "platform"];
const PERSONA_LABEL: Record<string, string> = { host: "Host", camper: "Camper", admin: "Admin", platform: "Platform", none: "อื่นๆ" };
const personaOf = (i: StatusIssue) => i.labels.find((l) => PERSONAS.includes(l)) || "";
const featureOf = (i: StatusIssue) => i.project?.name || "—";
const epicKeyOf = (i: StatusIssue) => i.parent?.title || epicOf(i.title);  // story → its epic
const personaChip = (p: string) => `<span class="chip persona ${p || "none"}">${esc(PERSONA_LABEL[p || "none"] || p)}</span>`;
const featChip = (f: string) => `<span class="chip feat">${esc(f)}</span>`;
const PERSONA_ORDER = ["host", "camper", "admin", "platform", "none"];

// ---------- role + stage meta ----------
const ROLE_LABEL: Record<string, string> = {
  architect: "Architect", "ux-designer": "Designer", "frontend-engineer": "Frontend", "backend-engineer": "Backend",
  "qa-engineer": "QA", "security-reviewer": "Security", "devops-release": "DevOps", "product-owner": "Product Owner",
  analyst: "Analyst", orchestrator: "Orchestrator", human: "You",
};
const roleLabel = (r: string) => ROLE_LABEL[r] || r || "team";

const ICON: Record<string, string> = {
  architect: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>',
  "ux-designer": '<circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
  "backend-engineer": '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  "frontend-engineer": '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/>',
  "qa-engineer": '<path d="M9 5h6M9 5a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2"/><path d="M9 11l1.5 1.5L13 10"/>',
  "security-reviewer": '<path d="M12 3l7 3v5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4.5"/>',
  "devops-release": '<path d="M7 21V4M7 4h11l-2 4 2 4H7"/>',
  "product-owner": '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  orchestrator: '<circle cx="12" cy="12" r="9"/><path d="M8 16l2-6 6-2-2 6z"/>',
  human: '<circle cx="9" cy="8" r="3"/><path d="M4 20c0-3 2.2-5 5-5s5 2 5 5"/>',
  story: '<path d="M5 21V4"/><path d="M5 4h11l-2 3 2 3H5"/>',
  flame: '<path d="M12 3C9.5 6.5 8 8.5 8 12a4 4 0 008 0c0-1.8-.8-3-1.8-4.4-.4 1.3-1.4 1.9-2.4 1.9.5-2.3-.3-5-.8-6.5z"/>',
  bell: '<path d="M6 9a6 6 0 1112 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6zM10 19a2 2 0 004 0"/>',
  heart: '<path d="M12 20s-7-4.5-9.5-8.5C1 8.6 2.4 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.6 0 5 3.6 3.5 6.5C19 15.5 12 20 12 20z"/>',
  shield: '<path d="M12 3l7 3v5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4.5"/>',
  trail: '<path d="M4 20s2-5 6-5 4-9 10-9"/><circle cx="20" cy="6" r="1.6" fill="currentColor"/>',
  // pipeline stage glyphs
  Design: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.3 5.2-5.2 2.3 2.3-5.2z"/>',
  Gate: '<path d="M12 3C9.5 6.5 8 8.5 8 12a4 4 0 008 0c0-1.8-.8-3-1.8-4.4-.4 1.3-1.4 1.9-2.4 1.9.5-2.3-.3-5-.8-6.5z"/>',
  Build: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
  Verify: '<path d="M12 3l7 3v5c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4.5"/>',
  Ship: '<path d="M7 21V4M7 4h11l-2 4 2 4H7"/>',
};
const svg = (p: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const roleIcon = (r: string) => svg(ICON[r] || ICON.story);
const epicIcon = (name: string) => {
  const n = name.toLowerCase();
  if (/wishlist|favou?rite|heart/.test(n)) return svg(ICON.heart);
  if (/secur|harden|auth/.test(n)) return svg(ICON.shield);
  if (/book|reserv|calendar/.test(n)) return svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>');
  return svg(ICON.story);
};

const COLS: [string, string][] = [["Backlog", "backlog"], ["Todo", "todo"], ["In Progress", "prog"], ["In Review", "review"], ["Done", "done"]];
const colIdx = (s: string) => { const i = COLS.findIndex((c) => c[0] === s); return i < 0 ? 99 : i; };

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return "";
  const h = Math.floor(ms / 3.6e6), d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return `${Math.max(1, Math.floor(ms / 6e4))}m`;
}

// ---------- derived model ----------
interface EpicNode {
  key: string;       // ?epic= value + m.epics lookup key (= epic title / legacy prefix)
  label: string;     // display name
  feature: string;   // Linear project / feature name
  persona: string;   // persona label ("" = none)
  stories: StatusIssue[];
  legacy: boolean;   // old "·"-title epic (Wishlist / P0 Hardening), grouped by title prefix
}
interface Model {
  work: StatusIssue[];                       // leaf stories only (epic containers excluded)
  epics: Record<string, StatusIssue[]>;      // epic key → its stories (renderEpic reads this)
  epicNodes: EpicNode[];
  epicNames: string[];                       // epic keys, sorted
  projectPct: number;
  gates: StatusIssue[];
  epicsActive: number;
  backlog: StatusIssue[];
  rmap: Record<string, { total: number; active: number; done: number }>;
  activeEpic: string;
  byFeature: Record<string, EpicNode[]>;
  byPersona: Record<string, EpicNode[]>;
  backlogByFeature: Record<string, StatusIssue[]>;
  backlogByPersona: Record<string, StatusIssue[]>;
  byEnv: Record<EnvLane, StatusIssue[]>;
}
function groupBy<T>(arr: T[], keyOf: (x: T) => string): Record<string, T[]> {
  const o: Record<string, T[]> = {};
  arr.forEach((x) => { const k = keyOf(x) || "none"; (o[k] = o[k] || []).push(x); });
  return o;
}
function buildModel(issues: StatusIssue[]): Model {
  // Classify three kinds of issue:
  //  • hierarchy epic   → a project issue with no parent and no "·" (shows even with 0 stories yet)
  //  • hierarchy story  → has a Linear parent (grouped under parent.title)
  //  • legacy story     → old "·"-title active-loop issue, no parent → grouped by title prefix
  //  (Linear-onboarding junk CAM-1..4: no "·", no parent, no project → dropped)
  const epicIssues = issues.filter((i) => !i.parent && !epicOf(i.title) && !!i.project);
  const epicTitles = new Set(epicIssues.map((i) => i.title));

  const storiesByEpic: Record<string, StatusIssue[]> = {};
  const legacyByPrefix: Record<string, StatusIssue[]> = {};
  issues.forEach((i) => {
    if (i.parent?.title) {
      const pt = i.parent.title;
      if (epicTitles.has(pt)) { (storiesByEpic[pt] = storiesByEpic[pt] || []).push(i); }    // child of a clean epic
      else { const pre = epicOf(pt) || pt; (legacyByPrefix[pre] = legacyByPrefix[pre] || []).push(i); }  // child of a legacy "·" issue (e.g. Wishlist subtasks)
      return;
    }
    if (epicTitles.has(i.title)) return;               // epic container — added below
    const pre = epicOf(i.title);
    if (pre) (legacyByPrefix[pre] = legacyByPrefix[pre] || []).push(i);
  });

  const epicNodes: EpicNode[] = [];
  epicIssues.forEach((ep) => {
    epicNodes.push({ key: ep.title, label: ep.title, feature: featureOf(ep), persona: personaOf(ep), stories: storiesByEpic[ep.title] || [], legacy: false });
  });
  Object.entries(legacyByPrefix).forEach(([pre, stories]) => {
    const seed = stories.find((s) => personaOf(s)) || stories[0];
    epicNodes.push({ key: pre, label: pre, feature: featureOf(stories[0]), persona: personaOf(seed), stories, legacy: true });
  });
  epicNodes.sort((a, b) => a.label.localeCompare(b.label));

  const epics: Record<string, StatusIssue[]> = {};
  epicNodes.forEach((n) => { epics[n.key] = n.stories; });
  const epicNames = epicNodes.map((n) => n.key);

  const work = epicNodes.flatMap((n) => n.stories);
  const done = work.filter(isDone).length;

  // Agent workload: counts all roles from role:* labels (accumulated history), falling back to
  // [role] title tag for backward-compat. buildWorkload handles the multi-role attribution.
  const rmap = buildWorkload(work);

  const backlog = work.filter((i) => i.status === "Backlog");
  // Env lanes — derived from state + released label (single source of truth, no env field).
  const byEnv: Record<EnvLane, StatusIssue[]> = { dev: [], staging: [], prod: [] };
  work.forEach((i) => { byEnv[envOf(i)].push(i); });
  return {
    work, epics, epicNodes, epicNames,
    projectPct: work.length ? Math.round((done / work.length) * 100) : 0,
    gates: work.filter(hasAwait),
    epicsActive: epicNodes.filter((n) => n.stories.some(isActive)).length,
    backlog,
    rmap,
    activeEpic: epicNodes.find((n) => n.stories.some(isActive))?.key || epicNames[0] || "",
    byFeature: groupBy(epicNodes, (n) => n.feature),
    byPersona: groupBy(epicNodes, (n) => n.persona),
    backlogByFeature: groupBy(backlog, (i) => featureOf(i)),
    backlogByPersona: groupBy(backlog, (i) => personaOf(i)),
    byEnv,
  };
}

// ---------- Environments board (derived 3-env lanes: Dev → Staging → Prod) ----------
// Mirrors the per-status Board idiom (.board/.col/.kc) but keyed by env. env is DERIVED from
// state + the `released` label (envOf) — no env field. Staging column = the release train.
const ENV_ORDER: EnvLane[] = ["dev", "staging", "prod"];
const ENV_META: Record<EnvLane, { label: string; sub: string }> = {
  dev: { label: "Dev", sub: "กำลังทำ · ยังไม่ขึ้น staging" },
  staging: { label: "Staging", sub: "Done · พร้อมขึ้น prod" },
  prod: { label: "Prod", sub: "released" },
};
function renderEnvPane(m: Model, open: boolean): string {
  const summary = ENV_ORDER.map((e) => `${ENV_META[e].label} ${m.byEnv[e].length}`).join(" · ");
  let h = `<section class="glass board-wrap"><div class="pane-h"><span class="t">Environments</span>`
    + `<span style="display:inline-flex;align-items:center;gap:12px"><span class="x">${esc(summary)}</span>`
    + `<button class="segbtn" id="env-toggle" onclick="toggleEnv()">${open ? "ซ่อน" : "แสดง"}</button></span></div>`
    + `<div id="env-board" class="envwrap ${open ? "" : "collapsed"}"><div class="board" style="grid-template-columns:repeat(3,1fr)">`;
  for (const env of ENV_ORDER) {
    const items = m.byEnv[env], meta = ENV_META[env];
    const tag = env === "staging" && items.length ? ` <span class="yb">RELEASE</span>` : "";
    h += `<div class="col" data-k="env-${env}"><div class="col-h"><span class="dot cd"></span>${esc(meta.label)}${tag}<span class="c">${items.length}</span></div>`;
    h += `<div style="font-size:11px;color:var(--muted);margin:-2px 0 8px">${esc(meta.sub)}</div>`;
    if (!items.length) h += `<div class="empty">—</div>`;
    items.forEach((i) => {
      h += `<a class="kc ${isActive(i) ? "prog" : ""}" href="${esc(i.url)}" target="_blank" rel="noopener" title="${esc(clean(i.title))}"><div class="kt">${roleIcon(roleOf(i.title))}<span>${esc(clean(i.title))}</span></div><div class="kb"><span class="kr">${esc(roleLabel(roleOf(i.title)))}</span><span class="tk">${esc(i.id)}</span></div></a>`;
    });
    h += `</div>`;
  }
  return h + `</div></div></section>`;
}

// feature groups ordered by story volume (desc) so the busiest feature leads
function featureOrder(groups: Record<string, EpicNode[]>): string[] {
  return Object.keys(groups).sort((a, b) => groups[b].flatMap((n) => n.stories).length - groups[a].flatMap((n) => n.stories).length || a.localeCompare(b));
}
function backlogFeatureOrder(groups: Record<string, StatusIssue[]>): string[] {
  return Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length || a.localeCompare(b));
}

// ---------- top bar ----------
function topBar(m: Model, tab: string): string {
  return `<header class="glass bar"><div class="brand">${LOGO}<span class="cv-sub">${esc(m.activeEpic || "CampVibe")} · live</span></div>`
    + `<nav class="tabs"><button class="tab ${tab !== "epic" ? "active" : ""}" id="tab-overview" onclick="showView('overview')">Overview</button>`
    + `<button class="tab ${tab === "epic" ? "active" : ""}" id="tab-epic" onclick="showView('epic')">Epic detail</button></nav>`
    + `<span class="live"><span class="dot live"></span><span id="clock">·</span></span></header>`;
}

// Camper Agent toggle — lives in the "Gates need you" pane because the agent IS the approver.
// ON = autopilot decides G1–G4 on your behalf; escalates G5/security/irreversible/any-cost.

// ---------- grouping (Feature | Persona) ----------
const MIX_COLORS = ["#8a9aa8", "var(--blue)", "var(--emerald)", "var(--violet)", "var(--green)"];
// segmented toggle — appears in both Epics + Project backlog headers; setGroup() keeps every copy in sync.
const segmented = (group: string) =>
  `<div class="segmented" role="tablist" aria-label="จัดกลุ่ม">`
  + `<button class="segbtn ${group !== "persona" ? "active" : ""}" data-g="feature" role="tab" aria-selected="${group !== "persona"}" onclick="setGroup('feature')">Feature</button>`
  + `<button class="segbtn ${group === "persona" ? "active" : ""}" data-g="persona" role="tab" aria-selected="${group === "persona"}" onclick="setGroup('persona')">Persona</button></div>`;

// Epics lifecycle filter — All | กำลังทำ | เสร็จแล้ว | ยังไม่เริ่ม. filterEpics() shows/hides cards client-side.
const EPIC_FILTERS: [string, string][] = [["all", "ทั้งหมด"], ["prog", "กำลังทำ"], ["done", "เสร็จแล้ว"], ["todo", "ยังไม่เริ่ม"]];
const epicFilter = (f: string) =>
  `<div class="segmented" role="tablist" aria-label="กรองสถานะ Epic">`
  + EPIC_FILTERS.map(([k, lbl]) => `<button class="segbtn efbtn ${f === k ? "active" : ""}" data-f="${k}" onclick="filterEpics('${k}')">${lbl}</button>`).join("")
  + `</div>`;

// epic lifecycle bucket for the Epics filter: done (all stories shipped) · prog (some active) · todo (not started/queued)
function epicStatusOf(n: EpicNode): "done" | "prog" | "todo" {
  const total = n.stories.length, doneN = n.stories.filter(isDone).length;
  if (total > 0 && doneN === total) return "done";
  if (n.stories.some(isActive)) return "prog";
  return "todo";
}
function renderEpicCard(n: EpicNode, linkQ: string, chip: string, efilter: string): string {
  const it = n.stories, total = it.length;
  const doneN = it.filter(isDone).length, pct = total ? Math.round((doneN / total) * 100) : 0;
  const active = it.some(isActive), gate = it.some(hasAwait);
  const st = gate ? "waiting on you" : active ? "in progress" : !total ? "no stories yet" : pct === 100 ? "shipped · done" : "queued";
  const mix = total ? COLS.map(([s], idx) => { const num = it.filter((i) => i.status === s).length; return num ? `<span style="width:${(num / total) * 100}%;background:${MIX_COLORS[idx]}"></span>` : ""; }).join("") : "";
  const estatus = epicStatusOf(n);
  const hide = efilter !== "all" && estatus !== efilter ? ' style="display:none"' : "";
  return `<a class="epic ${gate ? "live" : ""}" data-estatus="${estatus}"${hide} href="?tab=epic&epic=${encodeURIComponent(n.key)}${linkQ}"><div class="epic-head"><span class="epic-ic">${epicIcon(n.label)}</span><div class="epic-id"><div class="epic-name">${esc(n.label)}</div><div class="epic-st">${esc(st)}</div></div>${chip}</div><div class="epic-prog"><div class="epic-bar"><i style="width:${pct}%"></i></div><span class="epic-pct">${pct}%</span></div><div class="epic-mix">${mix}</div></a>`;
}

// chipMode = the OTHER dimension shown on each card (group by feature → show persona chip, & vice-versa)
function renderEpicGroups(groups: Record<string, EpicNode[]>, order: string[], labelOf: (k: string) => string, chipMode: "persona" | "feature", linkQ: string, efilter: string): string {
  let h = "";
  for (const k of order) {
    const nodes = groups[k]; if (!nodes || !nodes.length) continue;
    const stories = nodes.flatMap((n) => n.stories);
    const pct = stories.length ? Math.round((stories.filter(isDone).length / stories.length) * 100) : 0;
    const groupHidden = efilter !== "all" && !nodes.some((n) => epicStatusOf(n) === efilter) ? ' style="display:none"' : "";
    h += `<div class="grp"${groupHidden}><div class="grp-h"><span class="grp-name">${esc(labelOf(k))}</span><span class="grp-meta">${nodes.length} epic${nodes.length === 1 ? "" : "s"} · ${stories.length} stor${stories.length === 1 ? "y" : "ies"} · ${pct}%</span></div><div class="epics">`;
    for (const n of nodes) h += renderEpicCard(n, linkQ, chipMode === "persona" ? personaChip(n.persona) : featChip(n.feature), efilter);
    h += `</div></div>`;
  }
  return h;
}

function renderBacklogGroups(groups: Record<string, StatusIssue[]>, order: string[], labelOf: (k: string) => string, chipMode: "persona" | "feature"): string {
  let h = "";
  for (const k of order) {
    const items = groups[k]; if (!items || !items.length) continue;
    h += `<div class="grp"><div class="grp-h"><span class="grp-name">${esc(labelOf(k))}</span><span class="grp-meta">${items.length}</span></div>`;
    items.forEach((i) => {
      const chip = chipMode === "persona" ? personaChip(personaOf(i)) : featChip(featureOf(i));
      h += `<a class="qrow" href="${esc(i.url)}" target="_blank" rel="noopener" title="${esc(clean(i.title))}"><div class="qa">${roleIcon(roleOf(i.title))}</div><div class="qm"><b>${esc(clean(i.title))}</b><span class="tk">${esc(i.id)} · ${esc(epicKeyOf(i) || "—")}</span></div>${chip}<span class="qs bl">Backlog</span></a>`;
    });
    h += `</div>`;
  }
  return h;
}

// ---------- OVERVIEW ----------
function renderOverview(m: Model, tq: string, group: string, envOpen: boolean, efilter: string): string {
  const linkQ = `${tq}&group=${group}`;
  const firstGateEpic = m.gates[0] ? `?tab=epic&epic=${encodeURIComponent(epicKeyOf(m.gates[0]))}${linkQ}` : "#";
  let h = "";

  // Gates need you
  h += `<section class="glass pane"><div class="pane-h"><span class="t">Gates need you</span>`
    + `<span class="x">${m.gates.length} across all epics</span></div>`;
  if (m.gates.length) {
    m.gates.forEach((i) => {
      const g = gateOf(i.title);
      h += `<div class="gaterow urgent"><div class="gr-ic">${svg(ICON.flame)}</div><div class="gr-m"><div class="gr-title">${esc(clean(i.title))}</div><div class="gr-sub">${esc(epicKeyOf(i))} · ${esc(i.priority)}${g ? " · " + esc(g) : ""}</div></div><a class="gr-btn" href="${esc(i.url)}" target="_blank" rel="noopener">Review →</a></div>`;
    });
  } else h += `<div class="none-row">✓ ไม่มีงานรออนุมัติจากคุณตอนนี้</div>`;
  h += `</section>`;

  // Project summary
  h += `<section class="glass hero"><div class="ovh-top"><div><div class="ovh-eyebrow">CampVibe · all delivery</div><div class="ovh-title">${m.epicNames.length} epics · ${m.work.length} stories · live from Linear</div></div>`;
  if (m.gates.length) h += `<a class="ovh-gate" href="${firstGateEpic}">${svg(ICON.bell)} ${m.gates.length} gate${m.gates.length > 1 ? "s" : ""} need you</a>`;
  h += `</div><div class="orbs">`
    + `<div class="orb run"><div class="n">${m.projectPct}%</div><div class="l">Stories done</div></div>`
    + `<a class="orb you" href="${firstGateEpic}"><div class="n">${m.gates.length}</div><div class="l">Gates need you</div></a>`
    + `<div class="orb"><div class="n">${m.epicsActive}<span style="font-size:16px;color:var(--faint)"> / ${m.epicNames.length}</span></div><div class="l">Epics active</div></div>`
    + `<div class="orb q"><div class="n">${m.backlog.length}</div><div class="l">Backlog stories</div></div>`
    + `</div><div class="ovbar"><i style="width:${m.projectPct}%"></i></div></section>`;

  // Environments — which work sits in which env (Dev/Staging/Prod), derived from state+released.
  h += renderEnvPane(m, envOpen);

  // Agent workload — primary number = งานที่ "กำลังทำ" (active); done · queued is secondary.
  const roles = Object.keys(m.rmap).filter((r) => r !== "human").sort((a, b) => m.rmap[b].active - m.rmap[a].active || m.rmap[b].total - m.rmap[a].total);
  h += `<section class="glass pane"><div class="pane-h"><span class="t">Agent workload</span><span class="x">กำลังทำ · across all epics</span></div><div class="loads">`;
  h += `<div class="load you"><div class="load-top"><span class="load-name">You</span><span class="load-n on">${m.gates.length}</span></div><div class="seg"><span style="width:100%;background:var(--amber)"></span></div><div class="load-sub">${m.gates.length} gate${m.gates.length === 1 ? "" : "s"} to review</div></div>`;
  roles.forEach((r) => {
    const d = m.rmap[r], queued = Math.max(0, d.total - d.active - d.done);
    const seg = [
      d.done ? `<span style="width:${(d.done / d.total) * 100}%;background:var(--green)"></span>` : "",
      d.active ? `<span style="width:${(d.active / d.total) * 100}%;background:var(--emerald)"></span>` : "",
      queued ? `<span style="width:${(queued / d.total) * 100}%;background:var(--blue)"></span>` : "",
    ].join("");
    const sub = `${d.active ? '<span class="dot live"></span>' : ""}${d.done} done · ${queued} queued`;
    h += `<div class="load"><div class="load-top"><span class="load-name">${esc(roleLabel(r))}</span><span class="load-n ${d.active ? "on" : ""}">${d.active}</span></div><div class="seg">${seg}</div><div class="load-sub">${sub}</div></div>`;
  });
  h += `</div></section>`;

  // Epics — grouped by Feature | Persona (toggle, default Feature). Both variants pre-rendered, toggled client-side.
  h += `<section class="glass pane" id="epics-pane"><div class="pane-h"><span class="t">Epics</span><span style="display:inline-flex;gap:10px;align-items:center;flex-wrap:wrap">${epicFilter(efilter)}${segmented(group)}</span></div>`
    + `<div id="epics-by-feature" class="gsub ${group !== "persona" ? "active" : ""}">${renderEpicGroups(m.byFeature, featureOrder(m.byFeature), (k) => k, "persona", linkQ, efilter)}</div>`
    + `<div id="epics-by-persona" class="gsub ${group === "persona" ? "active" : ""}">${renderEpicGroups(m.byPersona, PERSONA_ORDER, (k) => PERSONA_LABEL[k] || k, "feature", linkQ, efilter)}</div>`
    + `</section>`;

  // Project backlog — same toggle (shares ?group)
  h += `<section class="glass pane"><div class="pane-h"><span class="t">Project backlog</span><span style="display:inline-flex;align-items:center;gap:12px"><span class="x">${m.backlog.length} stories</span>${segmented(group)}</span></div>`;
  if (m.backlog.length) {
    h += `<div id="backlog-by-feature" class="gsub ${group !== "persona" ? "active" : ""}">${renderBacklogGroups(m.backlogByFeature, backlogFeatureOrder(m.backlogByFeature), (k) => k, "persona")}</div>`
      + `<div id="backlog-by-persona" class="gsub ${group === "persona" ? "active" : ""}">${renderBacklogGroups(m.backlogByPersona, PERSONA_ORDER, (k) => PERSONA_LABEL[k] || k, "feature")}</div>`;
  } else h += `<div class="none-row" style="color:var(--muted)">— ไม่มี story ใน backlog</div>`;
  h += `</section>`;

  return h;
}

// epic-switcher modal — lists every epic, filterable by persona; click navigates (persists + closes).
function renderSwitcher(m: Model, current: string, tq: string, group: string): string {
  const linkQ = `${tq}&group=${group}`;
  let items = "";
  m.epicNodes.forEach((n) => {
    const total = n.stories.length, pct = total ? Math.round((n.stories.filter(isDone).length / total) * 100) : 0;
    const stCls = n.stories.some(hasAwait) ? "gate" : n.stories.some(isActive) ? "run" : pct === 100 && total ? "done" : "q";
    items += `<a class="sw-item ${n.key === current ? "current" : ""}" data-persona="${n.persona || "none"}" href="?tab=epic&epic=${encodeURIComponent(n.key)}${linkQ}"><span class="sw-ic">${epicIcon(n.label)}</span><span class="sw-m"><span class="sw-name">${esc(n.label)}</span><span class="sw-meta">${esc(n.feature)}</span></span>${personaChip(n.persona)}<span class="sw-st ${stCls}">${pct}%</span></a>`;
  });
  const fbtn = (p: string, label: string) => `<button class="sw-fbtn ${p === "all" ? "active" : ""}" data-p="${p}" onclick="filterSwitcher('${p}')">${esc(label)}</button>`;
  return `<div id="switcher" class="switcher" role="dialog" aria-modal="true" aria-label="สลับ epic"><div class="sw-backdrop" onclick="closeSwitcher()"></div><div class="sw-panel"><div class="sw-head"><span class="sw-title">สลับ epic</span><button class="sw-x" onclick="closeSwitcher()" aria-label="ปิด">✕</button></div><div class="sw-filter">${fbtn("all", "All")}${fbtn("host", "Host")}${fbtn("camper", "Camper")}${fbtn("admin", "Admin")}${fbtn("platform", "Platform")}</div><div class="sw-list">${items}</div></div></div>`;
}

// ---------- EPIC DETAIL ----------
function renderEpic(m: Model, e: string, tq: string, group: string): string {
  const linkQ = `${tq}&group=${group}`;
  const it = (m.epics[e] || []).slice();
  const running = it.filter(isActive);
  const needs = it.filter(hasAwait);
  const shipped = it.filter(isDone);
  const queued = it.filter((i) => !isActive(i) && !isDone(i) && !hasAwait(i)).sort((a, b) => colIdx(a.status) - colIdx(b.status));

  // pipeline stages — built from buildTrail (distribution counts per stage)
  const trail = buildTrail(it);
  const stages = trail.nodes;
  const curIdx = trail.curIdx;
  const curName = trail.curName;

  let h = "";
  // breadcrumb
  h += `<div class="glass crumb"><a href="?tab=overview${linkQ}">CampVibe</a><span class="sep">›</span><span class="cur">${esc(e)}</span><span class="cstage">Stage ${curIdx + 1} / 5 · ${esc(curName.toLowerCase())} · ${esc(trail.header)}</span><button class="swbtn" onclick="openSwitcher()" aria-haspopup="dialog" aria-controls="switcher" title="สลับไป epic อื่น">${svg('<path d="M7 4l-3 3 3 3"/><path d="M4 7h13"/><path d="M17 20l3-3-3-3"/><path d="M20 17H7"/>')}<span>Switch</span></button></div>`;

  // hero orbs + pips
  h += `<section class="glass hero"><div class="orbs">`
    + `<div class="orb run"><div class="n">${running.length}</div><div class="l">Running</div></div>`
    + `<div class="orb you"><div class="n">${needs.length}</div><div class="l">Needs you</div></div>`
    + `<div class="orb q"><div class="n">${queued.length}</div><div class="l">Queued</div></div>`
    + `<div class="orb s"><div class="n">${shipped.length}</div><div class="l">Shipped</div></div></div><div class="pips">`;
  it.forEach((i) => { const c = isActive(i) ? "run" : hasAwait(i) ? "you" : isDone(i) ? "done" : "q"; h += `<span class="pip ${c}" title="${esc(i.id)} ${esc(roleLabel(roleOf(i.title)))}"></span>`; });
  h += `</div></section>`;

  // The Trail
  h += `<section class="glass trail"><div class="trail-h"><span class="t">${svg(ICON.trail)} The trail</span><span class="h">start → ship</span></div><div class="rail">`;
  stages.forEach((s, idx) => {
    if (idx > 0) { const prev = stages[idx - 1]; const live = prev.cls === "run" || prev.cls === "done"; h += `<div class="conn ${live ? "flowing" : ""}"></div>`; }
    const badge = s.count ? `<span class="ncount">${s.count}</span>` : "";
    h += `<div class="stage ${s.cls}"><div class="node">${svg(ICON[s.name])}${badge}</div><div class="nminfo"><div class="nm">${s.name}</div><div class="sub">${esc(s.sub)}</div></div></div>`;
  });
  h += `</div></section>`;

  // action card
  if (needs.length) {
    const g = needs[0], gl = gateOf(g.title);
    h += `<section class="glass action"><div class="fi">${svg(ICON.flame)}</div><div class="c"><div class="k"><span class="dot"></span>Paused on you</div><h3>${esc(clean(g.title))}</h3><div class="tk">${esc(g.id)} · ${esc(g.priority)}${gl ? " · " + esc(gl) : ""}</div></div><a class="approve" href="${esc(g.url)}" target="_blank" rel="noopener">Review &amp; Approve <span aria-hidden="true">→</span></a></section>`;
  }

  // live now + up next
  h += `<div class="cols"><section class="glass pane"><div class="pane-h"><span class="t"><span class="dot live"></span>Live now</span><span class="x">${running.length}</span></div>`;
  if (running.length) {
    running.forEach((i) => {
      const dur = timeAgo(i.startedAt);
      const av = i.assignee?.avatarUrl ? `<img src="${esc(i.assignee.avatarUrl)}" alt="">` : roleIcon(roleOf(i.title));
      h += `<div class="agent"><div class="av">${av}</div><div class="m"><div class="r"><b>${esc(roleLabel(roleOf(i.title)))}</b><span class="tk">${esc(i.id)}</span></div><div class="ti">${esc(clean(i.title))}</div></div>${dur ? `<span class="dur"><span class="dd"></span>${esc(dur)}</span>` : ""}</div>`;
    });
  } else h += `<div class="none-row" style="color:var(--muted)">— ไม่มี agent ทำงานอยู่</div>`;
  h += `</section>`;

  h += `<section class="glass pane"><div class="pane-h"><span class="t">Up next</span><span class="x">queued</span></div>`;
  if (queued.length) {
    queued.forEach((i) => {
      const cls = i.status === "Backlog" ? "bl" : "td";
      h += `<a class="qrow" href="${esc(i.url)}" target="_blank" rel="noopener" title="${esc(clean(i.title))}"><div class="qa">${roleIcon(roleOf(i.title))}</div><div class="qm"><b>${esc(roleLabel(roleOf(i.title)))}</b><span class="tk">${esc(i.id)} · ${esc(clean(i.title))}</span></div><span class="qs ${cls}">${esc(i.status)}</span></a>`;
    });
  } else h += `<div class="none-row" style="color:var(--muted)">— คิวว่าง</div>`;
  h += `</section></div>`;

  // board
  h += `<section class="glass board-wrap"><div class="pane-h"><span class="t">Board</span><span class="x">${it.length} stories · live from Linear</span></div><div class="board">`;
  COLS.forEach(([name, key]) => {
    const items = it.filter((i) => i.status === name);
    h += `<div class="col" data-k="${key}"><div class="col-h"><span class="dot cd"></span>${esc(name)}<span class="c">${items.length}</span></div>`;
    if (!items.length) h += `<div class="empty">—</div>`;
    items.forEach((i) => {
      const yb = hasAwait(i) ? '<span class="yb">YOU</span>' : "";
      const live = isActive(i) ? '<span class="dot live" style="margin-right:5px"></span>' : "";
      h += `<a class="kc ${isActive(i) ? "prog" : ""} ${hasAwait(i) ? "gate" : ""}" href="${esc(i.url)}" target="_blank" rel="noopener" title="${esc(clean(i.title))}"><div class="kt">${roleIcon(roleOf(i.title))}<span>${esc(clean(i.title))}</span></div><div class="kb"><span class="kr">${live}${yb}${esc(roleLabel(roleOf(i.title)))}</span><span class="tk">${esc(i.id)}</span></div></a>`;
    });
    h += `</div>`;
  });
  h += `</div><div class="legend">`
    + COLS.map(([n], idx) => `<span><span class="dot" style="width:8px;height:8px;background:${["#8a9aa8", "var(--blue)", "var(--emerald)", "var(--violet)", "var(--green)"][idx]}"></span>${esc(n)}</span>`).join("")
    + `<span><span class="dot" style="width:8px;height:8px;background:var(--amber)"></span>Needs you</span></div></section>`;

  h += renderSwitcher(m, e, tq, group);
  return h;
}

// ---------- page ----------
export default async function StatusPage({ searchParams }: { searchParams: Promise<{ token?: string; tab?: string; epic?: string; group?: string; env?: string; efilter?: string }> }) {
  const sp = await searchParams;
  const required = process.env.STATUS_TOKEN;

  if (required && sp.token !== required) {
    const body = SCENE + `<div class="gatebox glass" style="padding:26px"><h2>🔒 Protected dashboard</h2><p style="color:var(--muted)">เพิ่ม access token ใน URL:<br><code>/status?token=YOUR_TOKEN</code></p></div>`;
    return (<><style dangerouslySetInnerHTML={{ __html: CSS }} /><div dangerouslySetInnerHTML={{ __html: body }} /></>);
  }

  let issues: StatusIssue[] = [];
  let err = "";
  try {
    let pulse = 0;
    try { pulse = await readPulse(); } catch { /* pulse unavailable → fall back to the 60s time cache */ }
    issues = await fetchStatusIssues(pulse);
  } catch (e) { err = e instanceof Error ? e.message : String(e); }
  const m = buildModel(issues);
  const tq = required ? `&token=${encodeURIComponent(sp.token || "")}` : "";
  const tab = sp.tab === "epic" ? "epic" : "overview";
  const group = sp.group === "persona" ? "persona" : "feature";
  const envOpen = sp.env !== "closed";
  const efilter = ["prog", "done", "todo"].includes(sp.efilter || "") ? (sp.efilter as string) : "all";
  const epic = sp.epic && m.epics[sp.epic] ? sp.epic : m.activeEpic || m.epicNames[0] || "";

  // Both views are rendered into the DOM and toggled client-side (showView) so switching
  // tabs is instant — no server round-trip, no loading state. AutoRefresh quietly updates data.
  // tab + group + epic all live in the URL so router.refresh() re-renders the SAME view (no bounce).
  const overviewView = `<div id="view-overview" class="view ${tab !== "epic" ? "active" : ""}">${renderOverview(m, tq, group, envOpen, efilter)}</div>`;
  const epicView = epic ? `<div id="view-epic" class="view ${tab === "epic" ? "active" : ""}">${renderEpic(m, epic, tq, group)}</div>` : "";
  const inner = err
    ? `<div class="err">❌ โหลดข้อมูลจาก Linear ไม่ได้: ${esc(err)}</div>`
    : overviewView + epicView;

  const main = `<main class="wrap">${topBar(m, tab)}${inner}</main><div class="toast" id="toast"></div>`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* SCENE is a constant string → React never re-injects it on refresh, so the starfield persists */}
      <div dangerouslySetInnerHTML={{ __html: SCENE }} />
      <div dangerouslySetInnerHTML={{ __html: main }} />
      <StatusClient refreshSeconds={60} token={sp.token || ""} />
    </>
  );
}
