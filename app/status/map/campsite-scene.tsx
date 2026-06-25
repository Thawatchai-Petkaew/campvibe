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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { ApprovalCard, DeliveryCard, EnvPickerPanel, FilterSignposts, HUD_CSS, StatusBoard, StatusBoardHint, SummaryCard, TeamRoster, ViewToggle } from "./campsite-overlays";
import DeliveryGift, { DELIVERY_GIFT_CSS } from "./delivery-gift";
import { boardColumnOf } from "@/lib/status-derive";
import { payloadChanged } from "@/lib/status-map-model";
import {
  ADJ,
  buildScoutState,
  NODES,
  startEngine,
  type EngineHandle,
  type ScoutRef,
} from "./campsite-engine";
import { LOGO } from "../dashboard-assets";

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
  completedAt: string | null;
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
  "architect":          { node: "W0",  color: "#8FB8F0", poseIdx: 0, displayName: "Architect",  roleLabel: "วางแผนระบบ" },
  "ux-designer":        { node: "W28", color: "#B7A6FF", poseIdx: 1, displayName: "Designer",   roleLabel: "UX และวิชวล" },
  "backend-engineer":   { node: "W23", color: "#5BE9B0", poseIdx: 2, displayName: "Backend",    roleLabel: "API และบริการ" },
  "frontend-engineer":  { node: "W3",  color: "#5FD0DE", poseIdx: 3, displayName: "Frontend",   roleLabel: "หน้าแอป" },
  "devops-release":     { node: "W2",  color: "#BFE85B", poseIdx: 4, displayName: "DevOps",     roleLabel: "CI/CD" },
  "qa-engineer":        { node: "W1",  color: "#F39FD2", poseIdx: 5, displayName: "QA",         roleLabel: "ทดสอบและตรวจสอบ" },
  "security-reviewer":  { node: "W29", color: "#FF8A7A", poseIdx: 0, displayName: "Security",   roleLabel: "ความปลอดภัย" },
};

// Speed variation per role index — slight spread so agents don't arrive in a clump.
const SPEED_VAR = [0.95, 1.05, 1.00, 1.10, 0.90, 1.08, 0.92];

// ── CAM-164: Layout tables (% of fixed 1920×1080 design canvas) ─────────────
// Screenshot-tuned values, refined via ?grid=1 coordinate overlay.
//
// CAM-166: LAYOUT_WIDE — clean ring on the central dirt clearing around the
// campfire (canvas centre ~50,52). All 7 role agents arranged in an oval ring
// on open dirt; furniture (tents/tables/board) is backdrop only, not occupied.
// You stays at the dock (upper-left). Walk routes stay on open dirt.
export const LAYOUT_WIDE: Record<string, { x: number; y: number }> = {
  "architect":          { x: 50.1, y: 38.2 },  // W0
  "ux-designer":        { x: 60.2, y: 43.1 },  // W28
  "backend-engineer":   { x: 65.9, y: 60.2 },  // W23
  "frontend-engineer":  { x: 49.8, y: 75.8 },  // W3
  "devops-release":     { x: 37.3, y: 65.3 },  // W2
  "qa-engineer":        { x: 32.3, y: 50.4 },  // W1
  "security-reviewer":  { x: 43.8, y: 42.5 },  // W29
};
export const YOU_POS_WIDE = { x: 38, y: 31 };

// Single-layout model: the decoupled fixed play area uses ONE ring on every
// screen (narrow simply crops at the edges — no reflow). Narrow aliases the one
// layout so the existing matchMedia wiring is a no-op; that dual-layout machinery
// is fully retired (and tests reconciled) at the final quality gate.
export const LAYOUT_NARROW = LAYOUT_WIDE;
export const YOU_POS_NARROW = YOU_POS_WIDE;

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
  /* Container-relative (resolves against .map-stage, container-type:size) + clamped:
     characters scale with the box but never get unreadably small or huge. cqmin =
     % of the box's shorter side. Tune on local. */
  --scout-size: clamp(44px, 9cqmin, 96px);
  --amber: #FFB454;
  --amber-glow: rgba(255,150,52,.6);
  --text: #F1F6FB;
  --muted: rgba(223,234,245,.66);
  --faint: rgba(223,234,245,.42);
  --line: rgba(150,240,195,.12);
  --line-2: rgba(150,240,195,.16);
  --hi: rgba(255,255,255,.16);
  --glass: rgba(11,30,24,.42);
  --blur: saturate(195%) blur(30px);
  --mono: 'JetBrains Mono','Fira Mono','Consolas',monospace;
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
  /* Contain-fit play area (reference HTML technique: design/campvibe-campsite.html
     .stage). The box always FITS ENTIRELY within the viewport — min() of the
     width-bound and the height-bound — so the whole character ring scales DOWN to
     stay fully visible on any screen and is never cropped. Centred via translate.
     Decoupled from the full-screen cover background and the fixed HUD.
     container-type:size makes --scout-size's cqw resolve against this box, so the
     characters scale together with the box. PAD clears the top toggle + bottom dock. */
  position:absolute;
  top:50%;left:50%;
  transform:translate(-50%,-50%);
  --pad-x: 32px;
  --pad-y: 140px;
  /* Square FIT safe-zone (Phaser FIT + safeArea / reference .stage): the largest
     square that still fits the viewport (min of width- and height-bound), CLAMPED
     so it is never too small (phone) or too large (4K). The ring scales DOWN to
     stay fully visible on any screen, never cropped. */
  width: clamp(320px, min(calc(100vw - var(--pad-x)), calc(100vh - var(--pad-y))), 1100px);
  aspect-ratio: 1 / 1;
  container-type: size;
}
.scout-layer{position:absolute;inset:0;z-index:30}
/* Top row — NO bar background; transparent container, each item floats as its own chip. */
.hud-topbar{
  position:fixed;top:0;left:0;right:0;z-index:23;
  display:flex;align-items:center;gap:12px;
  padding:14px 18px;
  pointer-events:none;
}
.hud-topbar > *{pointer-events:auto}
/* logo wrapped in its own green-glass chip */
.hud-topbar-logo{
  display:inline-flex;align-items:center;flex:none;
  padding:7px 16px;
  border:1px solid rgba(150,240,195,.13);border-radius:999px;
  background:rgba(11,30,24,.50);
  backdrop-filter:saturate(195%) blur(26px);-webkit-backdrop-filter:saturate(195%) blur(26px);
  box-shadow:0 8px 24px rgba(0,0,0,.32),inset 0 1px 0 rgba(200,255,232,.12);
}
/* Left panel stack — summary + approval, stacked vertically */
.hud-left-panels{
  position:fixed;top:80px;left:18px;z-index:22;
  display:flex;flex-direction:column;gap:8px;
  pointer-events:none;
  max-height:calc(100svh - 100px);overflow:hidden;
}
.hud-left-panels > *{pointer-events:auto}
.hud-right-panels{position:fixed;top:80px;right:18px;z-index:22;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-height:calc(100svh - 100px);overflow:hidden}
.hud-right-panels > *{pointer-events:auto}
.hud-topbar-spacer{flex:1 1 auto}
.hud-topbar-right{display:flex;align-items:center;gap:10px;flex:none}
.cv-logo{height:26px;width:auto;display:block;filter:drop-shadow(0 1px 7px rgba(0,0,0,.4))}
/* Ambient sound toggle — glass button inside the top bar. */
.sound-toggle{
  width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;
  border:1px solid rgba(150,240,195,.13);border-radius:999px;
  background:rgba(11,30,24,.50);
  backdrop-filter:saturate(195%) blur(26px);-webkit-backdrop-filter:saturate(195%) blur(26px);
  box-shadow:0 8px 24px rgba(0,0,0,.32);
  color:rgba(223,234,245,.66);cursor:pointer;
  transition:background 120ms,color 120ms,border-color 120ms;
}
.sound-toggle:hover{background:rgba(255,255,255,.07);color:rgba(223,234,245,.95)}
.sound-toggle:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px}
.sound-toggle.on{color:#5BE9B0;border-color:rgba(91,233,176,.4);background:rgba(91,233,176,.12)}
.sound-toggle svg{width:20px;height:20px;display:block}
/* Idle "waiting for work" speech bubble — engine toggles .show; text set via JS. */
.speech{
  position:absolute;left:50%;bottom:calc(var(--bh) + 56px);
  transform:translateX(-50%) translateY(6px) scale(.88);
  max-width:160px;white-space:nowrap;
  padding:5px 11px;border-radius:13px;
  font-size:10.5px;font-weight:600;line-height:1;color:var(--text);
  background:rgba(18,46,37,.92);
  box-shadow:0 8px 22px rgba(0,0,0,.42);
  opacity:0;pointer-events:none;z-index:7;
  transition:opacity .26s ease;
}
.speech::after{
  content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:6px solid transparent;border-top-color:rgba(18,46,37,.92);
}
.speech.show{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}
@media (prefers-reduced-motion: no-preference){
  .speech.show{animation:speechIn .3s cubic-bezier(.34,1.56,.64,1) both, speechFloat 2.8s ease-in-out .3s infinite}
}
@keyframes speechIn{from{opacity:0;transform:translateX(-50%) translateY(7px) scale(.86)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes speechFloat{0%,100%{transform:translateX(-50%) translateY(0) scale(1)}50%{transform:translateX(-50%) translateY(-3px) scale(1)}}
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
  .scout.working .badge{animation:badgeGlow 1.3s ease-in-out infinite}
  .scout.working .badge .bdot{animation:pdot2 1.6s ease-in-out infinite}
  .you-alert{animation:alertPulse 1.9s ease-in-out infinite}
}
.badge{
  position:absolute;left:50%;bottom:calc(var(--bh) + 4px);transform:translateX(-50%);
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;z-index:7;
  background:rgba(11,30,24,.46);backdrop-filter:saturate(195%) blur(26px);-webkit-backdrop-filter:saturate(195%) blur(26px);
  border:1px solid rgba(150,240,195,.13);border-radius:999px;padding:4px 9px;
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
  display:inline-flex;align-items:center;gap:7px;white-space:nowrap;z-index:9;cursor:pointer;
  font-size:13px;font-weight:700;color:#241402;
  background:linear-gradient(180deg,#ffcf86,#ff9d3c);border:1.5px solid rgba(255,220,130,.75);
  border-radius:13px;padding:7px 14px;
  box-shadow:0 0 0 1.5px rgba(255,180,84,.55),0 10px 28px -4px rgba(255,150,52,.7);
  font-family:inherit;min-height:44px;min-width:44px;
}
.you-alert:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
.you-alert svg{width:15px;height:15px;flex:none}
.you-alert::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#ff9d3c}
.popover{
  position:absolute;left:50%;bottom:calc(var(--bh) + 38px);transform:translateX(-50%) translateY(6px);
  width:194px;opacity:0;pointer-events:none;transition:opacity .16s,transform .16s;z-index:12;
  background:rgba(10,28,20,.80);backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);
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

/* ── CAM-181: Firefly layer ──────────────────────────────────────────────────
   Decorative ambient layer: 12 fireflies blink out of sync across the
   tree-line and clearing edges.

   z-index 35 places the layer in front of .scout-layer (z-index 30) —
   pointer-events:none so all clicks pass through to agents underneath.
   aria-hidden on both the layer and each dot (purely decorative).

   Keep-out zones (no firefly placed there):
     - Campfire / gift zone: x 43–57 %, y 46–60 %
     - HUD corner guard bands: y 0–7 % (topbar row)

   Reduced-motion:
     Default (no animation fallback): static faint dots at opacity:0.3
     @media (prefers-reduced-motion: no-preference): full twinkle animation
*/
.firefly-layer{
  position:absolute;inset:0;pointer-events:none;z-index:35;overflow:hidden;
}
.firefly{
  position:absolute;
  width:3px;height:3px;border-radius:9999px;
  background:#FFB454;
  box-shadow:0 0 6px 1px rgba(255,180,84,.7);
  pointer-events:none;
  /* Default: faint static dot (prefers-reduced-motion:reduce fallback) */
  opacity:0.3;
}
@media (prefers-reduced-motion: no-preference){
  @keyframes fireflyTwinkle{
    0%,100%{opacity:0}
    50%{opacity:0.9}
  }
  .firefly{
    opacity:0;
    animation:fireflyTwinkle var(--ff-dur,3.5s) ease-in-out var(--ff-delay,0s) infinite;
  }
}`;

// ── Sub-components ───────────────────────────────────────────────────────────

interface AgentScoutProps {
  agent: MapAgent;
  bodyRef: (el: HTMLElement | null) => void;
  rootRef: (el: HTMLElement | null) => void;
  speechRef: (el: HTMLElement | null) => void;
  onActivate: () => void;
}

function AgentScoutInner({
  agent, bodyRef, rootRef, speechRef, onActivate,
}: AgentScoutProps) {
  const cfg = ROLE_CONFIG[agent.role];
  if (!cfg) return null;

  const stateClass = agent.active ? "working" : "idle";

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
        // Position is engine-owned (imperative per-frame via place()). Do NOT set
        // left/top/zIndex here — React re-applying them on every feed update would
        // warp a walking agent back to home for one paint frame (flicker).
        // The initial position is seeded imperatively in the rootRef callback at the
        // render site so there is no unpositioned flash before the engine effect runs.

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
      <div ref={bodyRef} className="body" aria-hidden="true" />
      {/* Idle "waiting for work" speech bubble — the engine sets the text + .show class. */}
      <div ref={speechRef} className="speech" aria-hidden="true" />
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

// The agent position is engine-owned (imperative per-frame DOM writes). Memoise so a
// status-feed re-render (every SSE pulse / 60s poll) does NOT re-apply the static home
// position and warp a walking agent. Re-render only when its displayed data changes.
const AgentScout = memo(AgentScoutInner, (prev, next) =>
  prev.agent.active === next.agent.active &&
  prev.agent.done === next.agent.done &&
  prev.agent.activeCount === next.agent.activeCount &&
  prev.agent.queued === next.agent.queued &&
  prev.agent.task?.id === next.agent.task?.id &&
  prev.agent.task?.title === next.agent.task?.title,
);

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
          <BellRing size={15} strokeWidth={2} aria-hidden="true" />
          <span>{gates.length} รอตรวจสอบ</span>
        </span>
      )}

      <div className="popover" role="tooltip">
        <div className="pop-name">คุณ</div>
        <div className="pop-hint" style={{ marginTop: 0 }}>
          {hasGates ? `${gates.length} gate รอการอนุมัติ — กดเพื่อดูรายละเอียด` : "ไม่มี gate รอ"}
        </div>
      </div>
    </button>
  );
}

// ── URL param helpers ─────────────────────────────────────────────────────────
// Mirror syncUrl idiom from dashboard-client.tsx — history.replaceState, no navigation.

// Filter persistence (cookie) — restored on the next visit so the view is remembered.
const FILTER_COOKIE = "campvibe.map.filter";
type FilterCookie = { persona?: string; feature?: string; epic?: string; efilter?: string; summaryCollapsed?: boolean; approvalCollapsed?: boolean; deliveryCollapsed?: boolean; boardCollapsed?: boolean; teamCollapsed?: boolean };
function readFilterCookie(): FilterCookie {
  if (typeof document === "undefined") return {};
  try {
    const m = document.cookie.match(/(?:^|;\s*)campvibe\.map\.filter=([^;]+)/);
    return m ? (JSON.parse(decodeURIComponent(m[1])) as FilterCookie) : {};
  } catch {
    return {};
  }
}
function writeFilterCookie(v: FilterCookie): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${FILTER_COOKIE}=${encodeURIComponent(JSON.stringify(v))};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
  } catch {
    /* ignore */
  }
}

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

// ── Debug coordinate grid ────────────────────────────────────────────────────
// CAM-164: Dev tool rendered inside .scout-layer when ?grid=1 is present.
// Renders vertical + horizontal lines every 10% with numeric labels on the top
// and left edges. Coordinates match character % positions exactly (1920×1080 canvas).
// pointer-events:none + z-index below HUD + absent in production (prop=false).

// Builds copy-pasteable NODES + ADJ source from picked waypoints. Two waypoints are
// auto-connected when within `radius` (% of the play area) of each other.
function genWaypointCode(points: Array<{ x: number; y: number }>, radius: number): string {
  if (points.length === 0) return "// คลิกบนลานดิน/ทางเดินเพื่อวาง waypoint";
  const adj: Record<number, number[]> = {};
  points.forEach((_, i) => (adj[i] = []));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) <= radius) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }
  const nodes = points.map((p, i) => `  W${i}: { x: ${p.x}, y: ${p.y} },`).join("\n");
  const edges = points.map((_, i) => `  W${i}: [${adj[i].map((j) => `"W${j}"`).join(", ")}],`).join("\n");
  return `export const NODES = {\n${nodes}\n};\n\nexport const ADJ = {\n${edges}\n};`;
}

// Dev editor (?pick=1): click the clearing to drop walk-graph waypoints on the REAL
// scene (the only place the decoupled character layer is accurately positioned).
// Auto-connects nearby points and prints NODES/ADJ to copy. Click a point to remove it.
function WaypointPicker() {
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const RADIUS = 26;
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) <= RADIUS) edges.push([i, j]);
    }
  }
  const btn = {
    background: "rgba(255,255,255,0.08)", color: "#dfeaf5", border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 6, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "monospace",
  } as const;
  return (
    <>
      <div
        aria-hidden="true"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
          const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
          setPoints((prev) => {
            const hit = prev.findIndex((p) => Math.hypot(p.x - x, p.y - y) < 2.5);
            return hit >= 0 ? prev.filter((_, i) => i !== hit) : [...prev, { x, y }];
          });
        }}
        style={{ position: "absolute", inset: 0, zIndex: 2000, cursor: "crosshair" }}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2001, pointerEvents: "none", overflow: "visible" }}
      >
        {edges.map(([a, b], i) => (
          <line key={i} x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y} stroke="rgba(143,184,240,0.65)" strokeWidth={0.3} />
        ))}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={1.4} fill="#8FB8F0" />
            <text x={p.x} y={p.y - 2.2} textAnchor="middle" fontSize={2.6} fontWeight={700} fontFamily="monospace" fill="#d6e6ff">{i}</text>
          </g>
        ))}
      </svg>
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2002, width: 320, background: "rgba(12,20,34,0.95)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 12, padding: "11px 13px", color: "#dfeaf5", fontFamily: "monospace", fontSize: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <strong style={{ fontSize: 12 }}>waypoint picker · {points.length}</strong>
          <span>
            <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} style={btn}>undo</button>
            <button type="button" onClick={() => setPoints([])} style={{ ...btn, marginLeft: 6 }}>clear</button>
          </span>
        </div>
        <div style={{ opacity: 0.65, marginBottom: 8, lineHeight: 1.45 }}>
          คลิกลานดิน/ทางเดิน = วางจุด · คลิกจุดเดิม = ลบ · ต่อเส้นอัตโนมัติเมื่อใกล้ ≤{RADIUS}% · ก๊อปโค้ดส่งผม
        </div>
        <textarea
          readOnly
          value={genWaypointCode(points, RADIUS)}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "100%", height: 168, background: "rgba(0,0,0,0.34)", color: "#a8e8d0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: 8, fontSize: 10, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
        />
      </div>
    </>
  );
}

// Dev overlay (?routes=1): draws the walk graph — waypoints + edges + the central
// campfire keep-out — in the same % space as the characters, so the route network is
// visible for verification/tuning. Pairs with ?wander=1 to watch agents traverse it.
function DebugRoutes() {
  const edges: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const [a, nbrs] of Object.entries(ADJ)) {
    for (const b of nbrs) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
  }
  return (
    <svg
      data-testid="debug--map-routes"
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 21, pointerEvents: "none", overflow: "visible" }}
    >
      {/* campfire keep-out (no route should cross it) */}
      <circle cx={50} cy={54} r={7} fill="rgba(255,140,40,0.10)" stroke="rgba(255,150,60,0.75)" strokeWidth={0.3} strokeDasharray="1.4 1" />
      {edges.map(([a, b]) => {
        const p = NODES[a];
        const q = NODES[b];
        if (!p || !q) return null;
        return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="rgba(91,233,176,0.55)" strokeWidth={0.3} />;
      })}
      {Object.entries(NODES).map(([k, c]) => (
        <g key={k}>
          <circle cx={c.x} cy={c.y} r={1.2} fill="#5BE9B0" />
          <text x={c.x} y={c.y - 2} textAnchor="middle" fontSize={2.4} fontFamily="monospace" fontWeight={700} fill="#aeffdd">{k}</text>
        </g>
      ))}
    </svg>
  );
}

function DebugGrid() {
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  return (
    <div
      data-testid="debug--map-grid"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Vertical lines + top-edge labels */}
      {ticks.map((v) => (
        <div key={`v${v}`}>
          <div
            style={{
              position: "absolute",
              left: `${v}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: "rgba(255,255,255,0.25)",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: `${v}%`,
              top: 2,
              transform: "translateX(-50%)",
              fontSize: 10,
              fontFamily: "monospace",
              color: "rgba(255,255,180,0.85)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {v}
          </span>
        </div>
      ))}
      {/* Horizontal lines + left-edge labels */}
      {ticks.map((v) => (
        <div key={`h${v}`}>
          <div
            style={{
              position: "absolute",
              top: `${v}%`,
              left: 0,
              right: 0,
              height: 1,
              background: "rgba(255,255,255,0.25)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: `${v}%`,
              left: 2,
              transform: "translateY(-50%)",
              fontSize: 10,
              fontFamily: "monospace",
              color: "rgba(255,255,180,0.85)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Ambient sound toggle ─────────────────────────────────────────────────────
// A small glass button (top-right) that loops the campfire/wildlife ambience.
// Browser autoplay policy: audio with sound only starts inside a user gesture, so
// the default is OFF and the toggle click IS the gesture. The preference persists
// in localStorage; on reload, if it was ON we try to resume and otherwise start on
// the next interaction (no surprise audio, never throws).
const SOUND_KEY = "campvibe.map.sound";
const SOUND_SRC = "/status-map/campfire-wildlife-ambience.mp3";
const SOUND_VOL = 0.35;

function SoundToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(SOUND_KEY) === "on";
    } catch {
      return false;
    }
  });

  // On mount, if sound was left ON, try to resume it. Autoplay may be blocked until a
  // user gesture, so fall back to starting on the next interaction.
  useEffect(() => {
    if (!on) return;
    const a = audioRef.current;
    if (!a) return;
    a.volume = SOUND_VOL;
    a.play().catch(() => {
      const resume = () => a.play().catch(() => undefined);
      window.addEventListener("pointerdown", resume, { once: true });
      window.addEventListener("keydown", resume, { once: true });
    });
    // run once on mount; `on`'s initial value is what we restored from storage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        /* localStorage unavailable */
      }
      if (next) {
        a.volume = SOUND_VOL;
        a.play().catch(() => undefined);
      } else {
        a.pause();
      }
      return next;
    });
  }, []);

  const label = on ? "ปิดเสียงบรรยากาศ" : "เปิดเสียงบรรยากาศ";
  return (
    <>
      <audio ref={audioRef} src={SOUND_SRC} loop preload="none" aria-hidden="true" />
      <button
        type="button"
        className={on ? "sound-toggle on" : "sound-toggle"}
        onClick={toggle}
        aria-pressed={on}
        aria-label={label}
        title={label}
        data-testid="btn--map-sound-toggle"
      >
        {on ? (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
            <path
              d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
            <path
              d="m16 9 5 6M21 9l-5 6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </>
  );
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
  /** CAM-164 dev tool: render a % coordinate grid overlay when true (?grid=1). */
  debugGrid?: boolean;
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
  debugGrid = false,
}: Props) {
  // S6: liveModel is the authoritative data — starts from SSR initial value, updated
  // by the SSE reconcile. All overlay data reads from liveModel, never from the stale
  // `model` prop directly (which is frozen after first render in the dynamic component).
  const [liveModel, setLiveModel] = useState<MapModel>(model);
  const { projectPct, gates, agents, epicsActive, totalEpics, backlogItems, envLanes, epics } = liveModel;

  // S5: scope state — restored from URL params on mount via initial props
  const [scope, setScope]         = useState<"all" | "epic">(() => (initialEpic || readFilterCookie().epic) ? "epic" : initialScope);
  const [activeEpic, setActiveEpic] = useState<string>(() => initialEpic || readFilterCookie().epic || "");
  const [group, setGroup]         = useState<"feature" | "persona">(initialGroup);
  const [efilter, setEfilter]     = useState<"all" | "prog" | "done" | "todo">(() => {
    if (initialEfilter !== "all") return initialEfilter;
    const c = readFilterCookie().efilter;
    return c === "prog" || c === "done" || c === "todo" ? c : "all";
  });
  const [persona, setPersona]     = useState<string>(() => readFilterCookie().persona ?? "");
  const [feature, setFeature]     = useState<string>(() => readFilterCookie().feature ?? "");

  // Cascading filter options (Persona → Feature → Epic), narrowed by the current selection.
  const filterOpts = useMemo(() => {
    const personas = [...new Set(epics.map((e) => e.persona).filter(Boolean))].sort();
    const featPool = persona ? epics.filter((e) => e.persona === persona) : epics;
    const features = [...new Set(featPool.map((e) => e.feature).filter(Boolean))].sort();
    const epicList = featPool
      .filter((e) => !feature || e.feature === feature)
      .map((e) => ({ key: e.key, label: e.label }));
    return { personas, features, epics: epicList };
  }, [epics, persona, feature]);

  const [summaryCollapsed, setSummaryCollapsed] = useState<boolean>(() => readFilterCookie().summaryCollapsed ?? false);
  const [deliveryCollapsed, setDeliveryCollapsed] = useState<boolean>(() => readFilterCookie().deliveryCollapsed ?? false);
  const [approvalCollapsed, setApprovalCollapsed] = useState<boolean>(() => readFilterCookie().approvalCollapsed ?? false);
  const [boardCollapsed, setBoardCollapsed] = useState<boolean>(() => readFilterCookie().boardCollapsed ?? false);
  const [teamCollapsed, setTeamCollapsed] = useState<boolean>(() => readFilterCookie().teamCollapsed ?? false);
  const [envPickerOpen, setEnvPickerOpen] = useState(false);
  const envPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  // CAM-176 — no-op reconcile guard: tracks the last serialized payload so we can skip
  // setLiveModel when the server returns identical data. Init to the SSR model's JSON so
  // the very first poll of an unchanged board is already a no-op.
  const lastPayloadRef = useRef<string>(JSON.stringify(model));

  // Summary stats — filtered by the current persona/feature/epic selection.
  const summaryStats = useMemo(() => {
    let filtered = epics;
    if (scope === "epic" && activeEpic) filtered = epics.filter((e) => e.key === activeEpic);
    else if (feature) filtered = epics.filter((e) => e.feature === feature);
    else if (persona) filtered = epics.filter((e) => e.persona === persona);

    const allStories = filtered.flatMap((e) => e.stories);
    const storyDone = allStories.filter((s) => s.statusType === "completed").length;
    const storyTotal = allStories.length;
    const backlog = allStories.filter((s) => s.status === "Backlog").length;
    const epicDone = filtered.filter((e) => e.bucket === "done").length;
    const epicTotal = filtered.length;
    const pct = storyTotal ? Math.round((storyDone / storyTotal) * 100) : projectPct;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayStories = allStories.filter((s) => s.completedAt?.startsWith(todayStr)).length;
    const todayEpics = filtered.filter(
      (e) => e.bucket === "done" && e.stories.some((s) => s.completedAt?.startsWith(todayStr))
    ).length;

    const sparkline: number[] = Array(7).fill(0);
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    for (const s of allStories) {
      if (!s.completedAt) continue;
      const daysAgo = Math.floor((Date.now() - new Date(s.completedAt).getTime()) / 86400000);
      if (daysAgo >= 0 && daysAgo < 7) sparkline[6 - daysAgo]++;
    }
    const weekStories = sparkline.reduce((a, b) => a + b, 0);
    const weekEpics = filtered.filter(
      (e) => e.stories.some((s) => s.completedAt && new Date(s.completedAt).getTime() >= sevenDaysAgo)
    ).length;

    const statusCounts: Record<string, number> = {};
    for (const s of allStories) {
      const col = boardColumnOf(s);
      statusCounts[col] = (statusCounts[col] ?? 0) + 1;
    }

    return { pct, epicDone, epicTotal, storyDone, storyTotal, backlog, todayStories, todayEpics, weekStories, weekEpics, sparkline, statusCounts };
  }, [epics, persona, feature, scope, activeEpic, projectPct]);

  const showBoard = !!feature || (scope === "epic" && !!activeEpic);
  const boardStories = useMemo(() => {
    if (!showBoard) return [];
    let filtered = epics;
    if (scope === "epic" && activeEpic) filtered = epics.filter((e) => e.key === activeEpic);
    else if (feature) filtered = epics.filter((e) => e.feature === feature);
    return filtered.flatMap((e) => e.stories);
  }, [epics, feature, scope, activeEpic, showBoard]);

  const boardLabel = useMemo(() => {
    if (scope === "epic" && activeEpic) return epics.find((e) => e.key === activeEpic)?.label ?? activeEpic;
    if (feature) return feature;
    return "";
  }, [scope, activeEpic, feature, epics]);

  // One handler for the 3-level filter; choosing a higher level resets the lower ones.
  const onFilterChange = useCallback((level: "persona" | "feature" | "epic", value: string) => {
    if (level === "persona") { setPersona(value); setFeature(""); setActiveEpic(""); setScope("all"); }
    else if (level === "feature") { setFeature(value); setActiveEpic(""); setScope("all"); }
    else { setActiveEpic(value); setScope(value ? "epic" : "all"); }
  }, []);

  // Persist the filter + panel collapse states to a cookie so they are restored on the next visit.
  useEffect(() => {
    writeFilterCookie({ persona, feature, epic: scope === "epic" ? activeEpic : "", efilter, summaryCollapsed, deliveryCollapsed, approvalCollapsed, boardCollapsed, teamCollapsed });
  }, [persona, feature, scope, activeEpic, efilter, summaryCollapsed, deliveryCollapsed, approvalCollapsed, boardCollapsed, teamCollapsed]);

  // CAM-164 portrait fix: derive initial layoutKey from the actual viewport on first
  // client render (scene is ssr:false so window is always available here). This
  // prevents YouScout from rendering at YOU_POS_WIDE on portrait before the
  // useEffect fires — the initial render is already at the correct layout.
  // The module-level currentLayout is also pre-seeded here so homeStyle() is correct
  // on the very first render without waiting for the effect.
  const [layoutKey, setLayoutKey] = useState<"wide" | "narrow">(() => {
    if (typeof window === "undefined") return "wide"; // SSR guard (never reached — ssr:false)
    const isWide = window.matchMedia("(min-aspect-ratio: 7/5)").matches;
    currentLayout = isWide ? LAYOUT_WIDE : LAYOUT_NARROW;
    return isWide ? "wide" : "narrow";
  });


  // DOM refs — body and root element per agent, indexed by role.
  const bodyRefs = useRef<Record<string, HTMLElement | null>>({});
  const rootRefs = useRef<Record<string, HTMLElement | null>>({});
  const speechRefs = useRef<Record<string, HTMLElement | null>>({});

  // Exposed handle for S6 (parent can access via a forwarded ref if needed).
  const engineRef = useRef<EngineHandle | null>(null);

  // S7: track whether engine has started — used to re-apply scope after engine starts.
  const [engineReady, setEngineReady] = useState(false);

  // Dev: ?routes=1 overlays the walk graph (waypoints + edges + campfire keep-out).
  const debugRoutes =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("routes") === "1";

  // Dev: ?pick=1 turns on the waypoint editor — click the clearing to lay down the
  // walk graph on the real scene, then copy the generated NODES/ADJ for me to wire in.
  const debugPick =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("pick") === "1";

  // CAM-176 — stable activity signature: encode only the fields that actually drive
  // wander/rest (role, active flag, activeCount). A reconcile that changes unrelated
  // fields (gate count, title, backlog) produces a new `agents` array ref but an
  // IDENTICAL activeKey → the effect below does NOT re-run → no mid-walk disruption.
  // A genuine activity change (agent starts/stops work) changes the key → effect fires
  // → setActivity is called exactly once → intended behaviour preserved.
  const activeKey = useMemo(
    () => agents.map((a) => `${a.role}:${a.active ? 1 : 0}:${a.activeCount}`).join("|"),
    [agents],
  );

  // Drive wander/rest from live data: active roles wander, idle roles rest.
  // Runs once the engine is ready and again whenever an agent's activity changes.
  // Dep is `activeKey` (stable string) not `agents` (new ref on every reconcile) so a
  // data update that does not change activity does NOT interrupt a walking character.
  // Dev aid: ?wander=1 forces everyone to wander (the wander behaviour is otherwise
  // hard to see when the live data has no active work).
  useEffect(() => {
    if (!engineReady) return;
    const forceWander =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("wander") === "1";
    const activeByRole: Record<string, boolean> = {};
    for (const a of agents) activeByRole[a.role] = forceWander || a.active;
    engineRef.current?.setActivity(activeByRole);
  }, [engineReady, activeKey]); // activeKey, not agents — guards mid-walk resets (CAM-176)

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
      state.speechEl = speechRefs.current[role] ?? null;
      // The engine owns the body sprite from here on; set the initial relax pose now
      // so the character is visible on the first paint (React no longer sets it).
      if (state.bodyEl) {
        const relaxSrc = `/status-map/sprites/relax-${cfg.poseIdx}.webp`;
        state.bodyEl.style.backgroundImage = `url("${relaxSrc}")`;
        state.lastSrc = relaxSrc;
      }
      // Position immediately so the first paint matches the layout. The idle/working
      // class is owned by React (className); the engine only toggles walking-mode.
      if (state.rootEl) {
        state.rootEl.classList.remove("walking-mode");
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
        // React owns idle/working; the engine only toggles walking-mode.
        s.rootEl.classList.remove("walking-mode");
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
  // (same backoff + 15s fallback interval). On a pulse event, fetch the new MapModel from
  // /status/map/data and merge it into the running engine without remounting.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 15s fallback poll: re-fetch MapModel data without router.refresh (which would remount).
    // CAM-175: reduced from 60s to ≤15s to meet the freshness AC.
    const FALLBACK_MS = 15_000;
    let fallbackId: ReturnType<typeof setInterval> | null = null;

    async function reconcile() {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/status/map/data${qs}`);
        if (!res.ok) return; // S7: non-ok response — keep last-known data, don't crash
        const text = await res.text();
        // CAM-176 — no-op guard: skip re-render when payload is byte-identical to the
        // last seen value. The /status/map/data route serializes ABSOLUTE timestamps from
        // Linear (startedAt / completedAt), so an unchanged board produces an identical
        // JSON string across polls — the text compare is a reliable no-change signal.
        // A real change → text differs → setLiveModel → one update (expected, not flicker).
        if (!payloadChanged(lastPayloadRef.current, text)) return;
        lastPayloadRef.current = text;

        // Update React state — overlays re-render, and the setActivity effect (keyed on
        // the agents' active flags) drives wander/rest. No per-pulse triggerWalk loop:
        // it yanked active wanderers home on every pulse (breaking continuous, random
        // wandering) and could redirect a mid-walk agent on a path across the campfire.
        setLiveModel(JSON.parse(text) as MapModel);
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
        /* SSE unsupported → the 15s fallback interval still reconciles */
      }
    }

    openStream();

    return () => {
      if (fallbackId !== null) clearInterval(fallbackId);
      es?.close();
    };
  }, [token]); // token is stable after mount; reconnect only if it changes

  const handleSelectEpic = useCallback((epicKey: string) => {
    setActiveEpic(epicKey);
    setScope("epic");
  }, []);

  const handleBackToOverview = useCallback(() => {
    setScope("all");
    setActiveEpic("");
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
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS + HUD_CSS + DELIVERY_GIFT_CSS }} />

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

      {/* CAM-161: Viewport grid — centres the fixed 1920×1080 design canvas. */}
      <div className="map-viewport">
        {/* S7: Scene root with role="img" + aria-label summary for screen readers */}
        <div
          className="map-stage"
          role="img"
          aria-label={sceneAriaLabel}
          data-testid="stage--status-map"
        >
          {/* S7: tab order — You first (carries gates), then agents in role order */}
          <div
            className="scout-layer"
            role="list"
            aria-label="ทีม AI delivery agents บนแผนที่"
          >
            {/* CAM-164 dev tool: % coordinate grid — only when ?grid=1 is present.
                Renders inside .scout-layer so its % coords match character positions exactly.
                pointer-events:none; below HUD; absent in normal view. */}
            {debugGrid && <DebugGrid />}
            {debugRoutes && <DebugRoutes />}
            {debugPick && <WaypointPicker />}

            {/* CAM-171: Gift indicator — above campfire (left:50% top:44%), pointer-events wrapper */}
            <DeliveryGift epics={epics} />

            {/* You rendered first so it comes first in tab order.
                CAM-161: youPos switches between LAYOUT_WIDE/LAYOUT_NARROW. */}
            <YouScout
              gates={gates}
              onOpenGates={() => setApprovalCollapsed(false)}
              youPos={youPos}
            />
            {agents.map((agent) => {
              const pos = homeStyle(agent.role);
              return (
                <AgentScout
                  key={agent.role}
                  agent={agent}
                  rootRef={(el) => {
                    rootRefs.current[agent.role] = el;
                    // Seed the first-paint position imperatively so there is no
                    // unpositioned flash before the engine effect runs. The engine
                    // owns position after mount; React never writes left/top/zIndex
                    // again (they are not in the component's style prop).
                    if (el) {
                      el.style.left   = pos.left;
                      el.style.top    = pos.top;
                      el.style.zIndex = String(pos.zIndex);
                    }
                  }}
                  bodyRef={(el) => { bodyRefs.current[agent.role] = el; }}
                  speechRef={(el) => { speechRefs.current[agent.role] = el; }}
                  onActivate={() => setTeamCollapsed(false)}
                />
              );
            })}
          </div>
          {/* CAM-181: Firefly decorative layer — 12 amber dots blink out of sync.
              z-index 35 = in front of .scout-layer (z-index 30), click-through.
              Keep-out: campfire/gift zone (x 43–57 %, y 46–60 %),
              topbar row (y 0–7 %), right-panel corner (x > 82 %, y < 18 %),
              left-panel corner (x < 10 %, y < 18 %). */}
          <div
            className="firefly-layer"
            aria-hidden="true"
            data-testid="layer--map-fireflies"
          >
            {/* ff-1: upper-left tree area */}
            <span className="firefly" aria-hidden="true" style={{ left: "14%", top: "12%", ["--ff-dur" as string]: "3.2s", ["--ff-delay" as string]: "0s" }} />
            {/* ff-2: left mid-forest */}
            <span className="firefly" aria-hidden="true" style={{ left: "24%", top: "24%", ["--ff-dur" as string]: "4.1s", ["--ff-delay" as string]: "0.7s" }} />
            {/* ff-3: upper-right tree canopy */}
            <span className="firefly" aria-hidden="true" style={{ left: "68%", top: "9%", ["--ff-dur" as string]: "2.8s", ["--ff-delay" as string]: "1.4s" }} />
            {/* ff-4: right mid-forest */}
            <span className="firefly" aria-hidden="true" style={{ left: "78%", top: "27%", ["--ff-dur" as string]: "5.0s", ["--ff-delay" as string]: "0.3s" }} />
            {/* ff-5: right clearing edge */}
            <span className="firefly" aria-hidden="true" style={{ left: "82%", top: "48%", ["--ff-dur" as string]: "3.6s", ["--ff-delay" as string]: "2.1s" }} />
            {/* ff-6: left clearing edge */}
            <span className="firefly" aria-hidden="true" style={{ left: "22%", top: "55%", ["--ff-dur" as string]: "4.4s", ["--ff-delay" as string]: "0.9s" }} />
            {/* ff-7: upper-centre tree line */}
            <span className="firefly" aria-hidden="true" style={{ left: "41%", top: "16%", ["--ff-dur" as string]: "2.9s", ["--ff-delay" as string]: "1.7s" }} />
            {/* ff-8: lower-right, near agents but outside keep-out */}
            <span className="firefly" aria-hidden="true" style={{ left: "71%", top: "64%", ["--ff-dur" as string]: "3.8s", ["--ff-delay" as string]: "0.5s" }} />
            {/* ff-9: far-left mid-clearing edge */}
            <span className="firefly" aria-hidden="true" style={{ left: "11%", top: "39%", ["--ff-dur" as string]: "4.7s", ["--ff-delay" as string]: "1.2s" }} />
            {/* ff-10: upper-far-right */}
            <span className="firefly" aria-hidden="true" style={{ left: "88%", top: "18%", ["--ff-dur" as string]: "3.3s", ["--ff-delay" as string]: "1.9s" }} />
            {/* ff-11: lower-left clearing edge (y 68 % = below campfire keep-out) */}
            <span className="firefly" aria-hidden="true" style={{ left: "31%", top: "68%", ["--ff-dur" as string]: "4.9s", ["--ff-delay" as string]: "0.1s" }} />
            {/* ff-12: mid-right, between tree line and agents */}
            <span className="firefly" aria-hidden="true" style={{ left: "59%", top: "33%", ["--ff-dur" as string]: "3.5s", ["--ff-delay" as string]: "1.5s" }} />
          </div>
        </div>
      </div>

      {/* Top bar — logo (left) · view switch + sound (right). Fixed, outside .map-viewport. */}
      <div className="hud-topbar">
        <div className="hud-topbar-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO }} />
        <FilterSignposts
          personas={filterOpts.personas}
          features={filterOpts.features}
          epics={filterOpts.epics}
          persona={persona}
          feature={feature}
          epic={scope === "epic" ? activeEpic : ""}
          onChange={onFilterChange}
        />
        <div className="hud-topbar-spacer" />
        <div className="hud-topbar-right">
          <ViewToggle dashboardHref={dashboardHref} />
          <button
            ref={envPickerTriggerRef}
            className="hud-env-toggle"
            aria-label="ผลผลิต Scout Team — เปิดใน Staging / Production"
            data-testid="btn--map-env-picker"
            onClick={() => setEnvPickerOpen(v => !v)}
          >
            ผลผลิต Scout Team
          </button>
          <EnvPickerPanel
            isOpen={envPickerOpen}
            onClose={() => setEnvPickerOpen(false)}
            triggerRef={envPickerTriggerRef}
          />
          <SoundToggle />
        </div>
      </div>

      {/* Left panel stack — summary · delivery · approval */}
      <div className="hud-left-panels">
        <SummaryCard
          pct={summaryStats.pct}
          epicDone={summaryStats.epicDone}
          epicTotal={summaryStats.epicTotal}
          storyDone={summaryStats.storyDone}
          storyTotal={summaryStats.storyTotal}
          backlog={summaryStats.backlog}
          statusCounts={summaryStats.statusCounts}
          collapsed={summaryCollapsed}
          onToggle={() => setSummaryCollapsed((v) => !v)}
        />
        <DeliveryCard
          todayEpics={summaryStats.todayEpics}
          todayStories={summaryStats.todayStories}
          weekEpics={summaryStats.weekEpics}
          weekStories={summaryStats.weekStories}
          sparkline={summaryStats.sparkline}
          epicDone={summaryStats.epicDone}
          epicTotal={summaryStats.epicTotal}
          storyDone={summaryStats.storyDone}
          storyTotal={summaryStats.storyTotal}
          collapsed={deliveryCollapsed}
          onToggle={() => setDeliveryCollapsed((v) => !v)}
        />
        {gates.length > 0 && (
          <ApprovalCard
            gates={gates}
            collapsed={approvalCollapsed}
            onToggle={() => setApprovalCollapsed((v) => !v)}
            onOpen={() => setApprovalCollapsed(false)}
          />
        )}
        <TeamRoster
          agents={agents}
          collapsed={teamCollapsed}
          onToggle={() => setTeamCollapsed((v) => !v)}
        />
      </div>

      {/* Right panel — status board */}
      <div className="hud-right-panels">
        {showBoard ? (
          <StatusBoard
            stories={boardStories}
            label={boardLabel}
            pct={summaryStats.pct}
            collapsed={boardCollapsed}
            onToggle={() => setBoardCollapsed((v) => !v)}
          />
        ) : (
          <StatusBoardHint />
        )}
      </div>

    </div>
  );
}
