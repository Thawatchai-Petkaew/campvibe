// campsite-engine.ts — S3 hybrid motion model for the campsite delivery map.
// Pure TypeScript module (no React). Driven from a useEffect in campsite-scene.tsx.
//
// Motion model:
//   entering  → agent walks from an arm-tip entry node to its home station on first mount.
//   idle      → no rAF position work; CSS .idle .body { animation: breathe } handles sway.
//   walking   → path traversal via triggerWalk() — hook wired for S6; not called from data yet.
//
// No random wander — agents only walk on a real state change (AC requirement).
// DOM writes are limited to: style.left / style.top / style.zIndex / style.backgroundImage
// on element refs. No React setState in the loop.

// ── Waypoint graph (% coords, isometric campsite layout) ────────────────────
export interface Coord { x: number; y: number; }

export const NODES: Record<string, Coord> = {
  N:   { x: 49, y: 44 },
  NE:  { x: 58, y: 48 },
  E:   { x: 62, y: 55 },
  SE:  { x: 58, y: 62 },
  S:   { x: 49, y: 66 },
  SW:  { x: 40, y: 62 },
  W:   { x: 37, y: 55 },
  NW:  { x: 42, y: 50 },
  // arm-tip entry nodes (used as entrance walk start positions)
  aN:  { x: 49, y: 35 },
  aE:  { x: 70, y: 54 },
  aSE: { x: 66, y: 66 },
  aS:  { x: 49, y: 75 },
  aSW: { x: 33, y: 67 },
  aW:  { x: 29, y: 54 },
};

// Undirected adjacency — dead-end arm-tips each connect to one ring node.
export const ADJ: Record<string, string[]> = {
  N:   ["NE", "NW", "aN"],
  NE:  ["N",  "E"],
  E:   ["NE", "SE", "aE"],
  SE:  ["E",  "S",  "aSE"],
  S:   ["SE", "SW", "aS"],
  SW:  ["S",  "W",  "aSW"],
  W:   ["SW", "NW", "aW"],
  NW:  ["W",  "N"],
  aN:  ["N"],
  aE:  ["E"],
  aSE: ["SE"],
  aS:  ["S"],
  aSW: ["SW"],
  aW:  ["W"],
};

// Nearest arm-tip entry node for each home station.
const ENTRY_FOR_HOME: Record<string, string> = {
  N:  "aN",
  NE: "aN",   // arm-N is the closest tip; walk aN → N → NE
  E:  "aE",
  SE: "aSE",
  S:  "aS",
  SW: "aSW",
  W:  "aW",
  NW: "aW",   // arm-W is the closest tip; walk aW → W → NW
};

// ── Direction helper (ported from reference engine dirFor) ───────────────────
export type WalkDir = "frontRight" | "frontLeft" | "backRight" | "backLeft";

export function dirFor(dx: number, dy: number): WalkDir {
  if (dx >= 0 && dy >= 0) return "frontRight";
  if (dx <  0 && dy >= 0) return "frontLeft";
  if (dx >= 0 && dy <  0) return "backRight";
  return "backLeft";
}

// ── Walk sprite paths ────────────────────────────────────────────────────────
export const WALK_SPRITES: Record<WalkDir, [string, string]> = {
  frontRight: ["/status-map/sprites/walk-front-right-0.webp", "/status-map/sprites/walk-front-right-1.webp"],
  frontLeft:  ["/status-map/sprites/walk-front-left-0.webp",  "/status-map/sprites/walk-front-left-1.webp"],
  backRight:  ["/status-map/sprites/walk-back-right-0.webp",  "/status-map/sprites/walk-back-right-1.webp"],
  backLeft:   ["/status-map/sprites/walk-back-left-0.webp",   "/status-map/sprites/walk-back-left-1.webp"],
};

// ── Physics constants (ported from reference engine) ─────────────────────────
const BASE_SPEED = 0.0019; // % per ms at 1× speed (calm stroll)
const STEP_DIST  = 1.2;    // % walked before leg-swap frame (gait-locked to speed)
const WALK_AR    = 0.6106; // walk-sprite width-to-height ratio

// ── Scout state ──────────────────────────────────────────────────────────────
export type ScoutMode = "entering" | "walking" | "idle";

export interface ScoutState {
  role:     string;
  homeNode: string;   // octagon station key
  poseIdx:  number;   // index into relax-N.webp (0–5), set by component
  // path traversal (only used in entering / walking mode)
  cur:      string;   // current node key
  tgt:      string;   // next target node key
  t:        number;   // interpolation [0,1] along cur → tgt segment
  // world position (viewport %)
  x:        number;
  y:        number;
  // motion
  mode:     ScoutMode;
  dir:      WalkDir;
  frame:    number;   // 0 or 1 leg frame
  distAcc:  number;   // accumulated distance for gait swap
  lastSrc:  string;   // last applied backgroundImage — skip redundant DOM write
  speedVar: number;   // per-agent speed multiplier
  // DOM element refs, wired by the component after render
  bodyEl:   HTMLElement | null;
  rootEl:   HTMLElement | null;
}

export interface ScoutRef {
  state: ScoutState;
  /** Remaining path nodes to visit after tgt (tail of the BFS path). */
  path:  string[];
}

// ── BFS shortest path ────────────────────────────────────────────────────────
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
  return [from]; // shouldn't happen in a connected graph
}

// ── Smooth easing (cosine, same as reference engine) ─────────────────────────
function ease(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── Build initial scout state (entrance walk) ─────────────────────────────────
// The agent starts at the arm-tip nearest its home station and walks inward.
// On first mount this produces the entrance animation; S6 can re-trigger via triggerWalk().
export function buildScoutState(
  role: string,
  homeNode: string,
  poseIdx: number,
  speedVar: number,
): ScoutState {
  const entryKey = ENTRY_FOR_HOME[homeNode] ?? homeNode;
  const entryPos = NODES[entryKey] ?? NODES[homeNode];
  const homePos  = NODES[homeNode];

  // Initial direction: from entry toward home.
  const dx = homePos.x - entryPos.x;
  const dy = homePos.y - entryPos.y;

  return {
    role,
    homeNode,
    poseIdx,
    cur:      entryKey,
    tgt:      homeNode,
    t:        0,
    x:        entryPos.x,
    y:        entryPos.y,
    mode:     "entering",
    dir:      dirFor(dx, dy),
    frame:    0,
    distAcc:  0,
    lastSrc:  "",
    speedVar,
    bodyEl:   null,
    rootEl:   null,
  };
}

// ── Engine ───────────────────────────────────────────────────────────────────
export interface EngineHandle {
  /**
   * S6 hook — walk the agent at `role` to `toNode` (defaults to its home station).
   * Call this when live data changes and you want the agent to visually move.
   */
  triggerWalk: (role: string, toNode?: string) => void;
  /**
   * S5 hook — narrow / restore the scene without remounting the rAF loop.
   * In Epic scope: dim/hide agents whose role is NOT in epicRoles; all others stay.
   * In Overview scope (scope="all", epicRoles empty): restore all agents to full opacity.
   * The rAF loop keeps running; only CSS opacity/pointer-events on rootEl are touched.
   */
  setScope: (scope: "all" | "epic", epicRoles: string[]) => void;
  /** Cancel the rAF loop. Must be called in useEffect cleanup to prevent leaks. */
  stop: () => void;
}

export function startEngine(scouts: ScoutRef[]): EngineHandle {
  let rafId: number | null = null;
  let last   = performance.now();
  let active = true;

  // ── DOM helpers ─────────────────────────────────────────────────────────────

  function setWalkBody(s: ScoutState) {
    if (!s.bodyEl) return;
    s.bodyEl.style.width  = `calc(var(--scout-size) * ${WALK_AR})`;
    s.bodyEl.style.height = "var(--scout-size)";
  }

  function setIdleBody(s: ScoutState) {
    if (!s.bodyEl) return;
    // Clear walk-specific sizing (CSS defaults handle relax sprites via contain).
    s.bodyEl.style.width  = "";
    s.bodyEl.style.height = "";
    const relaxSrc = `/status-map/sprites/relax-${s.poseIdx}.webp`;
    if (s.lastSrc !== relaxSrc) {
      s.bodyEl.style.backgroundImage = `url("${relaxSrc}")`;
      s.lastSrc = relaxSrc;
    }
  }

  // ── Mode transitions ─────────────────────────────────────────────────────────

  function enterIdle(ref: ScoutRef) {
    const s = ref.state;
    s.mode   = "idle";
    ref.path = [];
    // Snap to the home node exactly.
    const home = NODES[s.homeNode];
    if (home) { s.x = home.x; s.y = home.y; }
    s.cur = s.homeNode;
    s.tgt = s.homeNode;
    s.t   = 0;
    if (s.rootEl) {
      s.rootEl.classList.remove("entering", "walking-mode");
      s.rootEl.classList.add("idle");
      s.rootEl.style.left   = `${s.x}%`;
      s.rootEl.style.top    = `${s.y}%`;
      s.rootEl.style.zIndex = String(Math.round(s.y * 12) + 5);
    }
    setIdleBody(s);
  }

  function enterWalking(ref: ScoutRef, targetNode: string) {
    const s        = ref.state;
    const fullPath = bfsPath(s.cur, targetNode);
    // Need at least 2 nodes to move anywhere.
    if (fullPath.length < 2) {
      enterIdle(ref);
      return;
    }
    s.tgt    = fullPath[1];
    ref.path = fullPath.slice(2);
    s.t      = 0;
    s.mode   = "walking";
    if (s.rootEl) {
      s.rootEl.classList.remove("idle", "entering");
      s.rootEl.classList.add("walking-mode");
    }
    setWalkBody(s);
    s.lastSrc = ""; // force sprite update on next render
  }

  // ── Per-frame step (ported from reference engine step()) ─────────────────────

  function stepWalk(s: ScoutState, dt: number, path: string[]): void {
    const p = NODES[s.cur];
    let   q = NODES[s.tgt];
    if (!p || !q) return;

    const segLen = Math.hypot(q.x - p.x, q.y - p.y) || 0.001;
    const moved  = BASE_SPEED * s.speedVar * dt;

    s.t       += moved / segLen;
    s.distAcc += moved;

    // Advance through waypoints while s.t overflows 1.
    let guard = 0;
    while (s.t >= 1 && guard++ < 8) {
      s.t   -= 1;
      s.cur  = s.tgt;
      if (path.length > 0) {
        s.tgt = path.shift()!;
      } else {
        // Arrived at destination — tgt stays as cur; loop exit detected below.
        s.tgt = s.cur;
        s.t   = 0;
        break;
      }
      q = NODES[s.tgt];
      if (!q) break;
    }

    // Leg-swap gait.
    if (s.distAcc >= STEP_DIST) {
      s.distAcc -= STEP_DIST;
      s.frame   ^= 1;
    }

    // Interpolated position.
    const qFinal = NODES[s.tgt];
    if (!qFinal) return;
    const e = ease(Math.min(s.t, 1));
    s.x   = p.x + (qFinal.x - p.x) * e;
    s.y   = p.y + (qFinal.y - p.y) * e;
    s.dir = dirFor(qFinal.x - p.x, qFinal.y - p.y);
  }

  // ── Render pass (DOM writes only) ───────────────────────────────────────────

  function renderScout(s: ScoutState) {
    if (!s.rootEl) return;
    // Position and z-order (isometric depth by y).
    s.rootEl.style.left   = `${s.x}%`;
    s.rootEl.style.top    = `${s.y}%`;
    s.rootEl.style.zIndex = String(Math.round(s.y * 12) + 5);

    if (s.mode === "entering" || s.mode === "walking") {
      if (!s.bodyEl) return;
      const [f0, f1] = WALK_SPRITES[s.dir];
      const src = s.frame === 0 ? f0 : f1;
      if (src !== s.lastSrc) {
        s.bodyEl.style.backgroundImage = `url("${src}")`;
        s.lastSrc = src;
      }
    }
    // Idle: CSS animation handles sway — no per-frame DOM write needed.
  }

  // ── Main rAF loop ────────────────────────────────────────────────────────────

  function loop(now: number) {
    if (!active) return;
    let dt = now - last;
    last   = now;
    // Cap spike (tab hidden, GC pause, etc.).
    if (dt > 50) dt = 50;

    for (const ref of scouts) {
      const s = ref.state;

      if (s.mode === "entering" || s.mode === "walking") {
        // Arrived when cur === tgt and no more path segments.
        const arrived = s.cur === s.tgt && ref.path.length === 0;
        if (arrived) {
          enterIdle(ref);
        } else {
          stepWalk(s, dt, ref.path);
          // Re-check after step (may have just reached destination).
          if (s.cur === s.tgt && ref.path.length === 0) {
            enterIdle(ref);
          } else {
            renderScout(s);
          }
        }
      }
      // mode === "idle": position is fixed; breathe animation is CSS-only.
    }

    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  return {
    triggerWalk(role: string, toNode?: string) {
      const ref = scouts.find((r) => r.state.role === role);
      if (!ref) return;
      const target = toNode ?? ref.state.homeNode;
      enterWalking(ref, target);
    },
    setScope(scope: "all" | "epic", epicRoles: string[]) {
      // DOM-only: adjust opacity/pointer-events without touching the rAF loop.
      for (const ref of scouts) {
        const el = ref.state.rootEl;
        if (!el) continue;
        if (scope === "all") {
          // Restore all agents to full presence.
          el.style.opacity        = "";
          el.style.pointerEvents  = "";
          el.style.transition     = "opacity 300ms ease-out";
        } else {
          const inEpic = epicRoles.includes(ref.state.role);
          el.style.opacity        = inEpic ? "1" : "0.18";
          el.style.pointerEvents  = inEpic ? "" : "none";
          el.style.transition     = "opacity 300ms ease-out";
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
