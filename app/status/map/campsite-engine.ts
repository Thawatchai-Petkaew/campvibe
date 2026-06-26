// campsite-engine.ts — character behaviour engine for the campsite delivery map.
// Pure TypeScript (no React); driven from a useEffect in campsite-scene.tsx.
//
// Behaviour model (per agent; "You" is the YouScout and never wanders):
//   ACTIVE  (role has work) → continuous, NON-repeating WANDER around the clearing:
//       randomised start delay, random next waypoint (never immediately backtracking),
//       smooth multi-segment walks (no teleport/warp), short pause, then repeat — forever.
//   IDLE    (no work) → REST near home:
//       • on settling, separate from any overlapping resting neighbour,
//       • randomly cycle the relax pose,
//       • periodically float an animated speech bubble ("ส่งงานมาเลยจ้า", …) —
//         never at the same moment as a pose change,
//       • after ~1 min standing, take a short stroll then settle again.
//
// DOM writes only (no React state in the loop): rootEl left/top/zIndex + walking-mode
// class, bodyEl backgroundImage/size, speechEl text + .show class. The engine OWNS the
// body sprite (relax pose + walk frames) so React never clobbers it on re-render.

// ── Geometry ─────────────────────────────────────────────────────────────────
export interface Coord { x: number; y: number; }

// Walkable clearing waypoints (% of the square play area). A ring on the open dirt
// AROUND the campfire (centre ~50,59), clear of the central fire and the furniture
// at the edges. The 7 role homes sit on N..NW (see LAYOUT_WIDE in the scene — kept in
// sync); S is a role-less waypoint that adds wander variety. Tune on local via ?grid=1.
export const NODES: Record<string, Coord> = {
  W0: { x: 50.1, y: 38.2 },
  W1: { x: 32.3, y: 50.4 },
  W2: { x: 37.3, y: 65.3 },
  W3: { x: 49.8, y: 75.8 },
  W4: { x: 67.8, y: 67.7 },
  W5: { x: 74.6, y: 56.9 },
  W6: { x: 71, y: 48.5 },
  W7: { x: 64.3, y: 39.5 },
  W8: { x: 65.2, y: 30.7 },
  W9: { x: 72.8, y: 27.7 },
  W10: { x: 56.6, y: 29.8 },
  W11: { x: 46.8, y: 26.3 },
  W12: { x: 32, y: 16.8 },
  W13: { x: 45, y: 29.2 },
  W14: { x: 40.9, y: 31.1 },
  W15: { x: 34.6, y: 37.8 },
  W16: { x: 30.4, y: 44.4 },
  W17: { x: 24.1, y: 58.5 },
  W18: { x: 8.6, y: 63.8 },
  W19: { x: 39.6, y: 82.6 },
  W20: { x: 26.5, y: 97.7 },
  W21: { x: 57.2, y: 77.5 },
  W22: { x: 65.6, y: 88.5 },
  W23: { x: 65.9, y: 60.2 },
  W24: { x: 79.1, y: 65.1 },
  W25: { x: 74.4, y: 48.8 },
  W26: { x: 17.4, y: 56.9 },
  W27: { x: 26.2, y: 67.5 },
  W28: { x: 60.2, y: 43.1 },
  W29: { x: 43.8, y: 42.5 },
  W30: { x: 63.5, y: 61.3 },
};

// Adjacency = each node to its 2 ring-neighbours + 2 skip-1 neighbours. The extra
// chords let wander routes vary (not a fixed loop / no predictable pattern) while
// every edge stays in the clearing annulus — none crosses the central campfire.
export const ADJ: Record<string, string[]> = {
  W0: ["W1", "W6", "W7", "W8", "W9", "W10", "W11", "W13", "W14", "W15", "W16", "W28", "W29"],
  W1: ["W0", "W2", "W13", "W14", "W15", "W16", "W17", "W26", "W27", "W29"],
  W2: ["W1", "W3", "W16", "W17", "W19", "W21", "W26", "W27", "W29"],
  W3: ["W2", "W4", "W19", "W21", "W22", "W23", "W27", "W30"],
  W4: ["W3", "W5", "W6", "W21", "W22", "W23", "W24", "W25", "W28", "W30"],
  W5: ["W4", "W6", "W7", "W23", "W24", "W25", "W28", "W30"],
  W6: ["W0", "W4", "W5", "W7", "W8", "W9", "W10", "W23", "W24", "W25", "W28", "W30"],
  W7: ["W0", "W5", "W6", "W8", "W9", "W10", "W11", "W13", "W14", "W23", "W25", "W28", "W29", "W30"],
  W8: ["W0", "W6", "W7", "W9", "W10", "W11", "W13", "W14", "W25", "W28", "W29"],
  W9: ["W0", "W6", "W7", "W8", "W10", "W25", "W28"],
  W10: ["W0", "W6", "W7", "W8", "W9", "W11", "W13", "W14", "W15", "W28", "W29"],
  W11: ["W0", "W7", "W8", "W10", "W12", "W13", "W14", "W15", "W16", "W28", "W29"],
  W12: ["W11", "W13", "W14", "W15"],
  W13: ["W0", "W1", "W7", "W8", "W10", "W11", "W12", "W14", "W15", "W16", "W28", "W29"],
  W14: ["W0", "W1", "W7", "W8", "W10", "W11", "W12", "W13", "W15", "W16", "W28", "W29"],
  W15: ["W0", "W1", "W10", "W11", "W12", "W13", "W14", "W16", "W17", "W26", "W29"],
  W16: ["W0", "W1", "W2", "W11", "W13", "W14", "W15", "W17", "W26", "W27", "W29"],
  W17: ["W1", "W2", "W15", "W16", "W18", "W26", "W27", "W29"],
  W18: ["W17", "W26", "W27"],
  W19: ["W2", "W3", "W20", "W21", "W27"],
  W20: ["W19"],
  W21: ["W2", "W3", "W4", "W19", "W22", "W23", "W24", "W30"],
  W22: ["W3", "W4", "W21"],
  W23: ["W3", "W4", "W5", "W6", "W7", "W21", "W24", "W25", "W28", "W30"],
  W24: ["W4", "W5", "W6", "W21", "W23", "W25", "W30"],
  W25: ["W4", "W5", "W6", "W7", "W8", "W9", "W23", "W24", "W28", "W30"],
  W26: ["W1", "W2", "W15", "W16", "W17", "W18", "W27"],
  W27: ["W1", "W2", "W3", "W16", "W17", "W18", "W19", "W26"],
  W28: ["W0", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W13", "W14", "W23", "W25", "W29", "W30"],
  W29: ["W0", "W1", "W2", "W7", "W8", "W10", "W11", "W13", "W14", "W15", "W16", "W17", "W28"],
  W30: ["W3", "W4", "W5", "W6", "W7", "W21", "W23", "W24", "W25", "W28"],
};

const ALL_NODES = Object.keys(NODES);

// ── Direction helper ─────────────────────────────────────────────────────────
export type WalkDir = "frontRight" | "frontLeft" | "backRight" | "backLeft";

export function dirFor(dx: number, dy: number): WalkDir {
  if (dx >= 0 && dy >= 0) return "frontRight";
  if (dx <  0 && dy >= 0) return "frontLeft";
  if (dx >= 0 && dy <  0) return "backRight";
  return "backLeft";
}

export const WALK_SPRITES: Record<WalkDir, [string, string]> = {
  frontRight: ["/status-map/sprites/walk-front-right-0.webp", "/status-map/sprites/walk-front-right-1.webp"],
  frontLeft:  ["/status-map/sprites/walk-front-left-0.webp",  "/status-map/sprites/walk-front-left-1.webp"],
  backRight:  ["/status-map/sprites/walk-back-right-0.webp",  "/status-map/sprites/walk-back-right-1.webp"],
  backLeft:   ["/status-map/sprites/walk-back-left-0.webp",   "/status-map/sprites/walk-back-left-1.webp"],
};

// ── Tunables ─────────────────────────────────────────────────────────────────
const BASE_SPEED = 0.0019;  // % per ms at 1× speed (calm stroll)
const STEP_DIST  = 1.2;     // % walked before a leg-swap frame
const WALK_AR    = 0.6106;  // walk-sprite width-to-height ratio
const RELAX_POSES = 6;      // relax-0..5.webp

const WANDER_START_MIN = 300,  WANDER_START_MAX = 4200; // staggered first wander leg (ms)
const WANDER_PAUSE_MIN = 1500, WANDER_PAUSE_MAX = 4500; // pause at each waypoint (ms) — longer = walk less often
const REST_STROLL_MS   = 60000;                          // stand ~1 min → short stroll
const POSE_MIN = 4500, POSE_MAX = 8500;                  // relax-pose cycle (ms)
const POSE_LOCK = 800;                                   // after a pose change, hold off speech (ms)
const SPEECH_MIN = 6500, SPEECH_MAX = 13000;             // gap between bubbles (ms)
const SPEECH_SHOW = 3600;                                // bubble visible duration (ms)
const OVERLAP_DIST = 7.5;                                // % — closer than this counts as overlapping
const MAX_RELOCS = 6;                                    // safety cap on relocation hops when seeking a free rest spot

// Idle "waiting for work" chatter. Plain, friendly Thai (no jargon).
export const SPEECH_LINES = [
  "ส่งงานมาเลยจ้า",
  "รองานอยู่นะ",
  "เมื่อไหร่งานจะมา?",
  "เหงาจังเลย",
  "ว่างอยู่ มางานเลย",
  "พร้อมลุยทุกเมื่อ",
];

const rand    = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[randInt(arr.length)];

// ── Scout state ──────────────────────────────────────────────────────────────
export type ScoutMode = "walking" | "resting";

export interface ScoutState {
  role:     string;
  homeNode: string;   // the agent's ring node (= its rest spot)
  poseIdx:  number;   // currently shown relax pose (0..RELAX_POSES-1)
  homeX:    number;   // authoritative rest position (% of the play area)
  homeY:    number;
  // path traversal
  cur:      string;   // current node key
  tgt:      string;   // next target node key
  t:        number;   // interpolation [0,1] along the current segment
  fx:       number;   // segment-FROM position (the agent's real start of this segment)
  fy:       number;   // — lets a walk begin smoothly from wherever the agent stands
  // world position (% of play area)
  x:        number;
  y:        number;
  // motion
  mode:     ScoutMode;
  dir:      WalkDir;
  frame:    number;
  distAcc:  number;
  lastSrc:  string;
  speedVar: number;
  // behaviour
  active:    boolean;  // role has work → wander; otherwise rest
  lastNode:  string;   // anti-backtrack for wander
  waitTimer: number;   // ms until the next wander leg (or the staggered first leg)
  rest:      number;    // ms standing at rest (→ stroll at REST_STROLL_MS)
  poseT:     number;   // ms until the next pose change
  poseLock:  number;   // ms cooldown after a pose change (suppresses speech)
  speechT:   number;   // ms until the next bubble
  speechHide: number;  // ms until the current bubble hides
  speechOn:  boolean;
  relocs:    number;   // consecutive relocation hops while seeking a free rest spot
  // DOM refs (wired by the component after render)
  bodyEl:   HTMLElement | null;
  rootEl:   HTMLElement | null;
  speechEl: HTMLElement | null;
}

export interface ScoutRef {
  state: ScoutState;
  /** Remaining path nodes to visit after tgt (tail of the BFS path). */
  path:  string[];
}

// ── BFS shortest path on the clearing graph ──────────────────────────────────
function bfsPath(from: string, to: string): string[] {
  if (from === to) return [from];
  const queue: string[][] = [[from]];
  const visited = new Set<string>([from]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node    = current[current.length - 1];
    for (const nbr of ADJ[node] ?? []) {
      if (nbr === to) return [...current, nbr];
      if (!visited.has(nbr)) {
        visited.add(nbr);
        queue.push([...current, nbr]);
      }
    }
  }
  return [from];
}

// ── Build initial scout state (starts resting at its home) ────────────────────
export function buildScoutState(
  role: string,
  homeNode: string,
  poseIdx: number,
  speedVar: number,
  homeCoords?: { x: number; y: number },
): ScoutState {
  const homePos = NODES[homeNode] ?? { x: 50, y: 55 };
  const hx = homeCoords?.x ?? homePos.x;
  const hy = homeCoords?.y ?? homePos.y;

  return {
    role,
    homeNode,
    poseIdx,
    homeX: hx,
    homeY: hy,
    cur: homeNode,
    tgt: homeNode,
    t: 0,
    fx: hx,
    fy: hy,
    x: hx,
    y: hy,
    mode: "resting",
    dir: "frontRight",
    frame: 0,
    distAcc: 0,
    lastSrc: "",
    speedVar,
    active: false,
    lastNode: homeNode,
    waitTimer: rand(WANDER_START_MIN, WANDER_START_MAX),
    rest: 0,
    poseT: rand(POSE_MIN, POSE_MAX),
    poseLock: 0,
    speechT: rand(SPEECH_MIN, SPEECH_MAX),
    speechHide: 0,
    speechOn: false,
    relocs: 0,
    bodyEl: null,
    rootEl: null,
    speechEl: null,
  };
}

// ── Engine ───────────────────────────────────────────────────────────────────
export interface EngineHandle {
  /** S6 hook — walk the agent at `role` to `toNode` (defaults to its home node). */
  triggerWalk: (role: string, toNode?: string) => void;
  /** S5 hook — dim/restore agents by epic scope (CSS opacity only; loop untouched). */
  setScope: (scope: "all" | "epic", epicRoles: string[]) => void;
  /** CAM-161 — switch all agents to a new set of home (rest) coordinates. */
  setHomes: (homes: Record<string, { x: number; y: number }>) => void;
  /**
   * Drive behaviour from live data: which roles currently have work.
   * Active roles start wandering; inactive roles settle and rest. Idempotent.
   */
  setActivity: (activeByRole: Record<string, boolean>) => void;
  /** Cancel the rAF loop. Must be called in useEffect cleanup. */
  stop: () => void;
}

export function startEngine(scouts: ScoutRef[]): EngineHandle {
  let rafId: number | null = null;
  let last   = performance.now();
  let active = true;

  // CAM-201 — preload + decode every walk/relax frame once at start, and keep the
  // decoded images alive (the array reference prevents GC). A background-image swap
  // mid-walk then paints from memory with no fetch/decode flash even on the very
  // first cycle. Pairs with the immutable Cache-Control on these assets (next.config)
  // so no frame swap ever triggers a network revalidation. Browser-only (the scene
  // is a client component loaded with ssr:false), so window/Image is available.
  const preloadedSprites: HTMLImageElement[] = [];
  if (typeof window !== "undefined" && typeof Image !== "undefined") {
    const allFrames = [
      ...Object.values(WALK_SPRITES).flat(),
      ...Array.from({ length: RELAX_POSES }, (_, i) => `/status-map/sprites/relax-${i}.webp`),
    ];
    for (const src of allFrames) {
      const img = new Image();
      img.src = src;
      img.decode?.().catch(() => {});
      preloadedSprites.push(img);
    }
  }
  void preloadedSprites; // referenced only to keep the decoded frames alive

  // ── DOM helpers ─────────────────────────────────────────────────────────────
  function setWalkBody(s: ScoutState) {
    if (!s.bodyEl) return;
    s.bodyEl.style.width  = `calc(var(--scout-size) * ${WALK_AR})`;
    s.bodyEl.style.height = "var(--scout-size)";
  }

  function setRestBody(s: ScoutState) {
    if (!s.bodyEl) return;
    s.bodyEl.style.width  = ""; // relax sprites use the CSS contain sizing
    s.bodyEl.style.height = "";
    const src = `/status-map/sprites/relax-${s.poseIdx}.webp`;
    if (s.lastSrc !== src) {
      s.bodyEl.style.backgroundImage = `url("${src}")`;
      s.lastSrc = src;
    }
  }

  function cyclePose(s: ScoutState) {
    // pick a different pose than the current one
    let next = s.poseIdx;
    if (RELAX_POSES > 1) {
      next = randInt(RELAX_POSES - 1);
      if (next >= s.poseIdx) next += 1;
    }
    s.poseIdx = next;
    setRestBody(s);
  }

  function showSpeech(s: ScoutState, text: string) {
    s.speechOn = true;
    if (s.speechEl) {
      s.speechEl.textContent = text;
      s.speechEl.classList.add("show");
    }
  }

  function hideSpeech(s: ScoutState) {
    s.speechOn = false;
    if (s.speechEl) s.speechEl.classList.remove("show");
  }

  function place(s: ScoutState) {
    if (!s.rootEl) return;
    s.rootEl.style.left   = `${s.x}%`;
    s.rootEl.style.top    = `${s.y}%`;
    s.rootEl.style.zIndex = String(Math.round(s.y * 12) + 5);
  }

  // ── Mode transitions ─────────────────────────────────────────────────────────
  function enterWalking(ref: ScoutRef, targetNode: string) {
    const s = ref.state;
    // Mid-edge redirect: the agent is partway along a real ring edge (cur → tgt).
    // Do NOT re-anchor to the off-node live position aimed at a neighbour of cur —
    // that first segment would not be a ring edge and could cut across the campfire.
    // Keep the current edge; recompute only the tail from the node we're heading to.
    if (s.mode === "walking" && s.tgt !== s.cur) {
      ref.path = bfsPath(s.tgt, targetNode).slice(1);
      return;
    }
    const full = bfsPath(s.cur, targetNode);
    if (full.length < 2) {           // already there / nowhere to go
      settle(ref);
      return;
    }
    s.tgt    = full[1];
    ref.path = full.slice(2);
    s.t      = 0;
    s.fx     = s.x;                  // start this segment from the real position (no warp)
    s.fy     = s.y;
    s.mode   = "walking";
    if (s.rootEl) s.rootEl.classList.add("walking-mode");
    setWalkBody(s);
    s.lastSrc = "";                 // force a sprite write next frame
  }

  /** Arrived / nothing to do → stand still and (re)start the rest behaviour. */
  function settle(ref: ScoutRef) {
    const s = ref.state;
    s.mode = "resting";
    s.tgt  = s.cur;
    s.t    = 0;
    if (s.rootEl) s.rootEl.classList.remove("walking-mode");

    if (s.active) {
      // Wander pause; the next leg is chosen when waitTimer elapses.
      s.waitTimer = rand(WANDER_PAUSE_MIN, WANDER_PAUSE_MAX);
      setRestBody(s);
      return;
    }

    // Idle arrival: never rest on top of another resting agent. If this spot is taken,
    // walk on to a free node and re-check on arrival — keep going until a gap is found.
    // (We rest where we arrived; never snap back to home — that would warp.)
    if (s.relocs < MAX_RELOCS && relocateIfOccupied(ref)) {
      s.relocs += 1;
      return;
    }
    s.relocs = 0;
    place(s);
    setRestBody(s);
    s.rest      = 0;
    s.poseT     = rand(POSE_MIN, POSE_MAX);
    s.poseLock  = 0;
    s.speechT   = rand(SPEECH_MIN, SPEECH_MAX);
  }

  // ── Per-frame walk step ───────────────────────────────────────────────────────
  // Consume the frame's travel distance ALONG the path (real arc-length), not a
  // per-segment normalised t. This keeps the on-screen speed constant across segments
  // so the agent never lurches/jitters at a waypoint when consecutive segments differ
  // in length (the 31-node graph mixes very short and long edges).
  function stepWalk(s: ScoutState, dt: number, path: string[]): void {
    let remaining = BASE_SPEED * s.speedVar * dt; // % distance to cover this frame
    s.distAcc += remaining;

    let guard = 0;
    while (remaining > 0 && guard++ < 24) {
      const q = NODES[s.tgt];
      if (!q) return;
      const segLen = Math.hypot(q.x - s.fx, q.y - s.fy);
      const distToTgt = (1 - s.t) * segLen;

      if (segLen < 1e-4 || remaining >= distToTgt) {
        // reach this node, then carry the leftover distance onto the next segment
        remaining -= Math.max(distToTgt, 0);
        s.cur = s.tgt;
        s.fx  = q.x;
        s.fy  = q.y;
        s.t   = 0;
        if (path.length > 0) {
          s.tgt = path.shift()!;
        } else {
          s.tgt = s.cur; // arrived — no more segments
          break;
        }
      } else {
        s.t += remaining / segLen;
        remaining = 0;
      }
    }

    if (s.distAcc >= STEP_DIST) {
      s.distAcc -= STEP_DIST;
      s.frame   ^= 1;
    }

    const qF = NODES[s.tgt];
    if (!qF) return;
    s.x   = s.fx + (qF.x - s.fx) * s.t;
    s.y   = s.fy + (qF.y - s.fy) * s.t;
    s.dir = dirFor(qF.x - s.fx, qF.y - s.fy);
  }

  function renderWalk(s: ScoutState) {
    place(s);
    if (!s.bodyEl) return;
    const [f0, f1] = WALK_SPRITES[s.dir];
    const src = s.frame === 0 ? f0 : f1;
    if (src !== s.lastSrc) {
      s.bodyEl.style.backgroundImage = `url("${src}")`;
      s.lastSrc = src;
    }
  }

  // ── Wander (active) ───────────────────────────────────────────────────────────
  function startWanderLeg(ref: ScoutRef) {
    const s = ref.state;
    const from = s.cur;
    // Random target: any node except where we are and where we just came from. Retry
    // so the route's FIRST hop never retraces the node we just came from — a 2-hop
    // BFS path could otherwise route straight back through it (a visible bounce).
    let target = from;
    for (let i = 0; i < 6; i++) {
      const pool = ALL_NODES.filter((n) => n !== from && n !== s.lastNode);
      target = pick(pool.length ? pool : ALL_NODES.filter((n) => n !== from));
      const hop1 = bfsPath(from, target)[1] ?? target;
      if (hop1 !== s.lastNode) break;
    }
    s.lastNode = from;
    enterWalking(ref, target);
  }

  // ── Rest (idle) ───────────────────────────────────────────────────────────────
  function strollFromRest(ref: ScoutRef) {
    const s = ref.state;
    const nbrs = (ADJ[s.cur] ?? ALL_NODES).filter((n) => n !== s.lastNode);
    const target = pick(nbrs.length ? nbrs : (ADJ[s.cur] ?? ALL_NODES));
    s.lastNode  = s.cur;
    enterWalking(ref, target);
  }

  /** Is (x,y) already occupied by another RESTING agent? */
  function isSpotTaken(x: number, y: number, self: ScoutRef): boolean {
    return scouts.some((o) =>
      o !== self && !o.state.active && o.state.mode === "resting" &&
      Math.hypot(o.state.x - x, o.state.y - y) < OVERLAP_DIST,
    );
  }

  /** If the agent's current rest spot is taken, walk on to a FREE neighbouring node
   *  (occupancy is checked BEFORE choosing where to go — prefer an empty node, else
   *  the most open one). Returns true if a relocation walk was started; settle() then
   *  re-checks on arrival, so the agent keeps moving until it finds an empty spot. */
  function relocateIfOccupied(ref: ScoutRef): boolean {
    const s = ref.state;
    if (!isSpotTaken(s.x, s.y, ref)) return false; // spot is free → rest here

    const nbrs = (ADJ[s.cur] ?? []).filter((n) => NODES[n]);
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const n of nbrs) {
      if (n === s.lastNode) continue; // don't bounce straight back
      const c = NODES[n]!;
      // prefer a FREE node (checked before walking), then the nearest one — a small step
      const score = (isSpotTaken(c.x, c.y, ref) ? -1000 : 0) - Math.hypot(c.x - s.x, c.y - s.y);
      if (score > bestScore) { bestScore = score; best = n; }
    }
    if (!best) best = pick(nbrs) ?? null; // every neighbour was lastNode → just move on
    if (!best) return false;

    s.lastNode = s.cur;
    enterWalking(ref, best);
    return true;
  }

  function tickRest(ref: ScoutRef, dt: number) {
    const s = ref.state;
    s.rest += dt;
    if (s.poseLock > 0) s.poseLock -= dt;

    // speech lifecycle
    if (s.speechOn) {
      s.speechHide -= dt;
      if (s.speechHide <= 0) {
        hideSpeech(s);
        s.poseLock = POSE_LOCK; // hold off a pose change right as the bubble closes
      }
    } else {
      s.speechT -= dt;
      if (s.speechT <= 0 && s.poseLock <= 0) {
        showSpeech(s, pick(SPEECH_LINES));
        s.speechHide = SPEECH_SHOW;
        s.speechT    = rand(SPEECH_MIN, SPEECH_MAX);
      }
    }

    // pose cycle — never while a bubble is up OR within the post-bubble lock window,
    // so a pose change and a bubble can never coincide (same-frame hole closed)
    if (!s.speechOn && s.poseLock <= 0) {
      s.poseT -= dt;
      if (s.poseT <= 0) {
        cyclePose(s);
        s.poseT    = rand(POSE_MIN, POSE_MAX);
        s.poseLock = POSE_LOCK;
      }
    }

    // stood for ~1 min → short stroll then settle again (only when calm)
    if (s.rest >= REST_STROLL_MS && !s.speechOn) {
      s.rest = 0;
      strollFromRest(ref);
    }
  }

  // ── Main rAF loop ──────────────────────────────────────────────────────────────
  function loop(now: number) {
    if (!active) return;
    let dt = now - last;
    last = now;
    if (dt > 50) dt = 50;

    for (const ref of scouts) {
      const s = ref.state;
      if (s.mode === "walking") {
        stepWalk(s, dt, ref.path);
        if (s.cur === s.tgt && ref.path.length === 0) {
          settle(ref);
        } else {
          renderWalk(s);
        }
      } else if (s.active) {
        s.waitTimer -= dt;
        if (s.waitTimer <= 0) startWanderLeg(ref);
      } else {
        tickRest(ref, dt);
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  return {
    triggerWalk(role: string, toNode?: string) {
      const ref = scouts.find((r) => r.state.role === role);
      if (!ref) return;
      enterWalking(ref, toNode ?? ref.state.homeNode);
    },
    setScope(scope: "all" | "epic", epicRoles: string[]) {
      for (const ref of scouts) {
        const el = ref.state.rootEl;
        if (!el) continue;
        if (scope === "all") {
          el.style.opacity       = "";
          el.style.pointerEvents = "";
          el.style.transition    = "opacity 300ms ease-out";
        } else {
          const inEpic = epicRoles.includes(ref.state.role);
          el.style.opacity       = inEpic ? "1" : "0.18";
          el.style.pointerEvents = inEpic ? "" : "none";
          el.style.transition    = "opacity 300ms ease-out";
        }
      }
    },
    setHomes(homes: Record<string, { x: number; y: number }>) {
      for (const ref of scouts) {
        const s = ref.state;
        const home = homes[s.role];
        if (!home) continue;
        s.homeX = home.x;
        s.homeY = home.y;
        // Idle + standing still → snap onto the new rest spot immediately.
        if (!s.active && s.mode === "resting") {
          s.x = home.x;
          s.y = home.y;
          s.cur = s.homeNode;
          place(s);
        }
      }
    },
    setActivity(activeByRole: Record<string, boolean>) {
      for (const ref of scouts) {
        const s = ref.state;
        const next = !!activeByRole[s.role];
        if (next === s.active) continue;
        s.active = next;
        // Engine owns working/idle class (moved from React className so a re-render
        // can no longer clobber the engine's walking-mode/entering class state or
        // restart CSS animations mid-walk).
        s.rootEl?.classList.toggle("working", next);
        s.rootEl?.classList.toggle("idle", !next);
        if (next) {
          // Became busy → start wandering after a short, staggered delay.
          if (s.mode === "resting") {
            hideSpeech(s);
            s.waitTimer = rand(WANDER_START_MIN, WANDER_START_MAX);
          }
        } else {
          // Became idle → walk home; on arrival, relocate to a free spot if taken.
          s.relocs = 0;
          if (s.mode === "resting") enterWalking(ref, s.homeNode);
        }
      }
    },
    stop() {
      active = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
