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
import type { RendererHandle } from "./map-types";
import type { CampsiteCanvasProps } from "./campsite-canvas";
import { MapProgress } from "./map-progress";

const COPY = {
  loading: "กำลังโหลดมุมมอง 3 มิติ…",
  unavailable: "อุปกรณ์นี้ไม่รองรับการแสดงผล 3 มิติ กรุณาสลับกลับไปมุมมอง 2 มิติ",
} as const;

// S2a-optimized assets: quantize + webp, no meshopt/Draco/KTX2 (verified WASM-free).
// S6 seam: swap this to "/status-3d/lod/" for a low-power/mobile device tier once
// device detection is wired — not part of S2b's static-scene scope (dispatch note).
const ASSET_BASE = "/status-3d/";

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
  mode: "active" | "idle";
  dimmed: boolean;
  patrol: PatrolState | null;
  /** Present only while walking TO workSpot right after an idle→active flip. */
  transit: { from: THREE.Vector3; startTime: number; duration: number } | null;
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
    actor.pivot.position.set(
      actor.workSpot.x,
      actor.workSpot.y + Math.sin(t * 2.8 + actor.bobPhase) * (actor.isAtlas ? 0.014 : 0.025),
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

// prefers-reduced-motion: freeze every character at its CURRENT commanded pose
// with no lerp/patrol in flight — active characters stand at their workSpot,
// idle characters sit at a fixed home point (mirrors the 2D engine's reduced-
// motion contract: no continuous motion, but the pose still reflects state).
function poseStaticAll(actors: CharacterActor[]): void {
  actors.forEach((actor) => {
    if (actor.isAtlas) return;
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
  { onReadyChange, agents }: CampsiteCanvasProps,
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    addLights(scene);
    addStarfield(scene);
    buildRoom(scene);

    // CAM-375 (S3): live-activity state. `actors` is populated once assets load
    // (below); `clock` drives every character's motion timing.
    const clock = new THREE.Clock();
    const actors: CharacterActor[] = [];
    let reducedMotion = false; // set for real by applyMotionPreference() below

    function render() {
      controls.update();
      if (!reducedMotion) {
        const t = clock.getElapsedTime();
        actors.forEach((actor, i) => {
          if (!actor.isAtlas) updateCharacterMotion(actor, t, i, actors);
        });
      }
      renderer.render(scene, camera);
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
      if (motionMq.matches) render(); // on-demand repaint only when the continuous loop is off
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
      if (motionMq.matches) render(); // no continuous loop to pick this up on its own
    }
    window.addEventListener("resize", onResize);

    // ── assets: characters + props, in parallel, per-item fallback ──────────
    const loader = new GLTFLoader();

    async function loadAssets() {
      const characterScenes = await Promise.all(
        WORKFLOW.map((station) =>
          loadGltf(loader, `${ASSET_BASE}${station.characterFile}`).catch((err) => {
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
        actors.push({
          key: station.key,
          isAtlas: !!station.isAtlas,
          pivot,
          workSpot: station.workSpot,
          facePos: station.pos,
          homePoint: ROUTE_POINTS[findNearestRouteIndex(station.workSpot)].clone(),
          bobPhase: i,
          mode: "active",
          dimmed: false,
          patrol: null,
          transit: null,
        });
      });

      const propScenes = await Promise.all(
        ROOM_PROPS.map((item) =>
          loadGltf(loader, `${ASSET_BASE}${item.file}`).catch((err) => {
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

    controllerRef.current = { setActivity: applyActivity, setScope: applyScope };

    return () => {
      disposed = true;
      controllerRef.current = { setActivity: () => {}, setScope: () => {} };
      stopLoop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionMq.removeEventListener("change", onMotionChange);
      controls.removeEventListener("change", onControlsChange);
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

  // CAM-375 (S3): React-owned (re-computed on every `agents` prop update,
  // independent of the WebGL rAF loop) so the scene's accessible state summary
  // stays accurate even under prefers-reduced-motion, where the characters'
  // own visual motion is frozen (mirrors campsite-canvas.tsx's S7 sceneAriaLabel
  // pattern — active count is always announced from real data, never animation).
  const activeAgentCount = agents.filter((a) => a.active).length;
  const sceneAriaLabel = `ห้องทำงาน 3 มิติของทีม AI delivery: Atlas และเพื่อนร่วมทีมอีก 7 คน ประจำอยู่ที่สถานีของตนเอง (กำลังทำงาน ${activeAgentCount}/7 คน)`;

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
