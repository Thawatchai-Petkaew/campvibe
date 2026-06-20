/* CampVibe — Live Delivery dashboard. Server-rendered from Linear, refreshed every 60s.
 * Look & feel: design/campvibe-delivery.html. Data: lib/linear.ts (real, no mock numbers).
 * Protected by STATUS_TOKEN (visit /status?token=YOUR_TOKEN). Tabs: ?tab=overview|epic&epic=<name>. */
import { fetchStatusIssues, type StatusIssue } from "@/lib/linear";
import { CSS, SCENE, LOGO } from "./dashboard-assets";
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

const STAGES = ["Design", "Gate", "Build", "Verify", "Ship"];
const ROLE_STAGE: Record<string, string> = {
  architect: "Design", "ux-designer": "Design", human: "Gate",
  "backend-engineer": "Build", "frontend-engineer": "Build",
  "qa-engineer": "Verify", "security-reviewer": "Verify", "devops-release": "Ship",
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
interface Model {
  work: StatusIssue[];
  epics: Record<string, StatusIssue[]>;
  epicNames: string[];
  projectPct: number;
  gates: StatusIssue[];
  epicsActive: number;
  backlog: StatusIssue[];
  rmap: Record<string, { total: number; active: number; done: number }>;
  activeEpic: string;
}
function buildModel(issues: StatusIssue[]): Model {
  const work = issues.filter((i) => epicOf(i.title));
  const epics: Record<string, StatusIssue[]> = {};
  work.forEach((i) => { const e = epicOf(i.title); (epics[e] = epics[e] || []).push(i); });
  const epicNames = Object.keys(epics).sort();
  const done = work.filter(isDone).length;
  const rmap: Record<string, { total: number; active: number; done: number }> = {};
  work.forEach((i) => {
    const r = roleOf(i.title) || "team";
    const d = (rmap[r] = rmap[r] || { total: 0, active: 0, done: 0 });
    d.total++; if (isActive(i)) d.active++; if (isDone(i)) d.done++;
  });
  return {
    work, epics, epicNames,
    projectPct: work.length ? Math.round((done / work.length) * 100) : 0,
    gates: work.filter(hasAwait),
    epicsActive: epicNames.filter((e) => epics[e].some(isActive)).length,
    backlog: work.filter((i) => i.status === "Backlog"),
    rmap,
    activeEpic: epicNames.find((e) => epics[e].some(isActive)) || epicNames[0] || "",
  };
}

// ---------- top bar ----------
function topBar(m: Model, tab: string): string {
  return `<header class="glass bar"><div class="brand">${LOGO}<span class="cv-sub">${esc(m.activeEpic || "CampVibe")} · live</span></div>`
    + `<nav class="tabs"><button class="tab ${tab !== "epic" ? "active" : ""}" id="tab-overview" onclick="showView('overview')">Overview</button>`
    + `<button class="tab ${tab === "epic" ? "active" : ""}" id="tab-epic" onclick="showView('epic')">Epic detail</button></nav>`
    + `<span class="live"><span class="dot live"></span><span id="clock">·</span></span></header>`;
}

// ---------- OVERVIEW ----------
function renderOverview(m: Model, tq: string): string {
  const firstGateEpic = m.gates[0] ? `?tab=epic&epic=${encodeURIComponent(epicOf(m.gates[0].title))}${tq}` : "#";
  let h = "";

  // Gates need you
  h += `<section class="glass pane"><div class="pane-h"><span class="t">Gates need you</span><span class="x">${m.gates.length} across all epics</span></div>`;
  if (m.gates.length) {
    m.gates.forEach((i) => {
      const g = gateOf(i.title);
      h += `<div class="gaterow urgent"><div class="gr-ic">${svg(ICON.flame)}</div><div class="gr-m"><div class="gr-title">${esc(clean(i.title))}</div><div class="gr-sub">${esc(epicOf(i.title))} · ${esc(i.priority)}${g ? " · " + esc(g) : ""}</div></div><a class="gr-btn" href="${esc(i.url)}" target="_blank" rel="noopener">Review →</a></div>`;
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

  // Agent workload
  const roles = Object.keys(m.rmap).filter((r) => r !== "human" && r !== "team").sort((a, b) => m.rmap[b].total - m.rmap[a].total);
  h += `<section class="glass pane"><div class="pane-h"><span class="t">Agent workload</span><span class="x">across all epics</span></div><div class="loads">`;
  h += `<div class="load you"><div class="load-top"><span class="load-name">You</span><span class="load-n">${m.gates.length}</span></div><div class="seg"><span style="width:100%;background:var(--amber)"></span></div><div class="load-sub">${m.gates.length} gate${m.gates.length === 1 ? "" : "s"} to review</div></div>`;
  roles.forEach((r) => {
    const d = m.rmap[r], queued = Math.max(0, d.total - d.active - d.done);
    const seg = [
      d.done ? `<span style="width:${(d.done / d.total) * 100}%;background:var(--green)"></span>` : "",
      d.active ? `<span style="width:${(d.active / d.total) * 100}%;background:var(--emerald)"></span>` : "",
      queued ? `<span style="width:${(queued / d.total) * 100}%;background:var(--blue)"></span>` : "",
    ].join("");
    const sub = d.active ? `<span class="dot live"></span>${d.active} active · ${d.done} done` : `${d.done} done · ${queued} queued`;
    h += `<div class="load"><div class="load-top"><span class="load-name">${esc(roleLabel(r))}</span><span class="load-n">${d.total}</span></div><div class="seg">${seg}</div><div class="load-sub">${sub}</div></div>`;
  });
  h += `</div></section>`;

  // Epics
  h += `<section class="glass pane"><div class="pane-h"><span class="t">Epics</span><span class="x">progress · tap to drill in</span></div><div class="epics">`;
  m.epicNames.forEach((e) => {
    const it = m.epics[e], doneN = it.filter(isDone).length, pct = Math.round((doneN / it.length) * 100);
    const active = it.some(isActive), gate = it.find(hasAwait);
    const st = gate ? "waiting on you" : active ? "in progress" : pct === 100 ? "shipped · done" : "queued";
    const badge = gate ? `<span class="epic-act gate">${esc(gateOf(gate.title) || "Gate")}</span>` : pct === 100 ? `<span class="epic-act done">done</span>` : `<span class="epic-act ph">${active ? "build" : "queued"}</span>`;
    const mix = COLS.map(([s], idx) => { const c = ["#8a9aa8", "var(--blue)", "var(--emerald)", "var(--violet)", "var(--green)"][idx]; const n = it.filter((i) => i.status === s).length; return n ? `<span style="width:${(n / it.length) * 100}%;background:${c}"></span>` : ""; }).join("");
    h += `<a class="epic ${gate ? "live" : ""}" href="?tab=epic&epic=${encodeURIComponent(e)}${tq}"><div class="epic-head"><span class="epic-ic">${epicIcon(e)}</span><div class="epic-id"><div class="epic-name">${esc(e)}</div><div class="epic-st">${esc(st)}</div></div>${badge}</div><div class="epic-prog"><div class="epic-bar"><i style="width:${pct}%"></i></div><span class="epic-pct">${pct}%</span></div><div class="epic-mix">${mix}</div></a>`;
  });
  h += `</div></section>`;

  // Backlog
  h += `<section class="glass pane"><div class="pane-h"><span class="t">Project backlog</span><span class="x">${m.backlog.length} stories</span></div>`;
  if (m.backlog.length) {
    m.backlog.forEach((i) => {
      h += `<a class="qrow" href="${esc(i.url)}" target="_blank" rel="noopener"><div class="qa">${roleIcon(roleOf(i.title))}</div><div class="qm"><b>${esc(clean(i.title))}</b><span class="tk">${esc(i.id)} · ${esc(roleLabel(roleOf(i.title)))} · ${esc(epicOf(i.title))}</span></div><span class="qs bl">Backlog</span></a>`;
    });
  } else h += `<div class="none-row" style="color:var(--muted)">— ไม่มี story ใน backlog</div>`;
  h += `</section>`;

  return h;
}

// ---------- EPIC DETAIL ----------
function renderEpic(m: Model, e: string, tq: string): string {
  const it = (m.epics[e] || []).slice();
  const running = it.filter(isActive);
  const needs = it.filter(hasAwait);
  const shipped = it.filter(isDone);
  const queued = it.filter((i) => !isActive(i) && !isDone(i) && !hasAwait(i)).sort((a, b) => colIdx(a.status) - colIdx(b.status));

  // pipeline stages
  const stageInfo = (stage: string) => {
    const items = it.filter((i) => ROLE_STAGE[roleOf(i.title)] === stage);
    if (!items.length) return { cls: "idle", sub: "—" };
    if (stage === "Gate") {
      if (items.some(hasAwait)) return { cls: "gate", sub: "needs you" };
      return items.every(isDone) ? { cls: "done", sub: "done" } : { cls: "q", sub: "queued" };
    }
    const act = items.filter(isActive).length;
    if (act) return { cls: "run", sub: `${act} agent${act > 1 ? "s" : ""}` };
    if (items.every(isDone)) return { cls: "done", sub: "done" };
    return { cls: "q", sub: "queued" };
  };
  const stages = STAGES.map((s) => ({ name: s, ...stageInfo(s) }));
  const curIdx = Math.max(0, stages.findIndex((s) => s.cls === "run" || s.cls === "gate"));
  const curName = stages[curIdx]?.name || "Design";

  let h = "";
  // breadcrumb
  h += `<div class="glass crumb"><a href="?tab=overview${tq}">CampVibe</a><span class="sep">›</span><span class="cur">${esc(e)}</span><span class="cstage">Stage ${curIdx + 1} / 5 · ${esc(curName.toLowerCase())}</span></div>`;

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
    h += `<div class="stage ${s.cls}"><div class="node">${svg(ICON[s.name])}</div><div class="nminfo"><div class="nm">${s.name}</div><div class="sub">${esc(s.sub)}</div></div></div>`;
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
      h += `<a class="qrow" href="${esc(i.url)}" target="_blank" rel="noopener"><div class="qa">${roleIcon(roleOf(i.title))}</div><div class="qm"><b>${esc(roleLabel(roleOf(i.title)))}</b><span class="tk">${esc(i.id)} · ${esc(clean(i.title))}</span></div><span class="qs ${cls}">${esc(i.status)}</span></a>`;
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
      h += `<a class="kc ${isActive(i) ? "prog" : ""} ${hasAwait(i) ? "gate" : ""}" href="${esc(i.url)}" target="_blank" rel="noopener"><div class="kt">${roleIcon(roleOf(i.title))}<span>${esc(clean(i.title))}</span></div><div class="kb"><span class="kr">${live}${yb}${esc(roleLabel(roleOf(i.title)))}</span><span class="tk">${esc(i.id)}</span></div></a>`;
    });
    h += `</div>`;
  });
  h += `</div><div class="legend">`
    + COLS.map(([n], idx) => `<span><span class="dot" style="width:8px;height:8px;background:${["#8a9aa8", "var(--blue)", "var(--emerald)", "var(--violet)", "var(--green)"][idx]}"></span>${esc(n)}</span>`).join("")
    + `<span><span class="dot" style="width:8px;height:8px;background:var(--amber)"></span>Needs you</span></div></section>`;

  return h;
}

// ---------- page ----------
export default async function StatusPage({ searchParams }: { searchParams: Promise<{ token?: string; tab?: string; epic?: string }> }) {
  const sp = await searchParams;
  const required = process.env.STATUS_TOKEN;

  if (required && sp.token !== required) {
    const body = SCENE + `<div class="gatebox glass" style="padding:26px"><h2>🔒 Protected dashboard</h2><p style="color:var(--muted)">เพิ่ม access token ใน URL:<br><code>/status?token=YOUR_TOKEN</code></p></div>`;
    return (<><style dangerouslySetInnerHTML={{ __html: CSS }} /><div dangerouslySetInnerHTML={{ __html: body }} /></>);
  }

  let issues: StatusIssue[] = [];
  let err = "";
  try { issues = await fetchStatusIssues(); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  const m = buildModel(issues);
  const tq = required ? `&token=${encodeURIComponent(sp.token || "")}` : "";
  const tab = sp.tab === "epic" ? "epic" : "overview";
  const epic = sp.epic && m.epics[sp.epic] ? sp.epic : m.activeEpic || m.epicNames[0] || "";

  // Both views are rendered into the DOM and toggled client-side (showView) so switching
  // tabs is instant — no server round-trip, no loading state. AutoRefresh quietly updates data.
  const overviewView = `<div id="view-overview" class="view ${tab !== "epic" ? "active" : ""}">${renderOverview(m, tq)}</div>`;
  const epicView = epic ? `<div id="view-epic" class="view ${tab === "epic" ? "active" : ""}">${renderEpic(m, epic, tq)}</div>` : "";
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
      <StatusClient refreshSeconds={60} />
    </>
  );
}
