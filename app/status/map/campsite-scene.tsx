"use client";

// S3 — Hybrid motion model:
//   entering → agents walk from arm-tip entry point to home station on first mount
//   idle     → in-place breathe/sway via CSS (transform/opacity only, no rAF state)
//   walking  → path traversal on triggerWalk() — hook ready for S6, not called from data yet
//
// S5 — Epic scope: engine.setScope() dims/shows agents without remounting the rAF loop.
//   URL params (scope/epic/group/efilter) are persisted via history.replaceState and
//   restored from initial props (read by the server page.tsx from searchParams).
//
// S7 — A11y + reduced-motion hardening:
//   - Scene root gets role="img" + aria-label summary.
//   - Each agent is a focusable <button> (tab-order: You first, then agents).
//   - Under prefers-reduced-motion:reduce every agent shows a visible text label
//     (display name + status tag) so all motion-carried signals are readable as text.
//   - Trail renders as a static filled bar + stage names under reduced-motion.
//   - Deep-link scope fix: scope effect re-runs when engineRef becomes available.
//   - Client reconcile failures are caught gracefully (keep last-known data).
//
// Reduced-motion: if prefers-reduced-motion:reduce → rAF loop never starts; all agents
// render static at their home station (S2 behaviour). The media-query listener
// starts/stops the loop if the OS setting changes without a page reload.
//
// DOM writes: only style.transform / style.backgroundImage / style.left / style.top /
// style.zIndex / style.opacity / style.pointerEvents on refs. No per-frame React setState.
// Effect cleanup cancels rAF.

import { useCallback, useEffect, useRef, useState } from "react";
import { MapOverlays, ViewToggle } from "./campsite-overlays";
import {
  buildScoutState,
  startEngine,
  type EngineHandle,
  type ScoutRef,
} from "./campsite-engine";

export interface MapAgent {
  role: string;         // canonical role key, e.g. "frontend-engineer"
  name: string;         // display name (Thai-friendly short name)
  active: boolean;      // rmap[role].active > 0
  done: number;
  activeCount: number;
  queued: number;       // total - done - active (stories not yet started)
  task: { id: string; title: string; startedAt: string | null } | null;
}

// Gate item for the You → Gates panel.
export interface MapGate {
  id: string;
  title: string;       // raw title (caller uses cleanTitle on it)
  url: string;
  epicKey: string;     // first "·" segment of the title, or ""
  priority: string;    // e.g. "High", "Urgent"
}

// Backlog story item for the Backlog overlay.
export interface MapBacklogItem {
  id: string;
  title: string;       // cleaned (no epic prefix, no [role] tag)
  role: string;        // canonical role for grouping
  epicKey: string;
}

// Environment lane item for the Environments overlay.
export interface MapEnvItem {
  id: string;
  title: string;       // cleaned display title
  role: string;        // display role label
}

/** Minimal serialisable story shape for per-epic Trail/Board/Up-next (client-side derive). */
export interface MapEpicStory {
  id: string;
  title: string;        // cleaned (no epic prefix, no [role] tag)
  status: string;       // e.g. "In Progress", "Done", "Backlog"
  statusType: string;   // backlog | unstarted | started | completed | canceled
  labels: string[];     // needed for hasAwait / epicBucket / rolesOf
  role: string;         // canonical role from [role] tag (may be "")
  url: string;
  startedAt: string | null;
}

/** One epic as projected for the map client. */
export interface MapEpicItem {
  key: string;          // epic key used as ?epic= value
  label: string;        // display name
  feature: string;      // Linear project / feature name
  persona: string;      // persona label ("" = none)
  bucket: "prog" | "done" | "todo";  // from epicBucket()
  stories: MapEpicStory[];
}

export interface MapModel {
  projectPct: number;
  gates: MapGate[];
  agents: MapAgent[];     // the 7 build-roles, always present
  epicNames: string[];
  // S4 overlay data — all derived server-side from Model
  epicsActive: number;
  totalEpics: number;
  backlogItems: MapBacklogItem[];
  envLanes: {
    dev: MapEnvItem[];
    staging: MapEnvItem[];
    prod: MapEnvItem[];
  };
  // S5 addition — per-epic story data for Trail/Board/Up-next client-side derive
  epics: MapEpicItem[];
}

// Canonical role display config — mirrors the mockup AGENTS array.
const ROLE_CONFIG: Record<
  string,
  { node: string; color: string; poseIdx: number; displayName: string; roleLabel: string }
> = {
  "architect":          { node: "N",  color: "#8FB8F0", poseIdx: 0, displayName: "Architect",  roleLabel: "วางแผนระบบ" },
  "ux-designer":        { node: "NE", color: "#B7A6FF", poseIdx: 1, displayName: "Designer",   roleLabel: "UX และวิชวล" },
  "backend-engineer":   { node: "E",  color: "#5BE9B0", poseIdx: 2, displayName: "Backend",    roleLabel: "API และบริการ" },
  "frontend-engineer":  { node: "SE", color: "#5FD0DE", poseIdx: 3, displayName: "Frontend",   roleLabel: "หน้าแอป" },
  "devops-release":     { node: "SW", color: "#BFE85B", poseIdx: 4, displayName: "DevOps",     roleLabel: "CI/CD" },
  "qa-engineer":        { node: "W",  color: "#F39FD2", poseIdx: 5, displayName: "QA",         roleLabel: "ทดสอบและตรวจสอบ" },
  "security-reviewer":  { node: "NW", color: "#FF8A7A", poseIdx: 0, displayName: "Security",   roleLabel: "ความปลอดภัย" },
};

// Speed variation per role index — slight spread so agents don't arrive in a clump.
const SPEED_VAR = [0.95, 1.05, 1.00, 1.10, 0.90, 1.08, 0.92];

// ── CAM-161: Layout tables (% of fixed 1920×1080 design canvas) ─────────────
// LAYOUT_WIDE: art-measured positions for ≥ 7:5 aspect ratio (wide/16:9/ultrawide).
// Characters sit on dock, tents, tables, board in the art.
// Exact coords are visual judgments confirmed by owner screenshot.
export const LAYOUT_WIDE: Record<string, { x: number; y: number }> = {
  "architect":          { x: 55, y: 30 },
  "ux-designer":        { x: 66, y: 33 },
  "backend-engineer":   { x: 67, y: 55 },
  "frontend-engineer":  { x: 60, y: 68 },
  "devops-release":     { x: 39, y: 68 },
  "qa-engineer":        { x: 33, y: 50 },
  "security-reviewer":  { x: 35, y: 40 },
};
export const YOU_POS_WIDE = { x: 41, y: 26 };

// LAYOUT_NARROW: compact cluster for < 7:5 aspect ratio (portrait phone/tablet).
// All 8 characters packed into canvas x∈[34,66] so they stay within the visible
// center band under cover scaling on a 9:16 screen.
// You sits top-center; others form a 2-column grid around the campfire (50,54).
export const LAYOUT_NARROW: Record<string, { x: number; y: number }> = {
  "architect":          { x: 38, y: 33 },
  "ux-designer":        { x: 62, y: 33 },
  "backend-engineer":   { x: 62, y: 47 },
  "frontend-engineer":  { x: 62, y: 61 },
  "devops-release":     { x: 38, y: 61 },
  "qa-engineer":        { x: 38, y: 47 },
  "security-reviewer":  { x: 50, y: 40 },
};
export const YOU_POS_NARROW = { x: 50, y: 25 };

// Active layout (mutable at runtime; starts with wide, switched by matchMedia).
// currentLayout is read by homeStyle() which is called each render, so React state
// (layoutKey) ensures re-renders pick up the new table on layout switch.
let currentLayout: Record<string, { x: number; y: number }> = LAYOUT_WIDE;

// Hex color → rgba helper
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── Scene CSS ────────────────────────────────────────────────────────────────
// Idle-sway is always-on ambient; walking-mode overrides it during traversal.
// All animations are wrapped in @media (prefers-reduced-motion: no-preference)
// so the OS setting kills everything at once. The rAF loop is separately gated.
//
// CAM-161 — Fixed-canvas scale model:
//
// .map-wrap is the full-screen container (fixed inset:0).
// .map-bg is a full-viewport cover <img> for the forest background (decoupled
//   from the character canvas; Story B will add srcset for hi-res).
// .map-viewport centres the 1920×1080 design canvas.
// .map-stage is the fixed 1920×1080 canvas scaled by --s = max(vw/1920, vh/1080)
//   so both axes cover the viewport (same logic as object-fit:cover).
//   transform:scale(--s) scales the canvas AND all characters as one unit →
//   character size is now proportional to the map on every screen shape.
//   transform-origin:center means grid place-items:center handles layout;
//   the old translate(-50%,-50%) trick is replaced by the grid.
// .scout-layer is inset:0 inside the 1920×1080 canvas.
//   Characters use left/top as % of the canvas; z-index by y (engine unchanged).
// --scout-size is a fixed design-px value (104px on the 1920×1080 canvas) so
//   it scales with transform — proportional to the map on every screen.
// Under LAYOUT_NARROW (portrait ≥ 9:16) the narrow MQ overrides --scout-size
//   to a slightly smaller value because the cover scale (--s) is large (~1.78).
const SCENE_CSS = `
:root {
  --scout-size: 104px;
  --amber: #FFB454;
  --amber-glow: rgba(255,150,52,.6);
  --text: #F1F6FB;
  --muted: rgba(223,234,245,.66);
  --faint: rgba(223,234,245,.42);
  --line: rgba(255,255,255,.13);
  --line-2: rgba(255,255,255,.18);
  --hi: rgba(255,255,255,.16);
  --glass: rgba(16,26,42,.42);
  --blur: saturate(150%) blur(20px);
  --mono: 'JetBrains Mono','Fira Mono','Consolas',monospace;
}
/* Narrow layout: portrait screens where the narrow scale factor is large.
   Reduce scout-size so the compact cluster doesn't produce giant overlapping characters. */
@media (max-aspect-ratio: 7/5) {
  :root { --scout-size: 82px; }
}
.map-wrap{
  position:fixed;inset:0;overflow:hidden;
  background:#070d1c;
  z-index:5;
}
/* CAM-161: Full-viewport background image — decoupled from the character canvas.
   Cover semantics: width:100%; height:100%; object-fit:cover.
   z-index:0 keeps it behind the canvas (z-index:5 on .map-wrap is the stacking
   context; everything inside resolves within it).
   Story B will add srcset for hi-res screens. */
.map-bg{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  z-index:0;pointer-events:none;display:block;
}
/* CAM-161: Viewport grid — centres the fixed canvas.
   overflow:hidden clips the scaled canvas edges that extend beyond the viewport
   (same as background-size:cover clipping). */
.map-viewport{
  position:absolute;inset:0;overflow:hidden;
  display:grid;place-items:center;
  z-index:5;
}
/* CAM-161: Fixed 1920×1080 design canvas.
   --s = max(100vw/1920, 100vh/1080): cover logic — picks the larger scale so
   both axes are covered (analogous to background-size:cover).
   transform:scale(--s) scales the canvas + all children as one unit.
   transform-origin:center keeps the centre fixed as the grid already centres it.
   width/height are the design-canvas dimensions; the transform makes them fill
   the viewport. Characters write left/top as % of this canvas (engine unchanged). */
.map-stage{
  position:relative;
  width:1920px;height:1080px;
  --s:max(calc(100vw / 1920), calc(100vh / 1080));
  transform:scale(var(--s));
  transform-origin:center;
}
.scout-layer{position:absolute;inset:0;z-index:30}
.scout{position:absolute;--bh:calc(var(--scout-size)*0.9);transform:translate(-50%,-100%)}
.scout .glow{
  position:absolute;left:50%;bottom:5%;transform:translateX(-50%);
  width:calc(var(--scout-size)*0.95);height:calc(var(--scout-size)*1.02);
  border-radius:50%;background:radial-gradient(ellipse at center 60%,var(--aura),transparent 66%);
  opacity:0;filter:blur(8px);z-index:0;pointer-events:none;transition:opacity .4s
}
.scout.working .glow{opacity:.2}
.scout .aura-ring{
  position:absolute;left:50%;bottom:0;transform:translate(-50%,30%);
  width:calc(var(--scout-size)*0.74);height:calc(var(--scout-size)*0.3);
  border-radius:50%;background:radial-gradient(ellipse at center,var(--aura),transparent 70%);
  opacity:0;filter:blur(4px);z-index:1;pointer-events:none;transition:opacity .4s
}
.scout.working .aura-ring{opacity:.58}
.scout.you .aura-ring{opacity:.5}
.scout .shadow{
  position:absolute;left:50%;bottom:0;transform:translate(-50%,34%);
  width:calc(var(--scout-size)*0.5);height:calc(var(--scout-size)*0.12);
  border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.5),transparent 72%);
  filter:blur(2px);z-index:2;pointer-events:none
}
.scout .body{
  position:absolute;left:50%;bottom:0;
  width:calc(var(--scout-size)*0.6204);height:var(--scout-size);
  background-size:contain;background-repeat:no-repeat;background-position:bottom center;
  z-index:3;transform:translateX(-50%);filter:drop-shadow(0 5px 4px rgba(0,0,0,.32))
}
@media (prefers-reduced-motion: no-preference) {
  .scout.working .aura-ring{animation:auraPulse 2.4s ease-in-out infinite}
  .scout.idle .body{animation:breathe 3.5s ease-in-out infinite}
  .scout.walking-mode .body{animation:none}
  .scout.entering .body{animation:none}
  @keyframes auraPulse{0%,100%{opacity:.38;transform:translate(-50%,30%) scale(1)}50%{opacity:.6;transform:translate(-50%,30%) scale(1.09)}}
  @keyframes breathe{0%,100%{transform:translateX(-50%) translateY(0) scale(1)}50%{transform:translateX(-50%) translateY(-1px) scale(1.014)}}
  @keyframes pdot2{0%,100%{box-shadow:0 0 4px 0 var(--aura);opacity:1}50%{box-shadow:0 0 9px 2px var(--aura);opacity:.7}}
  @keyframes badgeGlow{0%,100%{box-shadow:0 6px 16px rgba(0,0,0,.32),0 0 5px 0 var(--auraGlow)}50%{box-shadow:0 6px 16px rgba(0,0,0,.32),0 0 13px 2px var(--auraGlow)}}
  @keyframes alertPulse{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-3px)}}
  @keyframes pdot3{0%{box-shadow:0 0 0 0 rgba(122,59,0,.6)}70%{box-shadow:0 0 0 5px transparent}100%{box-shadow:0 0 0 0 transparent}}
  .scout.working .badge{animation:badgeGlow 1.3s ease-in-out infinite}
  .scout.working .badge .bdot{animation:pdot2 1.6s ease-in-out infinite}
  .you-alert{animation:alertPulse 1.9s ease-in-out infinite}
  .you-alert .adot{animation:pdot3 1.3s infinite}
}
.badge{
  position:absolute;left:50%;bottom:calc(var(--bh) + 4px);transform:translateX(-50%);
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;z-index:7;
  background:rgba(18,30,48,.46);backdrop-filter:saturate(165%) blur(18px);-webkit-backdrop-filter:saturate(165%) blur(18px);
  border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:4px 9px;
  box-shadow:0 6px 16px rgba(0,0,0,.32)
}
.badge .bdot{width:7px;height:7px;border-radius:50%;flex:none;background:rgba(190,202,218,.4)}
.scout.working .badge .bdot{background:var(--aura);box-shadow:0 0 7px var(--aura)}
.scout.you .badge .bdot{background:var(--amber);box-shadow:0 0 7px var(--amber)}
.badge .bname{font-size:10.5px;font-weight:600;color:var(--text)}
.scout.idle .badge .bname{color:var(--muted)}
.scout.you .badge .bname{color:var(--text)}
.badge .bstat{font-family:var(--mono);font-size:9px;font-weight:600;color:var(--muted);padding-left:6px;border-left:1px solid var(--line)}
.scout.idle .badge .bstat{color:var(--faint)}
.scout.working .badge{border-color:var(--aura)}
.you-alert{
  position:absolute;left:50%;bottom:calc(var(--bh) + 38px);transform:translateX(-50%);
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;z-index:9;cursor:pointer;
  font-size:11px;font-weight:700;color:#241402;
  background:linear-gradient(180deg,#ffcf86,#ff9d3c);border:1px solid rgba(255,207,134,.7);
  border-radius:11px;padding:5px 11px;box-shadow:0 8px 22px -3px var(--amber-glow);
  font-family:inherit;min-height:44px;min-width:44px;
}
.you-alert:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
.you-alert .adot{width:7px;height:7px;border-radius:50%;background:#7a3b00;flex:none}
.you-alert::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#ff9d3c}
.popover{
  position:absolute;left:50%;bottom:calc(var(--bh) + 38px);transform:translateX(-50%) translateY(6px);
  width:194px;opacity:0;pointer-events:none;transition:opacity .16s,transform .16s;z-index:12;
  background:rgba(14,24,40,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid var(--line-2);border-radius:13px;padding:11px 12px;
  box-shadow:0 16px 40px rgba(0,0,0,.46)
}
.scout:hover .popover,.scout:focus-visible .popover{opacity:1;transform:translateX(-50%) translateY(0)}
.pop-name{font-weight:600;font-size:13px}
.pop-role{
  display:inline-block;font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;
  padding:2px 8px;border-radius:999px;margin-top:6px;border:1px solid var(--line)
}
.pop-task{font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.4}
.pop-task .pid{font-family:var(--mono);color:var(--text)}
.pop-gate{display:flex;gap:7px;font-size:11.5px;color:var(--muted);margin-top:7px;line-height:1.35}
.pop-gate .gid{font-family:var(--mono);color:var(--amber);flex:none}
.pop-hint{font-size:10px;color:var(--faint);margin-top:9px;border-top:1px solid var(--line);padding-top:8px}
.popover::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:7px solid transparent;border-top-color:rgba(14,24,40,.9)}
/* S7: Reduced-motion static labels — visible under prefers-reduced-motion:reduce, hidden otherwise */
.rm-label{
  display:none;
  position:absolute;left:50%;bottom:calc(var(--bh) - 28px);transform:translateX(-50%);
  white-space:nowrap;text-align:center;pointer-events:none;z-index:8;
}
@media (prefers-reduced-motion: reduce) {
  .rm-label{display:block;}
  .rm-label-name{font-size:11px;font-weight:700;color:var(--text);display:block;line-height:1.3}
  .rm-label-status{font-size:9.5px;font-weight:600;display:block;margin-top:2px;
    border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:1px 7px;
    background:rgba(18,30,48,.55);color:var(--muted);line-height:1.4;white-space:nowrap;}
  .rm-label-status.working{color:#5BE9B0;border-color:rgba(91,233,176,.4);}
  .rm-label-status.amber{color:var(--amber);border-color:rgba(255,180,84,.4);}
}
/* S4: map-stat-bar replaced by Delivery chip overlay */
`;

// ── Sub-components ───────────────────────────────────────────────────────────

interface AgentScoutProps {
  agent: MapAgent;
  bodyRef: (el: HTMLElement | null) => void;
  rootRef: (el: HTMLElement | null) => void;
  /** Inline position used as static fallback (reduced-motion / pre-engine) */
  staticLeft: string;
  staticTop:  string;
  staticZ:    number;
  onActivate: () => void;
}

function AgentScout({
  agent, bodyRef, rootRef, staticLeft, staticTop, staticZ, onActivate,
}: AgentScoutProps) {
  const cfg = ROLE_CONFIG[agent.role];
  if (!cfg) return null;

  const stateClass = agent.active ? "working" : "idle";
  const relaxSrc   = `/status-map/sprites/relax-${cfg.poseIdx}.webp`;

  const bstatText = agent.active && agent.task
    ? agent.task.id
    : "พัก";

  const cleanTitle = agent.task
    ? agent.task.title
        .replace(/^[^·]*·\s*/, "")
        .replace(/\[[a-z-]+\]\s*/g, "")
        .trim()
    : "";

  // S7: reduced-motion status label text
  const rmStatusText = agent.active ? "กำลังทำ" : "พัก";
  const rmStatusCls = agent.active ? "rm-label-status working" : "rm-label-status";

  const ariaLabel = `${cfg.displayName} (${cfg.roleLabel}): ${agent.active ? `กำลังทำ ${bstatText}` : "พัก"}`;

  return (
    // S7: button so keyboard-triggerable + in natural tab order (You is rendered first)
    <button
      ref={rootRef as (el: HTMLButtonElement | null) => void}
      type="button"
      className={`scout ${stateClass}`}
      style={{
        left: staticLeft,
        top:  staticTop,
        zIndex: staticZ,
        // Reset button default styles; all visual styling is via .scout CSS
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        minWidth: 44,
        minHeight: 44,
        ["--aura" as string]:     cfg.color,
        ["--auraGlow" as string]: hexA(cfg.color, 0.7),
      }}
      aria-label={ariaLabel}
      onClick={onActivate}
      data-testid={`btn--map-agent-${agent.role}`}
    >
      <div className="glow" aria-hidden="true" />
      <div className="aura-ring" aria-hidden="true" />
      <div className="shadow" aria-hidden="true" />
      <div
        ref={bodyRef}
        className="body"
        style={{ backgroundImage: `url("${relaxSrc}")` }}
        aria-hidden="true"
      />
      {/* Always-in-tree badge for screen readers */}
      <div className="badge" aria-hidden="true">
        <span className="bdot" aria-hidden="true" />
        <span className="bname">{cfg.displayName}</span>
        <span className="bstat">{bstatText}</span>
      </div>

      {/* S7: Reduced-motion static label — always in accessibility tree (WCAG), visually shown only under reduce */}
      <div className="rm-label" aria-hidden="true">
        <span className="rm-label-name">{cfg.displayName}</span>
        <span className={rmStatusCls}>{rmStatusText}</span>
      </div>

      <div className="popover" role="tooltip">
        <div className="pop-name">{cfg.displayName}</div>
        <div
          className="pop-role"
          style={{
            color:       cfg.color,
            borderColor: hexA(cfg.color, 0.4),
            background:  hexA(cfg.color, 0.12),
          }}
        >
          {cfg.roleLabel}
        </div>
        {agent.active && agent.task ? (
          <div className="pop-task">
            <span className="pid">{agent.task.id}</span>{" "}
            {cleanTitle && `· ${cleanTitle}`}
          </div>
        ) : (
          <div className="pop-task" style={{ color: "var(--faint)" }}>
            ว่างอยู่ รอ task ใหม่
          </div>
        )}
        <div className="pop-hint">
          {agent.done} เสร็จแล้ว · {agent.activeCount} กำลังทำ · {agent.queued} รอคิว
        </div>
      </div>
    </button>
  );
}

interface YouScoutProps {
  gates: MapGate[];
  onOpenGates: () => void;
  /** CAM-161: current layout's You position (% of 1920×1080 canvas) */
  youPos: { x: number; y: number };
}

function YouScout({ gates, onOpenGates, youPos }: YouScoutProps) {
  const zIndex = Math.round(youPos.y * 12) + 5;
  const hasGates = gates.length > 0;

  // S7: reduced-motion You label
  const rmYouStatusText = hasGates ? `⚑${gates.length} รอคุณ` : "ปกติ";
  const rmYouStatusCls = hasGates ? "rm-label-status amber" : "rm-label-status";

  return (
    // S7: You is a button too — comes first in the DOM so tab order reaches You first
    <button
      type="button"
      className="scout you idle"
      style={{
        left:   `${youPos.x}%`,
        top:    `${youPos.y}%`,
        zIndex,
        // Reset button default styles
        background: "none",
        border: "none",
        padding: 0,
        cursor: hasGates ? "pointer" : "default",
        minWidth: 44,
        minHeight: 44,
        ["--aura" as string]:     "#FFB454",
        ["--auraGlow" as string]: "rgba(255,150,52,.7)",
      }}
      aria-label={hasGates ? `คุณ: มี ${gates.length} gate รอตรวจสอบ — กดเพื่อดูรายละเอียด` : "คุณ: ไม่มี gate รอ"}
      onClick={hasGates ? onOpenGates : undefined}
      data-testid="btn--map-agent-you"
    >
      <div className="glow" aria-hidden="true" />
      <div className="aura-ring" aria-hidden="true" />
      <div className="shadow" aria-hidden="true" />
      <div
        className="body"
        style={{ backgroundImage: `url("/status-map/sprites/you.webp")` }}
        aria-hidden="true"
      />
      <div className="badge" aria-hidden="true">
        <span className="bdot" aria-hidden="true" />
        <span className="bname">คุณ</span>
        <span className="bstat">{hasGates ? `${gates.length} gate` : "ปกติ"}</span>
      </div>

      {/* S7: Reduced-motion static label for You */}
      <div className="rm-label" aria-hidden="true">
        <span className="rm-label-name">คุณ</span>
        <span className={rmYouStatusCls}>{rmYouStatusText}</span>
      </div>

      {hasGates && (
        <span
          className="you-alert"
          aria-hidden="true"
        >
          <span className="adot" aria-hidden="true" />
          <span>&#9873;{gates.length} รอตรวจสอบ</span>
        </span>
      )}

      <div className="popover" role="tooltip">
        <div className="pop-name">คุณ</div>
        <div className="pop-hint" style={{ marginTop: 0 }}>
          {hasGates ? `${gates.length} gate รอการอนุมัติ — กดปุ่ม ⚑` : "ไม่มี gate รอ"}
        </div>
      </div>
    </button>
  );
}

// ── URL param helpers ─────────────────────────────────────────────────────────
// Mirror syncUrl idiom from dashboard-client.tsx — history.replaceState, no navigation.

function syncUrl(params: Record<string, string>): void {
  try {
    const u = new URL(location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    });
    history.replaceState(null, "", u);
  } catch {
    /* no-op in environments where location is unavailable */
  }
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  model: MapModel;
  token: string;
  /** Initial URL param values restored from searchParams by the server page. */
  initialScope: "all" | "epic";
  initialEpic: string;
  initialGroup: "feature" | "persona";
  initialEfilter: "all" | "prog" | "done" | "todo";
}

export interface SceneHandle {
  /** S6 hook: walk the agent at `role` to `toNode` (defaults to home station). */
  triggerWalk: (role: string, toNode?: string) => void;
}

export default function CampsiteScene({
  model,
  token,
  initialScope,
  initialEpic,
  initialGroup,
  initialEfilter,
}: Props) {
  // S6: liveModel is the authoritative data — starts from SSR initial value, updated
  // by the SSE reconcile. All overlay data reads from liveModel, never from the stale
  // `model` prop directly (which is frozen after first render in the dynamic component).
  const [liveModel, setLiveModel] = useState<MapModel>(model);
  const { projectPct, gates, agents, epicsActive, totalEpics, backlogItems, envLanes, epics } = liveModel;

  // S4: single-open overlay state — null = all closed
  const [openOverlay, setOpenOverlay] = useState<string | null>(null);

  // S5: scope state — restored from URL params on mount via initial props
  const [scope, setScope]         = useState<"all" | "epic">(initialScope);
  const [activeEpic, setActiveEpic] = useState<string>(initialEpic);
  const [group, setGroup]         = useState<"feature" | "persona">(initialGroup);
  const [efilter, setEfilter]     = useState<"all" | "prog" | "done" | "todo">(initialEfilter);

  // CAM-161: layout key — "wide" | "narrow". Changing this key causes YouScout and
  // homeStyle() to re-render with the new layout's coordinates. The engine's setHomes()
  // is called from the aspect-ratio listener to snap/redirect idle agents without remount.
  const [layoutKey, setLayoutKey] = useState<"wide" | "narrow">("wide");

  const openPanel = useCallback((id: string) => setOpenOverlay(id), []);
  const closePanel = useCallback(() => setOpenOverlay(null), []);

  // DOM refs — body and root element per agent, indexed by role.
  const bodyRefs = useRef<Record<string, HTMLElement | null>>({});
  const rootRefs = useRef<Record<string, HTMLElement | null>>({});

  // Exposed handle for S6 (parent can access via a forwarded ref if needed).
  const engineRef = useRef<EngineHandle | null>(null);

  // S7: track whether engine has started — used to re-apply scope after engine starts.
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    // Guard: only run in the browser (this is a "use client" component, but be safe).
    if (typeof window === "undefined") return;

    const mq    = window.matchMedia("(prefers-reduced-motion: reduce)");
    // CAM-163: Determine the active layout BEFORE building scouts so they are
    // placed at the correct art-measured position from the very first frame —
    // no compass-detour entrance walk and no visible snap on load.
    const arMqEarly = window.matchMedia("(min-aspect-ratio: 7/5)");
    const initialLayout = arMqEarly.matches ? LAYOUT_WIDE : LAYOUT_NARROW;
    // Sync the module-level var so homeStyle() is correct on first render.
    currentLayout = initialLayout;
    setLayoutKey(arMqEarly.matches ? "wide" : "narrow");

    // Build scout state for each agent — idle, at their layout home from the start.
    // CAM-163: passing homeCoords from the active layout so homeX/homeY are set
    // correctly before the engine starts. No entrance walk needed or produced.
    const roleKeys = Object.keys(ROLE_CONFIG);
    const scoutRefs: ScoutRef[] = roleKeys.map((role, idx) => {
      const cfg         = ROLE_CONFIG[role];
      const homeCoords  = initialLayout[role];
      const state       = buildScoutState(role, cfg.node, cfg.poseIdx, SPEED_VAR[idx] ?? 1.0, homeCoords);
      state.bodyEl = bodyRefs.current[role] ?? null;
      state.rootEl = rootRefs.current[role] ?? null;
      // Apply idle class and correct DOM position immediately so the first paint
      // matches the layout (no frame where agents sit at the wrong place).
      if (state.rootEl) {
        state.rootEl.classList.remove("entering", "walking-mode");
        state.rootEl.classList.add("idle");
        state.rootEl.style.left   = `${state.homeX}%`;
        state.rootEl.style.top    = `${state.homeY}%`;
        state.rootEl.style.zIndex = String(Math.round(state.homeY * 12) + 5);
      }
      return { state, path: [] };
    });

    let engine: EngineHandle | null = null;

    function startLoop() {
      if (engine) return; // already running
      engine = startEngine(scoutRefs);
      engineRef.current = engine;
      setEngineReady(true); // S7: notify scope effect that engine is ready
    }

    function stopLoop() {
      if (!engine) return;
      engine.stop();
      engine = null;
      engineRef.current = null;
      setEngineReady(false);
      // Restore all agents to their current layout home (homeX/homeY — not NODES).
      // CAM-163: use homeX/homeY so reduced-motion fallback respects the active layout.
      for (const ref of scoutRefs) {
        const s = ref.state;
        if (!s.rootEl) continue;
        s.rootEl.style.left   = `${s.homeX}%`;
        s.rootEl.style.top    = `${s.homeY}%`;
        s.rootEl.style.zIndex = String(Math.round(s.homeY * 12) + 5);
        // Restore class to idle (idle CSS sway is also off under reduced-motion)
        s.rootEl.classList.remove("entering", "walking-mode");
        s.rootEl.classList.add("idle");
      }
    }

    if (!mq.matches) {
      // Reduced-motion is NOT set → start the rAF loop (idle-sway + walk support).
      startLoop();
    }
    // If reduced-motion IS set, skip the loop entirely; agents sit at their
    // home-station positions (set via inline style on render) — S2 behavior.

    // Listen for OS setting changes (no page reload needed).
    function onMqChange(e: MediaQueryListEvent) {
      if (e.matches) {
        stopLoop();
      } else {
        // Reduced-motion was turned off → restart the loop.
        // CAM-163: rebuild scouts in idle mode at their current layout home,
        // not at the old compass entry arm-tip (no entrance walk on re-enable).
        for (const ref of scoutRefs) {
          const s    = ref.state;
          const cfg  = ROLE_CONFIG[s.role];
          if (!cfg) continue;
          const homeCoords = { x: s.homeX, y: s.homeY };
          const fresh = buildScoutState(s.role, cfg.node, cfg.poseIdx, s.speedVar, homeCoords);
          fresh.bodyEl = s.bodyEl;
          fresh.rootEl = s.rootEl;
          // Overwrite mutable fields in place so the array ref stays stable.
          Object.assign(s, fresh);
          ref.path = [];
          // Re-apply idle class + position after reset.
          if (s.rootEl) {
            s.rootEl.classList.remove("entering", "walking-mode");
            s.rootEl.classList.add("idle");
            s.rootEl.style.left   = `${s.homeX}%`;
            s.rootEl.style.top    = `${s.homeY}%`;
            s.rootEl.style.zIndex = String(Math.round(s.homeY * 12) + 5);
          }
        }
        startLoop();
      }
    }
    mq.addEventListener("change", onMqChange);

    // CAM-161 / CAM-163: aspect-ratio layout switcher — no remount.
    // (min-aspect-ratio: 7/5) = wide: use LAYOUT_WIDE.
    // Below threshold: use LAYOUT_NARROW so all 8 stay in the visible centre band.
    // arMqEarly is already declared above for the initial layout determination;
    // reuse it here (same MediaQueryList object) for the change listener.
    const arMq = arMqEarly;

    function applyLayout(isWide: boolean) {
      const layout = isWide ? LAYOUT_WIDE : LAYOUT_NARROW;
      // Update the module-level var so homeStyle() picks up the new table.
      currentLayout = layout;
      // Trigger React re-render so YouScout + homeStyle() re-calculate.
      setLayoutKey(isWide ? "wide" : "narrow");
      // Snap/redirect agents via engine (if running).
      // CAM-163: setHomes updates homeX/homeY on ALL scouts so enterIdle()
      // lands at the new layout position even for walking/entering agents.
      if (engine) {
        engine.setHomes(layout);
      } else {
        // Reduced-motion: directly write positions to DOM roots.
        for (const ref of scoutRefs) {
          const s    = ref.state;
          const home = layout[s.role];
          if (!home || !s.rootEl) continue;
          s.homeX = home.x;
          s.homeY = home.y;
          s.rootEl.style.left   = `${home.x}%`;
          s.rootEl.style.top    = `${home.y}%`;
          s.rootEl.style.zIndex = String(Math.round(home.y * 12) + 5);
        }
      }
    }

    // CAM-163: Initial layout was already applied when building scoutRefs above
    // (scouts start idle at initialLayout coords). We still call applyLayout here
    // so the engine's setHomes and the React layoutKey are in sync (the early
    // setLayoutKey call above already sets the React state, but calling applyLayout
    // again is harmless — idle-mode setHomes is a cheap DOM write).
    applyLayout(arMq.matches);

    function onArChange(e: MediaQueryListEvent) {
      applyLayout(e.matches);
    }
    arMq.addEventListener("change", onArChange);

    return () => {
      mq.removeEventListener("change", onMqChange);
      arMq.removeEventListener("change", onArChange);
      stopLoop();
    };
  }, []); // mount-once — engine is data-independent at this stage

  // S5 + S7: sync engine scope + URL params when scope/epic/group/efilter state changes,
  // OR when the engine first becomes ready (deep-link fix: ?scope=epic&epic=X applied on
  // the first frame after the engine has started, not lost during the engine startup gap).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return; // engine not yet started (e.g. reduced-motion, or pre-start)

    if (scope === "epic" && activeEpic) {
      // Determine which roles appear in the active epic's stories.
      // CAM-159 Epic bug fix: if roles resolves to empty (no [role] tags on stories),
      // fall back to "all" scope so the scene is never entirely dimmed/blank.
      const epicData = epics.find((e) => e.key === activeEpic);
      const roles = epicData
        ? [...new Set(epicData.stories.map((s) => s.role).filter(Boolean))]
        : [];
      if (roles.length > 0) {
        engine.setScope("epic", roles);
      } else {
        // Empty roles = unresolved; keep all agents gently visible (fall back to all).
        engine.setScope("all", []);
      }
    } else {
      engine.setScope("all", []);
    }

    // Persist URL state — compatible with /status param semantics for S6 deep-link.
    syncUrl({
      scope,
      epic:    scope === "epic" ? activeEpic : "",
      group,
      efilter: efilter !== "all" ? efilter : "",
    });
  // S7 fix: include engineReady so this effect re-runs when the engine starts,
  // ensuring ?scope=epic deep-link is applied even when it starts after this effect.
  }, [scope, activeEpic, group, efilter, epics, engineReady]);

  // S6: SSE reconcile — subscribe to /api/status/stream exactly like dashboard-client.tsx
  // (same backoff + 60s fallback interval). On a pulse event, fetch the new MapModel from
  // /status/map/data and merge it into the running engine without remounting.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    // 60s fallback poll: re-fetch MapModel data without router.refresh (which would remount).
    const FALLBACK_MS = 60_000;
    let fallbackId: ReturnType<typeof setInterval> | null = null;

    async function reconcile() {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/status/map/data${qs}`);
        if (!res.ok) return; // S7: non-ok response — keep last-known data, don't crash
        const next = (await res.json()) as MapModel;

        // Update React state — overlays will re-render with fresh data.
        setLiveModel(next);

        // Mutate the running engine for each agent: if active status or task changed,
        // trigger a walk so the character visually responds to the data change.
        const engine = engineRef.current;
        if (engine && !mq.matches) {
          for (const nextAgent of next.agents) {
            engine.triggerWalk(nextAgent.role);
          }
        }
        // Under reduced-motion: setLiveModel above updates overlay data statically; no walk.
      } catch {
        // S7: transient fetch error — keep last-known liveModel, don't crash or blank.
        // Next poll or SSE event will retry.
      }
    }

    fallbackId = setInterval(reconcile, FALLBACK_MS);

    // Real-time push via SSE — same pattern as dashboard-client.tsx.
    let es: EventSource | null = null;
    let guard = 0;

    function openStream() {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        es = new EventSource(`/api/status/stream${qs}`);
        es.onmessage = () => {
          guard = 0;
          void reconcile();
        };
        es.onerror = () => {
          if (es && es.readyState === EventSource.CLOSED) {
            es.close();
            es = null;
            if (guard++ < 5) setTimeout(openStream, 5000 * guard);
          }
        };
      } catch {
        /* SSE unsupported → the 60s fallback interval still reconciles */
      }
    }

    openStream();

    return () => {
      if (fallbackId !== null) clearInterval(fallbackId);
      es?.close();
    };
  }, [token]); // token is stable after mount; reconnect only if it changes

  // Scope change helpers passed to MapOverlays.
  const handleSelectEpic = useCallback((epicKey: string) => {
    setActiveEpic(epicKey);
    setScope("epic");
    setOpenOverlay(null); // close switcher after selecting
  }, []);

  const handleBackToOverview = useCallback(() => {
    setScope("all");
    setActiveEpic("");
    setOpenOverlay(null);
  }, []);

  // Static home position for each agent (used as initial style + reduced-motion fallback).
  // CAM-161: reads from currentLayout (LAYOUT_WIDE or LAYOUT_NARROW) rather than NODES,
  // so positions match the active art-measured layout table.
  function homeStyle(role: string): { left: string; top: string; zIndex: number } {
    const pos = currentLayout[role];
    if (!pos) return { left: "50%", top: "50%", zIndex: 10 };
    return {
      left:   `${pos.x}%`,
      top:    `${pos.y}%`,
      zIndex: Math.round(pos.y * 12) + 5,
    };
  }

  // Derive the active epic data for Epic overlays.
  // CAM-159 Epic bug fix: deep-link ?epic= may pass a key that isn't yet in epics
  // (e.g. race on first load). Fall back gracefully to null so the scene renders
  // and shows an empty state rather than a broken view.
  const activeEpicData = (activeEpic ? (epics.find((e) => e.key === activeEpic) ?? null) : null);

  // S7: aria-label summary for the scene container (role="img").
  const activeAgentCount = agents.filter((a) => a.active).length;
  const sceneAriaLabel = `แผนที่แคมป์: กำลังทำงาน ${activeAgentCount}/7 คน, รออนุมัติ ${gates.length} งาน, คืบหน้า ${projectPct}%`;

  // S6: Dashboard|Map toggle — build the dashboard URL from current map state,
  // mapping scope=all|epic ↔ tab=overview|epic; epic/group/efilter/token carry identically.
  const dashboardHref = (() => {
    const u = new URLSearchParams();
    u.set("tab", scope === "epic" ? "epic" : "overview");
    if (activeEpic) u.set("epic", activeEpic);
    if (group !== "feature") u.set("group", group);
    if (efilter !== "all") u.set("efilter", efilter);
    if (token) u.set("token", token);
    return `/status?${u.toString()}`;
  })();

  // CAM-161: derive active You position from the current layout.
  const youPos = layoutKey === "wide" ? YOU_POS_WIDE : YOU_POS_NARROW;

  return (
    <div className="map-wrap" data-testid="scene--status-map-campsite">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />

      {/* CAM-162: Responsive background image with srcset for hi-res screens.
          sizes="max(100vw, 177.78vh)" accounts for cover overscale on 16:9 —
          177.78vh = 100vh × (16/9) so the browser picks a large-enough source
          on both landscape 16:9 AND portrait screens.
          fetchpriority="high" keeps this as the LCP candidate.
          Not inside .map-viewport so it never scales with the character canvas. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="map-bg"
        src="/status-map/forest-1920.webp"
        srcSet="/status-map/forest-1280.webp 1280w, /status-map/forest-1920.webp 1920w, /status-map/forest-2560.webp 2560w, /status-map/forest-3840.webp 3840w"
        sizes="max(100vw, 177.78vh)"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
      />

      {/* Canvas dim overlay when a panel is open */}
      {openOverlay !== null && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 19,
            background: "rgba(6,11,26,.38)",
            pointerEvents: "none",
            transition: "opacity 200ms",
          }}
        />
      )}

      {/* CAM-161: Viewport grid — centres the fixed 1920×1080 design canvas. */}
      <div className="map-viewport">
        {/* S7: Scene root with role="img" + aria-label summary for screen readers */}
        <div
          className="map-stage"
          role="img"
          aria-label={sceneAriaLabel}
          style={{ opacity: openOverlay !== null ? 0.82 : 1, transition: "opacity 200ms" }}
          data-testid="stage--status-map"
        >
          {/* S7: tab order — You first (carries gates), then agents in role order */}
          <div
            className="scout-layer"
            role="list"
            aria-label="ทีม AI delivery agents บนแผนที่"
          >
            {/* You rendered first so it comes first in tab order.
                CAM-161: youPos switches between LAYOUT_WIDE/LAYOUT_NARROW. */}
            <YouScout
              gates={gates}
              onOpenGates={() => openPanel("gates")}
              youPos={youPos}
            />
            {agents.map((agent) => {
              const pos = homeStyle(agent.role);
              return (
                <AgentScout
                  key={agent.role}
                  agent={agent}
                  staticLeft={pos.left}
                  staticTop={pos.top}
                  staticZ={pos.zIndex}
                  rootRef={(el) => { rootRefs.current[agent.role] = el; }}
                  bodyRef={(el) => { bodyRefs.current[agent.role] = el; }}
                  onActivate={() => {
                    // Clicking an agent opens the Crew overlay panel so the user can
                    // see that agent's full details. This is the keyboard-triggerable
                    // action the spec requires (AC2).
                    openPanel("crew");
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* CAM-159: View toggle moved to top-center (pill, not corner). Real anchor links.
          position:fixed sibling — NOT inside .map-viewport so it never scales. */}
      <ViewToggle dashboardHref={dashboardHref} />

      {/* S4/S5 Overlays — scope-aware: Overview mode or Epic mode.
          position:fixed siblings — NOT inside .map-viewport so they never scale. */}
      <MapOverlays
        model={{
          projectPct,
          gates,
          agents,
          epicsActive,
          totalEpics,
          backlogItems,
          envLanes,
          epics,
        }}
        scope={scope}
        activeEpic={activeEpic}
        activeEpicData={activeEpicData}
        group={group}
        efilter={efilter}
        openOverlay={openOverlay}
        onOpen={openPanel}
        onClose={closePanel}
        onSelectEpic={handleSelectEpic}
        onBackToOverview={handleBackToOverview}
        onGroupChange={setGroup}
        onEfilterChange={setEfilter}
      />
    </div>
  );
}
