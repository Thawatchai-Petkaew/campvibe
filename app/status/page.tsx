/* Public live delivery dashboard — server-rendered from Linear.
 * Protected by STATUS_TOKEN (visit /status?token=YOUR_TOKEN).
 * Live: rendered fresh on every request + auto-reload every 60s. */
import { fetchStatusIssues, type StatusIssue } from "@/lib/linear";

export const dynamic = "force-dynamic";
export const metadata = { title: "CampVibe — Live Delivery" };

// ---------- icons (tabler-style) ----------
const ICON: Record<string, string> = {
  epic: '<path d="M3.5 20h17"/><path d="M12 5 4 20"/><path d="M12 5l8 15"/><path d="M12 5v15"/><path d="m9 20 3-4 3 4"/>',
  alert: '<path d="M10.3 4.3a2 2 0 0 1 3.4 0c2.8 1 4.3 3.2 4.3 6.2v3l1.2 2.2a.7.7 0 0 1-.6 1H5.4a.7.7 0 0 1-.6-1L6 13.5v-3c0-3 1.5-5.2 4.3-6.2z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  orchestrator: '<circle cx="12" cy="12" r="9"/><path d="M8 16l2-6 6-2-2 6z"/>',
  "product-owner": '<path d="M9 5h6v2H9z"/><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/>',
  analyst: '<path d="M4 5v14h16"/><circle cx="9" cy="13" r="1"/><circle cx="13" cy="9" r="1"/><circle cx="17" cy="12" r="1"/>',
  architect: '<path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M15 9h3a1 1 0 0 1 1 1v11"/><path d="M3 21h18"/><path d="M8 8h.01M8 12h.01M8 16h.01"/>',
  designer: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.9 1.6-1.6 0-1 .8-1.5 1.5-1.5h1A2.9 2.9 0 0 0 21 15a9 9 0 0 0-9-12z"/><circle cx="7.7" cy="12.5" r="1"/><circle cx="10" cy="8.2" r="1"/><circle cx="15" cy="8.2" r="1"/>',
  frontend: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  backend: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  qa: '<path d="M10 5h9M10 12h9M10 19h9"/><path d="m4 5 1 1 2-2"/><path d="m4 12 1 1 2-2"/><path d="m4 19 1 1 2-2"/>',
  security: '<path d="M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6z"/><path d="m9 12 2 2 4-4"/>',
  devops: '<path d="M12 3c3 1 5 4.2 5 8l-3 3H10L7 11c0-3.8 2-7 5-8z"/><path d="M9.5 17c-1 1-1 3-1 3s2 0 3-1"/><circle cx="12" cy="9.2" r="1.3"/>',
  human: '<circle cx="9" cy="8" r="3"/><path d="M4 20c0-3 2.2-5 5-5s5 2 5 5"/><path d="m14.5 13 2 2 4-4"/>',
  story: '<path d="M5 21V4"/><path d="M5 4h11l-2 3 2 3H5"/>',
};
const ICON_KEY: Record<string, string> = { architect: "architect", "ux-designer": "designer", "frontend-engineer": "frontend", "backend-engineer": "backend", "qa-engineer": "qa", "security-reviewer": "security", "devops-release": "devops", "product-owner": "product-owner", analyst: "analyst", orchestrator: "orchestrator", human: "human" };
const ROLE_LABEL: Record<string, string> = { architect: "Architect", "ux-designer": "Designer", "frontend-engineer": "Frontend", "backend-engineer": "Backend", "qa-engineer": "QA", "security-reviewer": "Security", "devops-release": "DevOps", "product-owner": "Product Owner", analyst: "Analyst", orchestrator: "Orchestrator", human: "You" };

const COLS: [string, string][] = [["Backlog", "var(--muted-fg)"], ["Todo", "var(--todo)"], ["In Progress", "var(--primary)"], ["In Review", "var(--review)"], ["Done", "var(--done)"]];
const PILL: Record<string, [string, string]> = { Backlog: ["var(--muted)", "var(--muted-fg)"], Todo: ["oklch(0.95 0.03 235)", "var(--todo)"], "In Progress": ["var(--primary-soft)", "var(--primary)"], "In Review": ["oklch(0.96 0.04 300)", "var(--review)"], Done: ["oklch(0.95 0.05 160)", "var(--done)"] };
const PRIc: Record<string, string> = { Urgent: "var(--destructive)", High: "oklch(0.65 0.16 50)", Medium: "var(--flame-deep)", Low: "var(--muted-fg)", "No priority": "var(--border)" };

const svg = (p: string) => `<svg class="i" viewBox="0 0 24 24">${p}</svg>`;
const roleIcon = (r: string | null) => svg(ICON[ICON_KEY[r ?? ""]] || ICON.story);
const roleOf = (t: string) => { const m = t.match(/\[([a-z-]+)\]/); return m ? m[1] : null; };
const epicOf = (t: string) => { const x = t.split("·"); return x.length > 1 ? x[0].trim() : null; };
const clean = (t: string) => t.replace(/^.*?\]\s*/, "").replace(/^[^·]*·\s*/, "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m] as string));
const hasAwait = (i: StatusIssue) => i.labels.includes("awaiting-you");
const isMine = (i: StatusIssue) => hasAwait(i) || i.priority === "Urgent";
const isActive = (i: StatusIssue) => i.status === "In Progress";
const roleLabel = (r: string | null) => ROLE_LABEL[r ?? ""] || r || "team";
const pill = (s: string) => { const c = PILL[s] || PILL.Backlog; return `<span class="pill" style="background:${c[0]};color:${c[1]}">${esc(s)}</span>`; };
const colIdx = (s: string) => { for (let i = 0; i < COLS.length; i++) if (COLS[i][0] === s) return i; return 99; };

function renderBody(issues: StatusIssue[], err: string): string {
  if (err) return `<div class="err">❌ Couldn't load from Linear: ${esc(err)}</div>`;
  const work = issues.filter((i) => epicOf(i.title));
  const epics: Record<string, StatusIssue[]> = {};
  work.forEach((i) => { const e = epicOf(i.title) as string; (epics[e] = epics[e] || []).push(i); });
  const epicNames = Object.keys(epics).sort();
  const mine = work.filter(isMine);
  let h = "";

  // Action Required
  h += `<div class="action"><div class="ah">${svg(ICON.alert)} Action Required <span class="badge">${mine.length}</span></div>`;
  if (mine.length) {
    mine.forEach((i) => { const r = roleOf(i.title); const gate = (clean(i.title).match(/Gate\s*G\d/i) || [])[0] || "";
      h += `<a class="item" href="${esc(i.url)}" target="_blank" rel="noopener"><span class="av">${roleIcon(r)}</span><span class="l"><div class="t">${esc(clean(i.title) || i.title)}</div><div class="m">${esc(roleLabel(r))}${gate ? " · " + esc(gate) : ""} · ${esc(i.id)}</div></span><span class="cta">${hasAwait(i) ? "Review &amp; Approve →" : "Open →"}</span></a>`; });
  } else h += `<div class="none">✓ Nothing waiting on you right now</div>`;
  h += `</div>`;

  // Workload by Role
  const rmap: Record<string, { total: number; active: number; done: number }> = {};
  work.forEach((i) => { const r = roleOf(i.title) || "team"; rmap[r] = rmap[r] || { total: 0, active: 0, done: 0 }; rmap[r].total++; if (isActive(i)) rmap[r].active++; if (i.status === "Done") rmap[r].done++; });
  const roles = Object.keys(rmap).sort((a, b) => rmap[b].total - rmap[a].total);
  h += `<div class="section-t">${svg(ICON.orchestrator)} Workload by Role <span class="c">${roles.length}</span></div><div class="roles">`;
  roles.forEach((r) => { const d = rmap[r]; const on = d.active > 0;
    h += `<div class="rolechip${on ? " on" : ""}"><span class="ic">${roleIcon(r)}</span><div><div class="nm">${esc(roleLabel(r))} <span class="n">${d.total}</span></div><div class="sub">${on ? `<span class="liveDot"></span>${d.active} in progress · ` : ""}${d.done} done</div></div></div>`; });
  h += `</div>`;

  // Overview
  h += `<div class="section-t">${svg(ICON.epic)} All Epics / Features <span class="c">${epicNames.length}</span></div><div class="ov">`;
  epicNames.forEach((e) => { const it = epics[e]; const cnt: Record<string, number> = {}; COLS.forEach((c) => (cnt[c[0]] = 0)); it.forEach((i) => (cnt[i.status] = (cnt[i.status] || 0) + 1));
    const done = cnt["Done"] || 0; const pct = it.length ? Math.round((done / it.length) * 100) : 0; const aw = it.filter(hasAwait).length;
    h += `<div class="ovc"><div class="top"><span class="badge-ic">${svg(ICON.epic)}</span><div><div class="nm">${esc(e)}</div><div class="meta">${it.length} stories${aw ? " · " + aw + " awaiting you" : ""}</div></div></div><div class="bar"><i style="width:${pct}%"></i></div><div class="chips"><span class="meta" style="font-weight:700;color:var(--primary)">${pct}%</span>${COLS.filter((c) => cnt[c[0]]).map((c) => `<span class="chip"><span class="dot" style="background:${c[1]}"></span>${cnt[c[0]]} ${esc(c[0])}</span>`).join("")}</div></div>`; });
  h += `</div>`;

  // Kanban
  h += `<div class="section-t">${svg(ICON.frontend)} Kanban <span class="c">${work.length}</span></div><div class="kb">`;
  COLS.forEach((c) => { const items = work.filter((i) => i.status === c[0]);
    h += `<div class="kcol"><h4><span style="color:${c[1]}">${esc(c[0])}</span><span class="c">${items.length}</span></h4>`;
    if (!items.length) h += `<div class="kempty">—</div>`;
    items.forEach((i) => { const r = roleOf(i.title); const act = isActive(i); const pr = i.priority;
      h += `<a class="kcard${act ? " active" : ""}" href="${esc(i.url)}" target="_blank" rel="noopener"><div class="kt"><span class="ic">${roleIcon(r)}</span><span>${esc(clean(i.title) || i.title)}</span></div><div class="kf"><span>${act ? `<span class="doing"><span class="dd"></span>${esc(roleLabel(r))} working</span>` : `<span><span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:${PRIc[pr] || "var(--border)"};margin-right:4px"></span>${esc(roleLabel(r))}</span>`}${hasAwait(i) ? ' <span class="awl">YOU</span>' : ""}</span><span>${esc(i.id)}</span></div></a>`; });
    h += `</div>`; });
  h += `</div>`;

  // Story Details (expandable)
  h += `<div class="section-t">${svg(ICON.story)} Story Details</div>`;
  epicNames.forEach((e) => { const it = epics[e].slice().sort((a, b) => colIdx(a.status) - colIdx(b.status));
    const done = it.filter((x) => x.status === "Done").length; const pct = it.length ? Math.round((done / it.length) * 100) : 0;
    h += `<div class="epic"><div class="eh"><span class="ic">${svg(ICON.epic)}</span><span class="nm">${esc(e)}</span><span class="pct">${pct}% · ${it.length} stories</span></div><div class="rows">`;
    it.forEach((i) => { const r = roleOf(i.title); const act = isActive(i); const pr = i.priority;
      h += `<details class="row${act ? " active" : ""}"><summary><span class="ic">${roleIcon(r)}</span><span class="tl"><span class="t">${esc(clean(i.title) || i.title)}</span><span class="s">${esc(roleLabel(r))}${act ? ' <span class="doing"><span class="dd"></span>working</span>' : ` <span class="dot" style="display:inline-block;width:6px;height:6px;border-radius:99px;background:${PRIc[pr] || "var(--border)"}"></span> ${esc(pr)}`}</span></span>${hasAwait(i) ? '<span class="awl">YOU</span>' : ""}${pill(i.status)}<span class="id">${esc(i.id)}</span></summary><div class="desc">${esc(i.description || "(no description)").replace(/\n/g, "<br>")}<div style="margin-top:8px"><a class="lk" href="${esc(i.url)}" target="_blank" rel="noopener">Open in Linear ↗</a></div></div></details>`; });
    h += `</div></div>`; });

  h += `<div class="legend">${COLS.map((c) => `<span><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${c[1]}"></span>${esc(c[0])}</span>`).join("")}</div>`;
  return h;
}

const CSS = `
:root{color-scheme:light;--primary:oklch(0.511 0.096 186.391);--primary-soft:oklch(0.511 0.096 186.391/.12);--primary-fg:oklch(0.984 0.014 180.72);--bg:oklch(0.995 0.004 197.1);--fg:oklch(0.205 0.012 228.8);--card:oklch(1 0 0);--muted:oklch(0.963 0.002 197.1);--muted-fg:oklch(0.52 0.021 213.5);--border:oklch(0.922 0.006 214.3);--destructive:oklch(0.577 0.245 27.325);--done:oklch(0.55 0.11 160);--review:oklch(0.55 0.12 300);--todo:oklch(0.60 0.08 235);--flame:oklch(0.66 0.19 47);--flame2:oklch(0.79 0.15 72);--flame-deep:oklch(0.50 0.16 47);--flame-soft:oklch(0.66 0.19 47/.22)}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(120% 60% at 50% -10%,var(--primary-soft),transparent 60%),var(--bg);color:var(--fg);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans Thai",sans-serif;font-size:14px;line-height:1.55}
.wrap{max-width:1180px;margin:0 auto;padding:20px 18px 44px}
svg.i{width:1em;height:1em;vertical-align:-.13em;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.hero{position:relative;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,var(--primary),oklch(0.46 0.07 200));color:var(--primary-fg);padding:20px 22px 30px}
.hero h1{margin:0;font-family:Outfit,Inter,sans-serif;font-size:23px;font-weight:700;display:flex;align-items:center;gap:10px}
.hero .sub{opacity:.9;font-size:12.5px;margin-top:3px}.hero .live{margin-top:10px;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;background:rgba(255,255,255,.16);padding:3px 10px;border-radius:99px}
.hero .live .d{width:7px;height:7px;border-radius:99px;background:#fff;animation:pulse 1.8s infinite}
.ridge{position:absolute;left:0;right:0;bottom:-1px;width:100%;height:34px;opacity:.5}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.5)}70%{box-shadow:0 0 0 7px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes ring{0%{box-shadow:0 0 0 0 var(--primary-soft)}70%{box-shadow:0 0 0 9px transparent}100%{box-shadow:0 0 0 0 transparent}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}@keyframes glow{0%,100%{box-shadow:0 0 0 0 var(--flame-soft)}50%{box-shadow:0 0 0 6px transparent}}
.section-t{font-family:Outfit,Inter,sans-serif;font-size:15px;font-weight:700;margin:26px 4px 12px;display:flex;align-items:center;gap:8px}
.section-t .c{font-size:11px;font-weight:600;color:var(--muted-fg);background:var(--muted);border-radius:99px;padding:1px 9px}
.action{position:relative;background:var(--card);border:1px solid oklch(0.86 0.08 60);border-radius:16px;margin-top:16px;overflow:hidden;box-shadow:0 12px 32px -18px var(--flame)}
.action::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--flame),var(--flame2))}
.action .ah{display:flex;align-items:center;gap:9px;padding:15px 14px 9px;font-family:Outfit,Inter,sans-serif;font-weight:800;color:var(--flame-deep);font-size:13.5px;letter-spacing:.04em;text-transform:uppercase}
.action .ah .badge{background:linear-gradient(135deg,var(--flame),var(--flame2));color:#fff;border-radius:99px;font-size:12px;padding:1px 10px;animation:glow 1.8s infinite}
.action .item{position:relative;background:linear-gradient(100deg,oklch(0.985 0.04 72),var(--card) 58%);border:1px solid oklch(0.9 0.07 64);border-left:4px solid var(--flame);border-radius:12px;padding:12px;margin:8px;display:flex;gap:13px;align-items:center;cursor:pointer;transition:.16s;text-decoration:none;color:inherit}
.action .item:hover{transform:translateY(-2px);box-shadow:0 12px 26px -12px var(--flame)}
.action .item .av{width:42px;height:42px;border-radius:50%;border:2px solid var(--flame);background:var(--flame-soft);color:var(--flame-deep);display:flex;align-items:center;justify-content:center;font-size:21px;flex:none}
.action .item .l{flex:1;min-width:0}.action .item .l .t{font-weight:700;font-size:14px}.action .item .l .m{font-size:11.5px;color:var(--muted-fg);margin-top:1px}
.action .item .cta{font-size:12px;background:linear-gradient(135deg,var(--flame),var(--flame2));color:#fff;padding:9px 15px;border-radius:99px;white-space:nowrap;font-weight:700;box-shadow:0 6px 14px -6px var(--flame)}
.action .none{padding:8px 14px 16px;color:var(--flame-deep);font-size:13px;font-weight:600}
.roles{display:flex;gap:9px;flex-wrap:wrap}
.rolechip{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:8px 12px 8px 9px}
.rolechip .ic{width:30px;height:30px;border-radius:8px;background:var(--muted);color:var(--muted-fg);display:flex;align-items:center;justify-content:center;font-size:17px}
.rolechip.on .ic{background:var(--primary);color:var(--primary-fg);animation:ring 2s infinite}
.rolechip .nm{font-size:12.5px;font-weight:600;line-height:1.1}.rolechip .sub{font-size:10.5px;color:var(--muted-fg)}
.rolechip .n{font-family:Outfit,Inter,sans-serif;font-weight:700;font-size:16px;margin-left:2px}
.rolechip .liveDot{display:inline-block;width:6px;height:6px;border-radius:99px;background:var(--primary);margin-right:4px;animation:blink 1.4s infinite}
.ov{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.ovc{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 15px}
.ovc .top{display:flex;align-items:center;gap:9px;margin-bottom:10px}
.ovc .badge-ic{width:34px;height:34px;border-radius:10px;background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}
.ovc .nm{font-weight:700;font-family:Outfit,Inter,sans-serif;font-size:14.5px;line-height:1.2}.ovc .meta{font-size:11px;color:var(--muted-fg)}
.bar{height:8px;background:var(--muted);border-radius:99px;overflow:hidden;margin:10px 0 8px}.bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--primary),oklch(0.6 0.1 175));border-radius:99px}
.chips{display:flex;gap:6px;flex-wrap:wrap;font-size:10.5px}.chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:var(--muted);color:var(--muted-fg)}.chip .dot{width:6px;height:6px;border-radius:99px}
.kb{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.kcol{background:var(--muted);border-radius:13px;padding:9px;min-height:60px}
.kcol h4{margin:2px 4px 9px;font-size:11.5px;font-weight:700;color:var(--muted-fg);display:flex;justify-content:space-between;text-transform:uppercase;letter-spacing:.03em}
.kcol h4 .c{background:var(--card);border-radius:99px;padding:0 7px;font-size:11px}
.kcard{display:block;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;text-decoration:none;color:inherit;transition:.14s}
.kcard:hover{box-shadow:0 5px 16px rgba(20,40,40,.1);transform:translateY(-1px)}
.kcard .kt{font-size:12px;font-weight:600;display:flex;gap:7px;align-items:flex-start}.kcard .kt .ic{font-size:15px;color:var(--muted-fg);flex:none;margin-top:1px}
.kcard .kf{display:flex;justify-content:space-between;align-items:center;margin-top:7px;font-size:10px;color:var(--muted-fg)}
.kcard.active{border-color:var(--primary);background:linear-gradient(180deg,var(--primary-soft),var(--card))}.kcard.active .ic{color:var(--primary)}
.kcard .doing{display:inline-flex;align-items:center;gap:5px;color:var(--primary);font-weight:700;font-size:9.5px}.kcard .doing .dd{width:6px;height:6px;border-radius:99px;background:var(--primary);animation:blink 1.3s infinite}
.kempty{color:var(--muted-fg);font-size:11px;text-align:center;padding:8px 0;opacity:.6}
.epic{margin-top:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.epic .eh{display:flex;align-items:center;gap:10px;padding:13px 15px;background:linear-gradient(180deg,var(--primary-soft),transparent)}
.epic .eh .ic{color:var(--primary);font-size:20px}.epic .eh .nm{font-weight:700;font-family:Outfit,Inter,sans-serif;font-size:14px;flex:1}.epic .eh .pct{font-size:12px;color:var(--muted-fg);font-weight:600}
.rows{display:flex;flex-direction:column;gap:8px;padding:10px}
.row{border-radius:11px;border:1px solid transparent;transition:.13s}
.row>summary{display:flex;align-items:center;gap:11px;padding:11px 12px;cursor:pointer;list-style:none}
.row>summary::-webkit-details-marker{display:none}
.row:hover{background:var(--muted)}.row .ic{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;flex:none;background:var(--muted);color:var(--muted-fg)}
.row .tl{flex:1;min-width:0}.row .tl .t{font-weight:600;font-size:13px}.row .tl .s{font-size:11px;color:var(--muted-fg);display:flex;gap:7px;align-items:center;margin-top:1px}
.pill{font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:99px;white-space:nowrap}.id{font-size:10.5px;color:var(--muted-fg);flex:none}
.row.active{background:var(--primary-soft);border-color:oklch(0.511 0.096 186.391/.3)}.row.active .ic{background:var(--primary);color:var(--primary-fg);animation:ring 2s infinite}
.row .doing{display:inline-flex;align-items:center;gap:5px;color:var(--primary);font-weight:700;font-size:10.5px}.row .doing .dd{width:6px;height:6px;border-radius:99px;background:var(--primary);animation:blink 1.3s infinite}
.row .desc{padding:0 14px 14px 57px;font-size:12.5px;color:var(--fg);line-height:1.7}
.lk{color:var(--primary);font-weight:600;text-decoration:none}
.awl{font-size:10px;background:linear-gradient(135deg,var(--flame),var(--flame2));color:#fff;padding:1px 8px;border-radius:99px;font-weight:700}
.legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;font-size:11px;color:var(--muted-fg)}.legend span{display:inline-flex;align-items:center;gap:5px}
.err{background:oklch(0.97 0.04 27);border:1px solid var(--destructive);color:var(--destructive);border-radius:12px;padding:14px;margin-top:16px}
.gate{max-width:420px;margin:14vh auto;text-align:center;font-family:Inter,sans-serif;color:var(--fg)}
.gate h2{font-family:Outfit,Inter,sans-serif}
@media(max-width:820px){.kb{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.kb{grid-template-columns:1fr}}
`;

const HERO = `<div class="hero"><h1><svg class="i" viewBox="0 0 24 24" style="width:26px;height:26px"><path d="M3.5 20h17"/><path d="M12 5 4 20"/><path d="M12 5l8 15"/><path d="M12 5v15"/><path d="m9 20 3-4 3 4"/></svg> CampVibe — Live Delivery</h1><div class="sub">All work across Feature · Epic · Story — live from Linear</div><span class="live"><span class="d"></span>Live · auto-refresh 60s</span><svg class="ridge" viewBox="0 0 1200 80" preserveAspectRatio="none"><path d="M0 80 L0 55 L120 30 L260 60 L420 18 L600 58 L760 22 L920 55 L1080 28 L1200 52 L1200 80 Z" fill="rgba(255,255,255,.18)"/><path d="M0 80 L0 65 L160 45 L340 70 L520 38 L700 68 L900 42 L1080 66 L1200 46 L1200 80 Z" fill="rgba(255,255,255,.12)"/></svg></div>`;

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const required = process.env.STATUS_TOKEN;

  if (required && sp.token !== required) {
    const body = `<div class="gate"><h2>🔒 Protected dashboard</h2><p style="color:var(--muted-fg)">Add your access token to the URL:<br><code>/status?token=YOUR_TOKEN</code></p></div>`;
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="wrap" dangerouslySetInnerHTML={{ __html: body }} />
      </>
    );
  }

  let issues: StatusIssue[] = [];
  let err = "";
  try { issues = await fetchStatusIssues(); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  const body = HERO + renderBody(issues, err);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wrap" dangerouslySetInnerHTML={{ __html: body }} />
      <script dangerouslySetInnerHTML={{ __html: "setTimeout(function(){location.reload()},60000)" }} />
    </>
  );
}
