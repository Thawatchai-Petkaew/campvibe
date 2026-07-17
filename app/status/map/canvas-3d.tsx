"use client";

// Canvas3D — CAM-373 (S2b) static room + CAM-375 (S3) live-data character
// animation, the real Three.js 3D room scene for /status/map.
//
// S2b scope: a STATIC room — renderer/scene/camera/controls/lights/room/props/8
// characters, ported (layout only) from the prototype at
// atlas_web_demo/index.html.
//
// S3 scope: setActivity(activeByRole) drives each of the 7 build-role
// characters (Atlas excluded — not bound to a build role here, S4 wires Atlas
// to gate activity) between two states: "active" = walk to / stand at its
// workSpot with a gentle bob, facing its board; "idle" = patrol the room
// (collision-aware, ported from the prototype's updateActorPatrols) between
// fixed floor points. setActivity is an idempotent STATE SET — an actor whose
// commanded mode is unchanged is never re-pathed, matching the shell's
// activeKey-only call contract (campsite-scene.tsx only calls setActivity on a
// genuine activity change). setScope(scope, epicRoles) dims (opacity fade)
// characters outside the active epic's roles; also idempotent per actor.
// triggerWalk stays a no-op (not in S3's scope).
//
// S4 scope (CAM-376): Atlas — the AI-orchestrator character, distinct from the
// 7 build roles and never one of them — comes alive, driven by the gate/
// approval queue (`gates: MapGate[]`, already flowing into this component as a
// plain prop via CampsiteCanvasProps, exactly like the 2D renderer's YouScout
// reads it directly). Atlas has exactly two states: "reviewing" (gates.length
// > 0 — a quicker attention bob + a gaze sweep toward the approval area + a
// pulsing accent light) and "calm" (gates.length === 0 — a slow, minimal
// breathing bob, steady light, facing its board plainly). Atlas NEVER patrols
// in either state — it stays at its own workSpot always (unlike the 7 build
// roles' idle patrol); only its pose/light react to gate count. The seam is a
// dedicated internal bridge (`atlasControllerRef`/`applyGatesPending`, mirrors
// the `controllerRef`/setActivity pattern) driven by a small `useEffect` keyed
// on `gates.length` (a primitive, not the `gates` array reference) — so a
// reconcile that changes unrelated fields never touches Atlas, and an
// unchanged gate COUNT is a guaranteed no-op (idempotent, same contract as
// setActivity). This is intentionally NOT wired through the shell's
// activeKey/activeByRole bridge (campsite-scene.tsx) or the public
// RendererHandle interface — the shell already passes `gates` straight
// through as a normal prop, so no shell change or interface change was needed;
// see the PR description for why this option was chosen over extending
// activeKey or adding a new RendererHandle method. Atlas is still excluded
// from ROLE_KEY_BY_CHARACTER/applyActivity/applyScope (unchanged from S3) —
// it is never counted in `agents`-derived active counts (MapAgent[] never
// contains an Atlas/orchestrator entry) and never gated by epic scope.
//
// S5 scope (CAM-377): clicking/tapping a 3D character opens its ticket, reusing
// the SAME shell contract the 2D sprite click already uses — onAgentActivate/
// onOpenGates/onOpenFirstGate (CampsiteCanvasProps) are never reimplemented here.
// A single reused THREE.Raycaster hit-tests the pointer against every loaded
// actor's pivot; a build-role hit resolves its `characterKey` to a canonical role
// (ROLE_KEY_BY_CHARACTER, from S3) and calls onAgentActivate with the live
// MapAgent for that role (including a taskless/idle agent — the shell's own
// handleAgentActivate already opens the roster for that case, matching 2D); an
// Atlas hit opens the approval queue (onOpenFirstGate when a gate is pending,
// else onOpenGates). A tap-vs-drag guard (pointerdown/pointerup movement
// threshold) keeps an OrbitControls camera-drag from also firing a selection.
// Latest-data refs (`agentsRef`/`gatesRef`/the three callback refs) keep the
// mount-once pointer handler reading current data/callbacks instead of the
// stale first-render closure (mirrors `atlasGatesPendingRef`'s staleness fix).
// A pointermove hover sets `canvas.style.cursor = "pointer"` over a character
// (skipped while any button is held, so it never fights an in-progress orbit
// drag). The WebGL canvas itself stays out of the keyboard tab order (unchanged
// `role="img"` + label below) — full keyboard access to the same tickets is
// already covered by the shell's overlay Status Board, so this click is an
// enhancement, not the only path.
//
// S6 scope (CAM-378, production hardening): decides ONCE at mount (never
// per-frame — same convention as canCreateWebGL/prefers-reduced-motion below)
// whether to load the default asset tier (/status-3d/, ~27MB total, textures@
// 1024) or the mobile/low-end LOD tier S2a already shipped alongside it
// (/status-3d/lod/, ~8.5MB total, textures@512 + simplified geometry, IDENTICAL
// filenames — see preferLowLod()). The predicate opts into the lighter tier on
// a narrow/touch viewport OR a device self-reporting <=4GB RAM; pixelRatio is
// also capped more aggressively (1.5 vs 2) and the decorative starfield is
// skipped on that same path. This closes the seam S2b's ASSET_BASE comment
// left open. Also in scope: an a11y pass (confirmed — no code gap found: the
// scene's role="img"+live label, the WebGL-unavailable text fallback, and
// reduced-motion were already correct from S2b-S5; the canvas was already
// out of tab order with no keyboard trap) and this file's own design-gate
// self-check (see the PR description for the 8-states result).
//
// S7 scope (CAM-379): a per-station WALL SCREEN at each of the 8 characters —
// the "workflow board" the S2 prototype deferred (atlas_web_demo/index.html's
// createWorkflowStations()/updateBoardDisplay(), gated behind its own
// SHOW_WORKFLOW_BOARDS flag there, off by default). The MECHANISM is ported
// (a dark-glass RoundedBoxGeometry backPlate + a front PlaneGeometry panel
// carrying a THREE.CanvasTexture drawn from an offscreen 2D <canvas>); the
// DRAWING is rewritten against this file's own live data (`agents`/`gates`,
// already flowing in as plain props) instead of the prototype's static
// workflow[] fixture. Board orientation is DERIVED, not hardcoded per wall:
// `boardFacingY()` reuses the same station.pos -> station.workSpot geometry
// the character's own facing already reads (see the `pivot.rotation.y =
// Math.atan2(...)` assignment in loadAssets below) — verified to reproduce
// the prototype's per-item `rotY` (0 for the 4 back-wall stations, PI/2 for
// the 4 left-wall stations) for all 8 stations with one formula, no per-wall
// branch. CSP-safe: a CanvasTexture built from a <canvas> you draw into is
// uploaded to WebGL directly (no fetch/blob:/image load), so it never
// touches the connect-src restriction the GLB webp textures needed (S2a).
// Redraw discipline: `computeBoardsSignature(agents, gates)` is a cheap
// string over exactly the fields the boards render (role/active/
// activeCount/done/queued/task.id + gate count) — a `useEffect` keyed on
// that STRING (not the `agents`/`gates` array references) redraws every
// board's canvas + flips `texture.needsUpdate`; this mirrors the file's own
// `gates.length`-keyed Atlas effect (S4) and the CAM-176 activeKey
// discipline — a reconcile that changes an unrelated field (title text, url,
// startedAt, ...) is a guaranteed no-op, and redraw NEVER happens inside the
// rAF loop (renderFrame only re-renders the already-drawn texture).
//
// CAM-381: the seated Atlas on the sofa. The prototype's `atlas_sit.glb` only
// ever existed as a meshopt-compressed file (CAM-373 S2a couldn't use it,
// since runtime meshopt is CSP-blocked); this story re-encodes it build-time
// (decode meshopt via the gltf-transform Node CLI, then re-quantize+webp —
// zero runtime WASM, same as every other GLB here) into `atlas-sit.glb` + a
// matching LOD variant. CAM-381 originally childed it onto the sofa's own
// RoomPropRecord.group at a fixed local offset, purely decorative and
// excluded from every raycaster.
//
// CAM-383 detaches it into a fully independent, editable object: it is its
// own top-level THREE.Group in the scene (no longer a child of the sofa),
// registered as its own RoomPropRecord (see SEATED_ATLAS_PROP_DEF + loadAssets
// below) so it gets the SAME selection ring + XZ drag + Shift-height clamp +
// ↺↻ rotate + persistence every other room prop already has. It is still
// static (no rAF motion), still not one of the 7 build-role characters or the
// 8th orchestrator Atlas, not `activeByRole`/gate-driven, and not in the aria
// active count — and it stays OUT of the S5 character raycaster
// (`actors`/`raycastPivots`) so a normal-mode click on it never opens a
// ticket (only CAM-380's prop raycaster/`propPivots` picks it up, and only
// while Object Edit Mode is enabled).
//
// WASM-free (non-negotiable, CAM-373 S2a): production CSP has no
// 'wasm-unsafe-eval' outside dev and blocks blob: workers, so every GLB under
// /status-3d/ was optimized with ZERO runtime WASM decoder (quantize + webp
// only — no meshopt/Draco/KTX2). This file loads them with a PLAIN
// `GLTFLoader` — no `setMeshoptDecoder`, no DRACOLoader, no KTX2Loader wiring.
// Do not add one; a decoder wire-up here would silently reintroduce the WASM
// dependency the asset pipeline was built to avoid.
//
// `three` (+ addons) only ever loads when a user switches to 3D — Canvas3D is
// React.lazy-imported by campsite-scene.tsx (selection-gated), so the default
// 2D path's first-load JS is unaffected. See that file's Canvas3D declaration
// for why React.lazy (not next/dynamic) is used for the ref-forwarding.
//
// Reduced motion: `prefers-reduced-motion: reduce` disables the continuous rAF
// loop entirely — the scene renders once, then re-renders only on the
// OrbitControls "change" event (on-demand), with damping turned off so a drag
// applies immediately with no lingering inertia frames. This mirrors the 2D
// engine's matchMedia + change-listener pattern (campsite-canvas.tsx) applied
// to the correct mechanism for a WebGL render loop.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { MapAgent, MapGate, RendererHandle } from "./map-types";
import type { CampsiteCanvasProps } from "./campsite-canvas";
import { MapProgress } from "./map-progress";
import { ROLE_DISPLAY } from "./role-config";

const COPY = {
  loading: "กำลังโหลดมุมมอง 3 มิติ…",
  unavailable: "อุปกรณ์นี้ไม่รองรับการแสดงผล 3 มิติ กรุณาสลับกลับไปมุมมอง 2 มิติ",
  // CAM-380: Object Edit Mode toggle/reset — this route's copy is Thai-only,
  // sourced from a local const object (matches this same file's existing
  // COPY/BOARD_COPY convention, not the shared TH/EN locales/translations.ts
  // toggle — /status/map is an internal delivery-status view, not a public
  // bilingual product page).
  editModeEnter: "จัดห้อง",
  editModeExit: "เสร็จ",
  editModeReset: "รีเซ็ต",
  // CAM-382: the on-screen turn-button labels (accessible name for ↺/↻,
  // which are otherwise decorative glyphs) — same local-const convention.
  rotateCcw: "หมุนทวนเข็มนาฬิกา",
  rotateCw: "หมุนตามเข็มนาฬิกา",
} as const;

// S2a-optimized assets: quantize + webp, no meshopt/Draco/KTX2 (verified WASM-free).
const ASSET_BASE = "/status-3d/";
// S6 (CAM-378): the mobile/low-end LOD tier S2a shipped alongside the default —
// IDENTICAL filenames, only the base path differs (512px textures + simplified
// geometry, ~8.5MB total vs. the default tier's ~27MB). Selected once at mount
// by preferLowLod() below, never re-evaluated per frame or on resize.
const ASSET_BASE_LOD = "/status-3d/lod/";

// Non-standard but widely supported on Chromium/Android (absent on iOS/Safari/
// Firefox — the `typeof ... === "number"` check below reads as `undefined`
// there, never throws, and an unsupported browser simply skips this signal
// rather than being treated as low-end by default).
interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

// S6 (CAM-378): the mobile/low-end LOD predicate — decided ONCE at mount (see
// the file-header S6 note), mirroring canCreateWebGL()'s call convention
// (throwaway matchMedia/navigator reads, never touched again after mount).
// Opts into the lighter tier when ANY of:
//   - a narrow viewport (<=768px) — phones and portrait tablets;
//   - a coarse pointer (touch) — a touch-primary device regardless of its
//     reported viewport width (e.g. a large tablet in landscape);
//   - the device self-reports <=4GB RAM (navigator.deviceMemory). Absence of
//     the signal (older/incompatible browsers) is NOT treated as low-end —
//     only an explicit low value opts in; a browser this predicate can't read
//     falls open to the default (higher-fidelity) tier.
// Safe to call from the mount effect only (this module is ssr:false via
// scene-loader.tsx, so `window`/`navigator` always exist here) — never called
// per-frame. Exported (named, per code.md's util convention) so its predicate
// logic gets a real behavioral unit test instead of a source-grep guard.
export function preferLowLod(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const narrowViewport = window.matchMedia("(max-width: 768px)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const nav = navigator as NavigatorWithMemory;
    const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
    return narrowViewport || coarsePointer || lowMemory;
  } catch {
    return false; // fail open to the default tier — never block the scene from loading
  }
}

// ── Room geometry constants (ported from the prototype's L-room layout) ─────
const WALL_OUTER = -8.5;
const WALL_INNER = -8.26;
const WALL_END = 9.0;
const OPEN_ROUND_START = 7.0;
const WALL_SPAN = WALL_END - WALL_OUTER;
const WALL_CENTER = (WALL_END + WALL_OUTER) / 2;
const toShapeY = (worldZ: number) => -worldZ;

// Lighting scale ported from the prototype's "public-lite" tier (its non-showcase
// default). S2b runs one fixed tier — no perf-mode switch, no device detection.
const LIGHT_SCALE = 0.68;

const ROLE_COLORS = {
  atlas: 0x7fd6ff,
  architect: 0x8b5cf6,
  designer: 0x9b5cff,
  frontend: 0x168cff,
  backend: 0x35d66d,
  security: 0xff2f3a,
  qa: 0xff9cc7,
  devops: 0xd8b43f,
} as const;

// CAM-375 (S3): maps a WORKFLOW character key to the canonical role key
// MapAgent.role carries (role-config.ts / lib/status-map-model.ts). Atlas is
// intentionally absent — S3 does not bind Atlas to a build role, it stays
// static/idle here (S4 wires Atlas to gate activity instead).
const ROLE_KEY_BY_CHARACTER: Partial<Record<keyof typeof ROLE_COLORS, string>> = {
  designer: "ux-designer",
  frontend: "frontend-engineer",
  backend: "backend-engineer",
  architect: "architect",
  security: "security-reviewer",
  qa: "qa-engineer",
  devops: "devops-release",
};

interface WorkflowStation {
  key: keyof typeof ROLE_COLORS;
  characterFile: string;
  isAtlas?: boolean;
  /** Reference point the character faces (the prototype's board position — no
   *  board panel is rendered in S2b, layout/orientation only). */
  pos: THREE.Vector3;
  /** Where the character stands. */
  workSpot: THREE.Vector3;
}

// Ported from the prototype's workflow[] — positions/orientation only (no
// board/task-orb/patrol fields, those are out of S2b's static scope).
const WORKFLOW: WorkflowStation[] = [
  { key: "designer", characterFile: "designer.glb", pos: new THREE.Vector3(-5.60, 2.0, -7.65), workSpot: new THREE.Vector3(-5.60, 0.94, -5.95) },
  { key: "frontend", characterFile: "frontend.glb", pos: new THREE.Vector3(-1.40, 2.0, -7.65), workSpot: new THREE.Vector3(-1.40, 0.94, -5.95) },
  { key: "backend", characterFile: "backend.glb", pos: new THREE.Vector3(2.80, 2.0, -7.65), workSpot: new THREE.Vector3(2.80, 0.94, -5.95) },
  { key: "architect", characterFile: "architect.glb", pos: new THREE.Vector3(7.00, 2.0, -7.65), workSpot: new THREE.Vector3(7.00, 0.94, -5.95) },
  { key: "security", characterFile: "security.glb", pos: new THREE.Vector3(-7.65, 2.0, 7.00), workSpot: new THREE.Vector3(-5.95, 0.94, 7.00) },
  { key: "atlas", characterFile: "atlas.glb", isAtlas: true, pos: new THREE.Vector3(-7.65, 2.0, 2.80), workSpot: new THREE.Vector3(-5.95, 0.94, 2.80) },
  { key: "qa", characterFile: "qa.glb", pos: new THREE.Vector3(-7.65, 2.0, -1.40), workSpot: new THREE.Vector3(-5.95, 0.94, -1.40) },
  { key: "devops", characterFile: "devops.glb", pos: new THREE.Vector3(-7.65, 2.0, -5.60), workSpot: new THREE.Vector3(-5.95, 0.94, -5.60) },
];

interface RoomPropDef {
  name: string;
  file: string;
  position: THREE.Vector3;
  rotationY: number;
  /** Ordinary ROOM_PROPS entries: scaled via normalizeRoomProp (scale-to-size
   *  + floor-align) — every ROOM_PROPS item below always sets this. Absent
   *  on the seated-Atlas record (SEATED_ATLAS_PROP_DEF), which sets
   *  `targetHeight` instead (CAM-383). */
  targetSize?: number;
  radius: number;
  /** CAM-383: present ONLY on the seated-Atlas record — its mesh is
   *  center-normalized + scaled via normalizeCharacter (like the 8 build-
   *  role/Atlas characters), NOT floor-aligned via normalizeRoomProp like
   *  every ordinary prop. The group ORIGIN sits at the character's visual
   *  vertical CENTER, not its feet — anything reading a record's "floor
   *  height" (e.g. the selection ring, see updatePropSelectionRing) must
   *  subtract half of this value when it is present. */
  targetHeight?: number;
}

// Ported from the prototype's roomPropDefs. The seated-Atlas extra
// (SEATED_ATLAS_PROP_DEF below) is a separate module-level constant — not one
// of these 5 literal entries — purely so ROOM_PROPS keeps mirroring the
// prototype's original list 1:1; it is still RoomPropDef-shaped and is
// registered into the very same `propRecords`/`propPivots` machinery as these
// 5 (CAM-383), just built in its own branch in loadAssets below.
const ROOM_PROPS: RoomPropDef[] = [
  { name: "sofa", file: "sofa.glb", position: new THREE.Vector3(0.5, 0.02, 1.4), rotationY: -Math.PI / 2, targetSize: 2.48, radius: 1.62 },
  { name: "table-oval", file: "table-oval.glb", position: new THREE.Vector3(1.8, 0.02, 3.7), rotationY: Math.PI / 2, targetSize: 1.46, radius: 0.98 },
  { name: "table-lumen", file: "table-lumen.glb", position: new THREE.Vector3(-0.8, 0.02, 3.7), rotationY: Math.PI / 2, targetSize: 1.92, radius: 1.26 },
  { name: "data-vault", file: "data-vault.glb", position: new THREE.Vector3(3.6, 0.02, 1.4), rotationY: Math.PI / 2, targetSize: 1.52, radius: 1.04 },
  { name: "plant", file: "plant.glb", position: new THREE.Vector3(-2.6, 0.02, 1.4), rotationY: Math.PI / 2, targetSize: 1.02, radius: 0.72 },
];

// CAM-382: Thai display names for the rotate control's "which prop is
// selected" label — same Thai-only local-const convention as COPY/BOARD_COPY
// above (this route's copy is not sourced from locales/translations.ts).
// CAM-383 adds "seated-atlas" now that it is a selectable editable object too.
const PROP_DISPLAY_NAME: Record<string, string> = {
  sofa: "โซฟา",
  "table-oval": "โต๊ะวงรี",
  "table-lumen": "โคมไฟตั้งโต๊ะ",
  "data-vault": "ตู้เก็บข้อมูล",
  plant: "ต้นไม้",
  "seated-atlas": "แอตลาสนั่ง",
};

// CAM-381 shipped `atlas-sit.glb` (build-time meshopt DECODE via the
// gltf-transform Node CLI, then re-quantize+webp, zero runtime WASM — see
// that PR's description for the exact command + verification) childed onto
// the sofa's own RoomPropRecord.group at a fixed local offset.
//
// CAM-383 detaches it: this is now a full RoomPropDef in the SAME shape
// ROOM_PROPS entries use (`targetHeight` replaces `targetSize` — see
// RoomPropDef's own doc comment above), registered as its own independent
// RoomPropRecord in loadAssets below. `position`/`rotationY` here are the
// WORLD transform the OLD local-to-sofa offset resolved to — computed once so
// detaching it never visibly moved the figure: the sofa's own world transform
// (position (0.5, 0.02, 1.4), rotationY -PI/2) composed with the prototype's
// local offset (position (0.38, 0.86, -0.04), rotationY PI) resolves to
// world position (0.54, 0.88, 1.78) and world rotationY PI/2 (see the PR
// description for the full rotation-matrix derivation). Exported (named, per
// code.md's util convention) so the composition itself gets a real
// behavioral unit test (see cam-383-detach-editable-atlas.test.ts) — mirrors
// every other exported pure constant/function in this file.
export const SEATED_ATLAS_PROP_DEF: RoomPropDef = {
  name: "seated-atlas",
  file: "atlas-sit.glb",
  position: new THREE.Vector3(0.54, 0.88, 1.78),
  rotationY: Math.PI / 2,
  radius: 0.45,
  targetHeight: 0.98,
};

// ── Live-activity motion (CAM-375, S3) ───────────────────────────────────────
// Ported from the prototype's patrolPoints — same room coordinate system as
// WALL_*/ROOM_PROPS above (numerically identical layout), so these floor
// points and the obstacle-avoidance below are valid as-is. The prototype's
// bossVisitPoints ("workers periodically visit Atlas's station") is dropped —
// out of S3 scope; Atlas stays static/idle here (S4 wires gates).
const ROUTE_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(-4.65, 0.92, -6.05),
  new THREE.Vector3(-2.25, 0.92, -6.25),
  new THREE.Vector3(0.10, 0.92, -6.10),
  new THREE.Vector3(3.55, 0.92, -6.20),
  new THREE.Vector3(6.30, 0.92, -4.80),
  new THREE.Vector3(7.05, 0.92, -2.85),
  new THREE.Vector3(6.25, 0.92, 0.10),
  new THREE.Vector3(6.55, 0.92, 4.25),
  new THREE.Vector3(4.20, 0.92, 6.20),
  new THREE.Vector3(1.50, 0.92, 6.78),
  new THREE.Vector3(0.15, 0.92, 6.65),
  new THREE.Vector3(-3.65, 0.92, 6.05),
  new THREE.Vector3(-6.20, 0.92, 4.20),
  new THREE.Vector3(-6.45, 0.92, 0.35),
  new THREE.Vector3(-5.95, 0.92, -2.95),
  new THREE.Vector3(-4.65, 0.92, -1.20),
  new THREE.Vector3(-4.80, 0.92, 2.55),
  new THREE.Vector3(-2.30, 0.92, 5.10),
  new THREE.Vector3(4.85, 0.92, 2.55),
];

// Obstacle circles for collision avoidance, derived from the same ROOM_PROPS
// radii the props render with (ported from the prototype's navigationObstacles).
// CAM-383: the seated Atlas is appended as a FIXED 6th slot (index
// ROOM_PROPS.length) — computed once here at module scope from
// SEATED_ATLAS_PROP_DEF's own default position/radius, never pushed at
// runtime inside loadAssets. NAVIGATION_OBSTACLES is a module-level array
// that outlives a single mount (a 2D<->3D toggle reuses these same entries —
// see the "Review fix (FIX 3, stale obstacle on remount)" comment at this
// array's call site below); appending a new entry at RUNTIME on every mount
// would duplicate/grow it, so the atlas's slot is baked in here instead, the
// same way every ROOM_PROPS slot already is.
const NAVIGATION_OBSTACLES = [...ROOM_PROPS, SEATED_ATLAS_PROP_DEF].map((item) => ({
  x: item.position.x,
  z: item.position.z,
  radius: item.radius,
}));

// ── Object Edit Mode (CAM-380): drag/arrange room props + saved layout ──────
// MECHANISM ported from atlas_web_demo/index.html's `objectEdit` state +
// handleObjectPointerDown/Move/Up + syncObjectObstacle + localStorage
// persistence (PROP_LAYOUT_STORAGE_KEY / PROP_DEFAULT_LAYOUT_STORAGE_KEY
// there). The UI is NOT ported (no per-axis toolbar, no rotate) — the dispatch
// scoped this to pick+drag (XZ) + a raise/lower-to-floor gesture + a reset
// action; see Canvas3DInner's edit-mode block for the runtime wiring.
//
// Floor/ceiling world-Y clamps are numerically identical to the prototype's
// OBJECT_FLOOR_WORLD_Y/OBJECT_CEILING_WORLD_Y. Every ROOM_PROPS item is
// floor-aligned by normalizeRoomProp (min.y -> 0, same as the prototype's
// normalizeRoomProp), so a prop's OWN group.position.y already IS its
// resting-on-the-floor value (0.02) — no per-prop bounding-box recompute is
// needed the way the prototype's updateEditableVerticalRange did for its more
// varied prop set (this file's 5 props are simpler, single-mesh-root cases).
//
// CAM-383: the seated Atlas is the one editable record where this clamp means
// something different — it is center-normalized via normalizeCharacter (see
// RoomPropDef's `targetHeight` doc comment above), so its group ORIGIN sits
// at the character's visual vertical CENTER, not its feet. The
// [OBJECT_FLOOR_WORLD_Y, OBJECT_CEILING_WORLD_Y] clamp still applies to that
// same ORIGIN, exactly as it does for every floor-aligned prop — it is just
// clamping a different physical point (the center, not the base). This gives
// the Atlas the SAME full floor-to-ceiling Shift-drag range as any prop, and
// is intentional: it lets the owner freely re-seat/re-place the figure at
// any height, not only "resting on the sofa cushion".
const OBJECT_FLOOR_WORLD_Y = 0.02;
const OBJECT_CEILING_WORLD_Y = 4.05;
const PROP_LAYOUT_STORAGE_KEY = "statusmap.3d.propLayout";
// World-Y units moved per pixel of vertical pointer travel during a
// Shift+drag raise/lower gesture (tune on Staging — dispatch flagged gesture
// feel as owner-tunable).
const PROP_VERTICAL_DRAG_SCALE = 0.01;
// Mirrors S5's HOVER_RAYCAST_THROTTLE_MS — a cursor swap needs no per-move
// precision; throttling keeps the edit-mode hover raycast off the INP-risk
// per-mousemove path the same way S5 already avoids it for character hover.
const PROP_EDIT_HOVER_THROTTLE_MS = 80;
// CAM-382: on-screen turn-button rotation — a fixed 15° step around Y per tap
// (↺ = -1 step, ↻ = +1 step), applied directly to a prop's group.rotation.y.
// A discrete DOM button click, entirely independent of the drag/Shift-height
// canvas pointer handlers above — no new gesture on the canvas itself.
const PROP_ROTATE_STEP_RAD = THREE.MathUtils.degToRad(15);

export interface StoredPropPosition {
  x: number;
  y: number;
  z: number;
  /** CAM-382: optional Y-axis rotation (radians) — absent on any layout saved
   *  before this story (pre-CAM-382 {x,y,z}-only entries). Absence is NOT an
   *  error: parseStoredPropLayout keeps the entry and applyStoredPropLayout
   *  simply leaves the prop's current/ROOM_PROPS-default rotation untouched
   *  when this field is missing — see both functions below. */
  rotationY?: number;
}
export type StoredPropLayout = Record<string, StoredPropPosition>;

// Guards a malformed/absent/corrupted localStorage value: any shape that
// isn't a plain object of finite-number {x,y,z} triples (rotationY optional,
// see StoredPropPosition above) is dropped per-entry, never thrown — a bad
// value fails open to "no saved layout" (ROOM_PROPS defaults), never a
// crash. Exported (named, per code.md's util convention) for a real unit
// test, mirroring preferLowLod()/boardFacingY() above.
//
// CAM-382 backward-compat: an entry saved by the pre-rotate build has no
// `rotationY` key at all — that shape is STILL accepted as-is (rotationY
// simply comes out `undefined`, see applyStoredPropLayout below); only a
// PRESENT-but-non-finite `rotationY` drops the whole entry, the same
// malformed-entry-drop rule the x/y/z fields already use.
export function parseStoredPropLayout(raw: string | null): StoredPropLayout {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: StoredPropLayout = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    const v = value as Partial<StoredPropPosition> | null;
    if (!v || typeof v !== "object" || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) continue;
    if (v.rotationY !== undefined && !Number.isFinite(v.rotationY)) continue;
    out[name] = {
      x: v.x as number,
      y: v.y as number,
      z: v.z as number,
      ...(v.rotationY !== undefined ? { rotationY: v.rotationY as number } : {}),
    };
  }
  return out;
}

// Shared bounds math for clampPropPosition/clampPropPositionInto below — a
// single source for the margin/wall formula so the two clamp entry points
// (the allocating one-off call sites vs. the zero-allocation hot drag path)
// can never drift apart.
function propClampBounds(radius: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const margin = Math.max(0.52, radius * 0.48);
  return {
    minX: WALL_INNER + margin,
    maxX: WALL_END - margin,
    minZ: WALL_INNER + margin,
    maxZ: WALL_END - margin,
  };
}

// Clamps a candidate prop position to the room's floor bounds (ported from
// the prototype's clampRoomPropPosition, reusing this file's OWN
// WALL_INNER/WALL_END — numerically identical to the prototype's wallInner/
// wallEnd) and to the floor/ceiling world-Y range. Exported for a real unit
// test (boundary: exactly at a wall, exactly at the floor/ceiling). Used at
// one-off call sites (restoring/resetting a layout) where allocating a small
// plain object is fine — the per-move hot path uses clampPropPositionInto
// below instead.
export function clampPropPosition(
  x: number,
  y: number,
  z: number,
  radius: number,
): { x: number; y: number; z: number } {
  const b = propClampBounds(radius);
  return {
    x: THREE.MathUtils.clamp(x, b.minX, b.maxX),
    y: THREE.MathUtils.clamp(y, OBJECT_FLOOR_WORLD_Y, OBJECT_CEILING_WORLD_Y),
    z: THREE.MathUtils.clamp(z, b.minZ, b.maxZ),
  };
}

// Same clamp as clampPropPosition, written directly into an existing
// Vector3 (the dragged prop's own group.position) instead of allocating a
// fresh {x,y,z} literal — used by the per-pointermove drag path so a mouse
// move never allocates. Exported (mirrors this file's export-pure-functions
// convention) so a unit test can assert it agrees with clampPropPosition.
export function clampPropPositionInto(target: THREE.Vector3, x: number, y: number, z: number, radius: number): void {
  const b = propClampBounds(radius);
  target.set(
    THREE.MathUtils.clamp(x, b.minX, b.maxX),
    THREE.MathUtils.clamp(y, OBJECT_FLOOR_WORLD_Y, OBJECT_CEILING_WORLD_Y),
    THREE.MathUtils.clamp(z, b.minZ, b.maxZ),
  );
}

// CAM-382: keeps a repeatedly-rotated prop's angle bounded to [0, 2π) instead
// of growing unbounded across many ↺/↻ taps (THREE.Euler has no wrap of its
// own). Exported (named, per code.md's util convention) for a real unit
// test, mirroring clampPropPosition's own boundary tests above.
export function normalizeYRotation(radians: number): number {
  const twoPi = Math.PI * 2;
  return ((radians % twoPi) + twoPi) % twoPi;
}

interface RoomPropRecord {
  def: RoomPropDef;
  group: THREE.Group;
  /** The shared NAVIGATION_OBSTACLES[i] entry for this prop — mutated in
   *  place (never replaced) so the patrol/collision functions above, which
   *  hold their own reference into this same array, see the update. */
  obstacle: { x: number; z: number; radius: number };
}

// Ported from the prototype's syncObjectObstacle — keeps a prop's obstacle
// circle in lockstep with its CURRENT position after a drag, so patrolling
// characters (isPointClear/isSegmentClear/choosePatrolTarget above) replan
// around the new spot. Called on every drag-move + once more on release,
// never per animation frame.
function syncPropObstacle(record: RoomPropRecord): void {
  record.obstacle.x = record.group.position.x;
  record.obstacle.z = record.group.position.z;
}

// Captures every prop's current position + Y rotation, keyed by name.
// CAM-382 extends the prototype's captureCurrentPropLayout shape: the
// prototype dropped rotationY since it never rotated a prop; this port now
// does, via the on-screen turn buttons, so every capture includes it.
// Exported for a unit test (no WebGL needed: THREE.Group is plain data in
// jsdom/node).
export function capturePropLayout(records: RoomPropRecord[]): StoredPropLayout {
  const layout: StoredPropLayout = {};
  records.forEach((record) => {
    layout[record.def.name] = {
      x: Number(record.group.position.x.toFixed(3)),
      y: Number(record.group.position.y.toFixed(3)),
      z: Number(record.group.position.z.toFixed(3)),
      rotationY: Number(record.group.rotation.y.toFixed(3)),
    };
  });
  return layout;
}

function readStoredPropLayout(): StoredPropLayout {
  if (typeof window === "undefined") return {};
  try {
    return parseStoredPropLayout(window.localStorage.getItem(PROP_LAYOUT_STORAGE_KEY));
  } catch {
    return {}; // private-mode / storage-disabled — fail open to ROOM_PROPS defaults
  }
}

function writeStoredPropLayout(layout: StoredPropLayout): void {
  try {
    window.localStorage.setItem(PROP_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Layout persistence is a convenience only — ignore quota/private-mode failures.
  }
}

// Applies a saved layout onto freshly-created prop groups (called once, right
// after propRecords is populated in loadAssets below) — a name with no saved
// entry keeps its ROOM_PROPS default position (and rotation) untouched.
// CAM-382 backward-compat: a saved entry with no `rotationY` (a pre-rotate
// layout) also keeps the group's CURRENT rotation untouched — at the point
// this runs (right after group creation in loadAssets) that current value
// already IS the ROOM_PROPS default (`item.rotationY`, set when the group
// was constructed), so "untouched" and "default" are the same thing here.
// Exported for a unit test (no WebGL needed, mirrors capturePropLayout above).
export function applyStoredPropLayout(records: RoomPropRecord[], layout: StoredPropLayout): void {
  records.forEach((record) => {
    const saved = layout[record.def.name];
    if (!saved) return;
    const clamped = clampPropPosition(saved.x, saved.y, saved.z, record.def.radius);
    record.group.position.set(clamped.x, clamped.y, clamped.z);
    if (saved.rotationY !== undefined) record.group.rotation.y = saved.rotationY;
    syncPropObstacle(record);
  });
}

// ── Atlas motion tuning (CAM-376, S4) ────────────────────────────────────────
// Distinct from both the build-role "active" bob (0.025 @ 2.8) and "idle"
// patrol bob (0.03 @ 2.4) — reviewing reads as "surfacing/assigning work"
// (quicker bob + a scanning gaze sweep across the approval area), calm reads
// as a slow, minimal idle breath. Values are a design call (dispatch note);
// tune on Staging.
// CAM-387: Atlas now walks gentle inspection rounds (see updateAtlasMotion), so
// the standing review/calm bob + gaze-sweep-frequency constants were removed;
// only the reduced-motion static pose keeps a fixed gaze offset.
const ATLAS_REVIEW_GAZE_SWEEP = 0.4; // radians, fixed gaze offset in the reduced-motion static pose
// Gentle supervisor stroll — slower than the build-role patrol (divisor 1.05,
// [2.5,6.2]s, bob 2.4Hz/0.03) with a smaller, slower bob so it reads as calm.
const ATLAS_PATROL_SPEED = 0.6;
const ATLAS_PATROL_MIN_DUR = 4.0;
const ATLAS_PATROL_MAX_DUR = 9.0;
const ATLAS_PATROL_BOB_FREQ = 1.6;
const ATLAS_PATROL_BOB_AMP = 0.016;
// Base intensity matches the PointLight created per-station at mount
// ((station.isAtlas ? 1.2 : 0.65) * LIGHT_SCALE) — reviewing pulses around it,
// calm sits dimmer and steady (no pulse), ported feel from the prototype's
// atlasLight.intensity pulse (t * 5.0).
const ATLAS_LIGHT_BASE = 1.2 * LIGHT_SCALE;
const ATLAS_LIGHT_PULSE_FREQ = 5.0;
const ATLAS_LIGHT_PULSE_AMPLITUDE = 0.35;
const ATLAS_LIGHT_CALM_SCALE = 0.7;

interface PatrolState {
  current: number;
  previous: number;
  target: number;
  from: THREE.Vector3;
  startTime: number;
  duration: number;
}

// Per-character live-activity state, stored in a plain array/refs (never React
// state — imperative, mirrors the 2D engine's ScoutState convention).
interface CharacterActor {
  key: keyof typeof ROLE_COLORS;
  isAtlas: boolean;
  pivot: THREE.Group;
  workSpot: THREE.Vector3;
  /** The board/reference point the character faces while "at station" (WORKFLOW's `pos`). */
  facePos: THREE.Vector3;
  /** Fixed idle pose position used only under prefers-reduced-motion (no patrol runs there). */
  homePoint: THREE.Vector3;
  /** Per-character bob-phase stagger (index-based, ported from the prototype). */
  bobPhase: number;
  /** For Atlas (CAM-376, S4): "active" == reviewing (gates pending), "idle" == calm. */
  mode: "active" | "idle";
  dimmed: boolean;
  patrol: PatrolState | null;
  /** Present only while walking TO workSpot right after an idle→active flip. */
  transit: { from: THREE.Vector3; startTime: number; duration: number } | null;
  /** CAM-376 (S4): the per-station accent PointLight, so Atlas's reviewing/calm
   *  motion can pulse it. Unused by the 7 build-role actors (created for every
   *  actor for a uniform CharacterActor shape, cheap to hold a reference to). */
  light: THREE.PointLight;
  /** CAM-387: the fake blob shadow (child of pivot). Its local Y is countered
   *  every frame so its WORLD Y stays pinned to the ground — otherwise it rides
   *  the character's vertical bob into/through the floor (flicker + only visible
   *  when stopped). */
  shadow: THREE.Mesh;
}

function isPointClear(x: number, z: number, padding: number): boolean {
  return !NAVIGATION_OBSTACLES.some((o) => {
    const r = o.radius + padding;
    const dx = x - o.x;
    const dz = z - o.z;
    return dx * dx + dz * dz < r * r;
  });
}

function distancePointToSegmentXZ(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz || 1;
  const u = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  const cx = ax + vx * u;
  const cz = az + vz * u;
  const dx = px - cx;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dz * dz);
}

function isSegmentClear(from: THREE.Vector3, to: THREE.Vector3, padding: number): boolean {
  return !NAVIGATION_OBSTACLES.some(
    (o) => distancePointToSegmentXZ(o.x, o.z, from.x, from.z, to.x, to.z) < o.radius + padding,
  );
}

function isRoutePointOccupied(point: THREE.Vector3, self: CharacterActor, actors: CharacterActor[], radius: number): boolean {
  if (!isPointClear(point.x, point.z, 0.22)) return true;
  return actors.some((other) => {
    if (other === self) return false;
    if (other.patrol && ROUTE_POINTS[other.patrol.target]?.distanceToSquared(point) < radius * radius) return true;
    return other.pivot.position.distanceToSquared(point) < radius * radius;
  });
}

function findNearestRouteIndex(position: THREE.Vector3): number {
  let idx = 0;
  let best = Infinity;
  ROUTE_POINTS.forEach((p, i) => {
    const d = p.distanceToSquared(position);
    if (d < best) { best = d; idx = i; }
  });
  return idx;
}

// Ported from the prototype's chooseActorPatrolTarget: forward/wider-forward/
// side-step/backward candidates, filtered by occupancy + a clear line-of-travel;
// falls back to the nearest clear route point if every candidate is blocked.
function choosePatrolTarget(actor: CharacterActor, fromIndex: number, previousIndex: number, actors: CharacterActor[]): number {
  const len = ROUTE_POINTS.length;
  const forward = (fromIndex + 1) % len;
  const widerForward = (fromIndex + 2) % len;
  const sideStep = (fromIndex + 5) % len;
  const backward = (fromIndex - 1 + len) % len;
  const candidates = [forward, widerForward, sideStep, backward].filter(
    (idx, pos, arr) =>
      idx !== previousIndex &&
      arr.indexOf(idx) === pos &&
      idx !== fromIndex &&
      !isRoutePointOccupied(ROUTE_POINTS[idx], actor, actors, 1.05) &&
      isSegmentClear(actor.pivot.position, ROUTE_POINTS[idx], 0.30),
  );
  if (candidates.length > 0) return candidates[0];
  const fallback = ROUTE_POINTS
    .map((point, idx) => ({ idx, dist: point.distanceToSquared(actor.pivot.position) }))
    .filter(({ idx }) => idx !== previousIndex && idx !== fromIndex)
    .filter(
      ({ idx }) =>
        !isRoutePointOccupied(ROUTE_POINTS[idx], actor, actors, 1.05) &&
        isSegmentClear(actor.pivot.position, ROUTE_POINTS[idx], 0.34),
    )
    .sort((a, b) => a.dist - b.dist);
  return fallback[0]?.idx ?? fromIndex;
}

function startPatrol(actor: CharacterActor, t: number, actors: CharacterActor[]): void {
  const current = findNearestRouteIndex(actor.pivot.position);
  const previous = actor.patrol?.previous ?? -1;
  actor.patrol = {
    current,
    previous,
    target: choosePatrolTarget(actor, current, previous, actors),
    from: actor.pivot.position.clone(),
    startTime: t,
    duration: 3.2,
  };
}

// CAM-387: the shared room-patrol step (ported from the prototype's
// updateActorPatrols). `speedDivisor` (duration = segmentLen / divisor; larger
// = faster) + `bobFreq/bobAmp` let the caller set the pace: the 7 build roles
// stroll at the normal pace (1.05, [2.5,6.2]s); Atlas does gentle supervisor
// rounds (slower, smaller bob). Collision avoidance + route choice are shared.
function runPatrol(
  actor: CharacterActor,
  t: number,
  index: number,
  actors: CharacterActor[],
  speedDivisor: number,
  minDur: number,
  maxDur: number,
  bobFreq: number,
  bobAmp: number,
): void {
  if (!actor.patrol) startPatrol(actor, t, actors);
  const patrol = actor.patrol!;
  const targetPoint = ROUTE_POINTS[patrol.target];
  const progress = Math.min(1, (t - patrol.startTime) / patrol.duration);

  if (
    (isRoutePointOccupied(targetPoint, actor, actors, 1.05) || !isSegmentClear(actor.pivot.position, targetPoint, 0.32)) &&
    progress < 0.82
  ) {
    patrol.from = actor.pivot.position.clone();
    patrol.current = findNearestRouteIndex(actor.pivot.position);
    patrol.target = choosePatrolTarget(actor, patrol.current, patrol.previous, actors);
    patrol.startTime = t;
    return;
  }

  const end = ROUTE_POINTS[patrol.target];
  const u = Math.min(1, (t - patrol.startTime) / patrol.duration);
  const ease = u * u * (3 - 2 * u);
  actor.pivot.position.lerpVectors(patrol.from, end, ease);
  actor.pivot.position.y = 0.92 + Math.sin(t * bobFreq + index) * bobAmp;
  const dir = Math.atan2(end.x - patrol.from.x, end.z - patrol.from.z);
  actor.pivot.rotation.y = THREE.MathUtils.lerp(actor.pivot.rotation.y, dir, 0.08);

  if (u >= 1) {
    patrol.previous = patrol.current;
    patrol.current = patrol.target;
    patrol.from = ROUTE_POINTS[patrol.current].clone();
    patrol.target = choosePatrolTarget(actor, patrol.current, patrol.previous, actors);
    patrol.startTime = t;
    const nextDist = ROUTE_POINTS[patrol.current].distanceTo(ROUTE_POINTS[patrol.target]);
    patrol.duration = THREE.MathUtils.clamp(nextDist / speedDivisor, minDur, maxDur);
  }
}

// Per-frame motion for one character (Atlas is never passed in — the caller
// skips it). "active" = walk to / stand at the workSpot with a gentle bob,
// facing the board; "idle" = patrol the room with collision avoidance. This
// is a pure state-ADVANCE only — it never decides active vs idle (that is
// setActivity's job, called far less often); an unchanged actor whose mode
// didn't flip just keeps doing whatever it was already doing.
function updateCharacterMotion(actor: CharacterActor, t: number, index: number, actors: CharacterActor[]): void {
  if (actor.mode === "active") {
    if (actor.transit) {
      const u = Math.min(1, (t - actor.transit.startTime) / actor.transit.duration);
      const ease = u * u * (3 - 2 * u);
      actor.pivot.position.lerpVectors(actor.transit.from, actor.workSpot, ease);
      const dir = Math.atan2(actor.workSpot.x - actor.transit.from.x, actor.workSpot.z - actor.transit.from.z);
      actor.pivot.rotation.y = THREE.MathUtils.lerp(actor.pivot.rotation.y, dir, 0.12);
      if (u >= 1) {
        actor.pivot.position.copy(actor.workSpot);
        actor.transit = null;
      }
      return;
    }
    // Atlas is never passed to this function (the render loop routes it to
    // updateAtlasMotion instead — CAM-376 S4), so the bob amplitude here is
    // always the build-role value.
    actor.pivot.position.set(
      actor.workSpot.x,
      actor.workSpot.y + Math.sin(t * 2.8 + actor.bobPhase) * 0.025,
      actor.workSpot.z,
    );
    const dirToBoard = Math.atan2(actor.facePos.x - actor.workSpot.x, actor.facePos.z - actor.workSpot.z);
    actor.pivot.rotation.y = THREE.MathUtils.lerp(actor.pivot.rotation.y, dirToBoard, 0.16);
    return;
  }

  // Idle: gentle room patrol with collision avoidance (shared with Atlas).
  runPatrol(actor, t, index, actors, 1.05, 2.5, 6.2, 2.4, 0.03);
}

// CAM-376 (S4): Atlas's own per-frame motion — never patrols (always at its own
// workSpot, unlike the 7 build roles' idle patrol); only pose + light react to
// `actor.mode` ("active" == reviewing/gates pending, "idle" == calm), which is
// driven exclusively by applyGatesPending below (never by applyActivity/
// applyScope — those explicitly skip isAtlas actors, unchanged from S3).
function updateAtlasMotion(actor: CharacterActor, t: number, actors: CharacterActor[]): void {
  const reviewing = actor.mode === "active";
  // CAM-387 (owner request): Atlas strolls the room on gentle inspection rounds
  // instead of standing at its station — slower pace + smaller bob than the
  // build-role patrol, reading as a calm supervisor doing the rounds. The
  // pending-approval signal now lives on its accent light (pulse when reviewing).
  runPatrol(
    actor,
    t,
    actor.bobPhase,
    actors,
    ATLAS_PATROL_SPEED,
    ATLAS_PATROL_MIN_DUR,
    ATLAS_PATROL_MAX_DUR,
    ATLAS_PATROL_BOB_FREQ,
    ATLAS_PATROL_BOB_AMP,
  );
  actor.light.intensity = reviewing
    ? ATLAS_LIGHT_BASE * (1 + Math.sin(t * ATLAS_LIGHT_PULSE_FREQ) * ATLAS_LIGHT_PULSE_AMPLITUDE)
    : ATLAS_LIGHT_BASE * ATLAS_LIGHT_CALM_SCALE;
}

// prefers-reduced-motion: freeze every character at its CURRENT commanded pose
// with no lerp/patrol in flight — active characters stand at their workSpot,
// idle characters sit at a fixed home point (mirrors the 2D engine's reduced-
// motion contract: no continuous motion, but the pose still reflects state).
// CAM-376 (S4): Atlas gets its own static branch (never a home point — it
// never patrols in either mode) — reviewing shows a fixed gaze-sweep offset
// (the mid-point of the sweep) so the two states still read as visually
// distinct without any motion; calm shows a plain facing.
function poseStaticAll(actors: CharacterActor[]): void {
  actors.forEach((actor) => {
    if (actor.isAtlas) {
      // CAM-387: Atlas patrols under normal motion now — clear any in-flight
      // patrol so the reduced-motion pose snaps cleanly to its station.
      actor.patrol = null;
      actor.pivot.position.copy(actor.workSpot);
      const dirToBoard = Math.atan2(actor.facePos.x - actor.workSpot.x, actor.facePos.z - actor.workSpot.z);
      const reviewing = actor.mode === "active";
      actor.pivot.rotation.y = reviewing ? dirToBoard + ATLAS_REVIEW_GAZE_SWEEP : dirToBoard;
      actor.light.intensity = reviewing ? ATLAS_LIGHT_BASE : ATLAS_LIGHT_BASE * ATLAS_LIGHT_CALM_SCALE;
      return;
    }
    actor.patrol = null;
    actor.transit = null;
    if (actor.mode === "active") {
      actor.pivot.position.copy(actor.workSpot);
      actor.pivot.rotation.y = Math.atan2(actor.facePos.x - actor.workSpot.x, actor.facePos.z - actor.workSpot.z);
    } else {
      actor.pivot.position.copy(actor.homePoint);
      actor.pivot.rotation.y = Math.atan2(actor.workSpot.x - actor.homePoint.x, actor.workSpot.z - actor.homePoint.z);
    }
  });
}

// setScope dimming: a minimal (non-animated) opacity fade, idempotent per actor
// (returns false — no material write — when the dim state is already correct,
// so a repeated setScope("all")/setScope("epic", sameRoles) call is a no-op).
function setActorDim(actor: CharacterActor, dim: boolean): boolean {
  if (actor.dimmed === dim) return false;
  actor.dimmed = dim;
  actor.pivot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    // Every mesh's material was cloned per-instance in tuneMaterial() (called
    // from normalizeCharacter), so mutating opacity here only ever affects
    // this one actor, never a sibling sharing the same GLB source material.
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const m = mesh.material as THREE.Material & { opacity: number };
    m.transparent = dim;
    m.opacity = dim ? 0.22 : 1;
    m.depthWrite = !dim;
  });
  return true;
}

// ── WebGL availability probe (ported from the prototype's canCreateWebGL) ───
// jsdom (unit tests) has no WebGL context either — this same probe correctly
// routes the interactive test suite to the "unavailable" branch below instead
// of throwing out of the mount effect.
function canCreateWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// CAM-387: world Y the character blob shadow is pinned to each frame (just
// above the floor at OBJECT_FLOOR_WORLD_Y=0.02) so the character's bob never
// drags it below/through the floor.
const SHADOW_GROUND_Y = 0.06;

// CAM-387: floating "current task" popover above each working character's head
// (ported from atlas_web_demo's #atlasPopover). Height above the pivot origin
// to anchor the bubble's tail; DOM element positioned by projecting this world
// point to the canvas each frame.
const POPOVER_HEAD_OFFSET = 1.55;
const POPOVER_CSS = `
.map-3d-poplayer { position:absolute; inset:0; z-index:6; pointer-events:none; overflow:hidden; }
.map-3d-pop { position:absolute; left:0; top:0; transform:translate(-50%,-100%); opacity:0; transition:opacity .18s ease; will-change:left,top,opacity; }
.map-3d-pop .b { position:relative; display:inline-block; background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(245,249,255,.94)); color:#0f1728; border-radius:12px; padding:6px 11px; box-shadow:0 0 7px rgba(127,214,255,.20),0 8px 18px rgba(0,0,0,.18); border:1px solid var(--pa,#7fd6ff); white-space:nowrap; font-family:'Outfit','Anuphan',sans-serif; }
.map-3d-pop .r { display:flex; align-items:center; gap:6px; }
.map-3d-pop .r::before { content:""; width:6px; height:6px; border-radius:999px; background:var(--pa,#7fd6ff); box-shadow:0 0 7px var(--pa,#7fd6ff); flex:none; }
.map-3d-pop .t { font-weight:800; font-size:12px; color:#0f1728; }
.map-3d-pop .c { font-weight:600; font-size:12px; color:#475569; }
.map-3d-pop .b::after { content:""; position:absolute; left:50%; bottom:-5px; width:9px; height:9px; background:inherit; border-right:1px solid var(--pa,#7fd6ff); border-bottom:1px solid var(--pa,#7fd6ff); transform:translateX(-50%) rotate(45deg); border-radius:2px; }
@media (prefers-reduced-motion:no-preference){ .map-3d-pop.show .b { animation:map3dPopBob 1.8s ease-in-out infinite; } }
@keyframes map3dPopBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
`;

// ── Fake blob shadow (perf: no real shadow maps in S2b — dispatch requirement) ──
function createFakeShadow(radiusX: number, radiusZ: number, localY: number, opacity: number): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({ color: 0x5d6976, transparent: true, opacity, depthWrite: false, depthTest: true }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(radiusX, radiusZ, 1);
  shadow.position.y = localY;
  shadow.renderOrder = -1;
  return shadow;
}

function tuneMaterial(mesh: THREE.Mesh, roughnessCap: number, roughnessFloor: number, metalnessFloor: number, maxAnisotropy: number): void {
  if (Array.isArray(mesh.material)) return; // every Meshy AI asset here is single-material; skip the rare multi-material case
  mesh.material = mesh.material.clone();
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.transparent = false;
  m.opacity = 1;
  m.depthWrite = true;
  if ("roughness" in m) m.roughness = Math.min(m.roughness ?? roughnessCap, roughnessCap);
  if ("metalness" in m) m.metalness = Math.max(m.metalness ?? metalnessFloor, metalnessFloor);
  // CAM-389: GLB textures load at the GLTFLoader default anisotropy=1 → blurry at
  // the iso camera's grazing angles. Bump every map to the GPU max so props +
  // characters stay sharp when viewed obliquely (mipmaps are already on from the
  // loader default, so the anisotropic filter has a mip chain to sample).
  for (const map of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.emissiveMap, m.aoMap]) {
    if (map) {
      map.anisotropy = maxAnisotropy;
      map.needsUpdate = true;
    }
  }
}

// Characters: centered on all 3 axes, then scaled to targetHeight (ported as-is
// from the prototype's normalizeCharacter — the resulting stand height is tuned
// by the workSpot.y constants above, not by floor-aligning the mesh here).
function normalizeCharacter(root: THREE.Group, targetHeight: number, maxAnisotropy: number): THREE.Group {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(root);
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) tuneMaterial(mesh, 0.48, 0.35, 0.04, maxAnisotropy);
  });
  return root;
}

// Props: scaled to targetSize, then floor-aligned (min.y -> 0) and centered on
// X/Z only — ported as-is from the prototype's normalizeRoomProp.
function normalizeRoomProp(root: THREE.Group, targetSize: number, maxAnisotropy: number): THREE.Group {
  const size = new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(root);
  box.getSize(size);
  root.scale.setScalar(targetSize / Math.max(size.x, size.y, size.z, 0.001));
  root.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaledBox.min.y;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) tuneMaterial(mesh, 0.54, 0.42, 0.02, maxAnisotropy);
  });
  return root;
}

// Per-asset load fallback (ported from the prototype's createFallbackCharacter/
// Prop) — one failed GLB degrades to a simple placeholder mesh instead of
// blanking the whole scene.
function createFallbackCharacter(accent: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.08 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.58, 6, 12), mat);
  body.position.y = 0.22;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat);
  head.position.y = 0.92;
  group.add(body, head);
  return group;
}

function createFallbackProp(name: string): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1, 0.72, 0.72, 4, 0.12),
    new THREE.MeshStandardMaterial({ color: name.includes("plant") ? 0x6ee7a8 : 0xdcecff, roughness: 0.38, metalness: 0.04 }),
  );
  body.position.y = 0.36;
  group.add(body);
  return group;
}

function loadGltf(loader: GLTFLoader, url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

// Ported from the prototype's disposeObject3D/disposeMaterial — duck-typed
// (not isMesh-gated) so Points/Sprite geometries+materials (e.g. the
// starfield) are freed too, not just Mesh instances. Shared by the main
// cleanup (disposes the whole scene) and the late-resolved-GLB guard below
// (disposes a single loaded root that arrived after unmount).
function disposeObject3DTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const o = obj as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    o.geometry?.dispose();
    if (o.material) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => {
        Object.values(m).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
        m.dispose();
      });
    }
  });
}

// ── Static room shell: platform base + floor + two walls (ported from the
// prototype's L-room Shape/ExtrudeGeometry — only the fully-open corner is
// rounded, matching the room's one open side). ─────────────────────────────
function buildRoom(scene: THREE.Scene): void {
  const floorMat = new THREE.MeshPhysicalMaterial({ color: 0xfbfcff, roughness: 0.12, metalness: 0.02, clearcoat: 1.0, clearcoatRoughness: 0.05, reflectivity: 0.92 });
  const wallMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.02, clearcoat: 1.0, clearcoatRoughness: 0.08 });
  const baseMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.01, clearcoat: 0.95, clearcoatRoughness: 0.12 });

  const platformShape = new THREE.Shape();
  platformShape.moveTo(WALL_OUTER, toShapeY(WALL_OUTER));
  platformShape.lineTo(WALL_END, toShapeY(WALL_OUTER));
  platformShape.lineTo(WALL_END, toShapeY(OPEN_ROUND_START));
  platformShape.quadraticCurveTo(WALL_END, toShapeY(WALL_END), OPEN_ROUND_START, toShapeY(WALL_END));
  platformShape.lineTo(WALL_OUTER, toShapeY(WALL_END));
  platformShape.lineTo(WALL_OUTER, toShapeY(WALL_OUTER));
  const platformGeo = new THREE.ExtrudeGeometry(platformShape, { depth: 0.18, bevelEnabled: false, curveSegments: 28 });
  platformGeo.rotateX(-Math.PI / 2);
  platformGeo.translate(0, 0.09, 0);
  const roomBase = new THREE.Mesh(platformGeo, baseMat);
  roomBase.position.set(0, -0.18, 0);
  scene.add(roomBase);

  const floorShape = new THREE.Shape();
  floorShape.moveTo(WALL_INNER, toShapeY(WALL_INNER));
  floorShape.lineTo(WALL_END, toShapeY(WALL_INNER));
  floorShape.lineTo(WALL_END, toShapeY(OPEN_ROUND_START));
  floorShape.quadraticCurveTo(WALL_END, toShapeY(WALL_END), OPEN_ROUND_START, toShapeY(WALL_END));
  floorShape.lineTo(WALL_INNER, toShapeY(WALL_END));
  floorShape.lineTo(WALL_INNER, toShapeY(WALL_INNER));
  const floorGeo = new THREE.ShapeGeometry(floorShape, 28);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.006;
  scene.add(floor);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(WALL_SPAN, 4.3, 0.24), wallMat);
  backWall.position.set(WALL_CENTER, 2.15, WALL_OUTER + 0.12);
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.3, WALL_SPAN), wallMat);
  leftWall.position.set(WALL_OUTER + 0.12, 2.15, WALL_CENTER);
  scene.add(leftWall);
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdbe7fb, 1.1 * LIGHT_SCALE));
  const key = new THREE.DirectionalLight(0xffffff, 2.4 * LIGHT_SCALE);
  key.position.set(5, 9, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fd8ff, 1.1 * LIGHT_SCALE);
  rim.position.set(-8, 5, -8);
  scene.add(rim);
  const goldFill = new THREE.PointLight(0xf4d67a, 4.5 * LIGHT_SCALE, 16, 2.0);
  goldFill.position.set(0, 4.2, 0);
  scene.add(goldFill);
  const blueFill = new THREE.PointLight(0x7fd6ff, 4.0 * LIGHT_SCALE, 18, 2.1);
  blueFill.position.set(0, 3.0, 3.2);
  scene.add(blueFill);
}

// Optional (dispatch: "your call") — cheap ambient starfield visible through the
// room's open side, ported from the prototype's addStarfield at its default count.
function addStarfield(scene: THREE.Scene): void {
  const count = 450;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 26 + Math.random() * 24;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.9;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xdce9ff, size: 0.055, transparent: true, opacity: 0.46, sizeAttenuation: true, depthWrite: false });
  scene.add(new THREE.Points(geo, mat));
}

// ── Wall screens: per-station live-status board (CAM-379, S7) ───────────────
// See the file-header S7 note for the full design rationale.
// CAM-387: the board is a delivery CARD (ported from atlas_web_demo's
// updateBoardDisplay) drawn crisp on a thick, rounded, off-the-wall screen.
// Texture doubled (512->1024) + anisotropy so text/edges no longer pixelate on
// the ~3m panel; the drawn card coords below assume this 1024x640 canvas.
const BOARD_TEXTURE_WIDTH = 1024;
const BOARD_TEXTURE_HEIGHT = 640;
const BOARD_PANEL_WIDTH = 2.96;
const BOARD_PANEL_HEIGHT = 1.94;
// Board mesh — thick, rounded, crisp, stood off the wall (match the prototype).
const BOARD_BACK_WIDTH = 3.18;
const BOARD_BACK_HEIGHT = 2.14;
// CAM-388: match the prototype's screen exactly — a THIN rounded-rectangle
// panel with BIG face-corner radius + CRISP straight edges (an ExtrudeGeometry,
// bevelEnabled:false — see makeRoundedPanelGeometry), NOT a thick soft-beveled
// RoundedBoxGeometry. Earlier CAM-387 had the params inverted (thick 0.42 +
// tiny radius 0.06 + soft bevel) — the opposite of the reference.
const BOARD_BACK_THICKNESS = 0.1; // thin (prototype ~0.06); the crisp side edge stays visible
const BOARD_CORNER_RADIUS = 0.30; // CAM-390: was 0.42 (too round vs inner card) — 0.30 ≈ inner-card corner (~0.17) + border inset (0.11) so the outer curve sits concentric
const BOARD_STANDOFF = 0.34; // push the whole screen off the wall into the room
const BOARD_MAX_ANISOTROPY = 8; // crispness at grazing angles (was: unset -> blurry)
// Same font stack this route's overlays already load for Thai copy
// (campsite-scene.tsx's SheetTitle, campsite-overlays.tsx's HUD titles) —
// reused here, not reinvented, so Anuphan's Thai glyphs render identically
// on the canvas texture as they do in the DOM overlay chrome.
const BOARD_FONT_STACK = "'Outfit', 'Anuphan', sans-serif";

const BOARD_COPY = {
  activeStatus: "กำลังทำงาน",
  idleStatus: "ว่าง",
  queuedStatus: "มีงานรอคิว",
  idleTask: "ยังไม่มีงานที่ทำอยู่",
  countDone: "เสร็จ",
  countQueued: "รอคิว",
  approvalHeader: "คิวอนุมัติ",
  approvalActive: "รอคุณอนุมัติ",
  approvalPending: (n: number) => `${n} รายการรออนุมัติ`,
  approvalEmpty: "ไม่มีรายการรออนุมัติ",
} as const;

interface StationBoard {
  key: keyof typeof ROLE_COLORS;
  isAtlas: boolean;
  texture: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
}

function hexToCss(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clipText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** CAM-387: fraction (0..1) of this role's stories that are done — drives the
 *  card's progress bar. total = done + active + queued; 0 when the role has no
 *  work at all. Exported (named) for a real unit test, mirroring boardFacingY.
 */
export function boardProgress(agent: MapAgent | undefined): number {
  if (!agent) return 0;
  const total = agent.done + agent.activeCount + agent.queued;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, agent.done / total));
}

// Canvas glow (shadowBlur) around a single draw — save/restore so the glow
// never bleeds into later strokes. Ported from atlas_web_demo/index.html.
function withGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

type IconKey =
  | "pencil"
  | "code"
  | "server"
  | "arrows-exchange"
  | "shield-check"
  | "clipboard-check"
  | "check"
  | "upload";

// Per-role workflow icon, matching the prototype's per-station iconKey.
const ROLE_ICON: Record<keyof typeof ROLE_COLORS, IconKey> = {
  designer: "pencil",
  frontend: "code",
  backend: "server",
  architect: "arrows-exchange",
  security: "shield-check",
  atlas: "clipboard-check",
  qa: "check",
  devops: "upload",
};

// Minimal Tabler-style line-icon renderer (the subset the boards use), ported
// verbatim from atlas_web_demo/index.html's drawTablerIcon — strokes only.
function drawTablerIcon(
  ctx: CanvasRenderingContext2D,
  icon: IconKey,
  cx: number,
  cy: number,
  size: number,
  color: string,
  lineWidth = 3,
): void {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * s, cy - 12 * s);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = (cmd: (p: CanvasRenderingContext2D) => void) => {
    ctx.beginPath();
    cmd(ctx);
    ctx.stroke();
  };
  if (icon === "pencil") {
    path((p) => { p.moveTo(4, 20); p.lineTo(8, 20); p.lineTo(18.5, 9.5); p.lineTo(14.5, 5.5); p.lineTo(4, 16); p.lineTo(4, 20); });
    path((p) => { p.moveTo(13.5, 6.5); p.lineTo(17.5, 10.5); });
  } else if (icon === "code") {
    path((p) => { p.moveTo(7, 8); p.lineTo(3, 12); p.lineTo(7, 16); });
    path((p) => { p.moveTo(17, 8); p.lineTo(21, 12); p.lineTo(17, 16); });
    path((p) => { p.moveTo(14, 4); p.lineTo(10, 20); });
  } else if (icon === "server") {
    path((p) => { p.rect(4, 5, 16, 6); });
    path((p) => { p.rect(4, 13, 16, 6); });
    path((p) => { p.moveTo(8, 8); p.lineTo(8.01, 8); });
    path((p) => { p.moveTo(8, 16); p.lineTo(8.01, 16); });
  } else if (icon === "arrows-exchange") {
    path((p) => { p.moveTo(7, 7); p.lineTo(17, 7); p.lineTo(14, 4); });
    path((p) => { p.moveTo(17, 17); p.lineTo(7, 17); p.lineTo(10, 20); });
    path((p) => { p.moveTo(17, 7); p.lineTo(14, 10); });
    path((p) => { p.moveTo(7, 17); p.lineTo(10, 14); });
  } else if (icon === "check") {
    path((p) => { p.moveTo(5, 12); p.lineTo(10, 17); p.lineTo(20, 7); });
  } else if (icon === "upload") {
    path((p) => { p.moveTo(12, 15); p.lineTo(12, 4); });
    path((p) => { p.moveTo(7, 9); p.lineTo(12, 4); p.lineTo(17, 9); });
    path((p) => { p.moveTo(5, 19); p.lineTo(19, 19); });
  } else if (icon === "shield-check") {
    path((p) => { p.moveTo(12, 3); p.lineTo(20, 6.5); p.lineTo(20, 12); p.bezierCurveTo(20, 16.5, 16.8, 20.2, 12, 21); });
    path((p) => { p.moveTo(12, 3); p.lineTo(4, 6.5); p.lineTo(4, 12); p.bezierCurveTo(4, 16.5, 7.2, 20.2, 12, 21); });
    path((p) => { p.moveTo(8.8, 12.2); p.lineTo(11.1, 14.4); p.lineTo(15.6, 9.7); });
  } else {
    // clipboard-check
    path((p) => { p.rect(5, 4, 14, 17); });
    path((p) => { p.moveTo(9, 4); p.bezierCurveTo(9, 2.7, 15, 2.7, 15, 4); });
    path((p) => { p.moveTo(9, 4); p.lineTo(9, 6); p.lineTo(15, 6); p.lineTo(15, 4); });
    path((p) => { p.moveTo(8.5, 13); p.lineTo(11, 15.5); p.lineTo(16, 10.5); });
  }
  ctx.restore();
}

// The board's facing angle is DERIVED from the same station.pos (wall
// reference point) -> station.workSpot (where the character stands) pair the
// character's own facing already reads (see loadAssets' `pivot.rotation.y`
// assignment) — one formula covers both walls with no per-wall branch.
// Exported (named, per code.md's util convention) for a real geometry unit
// test, mirroring preferLowLod()'s exported-pure-predicate pattern.
export function boardFacingY(station: WorkflowStation): number {
  return Math.atan2(station.workSpot.x - station.pos.x, station.workSpot.z - station.pos.z);
}

/** CAM-379 (S7): a cheap per-scene signature over exactly the fields the
 *  boards render — role/active/activeCount/done/queued/task.id + gate count.
 *  Unrelated MapAgent/MapGate field churn (title text, url, priority,
 *  epicKey, startedAt, ...) never changes this string, so the redraw effect
 *  keyed on it (below, in Canvas3DInner) is a guaranteed no-op for an
 *  irrelevant reconcile — mirrors the file's own `gates.length`-keyed Atlas
 *  effect (S4) and the CAM-176 activeKey discipline. Exported (named) for a
 *  real unit test instead of a source-grep guard.
 */
export function computeBoardsSignature(agents: MapAgent[], gates: MapGate[]): string {
  const agentsPart = agents
    .map((a) => `${a.role}:${a.active ? 1 : 0}:${a.activeCount}:${a.done}:${a.queued}:${a.task?.id ?? ""}`)
    .join("|");
  return `${agentsPart}#${gates.length}`;
}

// Panel background + rounded border (brighter/accent-lit when active). Coords
// assume the 1024x640 board texture.
function drawBoardShell(ctx: CanvasRenderingContext2D, w: number, h: number, accent: number, active: boolean): void {
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, active ? "rgba(23, 48, 74, 0.95)" : "rgba(15, 26, 46, 0.92)");
  bg.addColorStop(1, active ? "rgba(10, 27, 48, 0.92)" : "rgba(7, 13, 24, 0.90)");
  ctx.fillStyle = bg;
  roundRectPath(ctx, 0, 0, w, h, 60);
  ctx.fill();

  ctx.strokeStyle = hexToCss(accent, active ? 0.8 : 0.45);
  ctx.lineWidth = active ? 4 : 3;
  roundRectPath(ctx, 6, 6, w - 12, h - 12, 54);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// Header row shared by every board: icon tile + title + a status dot + a status
// label. `iconKey` picks the per-role workflow glyph.
function drawBoardHeader(
  ctx: CanvasRenderingContext2D,
  w: number,
  accent: number,
  active: boolean,
  iconKey: IconKey,
  title: string,
  statusLabel: string,
): void {
  const iconCx = 96;
  const iconCy = 104;
  ctx.fillStyle = active ? hexToCss(accent, 0.22) : "rgba(255, 255, 255, 0.06)";
  roundRectPath(ctx, iconCx - 58, iconCy - 58, 116, 116, 34);
  ctx.fill();
  ctx.strokeStyle = active ? hexToCss(accent, 0.78) : "rgba(220, 238, 255, 0.16)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, iconCx - 58, iconCy - 58, 116, 116, 34);
  ctx.stroke();
  withGlow(ctx, active ? hexToCss(accent, 1) : "transparent", active ? 14 : 0, () => {
    drawTablerIcon(ctx, iconKey, iconCx + 4, iconCy, 58, active ? "#ffffff" : "rgba(236, 247, 255, 0.92)", 3);
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#F1F6FB";
  ctx.font = `800 56px ${BOARD_FONT_STACK}`;
  ctx.fillText(clipText(title, 18), 190, 96);

  ctx.fillStyle = active ? hexToCss(accent, 1) : "rgba(223, 234, 245, 0.6)";
  ctx.font = `700 30px ${BOARD_FONT_STACK}`;
  ctx.fillText(statusLabel, 192, 150);

  ctx.fillStyle = active ? hexToCss(accent, 1) : "rgba(148, 163, 184, 0.5)";
  withGlow(ctx, active ? hexToCss(accent, 0.9) : "transparent", active ? 16 : 0, () => {
    ctx.beginPath();
    ctx.arc(w - 62, 62, 15, 0, Math.PI * 2);
    ctx.fill();
  });
}

// The live delivery card (ported from atlas_web_demo's updateBoardDisplay):
// pulsing-look status dot + label + main line + sub line + a progress bar
// (bar omitted when `progress` is null, e.g. the Atlas approval card).
function drawDeliveryCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  accent: number,
  active: boolean,
  label: string,
  mainText: string,
  subText: string,
  progress: number | null,
): void {
  const cardX = 54;
  const cardY = 258;
  const cardW = w - 108;
  const cardH = 322;

  ctx.save();
  ctx.shadowColor = hexToCss(accent, active ? 0.5 : 0.2);
  ctx.shadowBlur = active ? 20 : 8;
  ctx.fillStyle = hexToCss(accent, active ? 0.12 : 0.06);
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexToCss(accent, active ? 0.82 : 0.4);
  ctx.lineWidth = active ? 3 : 2;
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = hexToCss(accent, 1);
  withGlow(ctx, active ? hexToCss(accent, 1) : "transparent", active ? 18 : 0, () => {
    ctx.beginPath();
    ctx.arc(cardX + 54, cardY + 60, active ? 14 : 11, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = hexToCss(accent, 1);
  ctx.font = `900 26px ${BOARD_FONT_STACK}`;
  ctx.fillText(label, cardX + 94, cardY + 70);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 40px ${BOARD_FONT_STACK}`;
  ctx.fillText(clipText(mainText, 34), cardX + 42, cardY + 154);

  ctx.fillStyle = "rgba(226, 240, 255, 0.72)";
  ctx.font = `700 30px ${BOARD_FONT_STACK}`;
  ctx.fillText(subText, cardX + 42, cardY + 214);

  if (progress !== null) {
    const barX = cardX + 42;
    const barY = cardY + 256;
    const barW = cardW - 84;
    const barH = 14;
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    roundRectPath(ctx, barX, barY, barW, barH, 7);
    ctx.fill();
    ctx.fillStyle = hexToCss(accent, 1);
    withGlow(ctx, active ? hexToCss(accent, 1) : "transparent", active ? 14 : 0, () => {
      roundRectPath(ctx, barX, barY, Math.max(barH, barW * progress), barH, 7);
      ctx.fill();
    });
  }
}

// Build-role board: header (role name + status) + a delivery card showing the
// current task (or the idle placeholder), the done/queued counts, and a
// progress bar — every field an AC-traceable read of the live MapAgent.
function drawRoleBoard(board: StationBoard, agent: MapAgent | undefined): void {
  const { ctx } = board;
  const w = BOARD_TEXTURE_WIDTH;
  const h = BOARD_TEXTURE_HEIGHT;
  const accent = ROLE_COLORS[board.key];
  const active = !!agent?.active;

  drawBoardShell(ctx, w, h, accent, active);

  const roleKey = ROLE_KEY_BY_CHARACTER[board.key];
  const displayName = (roleKey && ROLE_DISPLAY[roleKey]?.displayName) || board.key;
  const statusLabel = active
    ? BOARD_COPY.activeStatus
    : agent && agent.queued > 0
      ? BOARD_COPY.queuedStatus
      : BOARD_COPY.idleStatus;
  drawBoardHeader(ctx, w, accent, active, ROLE_ICON[board.key], displayName, statusLabel);

  const mainText = agent?.task?.title
    ? `${agent.task.id} · ${agent.task.title}`
    : BOARD_COPY.idleTask;
  const subText = `${BOARD_COPY.countDone} ${agent?.done ?? 0} · ${BOARD_COPY.countQueued} ${agent?.queued ?? 0}`;
  drawDeliveryCard(ctx, w, accent, active, statusLabel, mainText, subText, boardProgress(agent));

  board.texture.needsUpdate = true;
}

// Atlas board: the approval queue — mirrors the S4 Atlas gates binding
// (gates.length > 0 = pending, attention accent; 0 = calm, "no pending" copy).
function drawAtlasBoard(board: StationBoard, gatesCount: number): void {
  const { ctx } = board;
  const w = BOARD_TEXTURE_WIDTH;
  const h = BOARD_TEXTURE_HEIGHT;
  const accent = ROLE_COLORS.atlas;
  const pending = gatesCount > 0;

  drawBoardShell(ctx, w, h, accent, pending);
  drawBoardHeader(
    ctx,
    w,
    accent,
    pending,
    "clipboard-check",
    BOARD_COPY.approvalHeader,
    pending ? BOARD_COPY.approvalActive : BOARD_COPY.idleStatus,
  );
  drawDeliveryCard(
    ctx,
    w,
    accent,
    pending,
    pending ? BOARD_COPY.approvalActive : BOARD_COPY.approvalHeader,
    pending ? BOARD_COPY.approvalPending(gatesCount) : BOARD_COPY.approvalEmpty,
    "",
    null,
  );

  board.texture.needsUpdate = true;
}

// CAM-388: a flat rounded-RECTANGLE panel — the prototype's makeRoundedRectGeometry.
// An ExtrudeGeometry of a rounded-rect Shape with `bevelEnabled:false`, so the
// four FACE corners curve (radius) while every edge stays CRISP (no soft bevel)
// and the panel is thin. This is deliberately NOT RoundedBoxGeometry, which
// bevels every edge into a soft, chunky box (the CAM-387 mistake). `radius` is
// clamped so it can never exceed half the smaller side.
function makeRoundedPanelGeometry(width: number, height: number, radius: number, depth: number): THREE.ExtrudeGeometry {
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// Backplate (subtle dark glass, tinted per role) + front panel (the drawn
// CanvasTexture) at each station's `pos` — the wall/board reference point,
// distinct from `workSpot` (where the character stands). Created once at
// mount, independent of the async GLB load (loadAssets) — the boards never
// wait on character/prop assets to exist. `boardFacingY()` orients the group
// so both backPlate and panel face the room (see the file-header S7 note).
function createStationBoards(scene: THREE.Scene, maxAnisotropy: number): StationBoard[] {
  return WORKFLOW.map((station) => {
    const group = new THREE.Group();
    group.position.copy(station.pos);
    group.rotation.y = boardFacingY(station);
    scene.add(group);

    const accent = ROLE_COLORS[station.key];
    // CAM-388: a thin rounded-rectangle glass screen — big rounded FACE corners
    // (echoing the inner card) + crisp straight edges (no bevel), matching the
    // prototype's makeRoundedRectGeometry.
    const backPlate = new THREE.Mesh(
      makeRoundedPanelGeometry(BOARD_BACK_WIDTH, BOARD_BACK_HEIGHT, BOARD_CORNER_RADIUS, BOARD_BACK_THICKNESS),
      new THREE.MeshPhysicalMaterial({
        color: accent,
        transmission: 0.72,
        transparent: true,
        opacity: 0.5,
        roughness: 0.08,
        metalness: 0.02,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      }),
    );
    // Stand the whole screen off the wall so it reads as a freestanding panel.
    backPlate.position.set(0, 0, BOARD_STANDOFF);
    group.add(backPlate);

    const canvas = document.createElement("canvas");
    canvas.width = BOARD_TEXTURE_WIDTH;
    canvas.height = BOARD_TEXTURE_HEIGHT;
    // Non-null: a freshly created <canvas> always yields a 2D context (no
    // prior getContext("webgl") call on this element that would conflict).
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // CAM-387: anisotropy is THE fix for the pixelated/blurry text at grazing
    // angles (the board is viewed obliquely from the iso camera).
    texture.anisotropy = Math.min(maxAnisotropy, BOARD_MAX_ANISOTROPY);
    // CAM-389: mipmaps + trilinear are REQUIRED for the anisotropy above to do
    // anything under minification — without a mip chain the board text aliases
    // into broken lines when the board is small/oblique on screen. (WebGL2
    // handles the NPOT 640px height; the CanvasTexture regenerates mips on the
    // rare needsUpdate redraw.)
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_PANEL_WIDTH, BOARD_PANEL_HEIGHT),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.FrontSide }),
    );
    // Sit just in front of the thick backplate's front face so the text renders
    // crisp on the screen surface, not buried inside the glass slab.
    panel.position.set(0, 0, BOARD_STANDOFF + BOARD_BACK_THICKNESS / 2 + 0.012);
    group.add(panel);

    return { key: station.key, isAtlas: !!station.isAtlas, texture, ctx };
  });
}

function Canvas3DInner(
  { onReadyChange, agents, gates, onAgentActivate, onOpenGates, onOpenFirstGate }: CampsiteCanvasProps,
  ref: React.ForwardedRef<RendererHandle>,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  // CAM-375 (S3): the mount effect (below) reassigns these once the scene/actors
  // exist; useImperativeHandle itself has a stable (mount-once) identity, so it
  // always delegates through the ref rather than closing over effect-scoped
  // state directly. Reset to no-ops on unmount (the effect's cleanup) so a call
  // that races teardown never touches a disposed scene.
  const controllerRef = useRef<{
    setActivity: (activeByRole: Record<string, boolean>) => void;
    setScope: (scope: "all" | "epic", epicRoles: string[]) => void;
  }>({ setActivity: () => {}, setScope: () => {} });

  // CAM-376 (S4): a SEPARATE internal bridge for Atlas, deliberately NOT part of
  // the public RendererHandle/useImperativeHandle above (the shell never needs
  // to know Atlas exists — it already passes `gates` straight through as a
  // plain prop, same as CampsiteCanvasProps gives the 2D renderer's YouScout).
  // Mirrors controllerRef's reassign-on-mount / reset-on-cleanup pattern.
  const atlasControllerRef = useRef<{ setGatesPending: (pending: boolean) => void }>({
    setGatesPending: () => {},
  });
  // Seeds the Atlas actor's INITIAL mode at asset-load time (loadAssets() is
  // async — GLTF fetch — so it can resolve well after this component's first
  // render; reading a live ref here avoids a race where the actor is created
  // with a stale/default mode before the gates-driven effect below has had a
  // chance to call atlasControllerRef). Initialized from `gates` synchronously
  // at first render (already the real SSR-seeded value, never a placeholder),
  // then kept current by the effect below on every real gate-count change.
  const atlasGatesPendingRef = useRef(gates.length > 0);

  // CAM-379 (S7): a THIRD internal bridge, for the wall screens — same
  // reassign-on-mount / reset-on-cleanup shape as controllerRef/
  // atlasControllerRef above. Unlike atlasGatesPendingRef, the boards need no
  // parallel "pending" ref: board creation (createStationBoards) is NOT
  // gated behind the async GLB load (loadAssets) the way the Atlas actor is —
  // by the time any React effect can run, the mount effect below has already
  // created every board synchronously, so the signature-keyed effect further
  // down (which doubles as both the initial paint and every later redraw) can
  // safely call straight into this ref with no staleness window.
  const boardsControllerRef = useRef<{ redraw: (agents: MapAgent[], gates: MapGate[]) => void }>({
    redraw: () => {},
  });

  // CAM-380: a FOURTH internal bridge, for Object Edit Mode — same reassign-
  // on-mount / reset-on-cleanup shape as the three above. `editModeOn` is real
  // React state (drives the DOM toggle button's label/aria-pressed below);
  // the effect further down calls through this ref on every change, mirroring
  // the gates.length-keyed Atlas effect's bridge-on-primitive-change pattern.
  const editModeControllerRef = useRef<{ setEnabled: (enabled: boolean) => void; reset: () => void }>({
    setEnabled: () => {},
    reset: () => {},
  });
  const [editModeOn, setEditModeOn] = useState(false);

  // CAM-382: a FIFTH internal bridge, for the on-screen rotate buttons — same
  // reassign-on-mount / reset-on-cleanup shape as editModeControllerRef above.
  const propRotateControllerRef = useRef<{ rotate: (direction: 1 | -1) => void }>({
    rotate: () => {},
  });
  // Mirrors editModeOn: real React state so the rotate buttons' visibility
  // (JSX below) tracks which prop (if any) is currently selected in edit
  // mode. Set from inside the mount-once effect below (onPropPointerDown /
  // applyEditMode) — safe because useState setters have a stable identity
  // across renders, same convention as the setStatus/onReadyChange calls
  // already made from inside that same effect.
  const [selectedPropName, setSelectedPropName] = useState<string | null>(null);

  // CAM-377 (S5): latest-data refs for the raycaster's click handler (installed
  // once in the mount effect below, deps []). Without these, that handler would
  // close over the FIRST render's `agents`/`gates`/callbacks forever — a click
  // months into a session would still fire `onAgentActivate` with the agent list
  // as it existed on mount. `onOpenGates`/`onOpenFirstGate` are inline arrow
  // functions at the call site (campsite-scene.tsx's sharedRendererProps is
  // recomputed every render, not memoized), so they are NOT stable identities —
  // ref'd here same as the data, kept current by the effect right below.
  const agentsRef = useRef<MapAgent[]>(agents);
  const gatesRef = useRef<MapGate[]>(gates);
  const onAgentActivateRef = useRef(onAgentActivate);
  const onOpenGatesRef = useRef(onOpenGates);
  const onOpenFirstGateRef = useRef(onOpenFirstGate);
  useEffect(() => {
    agentsRef.current = agents;
    gatesRef.current = gates;
    onAgentActivateRef.current = onAgentActivate;
    onOpenGatesRef.current = onOpenGates;
    onOpenFirstGateRef.current = onOpenFirstGate;
  }, [agents, gates, onAgentActivate, onOpenGates, onOpenFirstGate]);

  useImperativeHandle(ref, () => ({
    setActivity: (activeByRole) => controllerRef.current.setActivity(activeByRole),
    setScope: (scope, epicRoles) => controllerRef.current.setScope(scope, epicRoles),
    // triggerWalk stays a no-op — not part of S3's scope (setActivity/setScope only).
    triggerWalk: () => {},
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    if (!canCreateWebGL()) {
      setStatus("unavailable");
      onReadyChange(true); // nothing to wait for — the no-op handle is trivially ready
      return () => onReadyChange(false);
    }

    let disposed = false;
    let rafId = 0;

    // S6 (CAM-378): decided ONCE here at mount — see preferLowLod()'s doc comment.
    // `assetBase` feeds loadAssets() below; `lowLod` also gates the pixelRatio cap
    // and the decorative starfield just below.
    const lowLod = preferLowLod();
    const assetBase = lowLod ? ASSET_BASE_LOD : ASSET_BASE;

    // canCreateWebGL() above is a point-in-time probe on a THROWAWAY canvas — it
    // does not guarantee the REAL renderer construction (on the actual canvas
    // ref, a moment later) also succeeds. Context creation can still fail here
    // (GPU driver hiccup, a rapid mount/unmount/remount racing the GPU process —
    // observed in practice under React's dev Strict-Mode double-invoke). Without
    // this try/catch, that throw is uncaught inside a synchronous effect body
    // and crashes the whole tree to the nearest error boundary instead of
    // degrading to the same "unavailable" state the pre-flight probe guards.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (err) {
      console.warn("Canvas3D: WebGL context creation failed at runtime", err);
      setStatus("unavailable");
      onReadyChange(true);
      return () => onReadyChange(false);
    }
    // S6 (CAM-378): a more aggressive pixelRatio cap on the low-LOD path (1.5 vs
    // the default 2) — fewer fragment-shader invocations per frame, compounding
    // with the lighter geometry/textures for the mobile/low-end tier.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowLod ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // CAM-389: the GPU's max anisotropy — applied to the board texture AND every
    // loaded GLB texture (props + characters) so nothing blurs at grazing angles.
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = false; // perf: fake blob shadows only (see createFakeShadow)

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081122);
    scene.fog = new THREE.FogExp2(0x081122, 0.007);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    camera.position.set(11.8, 8.0, 12.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.8, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 6.5;
    controls.maxDistance = 24;

    function setSize() {
      const w = container!.clientWidth || window.innerWidth;
      const h = container!.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    setSize();

    // CAM-377 (S5, review fix): the canvas's bounding rect, cached instead of
    // read via getBoundingClientRect() on every pointer event. Recomputed on
    // resize (below) and once here at mount. The container is `position:
    // absolute; inset: 0` inside a fixed-position ancestor (.map-wrap /
    // .map-scene), so a page scroll never moves it — no scroll listener needed.
    let canvasRect = canvas!.getBoundingClientRect();
    function updateCanvasRect(): void {
      canvasRect = canvas!.getBoundingClientRect();
    }

    addLights(scene);
    // S6 (CAM-378): the starfield is a pure decorative flourish (no state, no
    // interaction) — skipped on the low-LOD path to cut one extra Points draw
    // call + 450 vertices on mobile/low-end devices.
    if (!lowLod) addStarfield(scene);
    buildRoom(scene);
    // CAM-379 (S7): the wall screens — created here, synchronously, entirely
    // independent of loadAssets() (the async GLB fetch further below). See
    // the file-header S7 note + createStationBoards' own doc comment.
    const boards = createStationBoards(scene, maxAnisotropy);

    // CAM-380: selection affordance for Object Edit Mode — a thin glowing
    // ring under the currently-grabbed prop. Created once here (independent
    // of loadAssets, same as the boards above); position/visibility are
    // updated on select/drag/deselect only, never per animation frame beyond
    // what an in-flight drag already touches.
    //
    // CAM-383 fix (owner-reported: "buried in the floor"): a flat ring fixed
    // at y=0.03 z-fights with the floor at y=0.02 (invisible / flickering)
    // and stays glued to the floor when the selected object is raised, fully
    // disconnected from it. `depthTest: false` + a high `renderOrder` make
    // the floor mesh unable to ever occlude/z-fight the ring regardless of
    // world-Y; `updatePropSelectionRing` below now also tracks the selected
    // object's height every update instead of a fixed y=0.03.
    const propSelectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.74, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffb454,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    propSelectionRing.rotation.x = -Math.PI / 2;
    propSelectionRing.position.y = 0.03;
    propSelectionRing.visible = false;
    propSelectionRing.renderOrder = 999;
    scene.add(propSelectionRing);

    // CAM-375 (S3): live-activity state. `actors` is populated once assets load
    // (below); `clock` drives every character's motion timing.
    const clock = new THREE.Clock();
    const actors: CharacterActor[] = [];
    // CAM-377 (S5, review fix): the raycaster's hit-test target list — every
    // loaded actor's pivot, built ONCE right after `actors` is populated below
    // (the actor set never changes after load). Read-only from then on; the
    // raycaster never allocates a fresh `actors.map(...)` array per pointer event.
    const raycastPivots: THREE.Object3D[] = [];
    // CAM-387: the floating per-character "current task" popovers (DOM, over the
    // canvas). Index-aligned with `actors`, populated in loadAssets; positioned
    // by projecting each head to screen in renderFrame. A reused scratch vector
    // avoids a per-frame allocation.
    const popoverLayer = document.createElement("div");
    popoverLayer.className = "map-3d-poplayer";
    const popoverStyle = document.createElement("style");
    popoverStyle.textContent = POPOVER_CSS;
    popoverLayer.appendChild(popoverStyle);
    container!.appendChild(popoverLayer);
    const characterPopovers: HTMLDivElement[] = [];
    const popoverVec = new THREE.Vector3();
    // CAM-380: the Object Edit Mode counterpart to `actors`/`raycastPivots` —
    // populated once propScenes load (below); `propPivots` is the cached
    // hit-test target list (every prop's group), built once, never rebuilt
    // per pointer event (mirrors raycastPivots' own discipline).
    const propRecords: RoomPropRecord[] = [];
    const propPivots: THREE.Object3D[] = [];
    // Read once at mount — applied onto the prop groups right after they're
    // created in loadAssets below (loading is async, so this can't wait on it).
    const initialStoredPropLayout = readStoredPropLayout();
    // Runtime state for Object Edit Mode (mirrors the prototype's `objectEdit`
    // object), scoped to this mount like `actors`/`propRecords` above.
    const editState: {
      enabled: boolean;
      dragging: boolean;
      selected: RoomPropRecord | null;
      dragOffset: THREE.Vector3;
      floorPoint: THREE.Vector3;
      dragStartClientY: number;
      dragStartY: number;
      /** The Shift-key state the CURRENT drag is currently operating under —
       *  set at pointerdown, then kept in sync by the rebase-on-toggle logic
       *  in onPropPointerMove so switching axis mid-drag never teleports. */
      dragShiftActive: boolean;
    } = {
      enabled: false,
      dragging: false,
      selected: null,
      dragOffset: new THREE.Vector3(),
      floorPoint: new THREE.Vector3(),
      dragStartClientY: 0,
      dragStartY: 0,
      dragShiftActive: false,
    };
    const editFloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let reducedMotion = false; // set for real by applyMotionPreference() below

    // S6 (CAM-378 review fix): split the actor-motion + repaint step
    // (`renderFrame`) from the OrbitControls update step (`render`, below).
    // onControlsChange (further down) repaints via `renderFrame` ONLY — never
    // `render` — because `render`'s `controls.update()` is exactly what is
    // CURRENTLY dispatching the "change" event onControlsChange handles: on
    // OrbitControls, dispatchEvent("change") fires synchronously from INSIDE
    // update(), BEFORE it commits its own _lastPosition/_lastQuaternion/
    // _lastTargetPosition bookkeeping (three's own change-detection state). A
    // handler that calls `controls.update()` again at that point re-enters
    // update() while that bookkeeping is still stale, so the re-entrant call
    // detects "changed" too and redispatches "change" -- recursing with no
    // base case (each nested call is un-done only when the OUTERMOST call
    // finally commits, which never happens while a deeper call is still
    // in-flight). Confirmed via a real Chromium repro: with prefers-reduced-
    // motion: reduce, mounting the scene threw "RangeError: Maximum call stack
    // size exceeded" from Vector3.copy inside OrbitControls.update() on EVERY
    // mount, zero user interaction required (this bug reproduces identically
    // on the pre-S6 code — the reduced-motion path is the only caller that
    // ever re-renders directly from the "change" event, so the bug was latent
    // and invisible until this story's a11y audit exercised that path for
    // real). The camera is already fully updated by the in-flight `update()`
    // call by the time "change" fires, so a plain repaint (no second
    // `update()` call) is correct and sufficient here — see onControlsChange.
    // CAM-387: position + fill each character's "current task" popover by
    // projecting its head to the canvas. Shown only for a build role that is
    // actively working (has a task); hidden when idle or behind the camera.
    // Content (role name is static; the task code) is only written to the DOM
    // when it changes, so the per-frame cost is a couple of style writes.
    function updatePopovers(): void {
      if (!characterPopovers.length) return;
      const w = container!.clientWidth || 1;
      const h = container!.clientHeight || 1;
      // Linear lookup over the (~8-entry) live agent list, not a per-frame Map —
      // this runs every animated frame, so it follows the file's no-per-frame-
      // allocation discipline (cf. raycastPivots / the reused popoverVec).
      const liveAgents = agentsRef.current;
      actors.forEach((actor, i) => {
        const pop = characterPopovers[i];
        if (!pop) return;
        const roleKey = actor.isAtlas ? undefined : ROLE_KEY_BY_CHARACTER[actor.key];
        const agent = roleKey ? liveAgents.find((a) => a.role === roleKey) : undefined;
        if (!agent?.active) {
          pop.classList.remove("show");
          pop.style.opacity = "0";
          return;
        }
        const code =
          agent.task?.id ??
          (agent.queued > 0 ? `${BOARD_COPY.countQueued} ${agent.queued}` : BOARD_COPY.activeStatus);
        if (pop.dataset.code !== code) {
          pop.dataset.code = code;
          const codeEl = pop.querySelector(".c");
          if (codeEl) codeEl.textContent = code;
        }
        popoverVec.copy(actor.pivot.position);
        popoverVec.y += POPOVER_HEAD_OFFSET;
        popoverVec.project(camera);
        if (popoverVec.z >= 1) {
          pop.classList.remove("show");
          pop.style.opacity = "0";
          return;
        }
        pop.style.left = `${(popoverVec.x * 0.5 + 0.5) * w}px`;
        pop.style.top = `${(-popoverVec.y * 0.5 + 0.5) * h}px`;
        pop.style.opacity = "1";
        pop.classList.add("show");
      });
    }

    function renderFrame() {
      if (!reducedMotion) {
        const t = clock.getElapsedTime();
        actors.forEach((actor, i) => {
          // CAM-376 (S4): Atlas gets its own motion (reviewing/calm, never
          // patrols) instead of being skipped entirely as it was in S3.
          if (actor.isAtlas) updateAtlasMotion(actor, t, actors);
          else updateCharacterMotion(actor, t, i, actors);
          // CAM-387: pin the blob shadow to the ground (counter the pivot bob)
          // so it no longer sinks into / z-fights the floor while walking.
          actor.shadow.position.y = SHADOW_GROUND_Y - actor.pivot.position.y;
        });
      }
      updatePopovers();
      renderer.render(scene, camera);
    }
    function render() {
      controls.update();
      renderFrame();
    }

    // CAM-379 (S7): redraw every board's canvas + flip `texture.needsUpdate` —
    // called ONLY from the signature-keyed effect below (never from
    // renderFrame/the rAF loop, never per-frame). Under the continuous loop
    // the next animation frame naturally re-renders the scene (boards
    // included) with no extra call needed here; under reduced motion there is
    // no continuous loop to pick up the change on its own, so this mirrors
    // applyActivity/applyGatesPending's own "if (reducedMotion) render()"
    // on-demand-repaint contract.
    function redrawBoards(currentAgents: MapAgent[], currentGates: MapGate[]): void {
      const agentByRole = new Map(currentAgents.map((a) => [a.role, a] as const));
      boards.forEach((board) => {
        if (board.isAtlas) {
          drawAtlasBoard(board, currentGates.length);
          return;
        }
        const roleKey = ROLE_KEY_BY_CHARACTER[board.key];
        drawRoleBoard(board, roleKey ? agentByRole.get(roleKey) : undefined);
      });
      if (reducedMotion) render();
    }
    boardsControllerRef.current = { redraw: redrawBoards };

    // ── prefers-reduced-motion: continuous rAF loop vs on-demand render ──────
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    function stopLoop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }
    function loop() {
      rafId = requestAnimationFrame(loop);
      render();
    }
    function applyMotionPreference(reduced: boolean) {
      stopLoop();
      reducedMotion = reduced;
      // Damping needs several continuous frames to decay after a drag; under
      // on-demand rendering there is no continuous loop to play that decay, so
      // disable it — each drag applies immediately with no lingering inertia.
      controls.enableDamping = !reduced;
      if (reduced) {
        // Freeze every character at its current commanded pose (no lerp/patrol
        // left in flight) before the one-off render — mirrors the 2D engine's
        // reduced-motion contract (state still shown, no continuous motion).
        poseStaticAll(actors);
        render();
      } else {
        loop();
      }
    }
    function onControlsChange() {
      // renderFrame (NOT render) — see the reentrancy note on renderFrame's
      // declaration above; calling `render()` (which calls `controls.update()`
      // again) here recurses into a stack overflow.
      if (motionMq.matches) renderFrame(); // on-demand repaint only when the continuous loop is off
    }
    controls.addEventListener("change", onControlsChange);
    function onMotionChange(e: MediaQueryListEvent) {
      applyMotionPreference(e.matches);
    }
    motionMq.addEventListener("change", onMotionChange);
    applyMotionPreference(motionMq.matches);

    // ── pause the continuous loop while the tab is hidden ───────────────────
    function onVisibilityChange() {
      if (document.hidden) {
        stopLoop();
      } else if (!motionMq.matches) {
        // stopLoop() first: `loop()` is otherwise the one unguarded caller — without
        // this, a tab hidden→visible flip can schedule a second rAF chain the
        // `rafId` variable doesn't track (it gets overwritten), so it's never
        // cancelled by cleanup and can render on a disposed renderer post-unmount.
        stopLoop();
        loop();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // ── resize ───────────────────────────────────────────────────────────────
    function onResize() {
      setSize();
      updateCanvasRect(); // CAM-377 (S5, review fix): keep the cached rect in sync
      if (motionMq.matches) render(); // no continuous loop to pick this up on its own
    }
    window.addEventListener("resize", onResize);

    // ── CAM-377 (S5): raycaster hit-testing — click/tap a 3D character opens its
    // ticket, reusing the existing 2D modal flow (onAgentActivate/onOpenGates/
    // onOpenFirstGate, unchanged contracts — see CampsiteCanvasProps). Mechanism
    // ported from atlas_web_demo/index.html's pointerdown raycaster (setFromCamera
    // + intersectObjects against the character models, walk up to the actor root).
    // What's reused vs computed (review fix — the earlier comment here claimed
    // zero allocation, which `actors.map(...)` per event contradicted): the
    // Raycaster/Vector2/hitScratch array below are each a single instance reused
    // every call; `raycastPivots` (declared with `actors` above) is the hit-test
    // target list, built ONCE after load, never rebuilt per event; the canvas
    // rect is cached (`canvasRect` above), not re-read per event; the tap
    // (pointerdown/up) raycast stays immediate/unthrottled so clicks feel
    // instant, while the hover (pointermove) raycast is throttled — see
    // `onCanvasPointerMove` below — since a cursor swap needs no per-move
    // precision and an unthrottled recursive raycast against 8 full-detail GLB
    // hierarchies on every mousemove is an INP/jank risk on low-end devices.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitScratch: THREE.Intersection[] = [];

    function setPointerFromClientXY(clientX: number, clientY: number): void {
      // Canvas-relative (not window-relative, unlike the prototype) — this scene's
      // canvas fills its own container div, not necessarily the whole viewport.
      // Uses the cached `canvasRect` (kept in sync by updateCanvasRect on resize).
      pointer.x = ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
      pointer.y = -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    }

    // Walks a hit object up its parent chain to the actor's pivot (the group each
    // CharacterActor is keyed on — see the `actors.push(...)` below), mirroring the
    // prototype's `while (o && !models.includes(o)) o = o.parent`.
    function actorForObject(object: THREE.Object3D | null): CharacterActor | null {
      let current = object;
      while (current) {
        const found = actors.find((a) => a.pivot === current);
        if (found) return found;
        current = current.parent;
      }
      return null;
    }

    // Raycasts against `raycastPivots` (recursive — hits the model mesh or the
    // fake-shadow disc, both children of the pivot) and resolves the nearest hit
    // back to its CharacterActor. Returns null before assets finish loading
    // (raycastPivots.length === 0) or when the ray hits nothing.
    function pickActor(): CharacterActor | null {
      if (raycastPivots.length === 0) return null;
      hitScratch.length = 0;
      raycaster.intersectObjects(raycastPivots, true, hitScratch);
      return hitScratch.length > 0 ? actorForObject(hitScratch[0].object) : null;
    }

    // Resolves a clicked/tapped actor to the shell's existing ticket-flow contract —
    // never reimplemented here. Build-role actor -> its canonical role's live
    // MapAgent -> onAgentActivate(agent) (idle agents included: the shell's
    // handleAgentActivate already opens the roster for a taskless agent, exactly
    // matching the 2D sprite's onActivate). Atlas -> the approval queue: the first
    // gate's detail when one is pending (mirrors the 2D You alert bell), otherwise
    // just expand the ApprovalCard.
    function activateActor(actor: CharacterActor): void {
      if (actor.isAtlas) {
        if (gatesRef.current.length > 0) onOpenFirstGateRef.current();
        else onOpenGatesRef.current();
        return;
      }
      const roleKey = ROLE_KEY_BY_CHARACTER[actor.key];
      if (!roleKey) return;
      const agent = agentsRef.current.find((a) => a.role === roleKey);
      if (agent) onAgentActivateRef.current(agent);
    }

    // Tap-vs-drag guard: OrbitControls rotates the camera on the same primary-button
    // drag a selection tap uses. Only a pointerdown->pointerup pair that stayed
    // within a small movement threshold counts as a tap; anything that moved further
    // is a camera drag and must NOT open a ticket. Neither handler calls
    // preventDefault/stopPropagation, so OrbitControls' own pointerdown/pointerup
    // listeners on this same canvas are completely unaffected.
    // `movedBeyondTap` tracks the max path travelled at ANY point during the
    // press, not just the net start->end displacement -- a looping camera-orbit
    // drag that happens to end back within the threshold of where it started
    // must still count as a drag, never a tap (checked on every pointermove
    // while a button is held, below -- a cheap arithmetic check, no raycast).
    const TAP_MOVE_THRESHOLD_PX = 6;
    let pointerDownAt: { x: number; y: number } | null = null;
    let movedBeyondTap = false;

    function onCanvasPointerDown(event: PointerEvent): void {
      if (editState.enabled) return; // CAM-380: Object Edit Mode owns clicks instead — never opens a ticket
      if (event.button !== 0) { pointerDownAt = null; return; } // only the primary button/touch selects
      pointerDownAt = { x: event.clientX, y: event.clientY };
      movedBeyondTap = false;
    }
    function onCanvasPointerUp(event: PointerEvent): void {
      if (editState.enabled) return; // CAM-380: suppressed in edit mode (see onCanvasPointerDown above)
      const start = pointerDownAt;
      const wasBeyondTap = movedBeyondTap;
      pointerDownAt = null;
      movedBeyondTap = false;
      if (!start || event.button !== 0 || wasBeyondTap) return; // dragged beyond threshold at some point -- not a tap
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) return; // moved too far -- a camera drag, not a tap
      setPointerFromClientXY(event.clientX, event.clientY);
      const actor = pickActor();
      if (actor) activateActor(actor);
    }
    // Hover affordance: a plain cursor swap, no visual/DOM change to the scene
    // itself. Skipped entirely while any button is held (`event.buttons !== 0`) so
    // it never fights OrbitControls mid-drag — orbiting the camera never raycasts.
    // Throttled to ~12.5 Hz (review fix): a cursor swap needs no per-move
    // precision, and an unthrottled recursive raycast against all 8 full-detail
    // GLB character hierarchies on every mousemove is an INP/jank risk on
    // low-end devices. The tap raycast (pointerdown/up above) stays unthrottled
    // so a click still feels instant.
    const HOVER_RAYCAST_THROTTLE_MS = 80;
    let lastHoverRaycastAt = 0;
    function onCanvasPointerMove(event: PointerEvent): void {
      if (editState.enabled) return; // CAM-380: suppressed in edit mode (see onCanvasPointerDown above)
      // Path-length tracking for the tap-vs-drag guard (cheap, no raycast) --
      // runs regardless of the hover throttle below.
      if (pointerDownAt && event.buttons !== 0 && !movedBeyondTap) {
        const dx = event.clientX - pointerDownAt.x;
        const dy = event.clientY - pointerDownAt.y;
        if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) movedBeyondTap = true;
      }
      if (event.buttons !== 0) return; // dragging (camera orbit) -- no hover raycast
      const now = performance.now();
      if (now - lastHoverRaycastAt < HOVER_RAYCAST_THROTTLE_MS) return;
      lastHoverRaycastAt = now;
      setPointerFromClientXY(event.clientX, event.clientY);
      canvas!.style.cursor = pickActor() ? "pointer" : "default";
    }
    function onCanvasPointerLeave(): void {
      pointerDownAt = null;
      movedBeyondTap = false;
      if (!editState.enabled) canvas!.style.cursor = "default";
    }
    canvas.addEventListener("pointerdown", onCanvasPointerDown);
    canvas.addEventListener("pointerup", onCanvasPointerUp);
    canvas.addEventListener("pointermove", onCanvasPointerMove);
    canvas.addEventListener("pointerleave", onCanvasPointerLeave);

    // ── CAM-380: Object Edit Mode pointer handlers ───────────────────────────
    // Attached to the SAME canvas as the S5 handlers above; mutual exclusion is
    // via `editState.enabled` (S5's handlers early-return when it's true, these
    // early-return when it's false) rather than swapping listeners on/off —
    // simpler cleanup, and matches this file's existing convention of gating
    // behavior on a runtime flag inside one stable handler (e.g. reducedMotion).
    //
    // Pick + drag on the XZ plane ("ซ้าย-ขวา", left-right/forward-back): a
    // ray-plane intersection at the prop's CURRENT Y, offset by where inside
    // the prop it was grabbed (dragOffset) so the prop doesn't jump to be
    // centered under the pointer on pickup.
    //
    // Raise/lower to the floor ("ขึ้น-ลงต่ำสุดบริเวณพื้นผิว"): hold Shift while
    // dragging to move the SAME selected prop up/down instead of across the
    // floor — vertical pointer travel scales to world-Y via
    // PROP_VERTICAL_DRAG_SCALE, clamped every frame by clampPropPosition to
    // [OBJECT_FLOOR_WORLD_Y, OBJECT_CEILING_WORLD_Y] so lowering bottoms out
    // exactly ON the floor surface (never sinks through it) and raising caps
    // below the ceiling. Two separate gestures (plain-drag vs Shift+drag) on
    // the same pointer stream, chosen over a toolbar axis-toggle (the
    // prototype's approach) to keep the edit-mode chrome to a single button.
    let lastPropHoverRaycastAt = 0;

    function propRecordForObject(object: THREE.Object3D | null): RoomPropRecord | null {
      let current = object;
      while (current) {
        const found = propRecords.find((r) => r.group === current);
        if (found) return found;
        current = current.parent;
      }
      return null;
    }

    // Reuses the S5 raycaster/pointer/hitScratch (declared above) — never
    // concurrent with pickActor() since the two modes are mutually exclusive
    // at any given moment (editState.enabled gates both handler families).
    function pickProp(): RoomPropRecord | null {
      if (propPivots.length === 0) return null;
      hitScratch.length = 0;
      raycaster.intersectObjects(propPivots, true, hitScratch);
      return hitScratch.length > 0 ? propRecordForObject(hitScratch[0].object) : null;
    }

    function intersectFloorPlaneAtY(y: number, out: THREE.Vector3): THREE.Vector3 | null {
      editFloorPlane.constant = -y; // plane equation: normal(0,1,0)·p + constant = 0 -> p.y = -constant
      return raycaster.ray.intersectPlane(editFloorPlane, out);
    }

    // CAM-383: how far above the selected object's own "resting surface" the
    // ring floats — small enough to read as a halo hugging the object, large
    // enough (combined with depthTest:false above) to never re-introduce
    // z-fighting against the floor.
    const PROP_SELECTION_RING_Y_OFFSET = 0.02;

    function updatePropSelectionRing(): void {
      const record = editState.selected;
      propSelectionRing.visible = !!record && editState.enabled;
      if (!record) return;
      propSelectionRing.position.x = record.group.position.x;
      propSelectionRing.position.z = record.group.position.z;
      // CAM-383 fix: track the object's CURRENT height instead of a fixed
      // y=0.03, so a raised/lowered object carries the ring with it. Every
      // ordinary ROOM_PROPS record is floor-aligned (normalizeRoomProp), so
      // its group.position.y already IS its resting-surface height. The
      // seated Atlas is center-normalized (normalizeCharacter, targetHeight
      // set — see RoomPropDef's own doc comment) — its group ORIGIN sits at
      // the character's visual vertical center, so its resting surface is
      // targetHeight/2 below that origin.
      const restingSurfaceY =
        record.def.targetHeight !== undefined
          ? record.group.position.y - record.def.targetHeight / 2
          : record.group.position.y;
      propSelectionRing.position.y = restingSurfaceY + PROP_SELECTION_RING_Y_OFFSET;
      const ringBaseRadius = 0.68;
      const scale = Math.max(0.85, record.def.radius + 0.18) / ringBaseRadius;
      propSelectionRing.scale.set(scale, scale, scale);
    }

    function persistPropLayout(): void {
      writeStoredPropLayout(capturePropLayout(propRecords));
    }

    // Clearing an idle actor's in-flight patrol is enough to make it replan a
    // fresh route around a prop's NEW position on its very next patrol tick —
    // no forced immediate re-path is needed (ported from the prototype's
    // replanPatrolsAfterObjectEdit, minus its boss-visit-point special case,
    // which S3 already dropped as out of this file's scope).
    function replanPatrolsAfterPropEdit(): void {
      actors.forEach((actor) => {
        if (!actor.isAtlas) actor.patrol = null;
      });
    }

    function onPropPointerDown(event: PointerEvent): void {
      if (!editState.enabled || event.button !== 0) return;
      setPointerFromClientXY(event.clientX, event.clientY);
      const record = pickProp();
      editState.selected = record;
      // CAM-382: keeps the rotate buttons' React-owned visibility (JSX below)
      // in sync with the imperative selection state above.
      setSelectedPropName(record ? record.def.name : null);
      updatePropSelectionRing();
      // Review fix (selection-ring repaint): under reduced motion there is no
      // continuous loop to pick up the ring becoming visible/invisible on its
      // own — repaint once, on demand, for BOTH a real selection and a
      // click-on-empty-space deselection (mirrors applyActivity's own
      // on-demand-repaint contract elsewhere in this file).
      if (reducedMotion) render();
      if (!record) return;
      event.preventDefault();
      // Disable OrbitControls only while ACTIVELY dragging a prop — re-enabled
      // on pointer-up/cancel below (and on exiting edit mode) so the user can
      // still orbit the camera freely between drags, unlike the prototype
      // which disabled orbit for the entire edit-mode session.
      controls.enabled = false;
      editState.dragStartClientY = event.clientY;
      editState.dragStartY = record.group.position.y;
      editState.dragShiftActive = event.shiftKey;
      const hit = intersectFloorPlaneAtY(record.group.position.y, editState.floorPoint);
      if (hit) {
        editState.dragOffset.copy(record.group.position).sub(editState.floorPoint);
        editState.dragOffset.y = 0;
      } else {
        editState.dragOffset.set(0, 0, 0);
      }
      editState.dragging = true;
      canvas!.style.cursor = "grabbing";
      canvas!.setPointerCapture?.(event.pointerId);
    }

    // Review fix (Shift toggled mid-drag): `dragStartClientY`/`dragStartY`
    // (vertical axis) and `dragOffset` (XZ axis) are each meaningful only
    // relative to the axis mode active when they were captured. Toggling
    // Shift mid-drag without rebasing makes the vertical delta suddenly
    // measure from the ORIGINAL pointerdown position (a huge jump) and makes
    // the XZ branch resume from a `dragOffset` computed against a stale
    // Y-plane (also a jump) — both read as a teleport. Called once, exactly
    // when `event.shiftKey` differs from the drag's current mode, so the
    // prop continues smoothly from wherever it already is instead of
    // snapping. Not called on every move — only on the transition.
    function rebaseDragAxis(event: PointerEvent, record: RoomPropRecord): void {
      editState.dragShiftActive = event.shiftKey;
      if (event.shiftKey) {
        editState.dragStartClientY = event.clientY;
        editState.dragStartY = record.group.position.y;
      } else {
        const hit = intersectFloorPlaneAtY(record.group.position.y, editState.floorPoint);
        if (hit) {
          editState.dragOffset.copy(record.group.position).sub(editState.floorPoint);
          editState.dragOffset.y = 0;
        }
      }
    }

    function onPropPointerMove(event: PointerEvent): void {
      if (!editState.enabled) return;
      if (!editState.dragging || !editState.selected) {
        // Hover affordance only (throttled, mirrors S5's hover) — no drag in flight.
        const now = performance.now();
        if (now - lastPropHoverRaycastAt < PROP_EDIT_HOVER_THROTTLE_MS) return;
        lastPropHoverRaycastAt = now;
        setPointerFromClientXY(event.clientX, event.clientY);
        canvas!.style.cursor = pickProp() ? "grab" : "default";
        return;
      }
      // Review fix (pointercancel/missed-release recovery): a move event with
      // no button held means a pointerup/pointercancel was somehow missed
      // (observed on touch when the browser steals the pointer for its own
      // gesture) — recover exactly as if the drag had ended normally instead
      // of continuing to drag with nothing pressed.
      if (event.buttons === 0) {
        endPropDrag(event);
        return;
      }
      const record = editState.selected;
      setPointerFromClientXY(event.clientX, event.clientY);
      if (event.shiftKey !== editState.dragShiftActive) rebaseDragAxis(event, record);
      let nextX = record.group.position.x;
      let nextY = record.group.position.y;
      let nextZ = record.group.position.z;
      if (event.shiftKey) {
        // Raise/lower to the floor: dragging UP the screen (clientY decreasing)
        // raises the prop; the clamp below is what makes "lower" bottom out AT
        // the surface instead of sinking through it.
        const deltaPx = editState.dragStartClientY - event.clientY;
        nextY = editState.dragStartY + deltaPx * PROP_VERTICAL_DRAG_SCALE;
      } else {
        const hit = intersectFloorPlaneAtY(record.group.position.y, editState.floorPoint);
        if (!hit) return;
        nextX = editState.floorPoint.x + editState.dragOffset.x;
        nextZ = editState.floorPoint.z + editState.dragOffset.z;
      }
      // Review fix (per-move allocation): clamp directly into the prop's own
      // position Vector3 — no fresh {x,y,z} literal allocated per mousemove.
      clampPropPositionInto(record.group.position, nextX, nextY, nextZ, record.def.radius);
      syncPropObstacle(record);
      updatePropSelectionRing();
      // Repaint on-demand under reduced motion (no continuous loop to pick up
      // the moved prop otherwise); the normal-motion rAF loop already covers
      // this every frame regardless.
      if (reducedMotion) renderFrame();
    }

    // Shared teardown for a ended drag, regardless of HOW it ended (a normal
    // release, a pointercancel, or the buttons===0 recovery path above) — one
    // place clears `dragging`, re-enables OrbitControls, resets the cursor,
    // and persists/replans if a prop was actually being moved.
    function endPropDrag(event: PointerEvent): void {
      if (!editState.dragging) return;
      editState.dragging = false;
      controls.enabled = true; // re-enable orbit now that the drag ended
      canvas!.style.cursor = editState.selected ? "grab" : "default";
      canvas!.releasePointerCapture?.(event.pointerId);
      if (editState.selected) {
        persistPropLayout();
        replanPatrolsAfterPropEdit();
      }
    }

    function onPropPointerUp(event: PointerEvent): void {
      endPropDrag(event);
    }

    // Review fix (FIX 1): a touch/pen drag can be interrupted by the browser
    // (an OS-level gesture, or another touch stealing the pointer) WITHOUT
    // ever firing pointerup — pointercancel is the only signal in that case.
    // Without this listener, `dragging` stayed true and `controls.enabled`
    // stayed false forever (camera stuck un-orbitable, prop stuck following
    // the next move with no button held, and tapping empty space couldn't
    // recover because the null-pick path returns before re-enabling
    // controls). Listened on the SAME target as pointerup (window) and runs
    // the identical teardown.
    function onPropPointerCancel(event: PointerEvent): void {
      endPropDrag(event);
    }

    canvas.addEventListener("pointerdown", onPropPointerDown);
    canvas.addEventListener("pointermove", onPropPointerMove);
    window.addEventListener("pointerup", onPropPointerUp);
    window.addEventListener("pointercancel", onPropPointerCancel);

    // ── assets: characters + props, in parallel, per-item fallback ──────────
    const loader = new GLTFLoader();

    async function loadAssets() {
      const characterScenes = await Promise.all(
        WORKFLOW.map((station) =>
          loadGltf(loader, `${assetBase}${station.characterFile}`).catch((err) => {
            console.warn(`Canvas3D: character fallback for ${station.key}`, err);
            return createFallbackCharacter(ROLE_COLORS[station.key]);
          }),
        ),
      );
      if (disposed) {
        // Unmounted while these were in flight — transient (GC'd regardless),
        // but cheap to dispose explicitly rather than leave it to GC timing.
        characterScenes.forEach(disposeObject3DTree);
        return;
      }
      WORKFLOW.forEach((station, i) => {
        const pivot = new THREE.Group();
        pivot.position.copy(station.workSpot);
        // Face the board reference point (no board panel is rendered in S2b).
        pivot.rotation.y = Math.atan2(station.pos.x - pivot.position.x, station.pos.z - pivot.position.z);
        const model = normalizeCharacter(characterScenes[i], station.isAtlas ? 1.55 : 1.48, maxAnisotropy);
        pivot.add(model);
        const fakeShadow = createFakeShadow(station.isAtlas ? 0.58 : 0.5, station.isAtlas ? 0.34 : 0.3, -0.86, 0.12);
        pivot.add(fakeShadow);
        const roleLight = new THREE.PointLight(ROLE_COLORS[station.key], (station.isAtlas ? 1.2 : 0.65) * LIGHT_SCALE, station.isAtlas ? 2.4 : 1.8, 2.0);
        roleLight.position.set(0, 1.12, 0.05);
        pivot.add(roleLight);
        scene.add(pivot);

        // CAM-375 (S3): live-activity actor state. Default mode is "active" (the
        // character's created position IS its workSpot already) so there is no
        // flash-of-wandering before the shell's first real setActivity call
        // arrives; Atlas is still pushed (poseStaticAll/setActorDim skip it via
        // isAtlas) so array indices stay 1:1 with WORKFLOW for bobPhase.
        // CAM-376 (S4): Atlas's initial mode is seeded from atlasGatesPendingRef
        // (the latest known gates.length > 0, kept current independent of this
        // async load — see the ref's declaration comment) instead of the build
        // roles' unconditional "active" default, so Atlas never flashes a
        // reviewing pose when the queue actually started empty (or vice versa).
        actors.push({
          key: station.key,
          isAtlas: !!station.isAtlas,
          pivot,
          workSpot: station.workSpot,
          facePos: station.pos,
          homePoint: ROUTE_POINTS[findNearestRouteIndex(station.workSpot)].clone(),
          bobPhase: i,
          mode: station.isAtlas ? (atlasGatesPendingRef.current ? "active" : "idle") : "active",
          dimmed: false,
          patrol: null,
          transit: null,
          light: roleLight,
          shadow: fakeShadow,
        });
      });
      // CAM-377 (S5, review fix): build the raycast target list exactly once,
      // right after every actor exists — not per pointer event.
      raycastPivots.push(...actors.map((a) => a.pivot));

      // CAM-387: one "current task" popover per character, index-aligned with
      // `actors`. Atlas gets one too (kept for index alignment) but it is never
      // shown — updatePopovers skips it (Atlas status lives on its wall board).
      actors.forEach((actor) => {
        const pop = document.createElement("div");
        pop.className = "map-3d-pop";
        pop.style.setProperty("--pa", `#${ROLE_COLORS[actor.key].toString(16).padStart(6, "0")}`);
        const roleKey = ROLE_KEY_BY_CHARACTER[actor.key];
        const name = (roleKey && ROLE_DISPLAY[roleKey]?.displayName) || actor.key;
        pop.innerHTML = `<div class="b"><span class="r"><span class="t"></span><span class="c"></span></span></div>`;
        const titleEl = pop.querySelector(".t");
        if (titleEl) titleEl.textContent = name;
        popoverLayer.appendChild(pop);
        characterPopovers.push(pop);
      });

      const propScenes = await Promise.all(
        ROOM_PROPS.map((item) =>
          loadGltf(loader, `${assetBase}${item.file}`).catch((err) => {
            console.warn(`Canvas3D: prop fallback for ${item.name}`, err);
            return createFallbackProp(item.name);
          }),
        ),
      );
      if (disposed) {
        propScenes.forEach(disposeObject3DTree);
        return;
      }
      ROOM_PROPS.forEach((item, i) => {
        const group = new THREE.Group();
        group.position.copy(item.position);
        group.rotation.y = item.rotationY;
        // ROOM_PROPS entries always set targetSize (only the seated-Atlas
        // def, built in its own branch below via normalizeCharacter, omits
        // it in favor of targetHeight — see RoomPropDef's own doc comment).
        group.add(normalizeRoomProp(propScenes[i], item.targetSize!, maxAnisotropy));
        group.add(createFakeShadow(item.radius * 0.72, item.radius * 0.46, 0.01, 0.09));
        scene.add(group);
        // CAM-380: Object Edit Mode record, keyed to the SAME NAVIGATION_OBSTACLES
        // entry the patrol/collision functions above already read (index-aligned
        // — both are built from ROOM_PROPS in this same order).
        const record: RoomPropRecord = { def: item, group, obstacle: NAVIGATION_OBSTACLES[i] };
        propRecords.push(record);
        // Review fix (FIX 3, stale obstacle on remount): NAVIGATION_OBSTACLES
        // is a module-level array that outlives a single mount (a 2D<->3D
        // toggle creates a brand-new `group` here every time but reuses the
        // SAME obstacle entries) — reseed it to THIS fresh group's default
        // position now, before any saved layout is applied below. Without
        // this, a prior session's dragged obstacle position would leak into
        // a fresh mount whose localStorage has no entry for this prop
        // (private-mode storage, or a drag that was picked up then never
        // released/persisted): the prop would render back at its default
        // spot while patrols kept avoiding the OLD position — an invisible
        // obstacle / a clipped visible prop.
        syncPropObstacle(record);
      });

      // CAM-383: the seated Atlas — now a fully independent, editable object
      // (its own scene-level THREE.Group, no longer a child of the sofa's
      // group). Built in its OWN branch, NOT normalizeRoomProp/createFakeShadow
      // like the 5 props above: it is center-normalized via normalizeCharacter
      // (the same function every build-role/Atlas character uses) — no floor
      // align, no fake shadow, matching a seated character's actual geometry.
      // Per-asset load fallback: unlike a real character/prop, a failed load
      // here is skipped silently (no fallback mesh, no record at all) — this
      // is decorative-in-origin and the sofa itself already renders fine
      // either way.
      try {
        const seatedAtlasScene = await loadGltf(loader, `${assetBase}${SEATED_ATLAS_PROP_DEF.file}`);
        if (disposed) {
          disposeObject3DTree(seatedAtlasScene);
        } else {
          const group = new THREE.Group();
          group.position.copy(SEATED_ATLAS_PROP_DEF.position);
          group.rotation.y = SEATED_ATLAS_PROP_DEF.rotationY;
          // SEATED_ATLAS_PROP_DEF always sets targetHeight (see its own
          // definition above) — this is the one call site that reads it.
          group.add(normalizeCharacter(seatedAtlasScene, SEATED_ATLAS_PROP_DEF.targetHeight!, maxAnisotropy));
          scene.add(group);
          // Registered into the SAME propRecords/propPivots machinery as the
          // 5 ROOM_PROPS above (CAM-383) — it now gets the identical
          // selection ring + XZ drag + Shift-height clamp + ↺↻ rotate +
          // persistence every other room prop already has. Still stays OUT
          // of `actors`/`raycastPivots` (the S5 character raycaster), so it
          // is never one of the 8 build-role/Atlas characters, never
          // activity/gate-driven, and a normal-mode click on it opens no
          // ticket (prop-pick is gated on editState.enabled — see
          // onPropPointerDown above).
          const record: RoomPropRecord = {
            def: SEATED_ATLAS_PROP_DEF,
            group,
            obstacle: NAVIGATION_OBSTACLES[ROOM_PROPS.length],
          };
          propRecords.push(record);
          syncPropObstacle(record);
        }
      } catch (err) {
        console.warn("Canvas3D: seated Atlas skipped (decorative, load failed)", err);
      }

      // CAM-380/CAM-383: restore any saved layout now that EVERY editable
      // record exists — the 5 ROOM_PROPS plus the seated Atlas (a record with
      // no saved entry keeps its module-level default position/rotation, and
      // the obstacle reseed above, not a stale prior session's). Moved to
      // run after the Atlas branch (rather than immediately after the
      // ROOM_PROPS.forEach) specifically so the Atlas's own saved position/
      // rotation restores too, backward-compatible with any layout saved
      // before this story (which simply has no "seated-atlas" key).
      applyStoredPropLayout(propRecords, initialStoredPropLayout);
      // CAM-377-style cached hit-test target list, built once (never rebuilt
      // per pointer event — mirrors raycastPivots just above) — includes the
      // seated Atlas now that it is registered above.
      propPivots.push(...propRecords.map((r) => r.group));

      if (disposed) return;
      setStatus("ready");
      onReadyChange(true);
      // CAM-375 (S3) fix: under reduced motion there is no continuous loop to
      // pick up the just-added character/prop meshes on its own next tick (the
      // only earlier render() call happened at mount, before any of this
      // existed) — without this, the scene would stay empty (room/lights only)
      // until the next OrbitControls drag or window resize triggers render().
      if (reducedMotion) {
        poseStaticAll(actors);
        render();
      }
    }

    loadAssets().catch((err) => {
      // Promise.all above already catches every per-item failure into a fallback
      // mesh, so reaching here means a genuinely unexpected scene-graph error —
      // the room/lights already rendered, just without every actor. Report ready
      // regardless so the shell never hangs waiting on a renderer that exists.
      console.error("Canvas3D: scene assembly error", err);
      if (!disposed) {
        setStatus("ready");
        onReadyChange(true);
        if (reducedMotion) render(); // same reduced-motion gap as the success path above
      }
    });

    // CAM-375 (S3): bridge the imperative handle (declared once, outside this
    // effect) to this mount's actual scene state. setActivity is an idempotent
    // STATE SET, never a re-path — an actor whose commanded mode is unchanged
    // is skipped entirely (its in-flight patrol/transit is left alone), which
    // is exactly what preserves the shell's activeKey-only call contract: even
    // if the shell ever called setActivity twice with the same activeByRole,
    // the second call would be a no-op here.
    function applyActivity(activeByRole: Record<string, boolean>): void {
      const t = clock.getElapsedTime();
      let changed = false;
      for (const actor of actors) {
        if (actor.isAtlas) continue; // not bound to a build role in S3
        const roleKey = ROLE_KEY_BY_CHARACTER[actor.key];
        if (!roleKey) continue;
        const nextMode: "active" | "idle" = activeByRole[roleKey] ? "active" : "idle";
        if (nextMode === actor.mode) continue; // idempotent — unchanged actors are never re-pathed
        changed = true;
        actor.mode = nextMode;
        actor.patrol = null;
        actor.transit =
          nextMode === "active" && !reducedMotion
            ? {
                from: actor.pivot.position.clone(),
                startTime: t,
                duration: Math.max(0.6, actor.pivot.position.distanceTo(actor.workSpot) / 2.2),
              }
            : null;
      }
      // Under reduced motion there is no continuous loop to apply the new pose
      // on its own — re-pose + repaint once, on demand (mirrors applyMotionPreference).
      if (changed && reducedMotion) {
        poseStaticAll(actors);
        render();
      }
    }

    function applyScope(scope: "all" | "epic", epicRoles: string[]): void {
      let changed = false;
      for (const actor of actors) {
        if (actor.isAtlas) continue; // Atlas is not gated by epic scope in S3 (S4 decides its own binding)
        const roleKey = ROLE_KEY_BY_CHARACTER[actor.key];
        const dim = scope === "epic" && !!roleKey && !epicRoles.includes(roleKey);
        if (setActorDim(actor, dim)) changed = true;
      }
      if (changed && reducedMotion) render();
    }

    // CAM-376 (S4): the Atlas-only counterpart to applyActivity — bridges
    // atlasControllerRef (declared once, outside this effect) to this mount's
    // actual Atlas actor. Same idempotence contract as applyActivity: an
    // unchanged gates-pending signature is a guaranteed no-op, so it never
    // restarts Atlas's in-flight pose/light animation.
    function applyGatesPending(pending: boolean): void {
      const atlasActor = actors.find((a) => a.isAtlas);
      if (!atlasActor) return; // assets not loaded yet — atlasGatesPendingRef seeds the initial mode instead
      const nextMode: "active" | "idle" = pending ? "active" : "idle";
      if (nextMode === atlasActor.mode) return; // idempotent — mirrors applyActivity's contract
      atlasActor.mode = nextMode;
      // Under reduced motion there is no continuous loop to apply the new pose
      // on its own — re-pose + repaint once, on demand (mirrors applyActivity).
      if (reducedMotion) {
        poseStaticAll(actors);
        render();
      }
    }

    // CAM-380: the Object Edit Mode toggle — bridges editModeControllerRef
    // (declared once, outside this effect) to this mount's actual
    // editState/controls. Mirrors applyActivity/applyGatesPending's own
    // bridge-function pattern above. Always re-enables OrbitControls on a
    // mode switch (never leaves it disabled across a toggle) and clears any
    // stale selection/cursor from a prior session.
    function applyEditMode(enabled: boolean): void {
      editState.enabled = enabled;
      editState.dragging = false;
      editState.selected = null;
      setSelectedPropName(null); // CAM-382: hides the rotate buttons on toggle
      controls.enabled = true;
      canvas!.style.cursor = "default";
      updatePropSelectionRing();
      if (reducedMotion) render();
    }

    // CAM-380: the "รีเซ็ต" action — clears the saved override and restores
    // every prop to its ROOM_PROPS default position (ported from the
    // prototype's resetObjectLayout, minus its optional "set current as
    // default" companion action, which the dispatch didn't ask for).
    // CAM-382: also restores each prop's default rotation (record.def.rotationY)
    // — a reset undoes rotate the same way it already undoes drag/raise-lower.
    function resetPropLayout(): void {
      propRecords.forEach((record) => {
        const clamped = clampPropPosition(
          record.def.position.x,
          record.def.position.y,
          record.def.position.z,
          record.def.radius,
        );
        record.group.position.set(clamped.x, clamped.y, clamped.z);
        record.group.rotation.y = record.def.rotationY;
        syncPropObstacle(record);
      });
      writeStoredPropLayout({}); // clears the saved override — next mount reads ROOM_PROPS defaults
      replanPatrolsAfterPropEdit();
      updatePropSelectionRing();
      if (reducedMotion) render();
    }

    // CAM-382: the on-screen ↺/↻ turn-button action — rotates the CURRENTLY
    // SELECTED prop by one 15° step around Y (direction: -1 = ↺/CCW, +1 =
    // ↻/CW), normalized, then persists the full layout snapshot (same
    // capturePropLayout path the drag-release persist already uses — see
    // persistPropLayout above). A no-op when nothing is selected (the JSX
    // below also hides the buttons in that state, so this only guards a
    // stray call). Rotation never touches the circular nav obstacle
    // (radius-based, unaffected by facing) — no syncPropObstacle call here,
    // unlike a position change.
    function rotateSelectedProp(direction: 1 | -1): void {
      const record = editState.selected;
      if (!record) return;
      record.group.rotation.y = normalizeYRotation(record.group.rotation.y + direction * PROP_ROTATE_STEP_RAD);
      persistPropLayout();
      // On-demand repaint under reduced motion only (mirrors resetPropLayout/
      // applyEditMode's own contract) — the continuous rAF loop already
      // covers this every frame under normal motion.
      if (reducedMotion) render();
    }

    controllerRef.current = { setActivity: applyActivity, setScope: applyScope };
    atlasControllerRef.current = { setGatesPending: applyGatesPending };
    editModeControllerRef.current = { setEnabled: applyEditMode, reset: resetPropLayout };
    propRotateControllerRef.current = { rotate: rotateSelectedProp };

    return () => {
      disposed = true;
      controllerRef.current = { setActivity: () => {}, setScope: () => {} };
      atlasControllerRef.current = { setGatesPending: () => {} };
      boardsControllerRef.current = { redraw: () => {} };
      editModeControllerRef.current = { setEnabled: () => {}, reset: () => {} };
      propRotateControllerRef.current = { rotate: () => {} };
      stopLoop();
      // CAM-387: tear down the floating task popovers (DOM child of container).
      popoverLayer.remove();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionMq.removeEventListener("change", onMotionChange);
      controls.removeEventListener("change", onControlsChange);
      // CAM-377 (S5): raycaster pointer listeners.
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      canvas.removeEventListener("pointerup", onCanvasPointerUp);
      canvas.removeEventListener("pointermove", onCanvasPointerMove);
      canvas.removeEventListener("pointerleave", onCanvasPointerLeave);
      // CAM-380: Object Edit Mode pointer listeners.
      canvas.removeEventListener("pointerdown", onPropPointerDown);
      canvas.removeEventListener("pointermove", onPropPointerMove);
      window.removeEventListener("pointerup", onPropPointerUp);
      window.removeEventListener("pointercancel", onPropPointerCancel);
      controls.dispose();
      // CAM-379 (S7): disposeObject3DTree already walks the WHOLE scene graph —
      // every board's group/backPlate/panel was added via scene.add()/
      // group.add() above, so this single call disposes their geometries,
      // materials, AND each panel's CanvasTexture (duck-typed `instanceof
      // THREE.Texture` inside disposeObject3DTree — no board-specific
      // disposal code needed). The detached offscreen <canvas> elements
      // (never appended to the DOM) are then plain garbage once nothing
      // references them.
      disposeObject3DTree(scene);
      renderer.renderLists.dispose();
      // forceContextLoss() BEFORE dispose(): dispose() alone frees three's own
      // buffers/programs but leaves the underlying WebGL context to be reclaimed
      // by GC non-deterministically. Each 2D<->3D toggle mounts a fresh renderer
      // (a fresh context), so without this, repeated toggling can accumulate live
      // contexts up to the browser's cap (Chromium: ~16) and the scene goes black
      // ("Too many active WebGL contexts"). forceContextLoss() releases the GPU
      // context immediately and deterministically on unmount.
      renderer.forceContextLoss();
      renderer.dispose();
      onReadyChange(false);
      // canvasRef's <canvas> is a JSX-rendered element — React removes it from
      // the DOM as part of unmounting this component; nothing to detach by hand.
    };
    // mount-once — onReadyChange is the shell's stable state setter (identity
    // never changes); mirrors campsite-canvas.tsx's mount-once effect convention.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CAM-376 (S4): drive Atlas from the gate/approval queue. Dep is `gates.length`
  // (a primitive), NOT `gates` (a new array reference on every SSE reconcile) —
  // this is the gate-SIGNATURE guard: a reconcile that changes unrelated fields
  // (gate title/url/priority, or any other liveModel field) never re-runs this
  // effect at all, and even if it did, applyGatesPending's own idempotence check
  // (nextMode === atlasActor.mode) makes an unchanged COUNT a hard no-op either
  // way — Atlas's animation is never restarted by a no-op signature.
  useEffect(() => {
    atlasGatesPendingRef.current = gates.length > 0;
    atlasControllerRef.current.setGatesPending(gates.length > 0);
  }, [gates.length]);

  // CAM-379 (S7): drive every wall screen from the live agents/gates — dep is
  // `boardsSignature` (a STRING computed from exactly the fields the boards
  // render), NOT `agents`/`gates` (new array/object references on every SSE
  // reconcile). This is the redraw-on-signature-change discipline the file-
  // header S7 note describes: an unrelated field changing (title text, url,
  // startedAt, ...) never re-runs this effect, so the boards' canvases are
  // never redrawn for a no-op change — mirrors the Atlas effect just above
  // (keyed on `gates.length`, a primitive) and the CAM-176 activeKey
  // discipline. This effect ALSO doubles as the initial paint: on mount, the
  // WebGL-availability-gated effect above has already run synchronously
  // (including its own `applyMotionPreference` call, so `reducedMotion` is
  // already resolved) and set boardsControllerRef.current to the real
  // `redrawBoards`, by the time this effect's first run fires — no separate
  // "pending ref" seed is needed the way Atlas's actor needs one (that race
  // is specific to Atlas's actor only existing once the async GLB load
  // resolves; the boards exist synchronously at mount, independent of it).
  const boardsSignature = computeBoardsSignature(agents, gates);
  useEffect(() => {
    boardsControllerRef.current.redraw(agents, gates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardsSignature]);

  // CAM-380: drive Object Edit Mode from the DOM toggle button's React state —
  // dep is the primitive `editModeOn` boolean (mirrors the gates.length-keyed
  // Atlas effect above): a re-render that doesn't flip this flag never re-runs
  // the effect, and editModeControllerRef.current.setEnabled itself is a plain
  // reassignment (no in-flight animation to restart) either way.
  useEffect(() => {
    editModeControllerRef.current.setEnabled(editModeOn);
  }, [editModeOn]);

  // CAM-375 (S3): React-owned (re-computed on every `agents` prop update,
  // independent of the WebGL rAF loop) so the scene's accessible state summary
  // stays accurate even under prefers-reduced-motion, where the characters'
  // own visual motion is frozen (mirrors campsite-canvas.tsx's S7 sceneAriaLabel
  // pattern — active count is always announced from real data, never animation).
  // CAM-376 (S4): appends the pending-approval count (Atlas is never counted in
  // activeAgentCount — MapAgent[] never contains an Atlas/orchestrator entry —
  // so this is purely additive, not a double-count).
  const activeAgentCount = agents.filter((a) => a.active).length;
  const gatesAriaSuffix = gates.length > 0 ? ` มี ${gates.length} รายการรออนุมัติ` : "";
  const sceneAriaLabel = `ห้องทำงาน 3 มิติของทีม AI delivery: Atlas และเพื่อนร่วมทีมอีก 7 คน ประจำอยู่ที่สถานีของตนเอง (กำลังทำงาน ${activeAgentCount}/7 คน)${gatesAriaSuffix}`;

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, zIndex: 5 }}
      role="img"
      aria-label={sceneAriaLabel}
      data-testid="scene--status-map-3d"
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      {/* CAM-374: per .claude/rules/loading.md, a full-screen canvas module uses a
          progress indicator (not a skeleton/text card) while assets are still
          downloading — covers the in-progress room until it's ready, then reveals
          it. Reuses the shared MapProgress (same component as the Suspense
          fallback above it in campsite-scene.tsx) with a more specific label. */}
      {status === "loading" && <MapProgress label={COPY.loading} />}
      {/* "unavailable" is a terminal state (no WebGL), not a load-in-progress —
          keep the informative text card telling the user to switch back to 2D
          instead of a progress bar that would misleadingly imply it will finish. */}
      {status === "unavailable" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none", // lets the user orbit-drag the camera even while this shows
          }}
        >
          <div className="map-placeholder" role="status" aria-live="polite">
            <p className="map-placeholder-text">{COPY.unavailable}</p>
          </div>
        </div>
      )}
      {/* CAM-380: Object Edit Mode toggle — a small DOM overlay, 3D-view-only
          (this component never mounts in 2D). Dark-glass HUD idiom (matches
          .map-placeholder's --glass/--blur/--line/--r tokens from
          campsite-assets.ts) via a scoped inline <style>, same technique
          MapProgress above already uses for its own standalone CSS — this
          route's HUD_CSS (campsite-overlays.tsx) is shell-owned chrome this
          self-contained component does not reach into. Gated on
          status === "ready": editing props before the room/props exist is
          meaningless, and the toggle would otherwise appear over the loading
          progress bar or the "unavailable" text card. */}
      {status === "ready" && (
        <div style={{ position: "absolute", left: 16, bottom: 16, zIndex: 6, display: "flex", gap: 8, alignItems: "center" }}>
          <style>{`
            .map-3d-edit-btn {
              display: inline-flex; align-items: center; justify-content: center;
              min-height: 44px; min-width: 44px; padding: 0 18px;
              border-radius: 999px;
              border: 1px solid rgba(255, 255, 255, 0.13);
              background: rgba(16, 26, 42, 0.42);
              backdrop-filter: saturate(150%) blur(20px);
              -webkit-backdrop-filter: saturate(150%) blur(20px);
              box-shadow: 0 14px 44px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.16);
              color: #F1F6FB;
              font-family: 'Outfit', 'Anuphan', sans-serif;
              font-size: 13px; font-weight: 700;
              cursor: pointer;
              transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
            }
            .map-3d-edit-btn:hover { background: rgba(255, 255, 255, 0.08); }
            .map-3d-edit-btn:focus-visible { outline: 2px solid #5BE9B0; outline-offset: 2px; }
            .map-3d-edit-btn[aria-pressed="true"] {
              color: #FFB454; border-color: rgba(255, 180, 84, 0.4); background: rgba(255, 180, 84, 0.14);
            }
            .map-3d-rotate-group {
              display: inline-flex; align-items: center; gap: 8px;
              min-height: 44px; padding: 0 14px 0 18px;
              border-radius: 999px;
              border: 1px solid rgba(255, 255, 255, 0.13);
              background: rgba(16, 26, 42, 0.42);
              backdrop-filter: saturate(150%) blur(20px);
              -webkit-backdrop-filter: saturate(150%) blur(20px);
              box-shadow: 0 14px 44px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.16);
              color: #F1F6FB;
              font-family: 'Outfit', 'Anuphan', sans-serif;
              font-size: 13px; font-weight: 700;
            }
            .map-3d-rotate-btn {
              display: inline-flex; align-items: center; justify-content: center;
              min-height: 44px; min-width: 44px;
              border-radius: 999px;
              border: 1px solid rgba(255, 255, 255, 0.13);
              background: rgba(255, 255, 255, 0.06);
              color: #F1F6FB;
              font-size: 18px; line-height: 1;
              cursor: pointer;
              transition: background 140ms ease, border-color 140ms ease;
            }
            .map-3d-rotate-btn:hover { background: rgba(255, 255, 255, 0.14); }
            .map-3d-rotate-btn:focus-visible { outline: 2px solid #5BE9B0; outline-offset: 2px; }
          `}</style>
          <button
            type="button"
            className="map-3d-edit-btn"
            aria-pressed={editModeOn}
            aria-label={editModeOn ? COPY.editModeExit : COPY.editModeEnter}
            title={editModeOn ? COPY.editModeExit : COPY.editModeEnter}
            data-testid="btn--map-3d-edit"
            onClick={() => setEditModeOn((prev) => !prev)}
          >
            {editModeOn ? COPY.editModeExit : COPY.editModeEnter}
          </button>
          {editModeOn && (
            <button
              type="button"
              className="map-3d-edit-btn"
              aria-label={COPY.editModeReset}
              title={COPY.editModeReset}
              data-testid="btn--map-3d-edit-reset"
              onClick={() => editModeControllerRef.current.reset()}
            >
              {COPY.editModeReset}
            </button>
          )}
          {/* CAM-382: the rotate control — visible only while a prop is
              selected in edit mode (selectedPropName is kept in sync by the
              mount effect's onPropPointerDown/applyEditMode above). Two DOM
              buttons, entirely independent of the canvas pointer handlers —
              a click here never touches the WebGL raycaster. */}
          {editModeOn && selectedPropName && (
            <div className="map-3d-rotate-group" data-testid="section--map-3d-rotate">
              <span>{PROP_DISPLAY_NAME[selectedPropName] ?? selectedPropName}</span>
              <button
                type="button"
                className="map-3d-rotate-btn"
                aria-label={COPY.rotateCcw}
                title={COPY.rotateCcw}
                data-testid="btn--map-3d-rotate-ccw"
                onClick={() => propRotateControllerRef.current.rotate(-1)}
              >
                ↺
              </button>
              <button
                type="button"
                className="map-3d-rotate-btn"
                aria-label={COPY.rotateCw}
                title={COPY.rotateCw}
                data-testid="btn--map-3d-rotate-cw"
                onClick={() => propRotateControllerRef.current.rotate(1)}
              >
                ↻
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Canvas3D = forwardRef(Canvas3DInner);
Canvas3D.displayName = "Canvas3D";

export default Canvas3D;
