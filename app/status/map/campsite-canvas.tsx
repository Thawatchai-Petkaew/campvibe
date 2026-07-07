"use client";

// CampsiteCanvas — CAM-372 (S1b): the 2D sprite-engine renderer for /status/map,
// extracted verbatim (behavior-preserving) from campsite-scene.tsx (now
// StatusMapShell). Implements RendererHandle (map-types.ts) via useImperativeHandle
// so the shell can drive activity/scope without knowing which renderer is mounted —
// this is the seam that makes a future non-2D renderer (S1c) pluggable.
//
// S3 — Hybrid motion model:
//   entering → agents walk from arm-tip entry point to home station on first mount
//   idle     → in-place breathe/sway via CSS (transform/opacity only, no rAF state)
//   walking  → path traversal on triggerWalk() — hook ready for S6, not called from data yet
//
// S5 — Epic scope: engine.setScope() dims/shows agents without remounting the rAF loop.
//   Scope is driven by the shell (StatusMapShell) via the RendererHandle.setScope() call;
//   this component only exposes the imperative hook, it does not own scope/URL state.
//
// S7 — A11y + reduced-motion hardening:
//   - Scene root gets role="img" + aria-label summary.
//   - Each agent is a focusable <button> (tab-order: You first, then agents).
//   - Under prefers-reduced-motion:reduce every agent shows a visible text label
//     (display name + status tag) so all motion-carried signals are readable as text.
//   - Trail renders as a static filled bar + stage names under reduced-motion.
//
// Reduced-motion: if prefers-reduced-motion:reduce → rAF loop never starts; all agents
// render static at their home station (S2 behaviour). The media-query listener
// starts/stops the loop if the OS setting changes without a page reload.
//
// DOM writes: only style.transform / style.backgroundImage / style.left / style.top /
// style.zIndex / style.opacity / style.pointerEvents on refs. No per-frame React setState.
// Effect cleanup cancels rAF. Readiness crosses to the shell via the onReadyChange
// callback prop (replacing the old local setEngineReady state, CAM-372 S1b).

import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import DeliveryGift, { DELIVERY_GIFT_CSS } from "./delivery-gift";
import {
  ADJ,
  buildScoutState,
  NODES,
  startEngine,
  type EngineHandle,
  type ScoutRef,
} from "./campsite-engine";
import type { MapAgent, MapEpicItem, MapGate, RendererHandle } from "./map-types";
import { ROLE_DISPLAY } from "./role-config";

// Canonical role display config — mirrors the mockup AGENTS array.
// CAM-372 (S1c): displayName/roleLabel now source from the shared role-config.ts
// (StatusMapShell's Roster Sheet imports the same ROLE_DISPLAY directly — the shell
// no longer depends on this 2D-renderer module). node/color/poseIdx stay local here
// since they are 2D sprite-engine specifics no other renderer needs.
export const ROLE_CONFIG: Record<
  string,
  { node: string; color: string; poseIdx: number; displayName: string; roleLabel: string }
> = {
  "architect":          { node: "W0",  color: "#8FB8F0", poseIdx: 0, ...ROLE_DISPLAY["architect"] },
  "ux-designer":        { node: "W28", color: "#B7A6FF", poseIdx: 1, ...ROLE_DISPLAY["ux-designer"] },
  "backend-engineer":   { node: "W23", color: "#5BE9B0", poseIdx: 2, ...ROLE_DISPLAY["backend-engineer"] },
  "frontend-engineer":  { node: "W3",  color: "#5FD0DE", poseIdx: 3, ...ROLE_DISPLAY["frontend-engineer"] },
  "devops-release":     { node: "W2",  color: "#BFE85B", poseIdx: 4, ...ROLE_DISPLAY["devops-release"] },
  "qa-engineer":        { node: "W1",  color: "#F39FD2", poseIdx: 5, ...ROLE_DISPLAY["qa-engineer"] },
  "security-reviewer":  { node: "W29", color: "#FF8A7A", poseIdx: 0, ...ROLE_DISPLAY["security-reviewer"] },
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

// SMUX-2 (CAM-251): LAYOUT_NARROW — portrait-optimised oval for mobile (<640px).
// x-axis contracts ~35%, y-axis expands ~40% relative to wide so all 7 agents
// fit a vertical aspect without overlapping the campfire centre (~50.1, ~52.0).
// Coordinates are % of the fixed 1920×1080 design canvas (same system as LAYOUT_WIDE).
export const LAYOUT_NARROW: Record<string, { x: number; y: number }> = {
  "architect":          { x: 50.0, y: 31.0 },  // top
  "ux-designer":        { x: 61.8, y: 37.5 },  // upper-right
  "backend-engineer":   { x: 67.2, y: 52.5 },  // right
  "frontend-engineer":  { x: 60.5, y: 67.0 },  // lower-right
  "devops-release":     { x: 40.5, y: 67.0 },  // lower-left (symmetric with FE)
  "qa-engineer":        { x: 33.8, y: 52.5 },  // left (symmetric with BE)
  "security-reviewer":  { x: 39.2, y: 37.5 },  // upper-left (symmetric with UX)
};
export const YOU_POS_NARROW = { x: 38, y: 27 };

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
// .map-wrap is the full-screen container (fixed inset:0) — owned by the shell
//   (StatusMapShell); this component renders its content as its child.
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
/* CAM-374: .hud-topbar/.hud-topbar-logo/.hud-left-panels/.hud-right-panels/
   .hud-topbar-spacer/.hud-topbar-right/.cv-logo/.sound-toggle are shell-owned
   HUD chrome (position/z-index rendered by StatusMapShell, campsite-scene.tsx)
   — moved to HUD_CSS (campsite-overlays.tsx, always injected in both 2D and 3D)
   so the topbar + side panels stay correctly positioned/stacked above the 3D
   canvas too (previously unstyled/uncovered in 3D since SCENE_CSS never loads
   there). See HUD_CSS for the rule bodies. */
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
  border:1px solid rgba(255,255,255,.10);border-radius:999px;padding:4px 9px;
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
  font-size:12px;font-weight:700;color:#241402;
  background:linear-gradient(180deg,#ffcf86,#ff9d3c);border:1.5px solid rgba(255,220,130,.75);
  border-radius:12px;padding:5px 11px;
  box-shadow:0 0 0 1.5px rgba(255,180,84,.55),0 10px 28px -4px rgba(255,150,52,.7);
  font-family:inherit;min-height:44px;min-width:44px;
}
.you-alert:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
.you-alert svg{width:13px;height:13px;flex:none}
/* suppress popover when a gate is pending — prevents overlap with the notification */
.scout.has-gate .popover{display:none;pointer-events:none}
.you-alert::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#ff9d3c}
.popover{
  position:absolute;left:50%;bottom:calc(var(--bh) + 38px);transform:translateX(-50%) translateY(6px);
  width:194px;opacity:0;pointer-events:none;transition:opacity .16s,transform .16s;z-index:12;
  background:rgba(10,28,20,.80);backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);
  border:1px solid rgba(255,255,255,.10);border-radius:13px;padding:11px 12px;
  box-shadow:0 16px 40px rgba(0,0,0,.46)
}
.scout:hover .popover,.scout:focus-visible .popover{opacity:1;transform:translateX(-50%) translateY(0)}
.pop-name{font-weight:600;font-size:13px}
.pop-role{
  display:inline-block;font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;
  padding:2px 8px;border-radius:999px;margin-top:6px;border:1px solid rgba(255,255,255,.08)
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
}
/* CAM-374: the SMUX-2/CAM-260/SMUX-6 responsive HUD blocks (tablet edge-drawer
   tabs, tablet + mobile bottom toolbar, desktop hide rules, env/view-toggle +
   topbar-icons show/hide) all style shell-owned HUD chrome (StatusMapShell,
   campsite-scene.tsx) — moved to HUD_CSS (campsite-overlays.tsx, always
   injected in both 2D and 3D) so these controls stay correctly shown/hidden
   and positioned above the 3D canvas too. See HUD_CSS for the rule bodies. */
/* ── SMUX-3: Map↔Board/Filter bidirectional sync ────────────────────────────
   .scout--focused: a teal glow-ring on the GROUND (aligned with .shadow / .aura-ring)
   when a board card or filter selection points at this agent. Replaces the old
   rectangular sprite outline (CAM-263) so the selection reads as part of the scene.
   Uniform teal for every role. Shown for both motion + reduced-motion; only the
   pulse animation is gated behind prefers-reduced-motion. */
.scout--focused::after {
  content:"";position:absolute;left:50%;bottom:0;
  transform:translate(-50%,30%);                 /* same anchor as .aura-ring */
  width:calc(var(--scout-size)*0.82);height:calc(var(--scout-size)*0.34);
  border-radius:50%;
  border:2.5px solid rgba(91,233,176,.9);
  box-shadow:0 0 14px rgba(91,233,176,.55),inset 0 0 8px rgba(91,233,176,.35);
  z-index:2;pointer-events:none;                 /* on the ground, behind the body(z:3) */
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes smux3-ground-pulse {
    0%,100% { transform:translate(-50%,30%) scale(1);    box-shadow:0 0 14px rgba(91,233,176,.55),inset 0 0 8px rgba(91,233,176,.35); }
    50%     { transform:translate(-50%,30%) scale(1.06); box-shadow:0 0 22px rgba(91,233,176,.4),inset 0 0 10px rgba(91,233,176,.25); }
  }
  .scout--focused::after { animation:smux3-ground-pulse 1.4s ease-in-out infinite; }
}`;

// ── Sub-components ───────────────────────────────────────────────────────────

interface AgentScoutProps {
  agent: MapAgent;
  bodyRef: (el: HTMLElement | null) => void;
  rootRef: (el: HTMLElement | null) => void;
  speechRef: (el: HTMLElement | null) => void;
  onActivate: () => void;
  /** SMUX-3: when true, applies the teal focus-ring/pulse to this agent sprite. */
  focused?: boolean;
}

function AgentScoutInner({
  agent, bodyRef, rootRef, speechRef, onActivate, focused = false,
}: AgentScoutProps) {
  const cfg = ROLE_CONFIG[agent.role];
  if (!cfg) return null;

  // working/idle class is now engine-owned (toggled imperatively in setActivity()
  // and seeded in the rootRef). Removing it from React's className prevents a
  // re-render from clobbering the engine's walking-mode/entering class state or
  // restarting CSS animations mid-walk.
  // KEEP: bstatText, popover content, aria-label, rm-label — React-owned text/a11y.

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
      className={focused ? "scout scout--focused" : "scout"}
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
// SMUX-3: include focused in the memo guard so focus-ring toggling forces a re-render.
const AgentScout = memo(AgentScoutInner, (prev, next) =>
  prev.agent.active === next.agent.active &&
  prev.agent.done === next.agent.done &&
  prev.agent.activeCount === next.agent.activeCount &&
  prev.agent.queued === next.agent.queued &&
  prev.agent.task?.id === next.agent.task?.id &&
  prev.agent.task?.title === next.agent.task?.title &&
  prev.focused === next.focused,
);

interface YouScoutProps {
  gates: MapGate[];
  onOpenGates: () => void;
  onOpenFirstGate: () => void;
  /** CAM-161: current layout's You position (% of 1920×1080 canvas) */
  youPos: { x: number; y: number };
}

function YouScout({ gates, onOpenGates, onOpenFirstGate, youPos }: YouScoutProps) {
  const zIndex = Math.round(youPos.y * 12) + 5;
  const hasGates = gates.length > 0;

  // S7: reduced-motion You label
  const rmYouStatusText = hasGates ? `⚑${gates.length} รอคุณ` : "ปกติ";
  const rmYouStatusCls = hasGates ? "rm-label-status amber" : "rm-label-status";

  return (
    // S7: You is a button too — comes first in the DOM so tab order reaches You first
    <button
      type="button"
      className={`scout you idle${hasGates ? " has-gate" : ""}`}
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
        <button
          type="button"
          className="you-alert"
          aria-label={`${gates.length} gate รอตรวจสอบ — กดเพื่อดูรายละเอียด`}
          onClick={(e) => { e.stopPropagation(); onOpenFirstGate(); }}
          data-testid="btn--map-you-alert"
        >
          <BellRing size={13} strokeWidth={2} aria-hidden="true" />
          <span>{gates.length} รอตรวจสอบ</span>
        </button>
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

// ── Main component ───────────────────────────────────────────────────────────

export interface CampsiteCanvasProps {
  agents: MapAgent[];
  gates: MapGate[];
  epics: MapEpicItem[];
  projectPct: number;
  activeEpic: string;
  focusedTaskId: string;
  onAgentActivate: (agent: MapAgent) => void;
  onOpenGates: () => void;
  onOpenFirstGate: () => void;
  /** CAM-164 dev tool: render a % coordinate grid overlay when true (?grid=1). */
  debugGrid?: boolean;
  /** Crosses readiness to the shell (replaces the old local setEngineReady state). */
  onReadyChange: (ready: boolean) => void;
}

function CampsiteCanvasInner(
  {
    agents,
    gates,
    epics,
    projectPct,
    activeEpic,
    focusedTaskId,
    onAgentActivate,
    onOpenGates,
    onOpenFirstGate,
    debugGrid = false,
    onReadyChange,
  }: CampsiteCanvasProps,
  ref: React.ForwardedRef<RendererHandle>,
) {
  // DOM refs — body and root element per agent, indexed by role.
  const bodyRefs = useRef<Record<string, HTMLElement | null>>({});
  const rootRefs = useRef<Record<string, HTMLElement | null>>({});
  const speechRefs = useRef<Record<string, HTMLElement | null>>({});

  // Exposed handle for S6 (parent can access via a forwarded ref if needed).
  const engineRef = useRef<EngineHandle | null>(null);

  // CAM-372 (S1b): the imperative handle the shell drives — setActivity/setScope/
  // triggerWalk all delegate to the underlying 2D engine handle.
  useImperativeHandle(ref, () => ({
    setActivity: (activeByRole: Record<string, boolean>) => engineRef.current?.setActivity(activeByRole),
    setScope: (scope: "all" | "epic", epicRoles: string[]) => engineRef.current?.setScope(scope, epicRoles),
    triggerWalk: (role: string, toNode?: string) => engineRef.current?.triggerWalk(role, toNode),
  }), []);

  // CAM-164 portrait fix: derive initial layoutKey from the actual viewport on first
  // client render (scene is ssr:false so window is always available here). This
  // prevents YouScout from rendering at YOU_POS_WIDE on portrait before the
  // useEffect fires — the initial render is already at the correct layout.
  // The module-level currentLayout is also pre-seeded here so homeStyle() is correct
  // on the very first render without waiting for the effect.
  // SMUX-2: layoutKey initialised from min-width: 640px (not aspect-ratio).
  const [layoutKey, setLayoutKey] = useState<"wide" | "narrow">(() => {
    if (typeof window === "undefined") return "wide"; // SSR guard (never reached — ssr:false)
    const isWide = window.matchMedia("(min-width: 640px)").matches;
    currentLayout = isWide ? LAYOUT_WIDE : LAYOUT_NARROW;
    return isWide ? "wide" : "narrow";
  });

  // Dev: ?routes=1 overlays the walk graph (waypoints + edges + campfire keep-out).
  const debugRoutes =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("routes") === "1";

  // Dev: ?pick=1 turns on the waypoint editor — click the clearing to lay down the
  // walk graph on the real scene, then copy the generated NODES/ADJ for me to wire in.
  const debugPick =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("pick") === "1";

  useEffect(() => {
    // Guard: only run in the browser (this is a "use client" component, but be safe).
    if (typeof window === "undefined") return;

    const mq    = window.matchMedia("(prefers-reduced-motion: reduce)");
    // CAM-163: Determine the active layout BEFORE building scouts so they are
    // placed at the correct art-measured position from the very first frame —
    // no compass-detour entrance walk and no visible snap on load.
    // SMUX-2: trigger is viewport WIDTH <640px (not aspect-ratio) so a phone in
    // landscape still uses LAYOUT_NARROW (the canvas is small regardless of orientation).
    const arMqEarly = window.matchMedia("(min-width: 640px)");
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
      // Position immediately so the first paint matches the layout. working/idle
      // class is now engine-owned (not React className); set it here to match
      // the initial s.active so no class is ever missing before setActivity() runs.
      if (state.rootEl) {
        state.rootEl.classList.remove("walking-mode");
        state.rootEl.classList.toggle("working", state.active);
        state.rootEl.classList.toggle("idle", !state.active);
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
      onReadyChange(true); // S7: notify the shell's scope effect that the renderer is ready
    }

    function stopLoop() {
      if (!engine) return;
      engine.stop();
      engine = null;
      engineRef.current = null;
      onReadyChange(false);
      // Restore all agents to their current layout home (homeX/homeY — not NODES).
      // CAM-163: use homeX/homeY so reduced-motion fallback respects the active layout.
      for (const ref of scoutRefs) {
        const s = ref.state;
        if (!s.rootEl) continue;
        s.rootEl.style.left   = `${s.homeX}%`;
        s.rootEl.style.top    = `${s.homeY}%`;
        s.rootEl.style.zIndex = String(Math.round(s.homeY * 12) + 5);
        // Engine owns idle/working/walking-mode; restore to home idle state.
        s.rootEl.classList.remove("walking-mode");
        s.rootEl.classList.toggle("working", s.active);
        s.rootEl.classList.toggle("idle", !s.active);
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
          // Re-apply working/idle class + position after reset (engine-owned).
          // buildScoutState always produces s.active=false so classList.add("idle")
          // is correct here; classList.toggle covers a defensive active=true case.
          if (s.rootEl) {
            s.rootEl.classList.remove("entering", "walking-mode");
            s.rootEl.classList.toggle("working", s.active);
            s.rootEl.classList.toggle("idle", !s.active);
            if (!s.active) s.rootEl.classList.add("idle");
            s.rootEl.style.left   = `${s.homeX}%`;
            s.rootEl.style.top    = `${s.homeY}%`;
            s.rootEl.style.zIndex = String(Math.round(s.homeY * 12) + 5);
          }
        }
        startLoop();
      }
    }
    mq.addEventListener("change", onMqChange);

    // CAM-161 / CAM-163 / SMUX-2: width-based layout switcher — no remount.
    // (min-width: 640px) = wide: use LAYOUT_WIDE.
    // Below 640px: use LAYOUT_NARROW (portrait-optimised oval — CAM-251).
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
    // mount-once — engine is data-independent at this stage. onReadyChange is the
    // shell's stable setRendererReady state-setter (identity never changes), so
    // omitting it here preserves the original mount-once semantics (CAM-372 S1b).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // S7: aria-label summary for the scene container (role="img").
  const activeAgentCount = agents.filter((a) => a.active).length;
  const sceneAriaLabel = `แผนที่แคมป์: กำลังทำงาน ${activeAgentCount}/7 คน, รออนุมัติ ${gates.length} งาน, คืบหน้า ${projectPct}%`;

  // CAM-161: derive active You position from the current layout.
  const youPos = layoutKey === "wide" ? YOU_POS_WIDE : YOU_POS_NARROW;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS + DELIVERY_GIFT_CSS }} />

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
              onOpenGates={onOpenGates}
              onOpenFirstGate={onOpenFirstGate}
              youPos={youPos}
            />
            {agents.map((agent) => {
              const pos = homeStyle(agent.role);
              // SMUX-3: an agent is focused when:
              //   • its task.id matches focusedTaskId (user clicked this agent or its board card), OR
              //   • its task.epicKey matches the active epic filter (board/filter→map direction, all matching agents).
              const isFocused = !!focusedTaskId && agent.task?.id === focusedTaskId
                ? true
                : !focusedTaskId && !!activeEpic && agent.task?.epicKey === activeEpic && !!agent.task;
              return (
                <AgentScout
                  key={agent.role}
                  agent={agent}
                  focused={isFocused}
                  rootRef={(el) => {
                    rootRefs.current[agent.role] = el;
                    // Seed the first-paint position and initial working/idle class
                    // imperatively, guarded by dataset.posSeeded so this runs exactly
                    // ONCE per DOM element. React reuses the same DOM node across
                    // re-renders, so dataset.posSeeded persists and later inline-callback
                    // invocations (triggered by re-renders where memo allows) skip the
                    // re-seed. This keeps the first-paint seed that prevents a corner
                    // flash, while ensuring the engine is the sole owner of position and
                    // working/idle class from the moment the engine effect runs.
                    // React never writes left/top/zIndex again after the initial seed
                    // (they are not in the component's style prop); working/idle class is
                    // toggled exclusively by the engine's setActivity() thereafter.
                    if (el && !el.dataset.posSeeded) {
                      el.style.left   = pos.left;
                      el.style.top    = pos.top;
                      el.style.zIndex = String(pos.zIndex);
                      // Belt-and-suspenders initial class for the pre-engine first paint.
                      // The engine's init block will confirm/correct this once it runs.
                      el.classList.add(agent.active ? "working" : "idle");
                      el.dataset.posSeeded = "1";
                    }
                  }}
                  bodyRef={(el) => { bodyRefs.current[agent.role] = el; }}
                  speechRef={(el) => { speechRefs.current[agent.role] = el; }}
                  onActivate={() => onAgentActivate(agent)}
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
    </>
  );
}

export const CampsiteCanvas = forwardRef(CampsiteCanvasInner);
CampsiteCanvas.displayName = "CampsiteCanvas";
