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

const COPY = {
  loading: "กำลังโหลดมุมมอง 3 มิติ…",
  unavailable: "อุปกรณ์นี้ไม่รองรับการแสดงผล 3 มิติ กรุณาสลับกลับไปมุมมอง 2 มิติ",
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
  targetSize: number;
  radius: number;
}

// Ported from the prototype's roomPropDefs (the seated-Atlas-on-sofa decorative
// extra is intentionally dropped — no optimized `atlas-sit.glb` exists; CAM-373
// S2a found only a pre-compressed meshopt source for it, which the WASM-free
// pipeline cannot use, so there was nothing to port here).
const ROOM_PROPS: RoomPropDef[] = [
  { name: "sofa", file: "sofa.glb", position: new THREE.Vector3(0.5, 0.02, 1.4), rotationY: -Math.PI / 2, targetSize: 2.48, radius: 1.62 },
  { name: "table-oval", file: "table-oval.glb", position: new THREE.Vector3(1.8, 0.02, 3.7), rotationY: Math.PI / 2, targetSize: 1.46, radius: 0.98 },
  { name: "table-lumen", file: "table-lumen.glb", position: new THREE.Vector3(-0.8, 0.02, 3.7), rotationY: Math.PI / 2, targetSize: 1.92, radius: 1.26 },
  { name: "data-vault", file: "data-vault.glb", position: new THREE.Vector3(3.6, 0.02, 1.4), rotationY: Math.PI / 2, targetSize: 1.52, radius: 1.04 },
  { name: "plant", file: "plant.glb", position: new THREE.Vector3(-2.6, 0.02, 1.4), rotationY: Math.PI / 2, targetSize: 1.02, radius: 0.72 },
];

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
const NAVIGATION_OBSTACLES = ROOM_PROPS.map((item) => ({
  x: item.position.x,
  z: item.position.z,
  radius: item.radius,
}));

// ── Atlas motion tuning (CAM-376, S4) ────────────────────────────────────────
// Distinct from both the build-role "active" bob (0.025 @ 2.8) and "idle"
// patrol bob (0.03 @ 2.4) — reviewing reads as "surfacing/assigning work"
// (quicker bob + a scanning gaze sweep across the approval area), calm reads
// as a slow, minimal idle breath. Values are a design call (dispatch note);
// tune on Staging.
const ATLAS_REVIEW_BOB_AMPLITUDE = 0.022;
const ATLAS_REVIEW_BOB_FREQ = 3.4;
const ATLAS_REVIEW_GAZE_SWEEP = 0.4; // radians, +/- sweep toward the approval area
const ATLAS_REVIEW_GAZE_FREQ = 1.05;
const ATLAS_CALM_BOB_AMPLITUDE = 0.01;
const ATLAS_CALM_BOB_FREQ = 1.5;
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

  // Idle: patrol the room (ported from the prototype's updateActorPatrols).
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
  actor.pivot.position.y = 0.92 + Math.sin(t * 2.4 + index) * 0.03;
  const dir = Math.atan2(end.x - patrol.from.x, end.z - patrol.from.z);
  actor.pivot.rotation.y = THREE.MathUtils.lerp(actor.pivot.rotation.y, dir, 0.08);

  if (u >= 1) {
    patrol.previous = patrol.current;
    patrol.current = patrol.target;
    patrol.from = ROUTE_POINTS[patrol.current].clone();
    patrol.target = choosePatrolTarget(actor, patrol.current, patrol.previous, actors);
    patrol.startTime = t;
    const nextDist = ROUTE_POINTS[patrol.current].distanceTo(ROUTE_POINTS[patrol.target]);
    patrol.duration = THREE.MathUtils.clamp(nextDist / 1.05, 2.5, 6.2);
  }
}

// CAM-376 (S4): Atlas's own per-frame motion — never patrols (always at its own
// workSpot, unlike the 7 build roles' idle patrol); only pose + light react to
// `actor.mode` ("active" == reviewing/gates pending, "idle" == calm), which is
// driven exclusively by applyGatesPending below (never by applyActivity/
// applyScope — those explicitly skip isAtlas actors, unchanged from S3).
function updateAtlasMotion(actor: CharacterActor, t: number): void {
  const reviewing = actor.mode === "active";
  const bobAmplitude = reviewing ? ATLAS_REVIEW_BOB_AMPLITUDE : ATLAS_CALM_BOB_AMPLITUDE;
  const bobFreq = reviewing ? ATLAS_REVIEW_BOB_FREQ : ATLAS_CALM_BOB_FREQ;
  actor.pivot.position.set(
    actor.workSpot.x,
    actor.workSpot.y + Math.sin(t * bobFreq + actor.bobPhase) * bobAmplitude,
    actor.workSpot.z,
  );
  const dirToBoard = Math.atan2(actor.facePos.x - actor.workSpot.x, actor.facePos.z - actor.workSpot.z);
  // Reviewing: a gaze sweep toward the approval area (reads as "surfacing
  // work"), distinct from a build agent's steady stand-and-face. Calm: plain,
  // steady facing — no sweep.
  const gaze = reviewing ? Math.sin(t * ATLAS_REVIEW_GAZE_FREQ) * ATLAS_REVIEW_GAZE_SWEEP : 0;
  actor.pivot.rotation.y = THREE.MathUtils.lerp(actor.pivot.rotation.y, dirToBoard + gaze, reviewing ? 0.08 : 0.05);
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

function tuneMaterial(mesh: THREE.Mesh, roughnessCap: number, roughnessFloor: number, metalnessFloor: number): void {
  if (Array.isArray(mesh.material)) return; // every Meshy AI asset here is single-material; skip the rare multi-material case
  mesh.material = mesh.material.clone();
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.transparent = false;
  m.opacity = 1;
  m.depthWrite = true;
  if ("roughness" in m) m.roughness = Math.min(m.roughness ?? roughnessCap, roughnessCap);
  if ("metalness" in m) m.metalness = Math.max(m.metalness ?? metalnessFloor, metalnessFloor);
}

// Characters: centered on all 3 axes, then scaled to targetHeight (ported as-is
// from the prototype's normalizeCharacter — the resulting stand height is tuned
// by the workSpot.y constants above, not by floor-aligning the mesh here).
function normalizeCharacter(root: THREE.Group, targetHeight: number): THREE.Group {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(root);
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);
  root.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) tuneMaterial(mesh, 0.48, 0.35, 0.04);
  });
  return root;
}

// Props: scaled to targetSize, then floor-aligned (min.y -> 0) and centered on
// X/Z only — ported as-is from the prototype's normalizeRoomProp.
function normalizeRoomProp(root: THREE.Group, targetSize: number): THREE.Group {
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
    if (mesh.isMesh) tuneMaterial(mesh, 0.54, 0.42, 0.02);
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

    // CAM-375 (S3): live-activity state. `actors` is populated once assets load
    // (below); `clock` drives every character's motion timing.
    const clock = new THREE.Clock();
    const actors: CharacterActor[] = [];
    // CAM-377 (S5, review fix): the raycaster's hit-test target list — every
    // loaded actor's pivot, built ONCE right after `actors` is populated below
    // (the actor set never changes after load). Read-only from then on; the
    // raycaster never allocates a fresh `actors.map(...)` array per pointer event.
    const raycastPivots: THREE.Object3D[] = [];
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
    function renderFrame() {
      if (!reducedMotion) {
        const t = clock.getElapsedTime();
        actors.forEach((actor, i) => {
          // CAM-376 (S4): Atlas gets its own motion (reviewing/calm, never
          // patrols) instead of being skipped entirely as it was in S3.
          if (actor.isAtlas) updateAtlasMotion(actor, t);
          else updateCharacterMotion(actor, t, i, actors);
        });
      }
      renderer.render(scene, camera);
    }
    function render() {
      controls.update();
      renderFrame();
    }

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
      if (event.button !== 0) { pointerDownAt = null; return; } // only the primary button/touch selects
      pointerDownAt = { x: event.clientX, y: event.clientY };
      movedBeyondTap = false;
    }
    function onCanvasPointerUp(event: PointerEvent): void {
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
      canvas!.style.cursor = "default";
    }
    canvas.addEventListener("pointerdown", onCanvasPointerDown);
    canvas.addEventListener("pointerup", onCanvasPointerUp);
    canvas.addEventListener("pointermove", onCanvasPointerMove);
    canvas.addEventListener("pointerleave", onCanvasPointerLeave);

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
        const model = normalizeCharacter(characterScenes[i], station.isAtlas ? 1.55 : 1.48);
        pivot.add(model);
        pivot.add(createFakeShadow(station.isAtlas ? 0.58 : 0.5, station.isAtlas ? 0.34 : 0.3, -0.86, 0.12));
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
        });
      });
      // CAM-377 (S5, review fix): build the raycast target list exactly once,
      // right after every actor exists — not per pointer event.
      raycastPivots.push(...actors.map((a) => a.pivot));

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
        group.add(normalizeRoomProp(propScenes[i], item.targetSize));
        group.add(createFakeShadow(item.radius * 0.72, item.radius * 0.46, 0.01, 0.09));
        scene.add(group);
      });

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

    controllerRef.current = { setActivity: applyActivity, setScope: applyScope };
    atlasControllerRef.current = { setGatesPending: applyGatesPending };

    return () => {
      disposed = true;
      controllerRef.current = { setActivity: () => {}, setScope: () => {} };
      atlasControllerRef.current = { setGatesPending: () => {} };
      stopLoop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionMq.removeEventListener("change", onMotionChange);
      controls.removeEventListener("change", onControlsChange);
      // CAM-377 (S5): raycaster pointer listeners.
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      canvas.removeEventListener("pointerup", onCanvasPointerUp);
      canvas.removeEventListener("pointermove", onCanvasPointerMove);
      canvas.removeEventListener("pointerleave", onCanvasPointerLeave);
      controls.dispose();
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
    </div>
  );
}

const Canvas3D = forwardRef(Canvas3DInner);
Canvas3D.displayName = "Canvas3D";

export default Canvas3D;
