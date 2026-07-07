"use client";

// Canvas3D — CAM-373 (S2b): the real Three.js 3D room scene for /status/map.
//
// Scope: a STATIC room — renderer/scene/camera/controls/lights/room/props/8
// characters, ported (layout only) from the prototype at
// atlas_web_demo/index.html. No live-data binding and no character motion yet
// (S3/S6). setActivity/setScope/triggerWalk stay no-ops here — the shell calls
// them once ready regardless of which renderer is mounted; a no-op is correct
// until S3 wires live activity into the scene.
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
  { onReadyChange }: CampsiteCanvasProps,
  ref: React.ForwardedRef<RendererHandle>,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  // S2b: static scene only (no live-data binding, no character motion — S3/S6
  // add those). The shell still calls setActivity/setScope/triggerWalk once
  // ready regardless of which renderer is mounted; no-ops are correct here.
  useImperativeHandle(ref, () => ({
    setActivity: () => {},
    setScope: () => {},
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

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
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

    function render() {
      controls.update();
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
      // Damping needs several continuous frames to decay after a drag; under
      // on-demand rendering there is no continuous loop to play that decay, so
      // disable it — each drag applies immediately with no lingering inertia.
      controls.enableDamping = !reduced;
      if (reduced) {
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
      if (disposed) return;
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
      });

      const propScenes = await Promise.all(
        ROOM_PROPS.map((item) =>
          loadGltf(loader, `${ASSET_BASE}${item.file}`).catch((err) => {
            console.warn(`Canvas3D: prop fallback for ${item.name}`, err);
            return createFallbackProp(item.name);
          }),
        ),
      );
      if (disposed) return;
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
      }
    });

    return () => {
      disposed = true;
      stopLoop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionMq.removeEventListener("change", onMotionChange);
      controls.removeEventListener("change", onControlsChange);
      controls.dispose();
      // Ported from the prototype's disposeObject3D/disposeMaterial — duck-typed
      // (not isMesh-gated) so Points/Sprite geometries+materials (e.g. the
      // starfield) are freed too, not just Mesh instances.
      scene.traverse((obj) => {
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
      renderer.renderLists.dispose();
      renderer.dispose();
      onReadyChange(false);
      // canvasRef's <canvas> is a JSX-rendered element — React removes it from
      // the DOM as part of unmounting this component; nothing to detach by hand.
    };
    // mount-once — onReadyChange is the shell's stable state setter (identity
    // never changes); mirrors campsite-canvas.tsx's mount-once effect convention.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sceneAriaLabel = "ห้องทำงาน 3 มิติของทีม AI delivery: Atlas และเพื่อนร่วมทีมอีก 7 คน ประจำอยู่ที่สถานีของตนเอง";

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, zIndex: 5 }}
      role="img"
      aria-label={sceneAriaLabel}
      data-testid="scene--status-map-3d"
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      {status !== "ready" && (
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
            <p className="map-placeholder-text">
              {status === "unavailable" ? COPY.unavailable : COPY.loading}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const Canvas3D = forwardRef(Canvas3DInner);
Canvas3D.displayName = "Canvas3D";

export default Canvas3D;
