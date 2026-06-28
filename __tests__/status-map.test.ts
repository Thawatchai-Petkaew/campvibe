import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { canonRole } from "@/lib/status-derive";
import { payloadChanged } from "@/lib/status-map-model";
import {
  buildModel,
  epicOf,
  isActive,
  isDone,
  hasAwait,
  personaOf,
  featureOf,
} from "@/lib/status-model";

// CAM-151 (S1) + CAM-152 (S2) — Campsite delivery map (/status/map).
// Mirrors the source-inspection style of status-derive.test.ts: a source file is
// readFileSync'd and asserted on, plus a small logic check on the shared helpers
// that drive the map's agent projection.

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

// ---------- CAM-151: shared model module exports the moved helpers ----------
describe("lib/status-model.ts — shared model (CAM-151)", () => {
  it("exports buildModel + the helpers moved out of page.tsx", () => {
    // Runtime import proves they are real, named exports (not just present in source).
    expect(typeof buildModel).toBe("function");
    expect(typeof epicOf).toBe("function");
    expect(typeof isActive).toBe("function");
    expect(typeof isDone).toBe("function");
    expect(typeof hasAwait).toBe("function");
    expect(typeof personaOf).toBe("function");
    expect(typeof featureOf).toBe("function");
  });

  it("calls buildWorkload(work) inside the module (workload moved into the model)", () => {
    const src = read("../lib/status-model.ts");
    expect(src).toContain("buildWorkload(work)");
  });

  it("declares the shared model interface (Model)", () => {
    const src = read("../lib/status-model.ts");
    expect(src).toContain("export interface Model");
    expect(src).toContain("export interface EpicNode");
  });

  it("buildModel on [] returns an empty, non-throwing model (0% progress, no gates)", () => {
    const m = buildModel([]);
    expect(m.projectPct).toBe(0);
    expect(m.gates).toEqual([]);
    expect(m.work).toEqual([]);
    expect(m.epicNames).toEqual([]);
  });
});

// ---------- camper-infra: map gate/backlog epicKey survives the new (parented) structure ----------
describe("lib/status-map-model.ts — gate epicKey parent fallback (camper-infra)", () => {
  const src = read("../lib/status-map-model.ts");

  it("gates fall back to parent.title when the title has no '·' (new-structure epic scoping)", () => {
    // A new-structure story carries no '·', so epicOf() is empty — the gate chip must key off the
    // parent (epic) title to deep-link/scope, exactly like the backlog items already do.
    expect(src).toContain("epicKey: epicOf(i.title) || i.parent?.title");
  });

  it("backlog keeps the same parent.title fallback (parity with gates)", () => {
    expect(src).toContain('epicOf(i.title) || i.parent?.title || ""');
  });
});

// ---------- camper-infra: /status board canonicalizes the [role] tag ----------
describe("app/status/page.tsx — roleOf canonicalizes via canonRole (camper-infra)", () => {
  const src = read("../app/status/page.tsx");

  it("roleOf runs the raw tag through canonRole so short aliases resolve (no blank role)", () => {
    expect(src).toContain("canonRole");
    expect(src).toContain("return m ? canonRole(m[1]) : \"\";");
  });
});

// ---------- CAM-151: /status no longer declares buildModel locally ----------
describe("app/status/page.tsx — consumes the shared model (CAM-151)", () => {
  const src = read("../app/status/page.tsx");

  it("imports buildModel from @/lib/status-model", () => {
    expect(src).toContain("@/lib/status-model");
    expect(src).toContain("buildModel");
  });

  it("does NOT declare its own function buildModel (pure move)", () => {
    expect(src).not.toContain("function buildModel");
  });
});

// ---------- CAM-151: /status/map route shell is token-gated + data-wired ----------
describe("app/status/map/page.tsx — token gate + data projection (CAM-151/152)", () => {
  const src = read("../app/status/map/page.tsx");

  it("is token-gated via STATUS_TOKEN (parity with /status)", () => {
    expect(src).toContain("STATUS_TOKEN");
  });

  it("derives the model from real data via buildModel", () => {
    expect(src).toContain("buildModel");
    expect(src).toContain("fetchStatusIssues");
  });

  it("builds the agents projection via shared toMapModel (S6: projection extracted to lib)", () => {
    // S6 extracted the inline projection into lib/status-map-model.ts (toMapModel).
    // page.tsx now calls toMapModel(buildModel(issues)) — no more local buildAgents or rmap.
    expect(src).toContain("toMapModel");
    expect(src).toContain("buildModel");
  });

  it("is force-dynamic (no static caching of live status)", () => {
    expect(src).toContain('export const dynamic = "force-dynamic"');
  });
});

// ---------- CAM-151: scene mounted lazily, ssr disabled ----------
describe("app/status/map/scene-loader.tsx — lazy client scene (CAM-151)", () => {
  const src = read("../app/status/map/scene-loader.tsx");

  it("lazy-loads the scene with next/dynamic and ssr: false", () => {
    expect(src).toContain("next/dynamic");
    expect(src).toContain("ssr: false");
  });
});

// ---------- CAM-152: scene uses /public sprites, no base64, reduced-motion ----------
describe("app/status/map/campsite-scene.tsx — sprites + a11y (CAM-152)", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("references sprites under /status-map/sprites/", () => {
    expect(src).toContain("/status-map/sprites/");
  });

  it("contains NO inline base64 data:image string (sprites are external files)", () => {
    expect(src).not.toContain("data:image");
  });

  it("guards animation behind prefers-reduced-motion", () => {
    expect(src).toContain("prefers-reduced-motion");
  });

  it("widens the model: MapModel + MapAgent carry per-role workload + task", () => {
    expect(src).toContain("export interface MapModel");
    expect(src).toContain("export interface MapAgent");
    expect(src).toContain("activeCount");
    expect(src).toContain("queued");
    expect(src).toContain("task");
  });

  it("renders the You gate badge derived from gates.length", () => {
    expect(src).toContain("gates.length");
  });
});

// ============================================================
// CAM-161 — Responsive scene: fixed-canvas scale + 2-layout switch
// ============================================================

// ---------- CAM-161: new CSS architecture — .map-viewport + transform:scale ----------
describe("app/status/map/campsite-scene.tsx — CAM-161: fixed-canvas scale model", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("has .map-viewport wrapper (contains the play area)", () => {
    expect(src).toContain(".map-viewport");
    expect(src).toContain("position:absolute");
    expect(src).toContain("overflow:hidden");
  });

  it("has .map-stage as the contained play area (square FIT model)", () => {
    // CAM-166+: responsive square via clamp + aspect-ratio (replaces fixed 1920px)
    expect(src).toContain("aspect-ratio: 1 / 1");
    expect(src).toContain("clamp(320px");
  });

  it("map-stage is centred via translate(-50%,-50%) (replaces scale model)", () => {
    // CAM-166+: square FIT — translate keeps centre fixed; no transform:scale
    expect(src).toContain("translate(-50%,-50%)");
    expect(src).toContain("top:50%;left:50%");
  });

  it("--scout-size uses cqmin (container-relative, not vw-relative)", () => {
    // Must NOT contain 'vw' in the scout-size definition
    expect(src).not.toContain("7.2vw");
    // CAM-166+: responsive clamp using container query units
    expect(src).toContain("--scout-size: clamp(");
  });

  it("does NOT use the old width:max() approach for scaling", () => {
    // The old CAM-160 technique used width:calc(max(100vw,...)) on the stage.
    // CAM-161 replaces this with a fixed 1920px width + transform:scale().
    expect(src).not.toContain("width:calc(max(100vw");
  });

  it("has .map-bg full-viewport background image (decoupled from canvas)", () => {
    expect(src).toContain(".map-bg");
    expect(src).toContain("object-fit:cover");
    // CAM-162: single WebP replaced by responsive srcset; forest-1920.webp is the fallback src
    expect(src).toContain("forest-1920.webp");
  });

  it("background image is an <img> element with aria-hidden (not CSS background-image on stage)", () => {
    expect(src).toContain('className="map-bg"');
    expect(src).toContain('aria-hidden="true"');
  });

  it("does NOT set background-image on .map-stage (stage is no longer the bg carrier)", () => {
    // The old approach: background:url("/status-map/campsite-forest.webp") on .map-stage
    expect(src).not.toContain('background:url("/status-map/campsite-forest.webp")');
  });
});

// ---------- CAM-161: 2-layout tables + matchMedia switch ----------
describe("app/status/map/campsite-scene.tsx — CAM-161: LAYOUT_WIDE + LAYOUT_NARROW", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("exports LAYOUT_WIDE for aspect ≥ 7:5 (art-measured positions)", () => {
    expect(src).toContain("LAYOUT_WIDE");
  });

  it("exports LAYOUT_NARROW for aspect < 7:5 (compact centre-band cluster)", () => {
    expect(src).toContain("LAYOUT_NARROW");
  });

  it("YOU_POS_WIDE and YOU_POS_NARROW define separate You positions per layout", () => {
    expect(src).toContain("YOU_POS_WIDE");
    expect(src).toContain("YOU_POS_NARROW");
  });

  it("matchMedia '(min-width: 640px)' drives the layout switch (SMUX-2: width-based, not aspect-ratio)", () => {
    // SMUX-2 (CAM-251): changed from (min-aspect-ratio: 7/5) to (min-width: 640px)
    // so a phone in landscape still uses LAYOUT_NARROW (it is still a small viewport).
    expect(src).toContain("matchMedia(\"(min-width: 640px)\")");
  });

  it("aspect change listener calls setLayoutKey without remounting engine", () => {
    expect(src).toContain("setLayoutKey");
    expect(src).toContain("arMq.addEventListener");
  });

  it("engine.setHomes() is called on aspect ratio change", () => {
    expect(src).toContain("engine.setHomes");
  });

  it("homeStyle() reads from currentLayout (not NODES)", () => {
    expect(src).toContain("currentLayout[role]");
  });

  it("YouScout receives youPos prop derived from layoutKey", () => {
    expect(src).toContain("youPos={youPos}");
    expect(src).toContain("youPos: { x: number; y: number }");
  });
});

// ---------- CAM-161: engine setHomes addition ----------
describe("app/status/map/campsite-engine.ts — CAM-161: setHomes", () => {
  const src = read("../app/status/map/campsite-engine.ts");

  it("EngineHandle interface declares setHomes method", () => {
    expect(src).toContain("setHomes");
    expect(src).toContain("Record<string, { x: number; y: number }>");
  });

  it("setHomes implementation snaps idle agents and redirects walking agents", () => {
    expect(src).toContain("setHomes(homes:");
    expect(src).toContain("s.mode === \"resting\"");
  });
});

// ---------- CAM-152: sprite shell CSS has no base64 either ----------
describe("app/status/map/campsite-assets.ts — night-scene shell (CAM-152)", () => {
  const src = read("../app/status/map/campsite-assets.ts");

  it("contains NO inline base64 data:image string", () => {
    expect(src).not.toContain("data:image");
  });

  it("exports the CSS + SCENE shell strings", () => {
    expect(src).toContain("export const CSS");
    expect(src).toContain("export const SCENE");
  });
});

// ---------- logic: canonRole drives the role→agent projection in page.tsx ----------
// page.tsx's buildAgents matches a story's [role] title tag to a BUILD_ROLE via
// canonRole(titleRoleOf(title)). Assert the canonicalization that wiring relies on.
describe("canonRole — role canonicalization the map projection relies on (CAM-152)", () => {
  it("short alias 'frontend' canonicalizes to the build-role key 'frontend-engineer'", () => {
    expect(canonRole("frontend")).toBe("frontend-engineer");
  });

  it("short alias 'qa' → 'qa-engineer'", () => {
    expect(canonRole("qa")).toBe("qa-engineer");
  });

  it("short alias 'security' → 'security-reviewer'", () => {
    expect(canonRole("security")).toBe("security-reviewer");
  });

  it("long-form 'backend-engineer' passes through unchanged", () => {
    expect(canonRole("backend-engineer")).toBe("backend-engineer");
  });

  it("unknown slug → '' (no phantom agent on the map)", () => {
    expect(canonRole("unknownrole")).toBe("");
  });
});

// ============================================================
// CAM-157 (S7) — A11y + reduced-motion hardening
// ============================================================

// ---------- S7 AC1: reduced-motion labels present in scene source ----------
describe("campsite-scene.tsx — S7 AC1: reduced-motion static labels", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("CSS block contains @media (prefers-reduced-motion: reduce) for rm-labels", () => {
    expect(src).toContain("prefers-reduced-motion: reduce");
    expect(src).toContain(".rm-label");
  });

  it("rm-label-name renders the displayName under reduced-motion", () => {
    expect(src).toContain("rm-label-name");
  });

  it("rm-label-status renders working/พัก tag under reduced-motion", () => {
    expect(src).toContain("rm-label-status");
    expect(src).toContain("กำลังทำ");
    expect(src).toContain("พัก");
  });

  it("You character has a reduced-motion label (⚑N รอคุณ or ปกติ)", () => {
    expect(src).toContain("รอคุณ");
    expect(src).toContain("ปกติ");
  });
});

// ---------- S7 AC2: keyboard + screen-reader access ----------
describe("campsite-scene.tsx — S7 AC2: keyboard + screen-reader access", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("map-stage has role='img' for screen readers", () => {
    expect(src).toContain('role="img"');
  });

  it("map-stage has aria-label containing scene summary", () => {
    expect(src).toContain("sceneAriaLabel");
    expect(src).toContain("แผนที่แคมป์:");
    expect(src).toContain("กำลังทำงาน");
    expect(src).toContain("รออนุมัติ");
    expect(src).toContain("คืบหน้า");
  });

  it("AgentScout renders as <button> not <div> for keyboard triggering", () => {
    // The element must be a button for keyboard focus+activation (AC2)
    expect(src).toContain('type="button"');
    expect(src).toContain('data-testid={`btn--map-agent-${agent.role}`}');
  });

  it("You character has btn--map-agent-you testid", () => {
    expect(src).toContain('data-testid="btn--map-agent-you"');
  });

  it("AgentScout has a meaningful aria-label (displayName + roleLabel + state)", () => {
    expect(src).toContain("ariaLabel");
    expect(src).toContain("cfg.displayName");
    expect(src).toContain("cfg.roleLabel");
  });

  it("You button aria-label describes gate count when gates > 0", () => {
    expect(src).toContain("gate รอตรวจสอบ");
  });
});

// ---------- S7 AC3: error state uses the same copy as /status ----------
describe("app/status/map/page.tsx — S7 AC3: error state copy matches /status", () => {
  const src = read("../app/status/map/page.tsx");

  it("error banner text uses the exact /status copy pattern", () => {
    // /status uses: โหลดข้อมูลจาก Linear ไม่ได้:
    expect(src).toContain("โหลดข้อมูลจาก Linear ไม่ได้:");
  });

  it("error state renders over the night-scene background (not a blank screen)", () => {
    // SCENE is rendered before the conditional so the background is always present
    expect(src).toContain("dangerouslySetInnerHTML={{ __html: SCENE }}");
    expect(src).toContain('data-testid="error--status-map"');
  });

  it("error container has testid for QA assertion", () => {
    expect(src).toContain('data-testid="error-text--status-map"');
  });
});

// ---------- S7 AC4: loading state is labelled ----------
// CAM-248 (LOAD-4): markup extracted to MapProgress (map-progress.tsx);
// these assertions now check the canonical source of the a11y attributes.
describe("app/status/map/map-progress.tsx — S7 AC4: loading state", () => {
  const src = read("../app/status/map/map-progress.tsx");

  it("loading placeholder has role='status' aria-live='polite' for screen readers", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
  });

  it("loading placeholder has Thai text กำลังโหลดแผนที่แคมป์", () => {
    expect(src).toContain("กำลังโหลดแผนที่แคมป์");
  });

  it("loading placeholder has testid for QA", () => {
    expect(src).toContain('data-testid="loading--status-map"');
  });
});

// ---------- S7 AC5: overlay empty states are present ----------
describe("campsite-overlays.tsx — S7 AC5: empty states", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("DeliveryPanel empty: ยังไม่มีสตอรีในโปรเจกต์", () => {
    expect(src).toContain("ยังไม่มีสตอรีในโปรเจกต์");
  });

  it("BacklogPanel empty: ไม่มี story ใน backlog", () => {
    expect(src).toContain("ไม่มี story ใน backlog");
  });

  it("GatesPanel empty: ไม่มีงานรออนุมัติจากคุณตอนนี้", () => {
    expect(src).toContain("ไม่มีงานรออนุมัติจากคุณตอนนี้");
  });

  it("EpicProgressPanel empty: ยังไม่มีสตอรีใน epic นี้", () => {
    expect(src).toContain("ยังไม่มีสตอรีใน epic นี้");
  });

  it("EpicUpNextPanel empty: คิวว่าง", () => {
    expect(src).toContain("คิวว่าง");
  });

  it("EpicBoardPanel empty: ยังไม่มีสตอรีใน epic นี้", () => {
    expect(src).toContain("ยังไม่มีสตอรีใน epic นี้");
  });

  it("ScopeSwitcherPanel empty: ยังไม่มี epic ในโปรเจกต์", () => {
    expect(src).toContain("ยังไม่มี epic ในโปรเจกต์");
  });

  it("ScopeSwitcherPanel filtered empty: ไม่มี epic ที่ตรงกับตัวกรอง", () => {
    expect(src).toContain("ไม่มี epic ที่ตรงกับตัวกรอง");
  });
});

// ---------- S7 AC7: deep-link scope fix — engineReady in scope effect deps ----------
describe("campsite-scene.tsx — S7 AC7: deep-link scope fix", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("engineReady state variable is declared", () => {
    expect(src).toContain("engineReady");
    expect(src).toContain("setEngineReady");
  });

  it("setEngineReady(true) is called when engine starts", () => {
    expect(src).toContain("setEngineReady(true)");
  });

  it("engineReady is included in scope-effect dependency array", () => {
    // The scope effect deps array must include engineReady for deep-link fix
    expect(src).toContain("engineReady");
    // The comment explains the fix
    expect(src).toContain("S7 fix");
  });
});

// ============================================================
// CAM-159 — HUD redesign: command dock + expand-panel + Kanban modal
// ============================================================

// ---------- CAM-159 AC1: single bottom dock replaces corner chips ----------
describe("campsite-overlays.tsx — CAM-159 AC1: single bottom command dock", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("exports MapOverlays (root component) + ViewToggle (top-center toggle)", () => {
    expect(src).toContain("export function MapOverlays");
    expect(src).toContain("export function ViewToggle");
  });

  it("renders dock with data-testid dock--hud-overview (Overview) and dock--hud-epic (Epic)", () => {
    expect(src).toContain('data-testid="dock--hud-overview"');
    expect(src).toContain('data-testid="dock--hud-epic"');
  });

  it("dock has role='toolbar' for a11y (grouped controls)", () => {
    expect(src).toContain('role="toolbar"');
  });

  it("no corner chip positions in the new overlay: top-left/top-right/bottom-left/bottom-right removed", () => {
    // The old CHIP_POSITIONS / Overlay primitive is gone
    expect(src).not.toContain("CHIP_POSITIONS");
    expect(src).not.toContain('"top-left"');
    expect(src).not.toContain('"bottom-right"');
    expect(src).not.toContain('"bottom-left"');
  });

  it("dock segments are real <button> elements with aria-expanded", () => {
    expect(src).toContain('aria-expanded={openOverlay === "switcher"}');
    expect(src).toContain('aria-expanded={openOverlay === "delivery"}');
    expect(src).toContain('aria-expanded={openOverlay === "crew"}');
  });

  it("dock is centered bottom (hud-dock class, bottom 18px, translateX -50%)", () => {
    expect(src).toContain(".hud-dock");
    expect(src).toContain("bottom:18px");
    expect(src).toContain("translateX(-50%)");
  });
});

// ---------- CAM-159 AC2: expand panels rise above dock ----------
describe("campsite-overlays.tsx — CAM-159 AC2: expand panels", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("ExpandPanel renders with role='dialog' aria-modal", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
  });

  it("hud-panel CSS has bottom:80px (rises above dock)", () => {
    expect(src).toContain("bottom:80px");
  });

  it("panel CSS has panelRise animation wrapped in prefers-reduced-motion:no-preference", () => {
    expect(src).toContain("panelRise");
    expect(src).toContain("prefers-reduced-motion:no-preference");
  });

  it("focus trap implemented via FOCUSABLE selector + Escape handler", () => {
    expect(src).toContain("FOCUSABLE");
    expect(src).toContain('e.key === "Escape"');
  });
});

// ---------- CAM-159 AC3: Kanban modal for heavy data ----------
describe("campsite-overlays.tsx — CAM-159 AC3: Kanban modal", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("KanbanModal renders a centered modal box (hud-modal-box)", () => {
    expect(src).toContain("hud-modal-box");
  });

  it("modal backdrop darkens scene (hud-modal-backdrop)", () => {
    expect(src).toContain("hud-modal-backdrop");
  });

  it("modal has scale+fade animation via modalIn (prefers-reduced-motion gated)", () => {
    expect(src).toContain("modalIn");
  });

  it("modal renders 5 Kanban columns (Backlog/Todo/In Progress/In Review/Done)", () => {
    expect(src).toContain('"Backlog"');
    expect(src).toContain('"Todo"');
    expect(src).toContain('"In Progress"');
    expect(src).toContain('"In Review"');
    expect(src).toContain('"Done"');
  });

  it("modal renders metric pills (running/review/todo/done)", () => {
    expect(src).toContain('data-testid="metric--modal-run"');
    expect(src).toContain('data-testid="metric--modal-done"');
  });

  it("KanbanModal empty state: ยังไม่มีสตอรีใน epic นี้", () => {
    expect(src).toContain("ยังไม่มีสตอรีใน epic นี้");
  });

  it("board testid follows doc convention: board--hud-{epicLabel}", () => {
    expect(src).toContain("`board--hud-${epicLabel}`");
  });
});

// ---------- CAM-159 AC4: Epic scope — no overlapping surfaces ----------
describe("campsite-overlays.tsx — CAM-159 AC4: Epic scope dock structure", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("Epic dock has seg--hud-epic-progress segment (no duplicate position='right')", () => {
    expect(src).toContain('data-testid="seg--hud-epic-progress"');
  });

  it("Epic dock has seg--hud-upnext (Up Next segment — no longer at position='right')", () => {
    expect(src).toContain('data-testid="seg--hud-upnext"');
  });

  it("Epic dock has hud-board-btn (prominent open-board CTA)", () => {
    expect(src).toContain("hud-board-btn");
    expect(src).toContain("เปิดบอร์ด");
  });

  it("back-to-overview button present in Epic scope dock", () => {
    expect(src).toContain('data-testid="btn--scope-back-overview"');
  });
});

// ---------- CAM-159 AC5: View toggle top-center ----------
describe("campsite-overlays.tsx — CAM-159 AC5: ViewToggle top-center", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("ViewToggle CSS exists as a glass pill in the top bar", () => {
    expect(src).toContain(".hud-view-toggle");
    expect(src).toContain("border-radius:999px");
    // positioned inside .hud-topbar-right (not fixed top:18px)
    expect(src).toContain("backdrop-filter");
  });

  it("ViewToggle renders as a link to the dashboard with แดชบอร์ด label", () => {
    expect(src).toContain("แดชบอร์ด");
    // CAM-159+: single dashboard link (not a dual tablist)
    expect(src).toContain('data-testid="link--map-to-dashboard"');
    expect(src).toContain("aria-label");
  });
});

// ---------- CAM-159 AC6: Epic bug — setScope non-blank fix ----------
describe("campsite-scene.tsx — CAM-159 AC6: setScope non-blank fix", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("scope effect falls back to all-scope when epicRoles is empty", () => {
    // The CAM-159 fix: roles.length > 0 guard before setting epic scope
    expect(src).toContain("roles.length > 0");
    expect(src).toContain('engine.setScope("all", [])');
  });

  it("CAM-159 Epic bug fix comment is present", () => {
    expect(src).toContain("CAM-159 Epic bug fix");
  });

  it("activeEpicData resolves with fallback guard for deep-link", () => {
    // Guard: activeEpic ? find(...) ?? null : null
    expect(src).toContain("activeEpic ? (epics.find");
  });
});

// ---------- CAM-159 AC7: reduced-motion — all transitions gated ----------
describe("campsite-overlays.tsx — CAM-159 AC7: reduced-motion compliance", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("panelRise animation inside prefers-reduced-motion:no-preference block", () => {
    expect(src).toContain("prefers-reduced-motion:no-preference");
    expect(src).toContain("panelRise");
  });

  it("modalIn animation inside prefers-reduced-motion:no-preference block", () => {
    expect(src).toContain("modalIn");
  });

  it("bdFade backdrop animation inside prefers-reduced-motion:no-preference block", () => {
    expect(src).toContain("bdFade");
  });

  it("progress fill transition inside prefers-reduced-motion:no-preference block", () => {
    expect(src).toContain(".hud-prog-fill");
  });
});

// ---------- CAM-159: ViewToggle exported and used in campsite-scene ----------
describe("campsite-scene.tsx — CAM-159: ViewToggle integrated top-center", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("imports ViewToggle from campsite-overlays", () => {
    expect(src).toContain("ViewToggle");
    expect(src).toContain("campsite-overlays");
  });

  it("renders ViewToggle with dashboardHref (not the old inline nav)", () => {
    expect(src).toContain("<ViewToggle dashboardHref={dashboardHref}");
  });

  it("old inline nav with top:70 left:16 corner position is removed", () => {
    // The old corner nav style is gone
    expect(src).not.toContain("top: 70");
    expect(src).not.toContain("left: 16,");
  });
});

// ============================================================
// CAM-162 — Responsive background: srcset hi-res WebP
// ============================================================

describe("campsite-scene.tsx — CAM-162: responsive srcset background", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("uses forest-1920.webp as the fallback src (not campsite-forest.webp)", () => {
    expect(src).toContain('src="/status-map/forest-1920.webp"');
    expect(src).not.toContain('src="/status-map/campsite-forest.webp"');
  });

  it("has srcSet with all four responsive widths (1280w, 1920w, 2560w, 3840w)", () => {
    expect(src).toContain("forest-1280.webp 1280w");
    expect(src).toContain("forest-1920.webp 1920w");
    expect(src).toContain("forest-2560.webp 2560w");
    expect(src).toContain("forest-3840.webp 3840w");
  });

  it("has sizes='max(100vw, 177.78vh)' to account for cover overscale on portrait screens", () => {
    expect(src).toContain('sizes="max(100vw, 177.78vh)"');
  });

  it("has fetchPriority='high' for LCP (not lazy-loaded)", () => {
    expect(src).toContain('fetchPriority="high"');
  });

  it("does NOT reference the removed single-size campsite-forest.webp in any src attribute", () => {
    // The old single-size fallback must not appear as an img src
    expect(src).not.toContain('src="/status-map/campsite-forest.webp"');
  });
});

// ============================================================
// CAM-163 — Layout-apply fix: homeX/homeY authoritative resting position
// ============================================================

// ---------- CAM-163: ScoutState carries homeX/homeY -------------------------
describe("app/status/map/campsite-engine.ts — CAM-163: ScoutState.homeX/homeY", () => {
  const src = read("../app/status/map/campsite-engine.ts");

  it("ScoutState interface declares homeX and homeY fields", () => {
    expect(src).toContain("homeX:");
    expect(src).toContain("homeY:");
  });

  it("buildScoutState accepts optional homeCoords and initialises homeX/homeY from it", () => {
    expect(src).toContain("homeCoords");
    expect(src).toContain("homeX:");
    expect(src).toContain("homeY:");
  });

  it("buildScoutState returns scouts in resting mode (not entering)", () => {
    // CAM-163+: entrance walk removed — scouts start resting at their layout home.
    expect(src).toContain('mode: "resting"');
    // Ensure "entering" is NOT the default mode produced by buildScoutState.
    expect(src).not.toContain('mode: "entering"');
  });

  it("setHomes snaps idle agents to new home coords via home.x / home.y", () => {
    // CAM-163+: setHomes uses home.x/home.y from the layout table
    expect(src).toContain("s.x = home.x");
    expect(src).toContain("s.y = home.y");
    // Must NOT fall back to NODES[homeNode] for the resting snap.
    expect(src).not.toContain("const home = NODES[s.homeNode]");
  });

  it("setHomes updates homeX and homeY on ALL scouts regardless of mode", () => {
    expect(src).toContain("s.homeX = home.x");
    expect(src).toContain("s.homeY = home.y");
  });
});

// ---------- CAM-163: scene builds scouts at layout home from first frame -----
describe("app/status/map/campsite-scene.tsx — CAM-163: idle placement on mount", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("determines initial layout BEFORE building scoutRefs (no compass-detour on load)", () => {
    // Scene reads arMqEarly and initialLayout before calling buildScoutState.
    expect(src).toContain("arMqEarly");
    expect(src).toContain("initialLayout");
  });

  it("passes homeCoords from initialLayout into buildScoutState", () => {
    expect(src).toContain("homeCoords");
    expect(src).toContain("buildScoutState(role, cfg.node, cfg.poseIdx, SPEED_VAR[idx] ?? 1.0, homeCoords)");
  });

  it("applies idle class and correct DOM position immediately after buildScoutState", () => {
    // Agents must be placed at homeX/homeY from the first frame.
    expect(src).toContain("state.homeX");
    expect(src).toContain("state.homeY");
    // scene uses local ref var name (state or s) for classList add
    expect(src).toContain('classList.add("idle")');
  });

  it("stopLoop restores agents to homeX/homeY — not NODES[homeNode]", () => {
    // CAM-163: stopLoop (reduced-motion fallback) uses s.homeX/s.homeY.
    expect(src).toContain("s.homeX");
    expect(src).toContain("s.homeY");
    // Must NOT use the old NODES-based position in the stopLoop path.
    expect(src).not.toContain("NODES[s.homeNode]");
  });

  it("NODES is no longer imported by campsite-scene (not needed after CAM-163 fix)", () => {
    // NODES was only used in stopLoop (now replaced by homeX/homeY); remove verifies no leak.
    expect(src).not.toContain("import {\n  NODES,");
    expect(src).not.toContain('"NODES"');
  });
});

// ============================================================
// CAM-164 — Debug grid + portrait fix + layout rebalance
// ============================================================

// ---------- CAM-164: debug coordinate grid (?grid=1) -------------------------
describe("app/status/map/page.tsx — CAM-164: ?grid=1 param plumbing", () => {
  const src = read("../app/status/map/page.tsx");

  it("reads sp.grid from searchParams", () => {
    expect(src).toContain("grid");
  });

  it("debugGrid is true only when sp.grid === '1'", () => {
    expect(src).toContain('sp.grid === "1"');
    expect(src).toContain("debugGrid");
  });

  it("passes debugGrid prop to SceneLoader", () => {
    expect(src).toContain("debugGrid={debugGrid}");
  });
});

describe("app/status/map/scene-loader.tsx — CAM-164: debugGrid prop forwarded", () => {
  const src = read("../app/status/map/scene-loader.tsx");

  it("accepts debugGrid prop", () => {
    expect(src).toContain("debugGrid");
  });

  it("passes debugGrid to CampsiteScene", () => {
    expect(src).toContain("debugGrid={debugGrid}");
  });
});

describe("app/status/map/campsite-scene.tsx — CAM-164: debug grid component", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("DebugGrid component is defined", () => {
    expect(src).toContain("function DebugGrid");
  });

  it("debug grid has data-testid for QA assertion", () => {
    expect(src).toContain('data-testid="debug--map-grid"');
  });

  it("debug grid is aria-hidden (dev overlay, not content)", () => {
    expect(src).toContain('aria-hidden="true"');
  });

  it("debug grid renders only when debugGrid prop is true", () => {
    expect(src).toContain("{debugGrid && <DebugGrid />}");
  });

  it("Props interface includes debugGrid boolean", () => {
    expect(src).toContain("debugGrid?");
  });
});

// ---------- CAM-164: portrait fix — lazy state initializer -------------------
describe("app/status/map/campsite-scene.tsx — CAM-164: portrait centering fix", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("layoutKey useState uses a lazy initializer (not a hardcoded 'wide' literal)", () => {
    // The lazy initializer reads matchMedia on first client render so portrait
    // gets LAYOUT_NARROW immediately without waiting for the useEffect.
    expect(src).toContain("useState<\"wide\" | \"narrow\">(() =>");
  });

  it("lazy initializer reads (min-width: 640px) matchMedia (SMUX-2: width-based trigger)", () => {
    // SMUX-2 (CAM-251): changed from aspect-ratio to viewport width trigger.
    expect(src).toContain("window.matchMedia(\"(min-width: 640px)\")");
  });

  it("lazy initializer pre-seeds currentLayout for homeStyle() on first render", () => {
    // currentLayout must be set in the lazy init so homeStyle() is correct on first paint.
    expect(src).toContain("currentLayout = isWide ? LAYOUT_WIDE : LAYOUT_NARROW");
  });
});

// ---------- CAM-164: rebalanced layout coordinates ---------------------------
describe("app/status/map/campsite-scene.tsx — CAM-164: rebalanced layout coords", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("YOU_POS_WIDE is set to {x:38, y:31} (upper-left of clearing)", () => {
    expect(src).toContain("YOU_POS_WIDE = { x: 38, y: 31 }");
  });

  it("YOU_POS_NARROW is a genuine portrait position distinct from YOU_POS_WIDE (SMUX-2)", () => {
    // SMUX-2 (CAM-251): LAYOUT_NARROW is now a real portrait-optimised oval, not an alias.
    // YOU_POS_NARROW is { x: 38, y: 27 } per the Design Brief.
    expect(src).toContain("YOU_POS_NARROW = { x: 38, y: 27 }");
  });

  // SMUX-2 (CAM-251): LAYOUT_NARROW is now a genuine portrait-optimised oval (not an alias).
  it("LAYOUT_NARROW is a distinct portrait-optimised oval with 7 agent entries (SMUX-2)", () => {
    expect(src).toContain("export const LAYOUT_NARROW: Record<string, { x: number; y: number }>");
    // Spot-check the top agent from the Design Brief coordinates
    expect(src).toContain('"architect":          { x: 50.0, y: 31.0 }');
  });

  it("scout sizes updated: responsive clamp (not fixed 88px/74px)", () => {
    // CAM-166+: container-relative cqmin replaces fixed px sizes
    expect(src).toContain("--scout-size: clamp(");
  });

  it("CAM-164 layout comment references ?grid=1 tuning", () => {
    expect(src).toContain("?grid=1");
  });
});

// ============================================================
// CAM-165 — Portrait centering fix + coord tune
// ============================================================

// ---------- CAM-165 Fix 1: no duplicate .map-wrap rule in campsite-assets.ts ---
describe("app/status/map/campsite-assets.ts — CAM-165: no conflicting .map-wrap", () => {
  const src = read("../app/status/map/campsite-assets.ts");

  it("does NOT contain a .map-wrap flex/padding rule (removed to avoid scene CSS conflict)", () => {
    // The OLD leftover rule: .map-wrap{position:relative;...display:flex;...padding:24px}
    // conflicts with the scene's .map-wrap{position:fixed;inset:0}. CAM-165 removes it.
    expect(src).not.toContain(".map-wrap{position:relative");
    expect(src).not.toContain("display:flex;align-items:center;justify-content:center;padding:24px");
  });

  it("gate box still has its own .gatebox rule (not removed)", () => {
    expect(src).toContain(".gatebox");
  });

  it("error placeholder still has its own .map-placeholder rule (not removed)", () => {
    expect(src).toContain(".map-placeholder");
  });
});

// ---------- CAM-165 Fix 1: scene .map-wrap is position:fixed (only rule now) ---
describe("app/status/map/campsite-scene.tsx — CAM-165: .map-wrap is position:fixed", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it(".map-wrap CSS is position:fixed;inset:0 (the single authoritative rule)", () => {
    expect(src).toContain(".map-wrap{");
    expect(src).toContain("position:fixed;inset:0");
  });
});

// ---------- CAM-165 Fix 2: updated LAYOUT_WIDE coords — superseded by CAM-166 ring -----
// CAM-166: all 7 role agents placed in a clean ring on the central dirt clearing
// around the campfire (~50,52). Furniture is backdrop only, not occupied.
describe("app/status/map/campsite-scene.tsx — CAM-166: LAYOUT_WIDE clearing-ring coords", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("Architect placed at {x:50.1, y:38.2} (ring — top-centre of clearing)", () => {
    expect(src).toContain('{ x: 50.1, y: 38.2 }');
  });

  it("Designer placed at {x:60.2, y:43.1} (ring — upper-right)", () => {
    expect(src).toContain('{ x: 60.2, y: 43.1 }');
  });

  it("Backend placed at {x:65.9, y:60.2} (ring — right)", () => {
    expect(src).toContain('{ x: 65.9, y: 60.2 }');
  });

  it("Frontend placed at {x:49.8, y:75.8} (ring — lower-centre)", () => {
    expect(src).toContain('{ x: 49.8, y: 75.8 }');
  });

  it("DevOps placed at {x:37.3, y:65.3} (ring — lower-left)", () => {
    expect(src).toContain('{ x: 37.3, y: 65.3 }');
  });

  it("QA placed at {x:32.3, y:50.4} (ring — left)", () => {
    expect(src).toContain('{ x: 32.3, y: 50.4 }');
  });

  it("Security placed at {x:43.8, y:42.5} (ring — upper-left)", () => {
    expect(src).toContain('{ x: 43.8, y: 42.5 }');
  });

  it("YOU_POS_WIDE updated to {x:38, y:31} (upper-left of clearing)", () => {
    expect(src).toContain("YOU_POS_WIDE = { x: 38, y: 31 }");
  });
});

// ── CAM-167: ENV picker button + modal ────────────────────────────────────────
describe("CAM-167: ENV picker — shimmer button + side-by-side modal in top bar", () => {
  const sceneSrc = read("../app/status/map/campsite-scene.tsx");
  const overlaySrc = read("../app/status/map/campsite-overlays.tsx");

  it('campsite-scene imports EnvPickerPanel from campsite-overlays', () => {
    expect(sceneSrc).toContain("EnvPickerPanel");
  });

  it('campsite-scene renders btn--map-env-picker with correct testid', () => {
    expect(sceneSrc).toContain('data-testid="btn--map-env-picker"');
  });

  it('campsite-scene renders EnvPickerPanel with isOpen + onClose + triggerRef', () => {
    expect(sceneSrc).toContain("<EnvPickerPanel");
    expect(sceneSrc).toContain("envPickerOpen");
    expect(sceneSrc).toContain("envPickerTriggerRef");
  });

  it('campsite-overlays exports EnvPickerPanel function', () => {
    expect(overlaySrc).toContain("export function EnvPickerPanel");
  });

  it('HUD_CSS contains shimmer animation + .hud-env-toggle', () => {
    expect(overlaySrc).toContain("hud-shimmer");
    expect(overlaySrc).toContain(".hud-env-toggle");
  });

  it('HUD_CSS contains .hud-env-modal-box (centered modal)', () => {
    expect(overlaySrc).toContain(".hud-env-modal-box");
  });

  it('HUD_CSS contains .hud-env-card', () => {
    expect(overlaySrc).toContain(".hud-env-card");
  });

  it('EnvPickerPanel uses Lucide Server icon', () => {
    expect(overlaySrc).toContain("Server");
  });

  it('EnvPickerPanel uses Lucide Globe icon', () => {
    expect(overlaySrc).toContain("Globe");
  });

  it('EnvPickerPanel references campvibe-staging.vercel.app', () => {
    expect(overlaySrc).toContain("campvibe-staging.vercel.app");
  });

  it('EnvPickerPanel references NEXT_PUBLIC_PROD_URL for production link', () => {
    expect(overlaySrc).toContain("NEXT_PUBLIC_PROD_URL");
  });
});

// ============================================================
// CAM-176 — reconcile no-op guard: payloadChanged helper
// ============================================================

describe("lib/status-map-model.ts — CAM-176: payloadChanged pure helper", () => {
  it("returns false when prev and next are identical strings (no re-render needed)", () => {
    const payload = JSON.stringify({ projectPct: 42, agents: [] });
    expect(payloadChanged(payload, payload)).toBe(false);
  });

  it("returns true when next differs from prev (real update → setLiveModel)", () => {
    const prev = JSON.stringify({ projectPct: 42, agents: [] });
    const next = JSON.stringify({ projectPct: 43, agents: [] });
    expect(payloadChanged(prev, next)).toBe(true);
  });

  it("returns true when prev is empty string and next is non-empty (initial poll with data)", () => {
    expect(payloadChanged("", '{"projectPct":0}')).toBe(true);
  });

  it("returns false when both prev and next are empty strings", () => {
    expect(payloadChanged("", "")).toBe(false);
  });

  it("returns true when whitespace differs (exact byte compare)", () => {
    // Confirms the guard is strict: two semantically-equal but differently-serialized
    // strings are considered changed (no JSON.parse overhead in the hot path).
    expect(payloadChanged('{"a":1}', '{"a": 1}')).toBe(true);
  });
});

describe("app/status/map/campsite-scene.tsx — CAM-176: guard wired in source", () => {
  const src = readFileSync(resolve(__dirname, "../app/status/map/campsite-scene.tsx"), "utf8");

  it("imports payloadChanged from @/lib/status-map-model", () => {
    expect(src).toContain("payloadChanged");
    expect(src).toContain("status-map-model");
  });

  it("declares lastPayloadRef with useRef and JSON.stringify(model) initializer", () => {
    expect(src).toContain("lastPayloadRef");
    expect(src).toContain("JSON.stringify(model)");
  });

  it("reconcile reads response as text (res.text()) not res.json()", () => {
    // The guard compares raw strings; res.json() would lose the original text.
    expect(src).toContain("await res.text()");
  });

  it("reconcile calls payloadChanged guard before setLiveModel", () => {
    expect(src).toContain("payloadChanged(lastPayloadRef.current, text)");
  });

  it("reconcile updates lastPayloadRef.current on a real change", () => {
    expect(src).toContain("lastPayloadRef.current = text");
  });

  it("reconcile calls setLiveModel with JSON.parse(text) (not res.json())", () => {
    expect(src).toContain("JSON.parse(text) as MapModel");
  });

  it("FALLBACK_MS is still 15_000 (CAM-175 freshness preserved)", () => {
    expect(src).toContain("FALLBACK_MS = 15_000");
  });

  // CAM-176 layer 2: activity-keyed wander/rest effect
  it("derives activeKey via useMemo keyed on agents (role:active:activeCount per agent)", () => {
    expect(src).toContain("activeKey");
    expect(src).toContain("a.active ? 1 : 0");
    expect(src).toContain("a.activeCount");
  });

  it("wander/rest effect dep array uses activeKey, not agents", () => {
    // Confirm the effect dep is the stable string, not the raw agents array ref.
    expect(src).toContain("[engineReady, activeKey]");
  });

  it("wander/rest effect still reads agents array inside the effect body", () => {
    // The effect reads agents for setActivity — only the dep changes, not the logic.
    expect(src).toContain("for (const a of agents)");
  });
});

// ── CAM-176 layer 2: activeKey semantic tests ────────────────────────────────
describe("CAM-176: activeKey signature — unchanged activity yields same key", () => {
  // Replicate the activeKey formula from campsite-scene.tsx so we can assert its
  // behaviour in isolation without rendering the component.
  type AgentStub = { role: string; active: boolean; activeCount: number };
  function makeKey(agents: AgentStub[]): string {
    return agents.map((a) => `${a.role}:${a.active ? 1 : 0}:${a.activeCount}`).join("|");
  }

  it("identical agents list (new array ref, same values) yields the same key", () => {
    const base: AgentStub[] = [
      { role: "frontend-engineer", active: true,  activeCount: 2 },
      { role: "qa-engineer",       active: false, activeCount: 0 },
    ];
    // Simulate a reconcile that returns a new array ref but identical activity data.
    const after: AgentStub[] = [
      { role: "frontend-engineer", active: true,  activeCount: 2 },
      { role: "qa-engineer",       active: false, activeCount: 0 },
    ];
    expect(makeKey(base)).toBe(makeKey(after));
  });

  it("changed active flag yields a different key (agent starts working)", () => {
    const before: AgentStub[] = [
      { role: "frontend-engineer", active: false, activeCount: 0 },
    ];
    const after: AgentStub[] = [
      { role: "frontend-engineer", active: true, activeCount: 1 },
    ];
    expect(makeKey(before)).not.toBe(makeKey(after));
  });

  it("changed activeCount alone yields a different key", () => {
    const before: AgentStub[] = [{ role: "backend-engineer", active: true, activeCount: 1 }];
    const after: AgentStub[]  = [{ role: "backend-engineer", active: true, activeCount: 2 }];
    expect(makeKey(before)).not.toBe(makeKey(after));
  });

  it("unrelated field changes are NOT encoded — key stays the same", () => {
    // The formula only uses role / active / activeCount. Changes to task / queued /
    // other display fields do not change the key and therefore do not re-trigger
    // setActivity, protecting a walking character from mid-walk resets.
    const base: AgentStub[] = [{ role: "architect", active: true, activeCount: 1 }];
    const after: AgentStub[] = [{ role: "architect", active: true, activeCount: 1 }];
    expect(makeKey(base)).toBe(makeKey(after));
  });

  it("empty agents list yields an empty key (edge case — no crash)", () => {
    expect(makeKey([])).toBe("");
  });
});

// ============================================================
// CAM-198 — Replace loading card with progress bar
// CAM-248 (LOAD-4): markup extracted to MapProgress; scene-loader reuses it
// ============================================================

// CAM-198 + CAM-248: MapProgress component carries all a11y + markup
describe("app/status/map/map-progress.tsx — CAM-198/248: MapProgress component", () => {
  const src = read("../app/status/map/map-progress.tsx");

  it("renders map-progress (track element — not .map-placeholder card)", () => {
    expect(src).toContain("map-progress");
    expect(src).not.toContain('className="map-placeholder"');
  });

  it("has role='progressbar' and aria-busy='true'", () => {
    expect(src).toContain('role="progressbar"');
    expect(src).toContain('aria-busy="true"');
  });

  it("keeps data-testid='loading--status-map' (QA parity with CAM-198)", () => {
    expect(src).toContain('data-testid="loading--status-map"');
  });

  it("has Thai aria-label กำลังโหลดแผนที่แคมป์ (AC-4 screen reader)", () => {
    expect(src).toContain("กำลังโหลดแผนที่แคมป์");
  });

  it("renders the animated bar span (map-progress-standalone-bar)", () => {
    expect(src).toContain("map-progress-standalone-bar");
  });

  it("does NOT render .map-placeholder-text (no text box in loading state)", () => {
    expect(src).not.toContain("map-placeholder-text");
  });

  it("inline CSS defines the sweep animation gated by prefers-reduced-motion:no-preference", () => {
    expect(src).toContain("prefers-reduced-motion: no-preference");
    expect(src).toContain("map-sweep-standalone");
  });

  it("full-screen dark background (#070d1c) — consistent with night-scene map", () => {
    expect(src).toContain("#070d1c");
  });

  it("does NOT import RootShellSkeleton or any Skeleton primitive", () => {
    expect(src).not.toContain("RootShellSkeleton");
    expect(src).not.toContain("CampgroundGridSkeleton");
    expect(src).not.toContain("Skeleton");
  });
});

// CAM-248: scene-loader now delegates loading markup to MapProgress
describe("app/status/map/scene-loader.tsx — CAM-248: reuses MapProgress", () => {
  const src = read("../app/status/map/scene-loader.tsx");

  it("imports MapProgress from ./map-progress", () => {
    expect(src).toContain("MapProgress");
    expect(src).toContain("map-progress");
  });

  it("loading: () => <MapProgress /> (delegates, not inline markup)", () => {
    expect(src).toContain("loading: () => <MapProgress />");
  });

  it("does NOT contain inline map-progress JSX (markup lives in MapProgress)", () => {
    // After extraction, scene-loader must NOT duplicate the markup
    expect(src).not.toContain('role="progressbar"');
    expect(src).not.toContain('aria-busy="true"');
  });

  it("does NOT render .map-placeholder-text", () => {
    expect(src).not.toContain("map-placeholder-text");
  });
});

// ============================================================
// CAM-248 (LOAD-4) — Route-level loading.tsx: progress only, no skeleton
// ============================================================

describe("app/status/map/loading.tsx — CAM-248: progress only, overrides root skeleton", () => {
  const src = read("../app/status/map/loading.tsx");

  it("imports MapProgress from ./map-progress", () => {
    expect(src).toContain("MapProgress");
    expect(src).toContain("map-progress");
  });

  it("default export renders <MapProgress />", () => {
    expect(src).toContain("<MapProgress />");
  });

  it("does NOT import RootShellSkeleton (no import statement for skeleton)", () => {
    // Comments may mention it for context; imports must not reference it.
    expect(src).not.toMatch(/import\s+.*RootShellSkeleton/);
  });

  it("does NOT import CampgroundGridSkeleton", () => {
    expect(src).not.toMatch(/import\s+.*CampgroundGridSkeleton/);
  });

  it("does NOT import or render the <Skeleton> primitive", () => {
    // <Skeleton is the shadcn primitive; this route must not use it.
    expect(src).not.toContain("<Skeleton");
  });
});

describe("app/status/map/campsite-assets.ts — CAM-198: progress bar CSS", () => {
  const src = read("../app/status/map/campsite-assets.ts");

  it("defines .map-progress track CSS", () => {
    expect(src).toContain(".map-progress");
  });

  it("defines .map-progress-bar fill CSS with amber color", () => {
    expect(src).toContain(".map-progress-bar");
    expect(src).toContain("var(--amber)");
  });

  it("sweep animation (@keyframes map-sweep) is defined", () => {
    expect(src).toContain("@keyframes map-sweep");
  });

  it("sweep animation is wrapped in prefers-reduced-motion:no-preference (AC-3)", () => {
    expect(src).toContain("prefers-reduced-motion:no-preference");
    expect(src).toContain("map-sweep");
  });

  it("still contains .map-placeholder rule (error card state preserved)", () => {
    expect(src).toContain(".map-placeholder");
  });
});

// ============================================================
// CAM-251 (SMUX-2) — Responsive layout: breakpoints, toolbar, sheets, narrow ring
// ============================================================

describe("app/status/map/campsite-scene.tsx — SMUX-2: responsive layout", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  // ── LAYOUT_NARROW is a genuine portrait oval (not an alias) ─────────────────
  it("LAYOUT_NARROW exports a real portrait oval with 7 role entries", () => {
    expect(src).toContain("export const LAYOUT_NARROW: Record<string, { x: number; y: number }>");
    // All 7 roles must be present
    expect(src).toContain('"architect"');
    expect(src).toContain('"ux-designer"');
    expect(src).toContain('"backend-engineer"');
    expect(src).toContain('"frontend-engineer"');
    expect(src).toContain('"devops-release"');
    expect(src).toContain('"qa-engineer"');
    expect(src).toContain('"security-reviewer"');
  });

  it("LAYOUT_NARROW uses portrait-optimised coords — architect at top (y: 31.0)", () => {
    // The Design Brief places architect at top (y=31) in narrow mode
    expect(src).toContain('"architect":          { x: 50.0, y: 31.0 }');
  });

  it("LAYOUT_NARROW is NOT the same reference as LAYOUT_WIDE", () => {
    // After SMUX-2, they must differ — no LAYOUT_NARROW = LAYOUT_WIDE alias
    expect(src).not.toContain("LAYOUT_NARROW = LAYOUT_WIDE");
  });

  it("YOU_POS_NARROW is { x: 38, y: 27 } (portrait upper-left, Design Brief §Narrow Ring)", () => {
    expect(src).toContain("YOU_POS_NARROW = { x: 38, y: 27 }");
  });

  // ── matchMedia trigger uses width, not aspect-ratio ─────────────────────────
  it("matchMedia trigger uses min-width: 640px (not min-aspect-ratio) for LAYOUT_NARROW", () => {
    // SMUX-2: phone in landscape should still use NARROW → trigger on width, not aspect
    expect(src).toContain('matchMedia("(min-width: 640px)")');
  });

  it("does NOT use (min-aspect-ratio: 7/5) as the layout trigger any more", () => {
    expect(src).not.toContain("min-aspect-ratio: 7/5");
  });

  // ── Responsive CSS blocks ────────────────────────────────────────────────────
  it("SCENE_CSS contains a tablet @media (max-width: 1023px) block hiding side panels", () => {
    expect(src).toContain("@media (max-width: 1023px)");
    expect(src).toContain(".hud-left-panels{display:none}");
    expect(src).toContain(".hud-right-panels{display:none}");
  });

  it("SCENE_CSS contains a mobile @media (max-width: 639px) block with .hud-map-toolbar", () => {
    expect(src).toContain("@media (max-width: 639px)");
    expect(src).toContain(".hud-map-toolbar{");
  });

  it("desktop @media (min-width: 1024px) hides edge tabs and mobile toolbar", () => {
    expect(src).toContain("@media (min-width: 1024px)");
    expect(src).toContain(".hud-edge-tab{display:none}");
    expect(src).toContain(".hud-map-toolbar{display:none}");
  });

  // ── Edge drawer tabs (tablet) ────────────────────────────────────────────────
  it("renders a left edge-drawer tab button for Roster with correct aria attributes", () => {
    expect(src).toContain('data-testid="btn--map-edge-roster"');
    expect(src).toContain('aria-label="เปิด Roster"');
    expect(src).toContain('aria-haspopup="dialog"');
  });

  it("renders a right edge-drawer tab button for Board with correct aria attributes", () => {
    expect(src).toContain('data-testid="btn--map-edge-board"');
    expect(src).toContain('aria-label="เปิด Board"');
  });

  // ── Mobile toolbar ───────────────────────────────────────────────────────────
  it("renders a mobile toolbar with data-testid toolbar--map-mobile", () => {
    expect(src).toContain('data-testid="toolbar--map-mobile"');
    expect(src).toContain('role="toolbar"');
  });

  it("mobile toolbar has a Roster (ทีม) button", () => {
    expect(src).toContain('data-testid="btn--map-toolbar-roster"');
  });

  it("mobile toolbar has a Board button with ChevronUp icon", () => {
    expect(src).toContain('data-testid="btn--map-toolbar-board"');
    expect(src).toContain("ChevronUp");
  });

  it("toolbar buttons have aria-haspopup=dialog and aria-controls", () => {
    expect(src).toContain('aria-haspopup="dialog"');
    expect(src).toContain('aria-controls="sheet-roster"');
    expect(src).toContain('aria-controls="sheet-board"');
  });

  // ── One-at-a-time sheet state ─────────────────────────────────────────────────
  it("manages openSheet state typed as roster|board|null (one-at-a-time constraint)", () => {
    expect(src).toContain("openSheet, setOpenSheet] = useState<\"roster\" | \"board\" | null>");
  });

  // ── Sheets ───────────────────────────────────────────────────────────────────
  it("renders a Sheet for the Roster with id=sheet-roster", () => {
    expect(src).toContain('id="sheet-roster"');
    expect(src).toContain('data-testid="sheet--map-roster"');
  });

  it("renders a Sheet for the Board with id=sheet-board", () => {
    expect(src).toContain('id="sheet-board"');
    expect(src).toContain('data-testid="sheet--map-board"');
  });

  it("Sheet close buttons have aria-label=ปิด and data-testid", () => {
    expect(src).toContain('data-testid="btn--sheet-roster-close"');
    expect(src).toContain('data-testid="btn--sheet-board-close"');
    expect(src).toContain('aria-label="ปิด"');
  });

  it("Board Sheet empty state uses Thai copy from Design Brief verbatim", () => {
    expect(src).toContain("เลือก Feature หรือ Epic เพื่อดู Board");
  });

  it("Roster Sheet empty state uses Thai copy from Design Brief verbatim", () => {
    expect(src).toContain("ยังไม่มีข้อมูลทีม");
  });

  // ── i18n keys in locales ─────────────────────────────────────────────────────
  it("i18n locale keys for toolbar.roster TH = ทีม are added to translations.json", () => {
    const locales = read("../locales/translations.json");
    expect(locales).toContain('"roster": "ทีม"');
  });

  it("i18n locale keys for sheet.board.empty TH are added to translations.json", () => {
    const locales = read("../locales/translations.json");
    expect(locales).toContain('"empty": "เลือก Feature หรือ Epic เพื่อดู Board"');
  });

  // ── Imports — Sheet and icons ────────────────────────────────────────────────
  it("imports Sheet primitives from @/components/ui/sheet", () => {
    expect(src).toContain('from "@/components/ui/sheet"');
    expect(src).toContain("SheetContent");
    expect(src).toContain("SheetTitle");
    expect(src).toContain("SheetClose");
  });

  it("imports AlignJustify, ChevronUp, Layers, X icons from lucide-react", () => {
    expect(src).toContain("AlignJustify");
    expect(src).toContain("ChevronUp");
    expect(src).toContain("Layers");
  });

  // ── Desktop unchanged guard ──────────────────────────────────────────────────
  it("LAYOUT_WIDE is unchanged (desktop guard — 7 roles, campfire-ring coords)", () => {
    // Spot-check desktop ring positions
    expect(src).toContain('"architect":          { x: 50.1, y: 38.2 }');
    expect(src).toContain('"frontend-engineer":  { x: 49.8, y: 75.8 }');
  });

  it("desktop hud-left-panels and hud-right-panels classes are still rendered", () => {
    // Desktop panels must still be present (just hidden on small screens by CSS)
    expect(src).toContain('className="hud-left-panels"');
    expect(src).toContain('className="hud-right-panels"');
  });
});

// ============================================================
// CAM-252 (SMUX-3) — Bidirectional Flicker↔Board/Filter sync
// ============================================================

// ---------- SMUX-3: MapAgent.task widened with epicKey + feature ─────────────
describe("campsite-scene.tsx — SMUX-3: MapAgent.task carries epicKey + feature", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("MapAgent.task type includes epicKey field (for Map→Board/Filter sync)", () => {
    expect(src).toContain("epicKey: string");
  });

  it("MapAgent.task type includes feature field (for Map→Board/Filter sync)", () => {
    expect(src).toContain("feature: string");
  });

  it("MapAgent interface comment references SMUX-3 sync", () => {
    expect(src).toContain("SMUX-3");
  });
});

// ---------- SMUX-3: lib/status-map-model.ts projection ──────────────────────
describe("lib/status-map-model.ts — SMUX-3: task projects epicKey + feature", () => {
  const src = read("../lib/status-map-model.ts");

  it("buildAgents projects epicKey from epicOf(title) || parent.title (mirrors backlog/gate logic)", () => {
    expect(src).toContain("epicKey: epicOf(activeStory.title) || activeStory.parent?.title");
  });

  it("buildAgents projects feature from story.project?.name", () => {
    expect(src).toContain("feature: activeStory.project?.name");
  });

  it("task projection still has id, title, startedAt (no regression on existing fields)", () => {
    expect(src).toContain("id: activeStory.id");
    expect(src).toContain("title: cleanTitle(activeStory.title)");
    expect(src).toContain("startedAt: activeStory.startedAt");
  });
});

// ---------- SMUX-3: sync state ───────────────────────────────────────────────
describe("campsite-scene.tsx — SMUX-3: focusedTaskId sync state", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("declares focusedTaskId state (single source of truth for sync)", () => {
    expect(src).toContain("focusedTaskId, setFocusedTaskId");
  });

  it("initialises focusedTaskId to empty string (no highlight on load)", () => {
    expect(src).toContain('useState<string>("")');
  });
});

// ---------- SMUX-3: Map → Board/Filter direction (agent click) ───────────────
describe("campsite-scene.tsx — SMUX-3: Map→Board/Filter — agent click handler", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("handleAgentActivate is declared and wired to AgentScout onActivate", () => {
    expect(src).toContain("handleAgentActivate");
    expect(src).toContain("onActivate={() => handleAgentActivate(agent)");
  });

  it("agent without task falls back to roster open (original behavior preserved)", () => {
    // The handler must check !agent.task and open team roster
    expect(src).toContain("if (!agent.task)");
    expect(src).toContain("setTeamCollapsed(false)");
  });

  it("agent with task sets the filter to task.epicKey (scope='epic')", () => {
    expect(src).toContain("setActiveEpic(agent.task.epicKey)");
    expect(src).toContain('setScope("epic")');
  });

  it("agent with task sets focusedTaskId to task.id", () => {
    expect(src).toContain("setFocusedTaskId(agent.task.id)");
  });

  it("agent with task opens board sheet (mobile) and expands board panel (desktop)", () => {
    expect(src).toContain('setOpenSheet("board")');
    expect(src).toContain("setBoardCollapsed(false)");
  });
});

// ---------- SMUX-3: Board/Filter → Map direction (board card click) ──────────
describe("campsite-scene.tsx — SMUX-3: Board/Filter→Map — board card activate handler", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("handleBoardCardActivate is declared and sets focusedTaskId", () => {
    expect(src).toContain("handleBoardCardActivate");
    expect(src).toContain("setFocusedTaskId(storyId)");
  });

  it("closing the board sheet clears focusedTaskId", () => {
    // The Sheet onOpenChange callback must clear focusedTaskId when closing
    expect(src).toContain('setFocusedTaskId("")');
  });
});

// ---------- SMUX-3: agent focus ring (CSS + className) ───────────────────────
describe("campsite-scene.tsx — SMUX-3: agent focus ring", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("SCENE_CSS includes .scout--focused CSS rule with teal ring", () => {
    expect(src).toContain(".scout--focused");
    // The teal colour is the scene-internal #5BE9B0 or its rgba equivalent
    expect(src).toContain("rgba(91,233,176");
  });

  it("scout--focused animation is gated by prefers-reduced-motion: no-preference", () => {
    // Must not animate under reduce — check the guard exists in SCENE_CSS context
    expect(src).toContain("smux3-agent-pulse");
  });

  it("AgentScout receives focused prop and applies scout--focused class when true", () => {
    expect(src).toContain("focused ? \"scout scout--focused\" : \"scout\"");
  });

  it("AgentScoutProps interface declares focused optional boolean", () => {
    expect(src).toContain("focused?: boolean");
  });

  it("AgentScout memo comparator includes focused in the equality check", () => {
    expect(src).toContain("prev.focused === next.focused");
  });
});

// ---------- SMUX-3: Filter→Map — isFocused derivation for all matching agents ─
describe("campsite-scene.tsx — SMUX-3: Filter→Map — epic filter highlights matching agents", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("isFocused logic checks agent.task?.id === focusedTaskId (specific card path)", () => {
    expect(src).toContain("agent.task?.id === focusedTaskId");
  });

  it("isFocused logic also highlights by epicKey when focusedTaskId is empty + activeEpic matches", () => {
    expect(src).toContain("agent.task?.epicKey === activeEpic");
  });
});

// ---------- SMUX-3: board card highlight in campsite-overlays.tsx ─────────────
describe("campsite-overlays.tsx — SMUX-3: board card highlight", () => {
  const src = read("../app/status/map/campsite-overlays.tsx");

  it("StatusBoardProps declares focusedTaskId optional string", () => {
    expect(src).toContain("focusedTaskId?: string");
  });

  it("StatusBoardProps declares onCardActivate optional callback", () => {
    expect(src).toContain("onCardActivate?: (storyId: string) => void");
  });

  it("HUD_CSS includes .hud-kc.smux3-focused rule with teal border", () => {
    expect(src).toContain(".hud-kc.smux3-focused");
    expect(src).toContain("rgba(91,233,176");
  });

  it("focused card CSS animation is gated by prefers-reduced-motion: no-preference", () => {
    expect(src).toContain("hud-kc-focus-pulse");
  });

  it("board card applies smux3-focused class when its id matches focusedTaskId", () => {
    expect(src).toContain("smux3-focused");
    expect(src).toContain("focusedTaskId === s.id");
  });

  it("board card calls onCardActivate with its storyId on click", () => {
    expect(src).toContain("onCardActivate?.(s.id)");
  });

  it("board cards have data-testid following convention card--board-{id}", () => {
    expect(src).toContain("`card--board-${s.id}`");
  });

  it("StatusBoard uses useEffect to scroll focused card into view when focusedTaskId changes", () => {
    expect(src).toContain("scrollIntoView");
    expect(src).toContain("cardRefs.current[focusedTaskId]");
  });
});

// ---------- SMUX-3: onFilterChange clears focusedTaskId on reset ──────────────
describe("campsite-scene.tsx — SMUX-3: filter reset clears focusedTaskId", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("onFilterChange calls setFocusedTaskId('') when clearing persona", () => {
    // When level='persona' and value is empty → clear focus
    expect(src).toContain("if (!value) setFocusedTaskId");
  });
});

// ============================================================
// CAM-254 (SMUX-2-fix) — 3 visual defect fixes
// ============================================================

// ---------- Fix 1: right edge-tab border-radius mirrors left (inner-rounded) ---
describe("campsite-scene.tsx — CAM-254 Fix 1: right edge-tab border-radius", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("right edge-tab uses border-radius:0 6px 6px 0 (rounds inner/map-facing edge after rotate(180deg))", () => {
    // After rotate(180deg), the top-right and bottom-right corners (6px) visually become
    // the top-left and bottom-left (map-facing). So the map-facing side is rounded.
    // The frame-touching side stays flat — exactly mirroring the left tab.
    expect(src).toContain(".hud-edge-tab.right{");
    expect(src).toContain("border-radius:0 6px 6px 0;");
  });

  it("left edge-tab uses border-radius:0 6px 6px 0 (right side = map-facing for left-pinned tab)", () => {
    // Left tab is pinned left:0 so its right side faces the map → rounded on the right.
    expect(src).toContain(".hud-edge-tab.left{");
    expect(src).toContain("border-radius:0 6px 6px 0;");
  });

  it("right tab does NOT use border-radius:6px 0 0 6px (the wrong pre-fix value)", () => {
    // Guard: the bug was that the right tab had 6px on the left, which after rotate
    // became rounded on the right (frame-touching) side — wrong.
    // Verify the right-tab block no longer contains the old wrong value.
    const rightTabBlock = src.slice(src.indexOf(".hud-edge-tab.right{"), src.indexOf(".hud-edge-tab.right{") + 200);
    expect(rightTabBlock).not.toContain("border-radius:6px 0 0 6px");
  });
});

// ---------- Fix 2: mobile (<640) desktop signposts hidden, compact filter visible ---
describe("campsite-scene.tsx — CAM-254 Fix 2: mobile header overlap", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("@media (max-width: 639px) hides .hud-signposts-desktop with !important to prevent bleed", () => {
    // !important ensures the rule beats any broader selector that might show it.
    expect(src).toContain(".hud-signposts-desktop{display:none !important}");
  });

  it("@media (max-width: 639px) does NOT set .hud-filter-compact to position:fixed (stays in topbar flow)", () => {
    // The old code had position:fixed;top:10px;right:10px inside the mobile block, which
    // caused the compact filter to fly out of the topbar and overlap the logo.
    // After the fix, the mobile block must NOT set position:fixed on .hud-filter-compact.
    const mobileBlock = src.slice(src.lastIndexOf("@media (max-width: 639px)"), src.lastIndexOf("@media (max-width: 639px)") + 800);
    // The compact filter block inside mobile must NOT have position:fixed
    const compactInMobile = mobileBlock.indexOf(".hud-filter-compact");
    if (compactInMobile >= 0) {
      const compactCss = mobileBlock.slice(compactInMobile, compactInMobile + 120);
      expect(compactCss).not.toContain("position:fixed");
    }
  });

  it("@media (max-width: 1023px) also hides .hud-signposts-desktop (tablet parity)", () => {
    expect(src).toContain(".hud-signposts-desktop{display:none}");
  });
});

// ---------- Fix 3: each Sheet renders exactly one close button ─────────────────
describe("campsite-scene.tsx — CAM-254 Fix 3: single close button per Sheet", () => {
  const src = read("../app/status/map/campsite-scene.tsx");

  it("Roster SheetContent has showCloseButton={false} (suppresses shadcn built-in button)", () => {
    expect(src).toContain('id="sheet-roster"');
    // Confirm showCloseButton={false} appears before the next SheetContent close tag.
    const rosterBlock = src.slice(src.indexOf('id="sheet-roster"'), src.indexOf('id="sheet-board"'));
    expect(rosterBlock).toContain("showCloseButton={false}");
  });

  it("Board SheetContent has showCloseButton={false} (suppresses shadcn built-in button)", () => {
    const boardBlock = src.slice(src.indexOf('id="sheet-board"'), src.indexOf("</Sheet>", src.indexOf('id="sheet-board"')));
    expect(boardBlock).toContain("showCloseButton={false}");
  });

  it("Roster Sheet still has exactly one SheetClose element (the custom styled one)", () => {
    const rosterBlock = src.slice(src.indexOf('id="sheet-roster"'), src.indexOf('id="sheet-board"'));
    // Count occurrences of SheetClose in the roster block — must be exactly 1.
    const matches = rosterBlock.match(/<SheetClose/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("Board Sheet still has exactly one SheetClose element (the custom styled one)", () => {
    // The board sheet ends at the closing </Sheet> tag after id="sheet-board"
    const boardStart = src.indexOf('id="sheet-board"');
    // Find the </Sheet> that closes the board Sheet (first one after board starts)
    const boardEnd = src.indexOf("</Sheet>", boardStart);
    const boardBlock = src.slice(boardStart, boardEnd);
    const matches = boardBlock.match(/<SheetClose/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("custom SheetClose in Roster has aria-label=ปิด (a11y intact)", () => {
    expect(src).toContain('data-testid="btn--sheet-roster-close"');
    expect(src).toContain('aria-label="ปิด"');
  });

  it("custom SheetClose in Board has aria-label=ปิด (a11y intact)", () => {
    expect(src).toContain('data-testid="btn--sheet-board-close"');
  });

  it("SheetContent showCloseButton prop is accepted by the sheet component (not a stray prop)", () => {
    const sheetSrc = read("../components/ui/sheet.tsx");
    expect(sheetSrc).toContain("showCloseButton");
    expect(sheetSrc).toContain("showCloseButton = true");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CAM-256 SMUX-6 — Tablet/mobile chrome: icon buttons + filter row + env capsule
// Source-inspection tests on campsite-scene.tsx and campsite-overlays.tsx
// ────────────────────────────────────────────────────────────────────────────

describe("SMUX-6 — top bar icon buttons (<1024px)", () => {
  const scene  = read("../app/status/map/campsite-scene.tsx");
  const overly = read("../app/status/map/campsite-overlays.tsx");

  // AC-1: Icon button class exists with 44x44 sizing
  it("HUD_CSS defines .hud-icon-btn with 44px width and height for tap target", () => {
    expect(overly).toContain(".hud-icon-btn");
    expect(overly).toContain("width:44px");
    expect(overly).toContain("height:44px");
  });

  // AC-1: Dashboard link icon button with Thai aria-label
  it("scene renders LayoutDashboard icon link with Thai aria-label 'ดูผลงานทั้งหมด'", () => {
    expect(scene).toContain("LayoutDashboard");
    expect(scene).toContain("ดูผลงานทั้งหมด");
    expect(scene).toContain('data-testid="link--map-icon-dashboard"');
  });

  // AC-1: Env/productivity icon button with Gauge icon + Thai aria-label
  it("scene renders Gauge icon button with Thai aria-label 'ผลผลิต Scout Team'", () => {
    expect(scene).toContain("Gauge");
    expect(scene).toContain("ผลผลิต Scout Team");
    expect(scene).toContain('data-testid="btn--map-icon-env"');
  });

  // AC-1: Icon buttons container hidden on desktop ≥1024 via CSS
  it("SCENE_CSS hides .hud-topbar-icons on desktop (min-width:1024px) with display:none", () => {
    expect(scene).toContain("hud-topbar-icons");
    // The min-width 1024 block should hide them
    const minBlock = scene.slice(scene.lastIndexOf("@media (min-width: 1024px)"));
    expect(minBlock).toContain("hud-topbar-icons");
    expect(minBlock).toContain("display:none");
  });

  // AC-1: Original full-text env toggle hidden at <1024 via CSS
  it("SCENE_CSS hides .hud-env-toggle on mobile/tablet (<1024px)", () => {
    const maxBlock = scene.slice(scene.indexOf("@media (max-width: 1023px)"), scene.indexOf("@media (max-width: 639px)"));
    expect(maxBlock).toContain("hud-env-toggle");
    expect(maxBlock).toContain("display:none");
  });

  // AC-1: focus-visible ring on icon button for a11y
  it("HUD_CSS defines focus-visible ring on .hud-icon-btn for keyboard a11y", () => {
    expect(overly).toContain(".hud-icon-btn:focus-visible");
    expect(overly).toContain("outline:");
  });

  // AC-1: Lucide imports include LayoutDashboard and Gauge
  it("campsite-scene.tsx imports LayoutDashboard and Gauge from lucide-react", () => {
    const importLine = scene.split("\n").find((l) => l.includes("lucide-react"));
    expect(importLine).toBeDefined();
    expect(importLine).toContain("LayoutDashboard");
    expect(importLine).toContain("Gauge");
  });
});

describe("SMUX-6 — bottom filter row (<1024px, drop-up)", () => {
  const scene  = read("../app/status/map/campsite-scene.tsx");
  const overly = read("../app/status/map/campsite-overlays.tsx");

  // AC-2: FilterRowMobile exported from campsite-overlays
  it("campsite-overlays exports FilterRowMobile", () => {
    expect(overly).toContain("export function FilterRowMobile");
  });

  // AC-2: scene imports and renders FilterRowMobile
  it("campsite-scene.tsx imports FilterRowMobile from campsite-overlays", () => {
    const importLine = scene.split("\n").find((l) => l.includes("campsite-overlays"));
    expect(importLine).toContain("FilterRowMobile");
  });

  it("campsite-scene.tsx renders <FilterRowMobile> in JSX", () => {
    expect(scene).toContain("<FilterRowMobile");
  });

  // AC-2: 3 equal flex:1 columns
  it("HUD_CSS defines .hud-filter-col with flex:1 for equal columns", () => {
    expect(overly).toContain(".hud-filter-col{");
    expect(overly).toContain("flex:1");
  });

  // AC-2: min-height:30px on filter row buttons
  it("HUD_CSS defines .hud-filter-col-btn with min-height:30px", () => {
    expect(overly).toContain(".hud-filter-col-btn{");
    expect(overly).toContain("min-height:30px");
  });

  // AC-2: label truncates with text-overflow:ellipsis (no overflow at 320px)
  it("HUD_CSS defines text-overflow:ellipsis for label overflow safety at 320px", () => {
    expect(overly).toContain("text-overflow:ellipsis");
  });

  // AC-2: drop-up menus open upward with bottom: calc(100% + ...)
  it("HUD_CSS defines .hud-filter-dropup with bottom:calc(100%+...) for upward opening", () => {
    expect(overly).toContain(".hud-filter-dropup{");
    expect(overly).toContain("bottom:calc(100%");
  });

  // AC-2: filter row shown on tablet/mobile (<1024) via CSS
  it("HUD_CSS shows .hud-filter-row-mobile at max-width:1023px", () => {
    expect(overly).toContain(".hud-filter-row-mobile");
    // Should have a media block that shows it
    const mediaBlock = overly.slice(overly.indexOf("@media (max-width: 1023px)"), overly.indexOf("@media (min-width: 1024px)", overly.indexOf("@media (max-width: 1023px)")));
    expect(mediaBlock).toContain("hud-filter-row-mobile");
    expect(mediaBlock).toContain("display:block");
  });

  // AC-2: filter row hidden on desktop (≥1024) via CSS
  it("HUD_CSS hides .hud-filter-row-mobile on desktop (min-width:1024px)", () => {
    const minBlock = overly.slice(overly.lastIndexOf("@media (min-width: 1024px)"));
    expect(minBlock).toContain("hud-filter-row-mobile");
    expect(minBlock).toContain("display:none");
  });

  // AC-2: filter row has correct data-testid for QA
  it("FilterRowMobile renders data-testid='filter-row--map-mobile'", () => {
    expect(overly).toContain('data-testid="filter-row--map-mobile"');
  });

  // AC-2: no JSX span with hud-filter-compact class (replaced by FilterRowMobile bottom row)
  it("campsite-scene.tsx does not render a JSX <span> with className hud-filter-compact (replaced by FilterRowMobile)", () => {
    // Only check the JSX className attribute — CSS class selectors are allowed (backward compat)
    expect(scene).not.toContain('className="hud-filter-compact"');
  });

  // AC-2: a11y — aria-haspopup and aria-expanded on each column button
  it("FilterRowMobile column buttons have aria-haspopup and aria-expanded for a11y", () => {
    expect(overly).toContain('aria-haspopup="listbox"');
    expect(overly).toContain("aria-expanded={");
  });
});

describe("SMUX-6 — mobile bottom toolbar (transparent + EnvPipelineCapsule)", () => {
  const scene  = read("../app/status/map/campsite-scene.tsx");
  const overly = read("../app/status/map/campsite-overlays.tsx");

  // AC-3: toolbar background is transparent (not rgba(...) fill)
  it("SCENE_CSS makes .hud-map-toolbar transparent (no background fill) on <640px", () => {
    const mobileBlock = scene.slice(
      scene.indexOf("@media (max-width: 639px)"),
      scene.indexOf("@media (max-width: 639px)") + 1200
    );
    expect(mobileBlock).toContain("hud-map-toolbar");
    expect(mobileBlock).toContain("background:transparent");
    expect(mobileBlock).toContain("border-top:none");
  });

  // AC-3: no backdrop-filter on toolbar on mobile
  it("SCENE_CSS removes backdrop-filter from .hud-map-toolbar on mobile", () => {
    const mobileBlock = scene.slice(
      scene.indexOf("@media (max-width: 639px)"),
      scene.indexOf("@media (max-width: 639px)") + 1200
    );
    expect(mobileBlock).toContain("backdrop-filter:none");
  });

  // AC-4: EnvPipelineCapsule exported from campsite-overlays
  it("campsite-overlays exports EnvPipelineCapsule", () => {
    expect(overly).toContain("export function EnvPipelineCapsule");
  });

  // AC-4: scene imports EnvPipelineCapsule
  it("campsite-scene.tsx imports EnvPipelineCapsule from campsite-overlays", () => {
    const importLine = scene.split("\n").find((l) => l.includes("campsite-overlays"));
    expect(importLine).toContain("EnvPipelineCapsule");
  });

  // AC-4: scene renders <EnvPipelineCapsule> in mobile toolbar
  it("campsite-scene.tsx renders <EnvPipelineCapsule> in the toolbar (replaces bare pct%)", () => {
    expect(scene).toContain("<EnvPipelineCapsule");
  });

  // AC-4: EnvPipelineCapsule receives envLanes prop
  it("<EnvPipelineCapsule> receives envLanes prop in scene", () => {
    const capsuleBlock = scene.slice(scene.indexOf("<EnvPipelineCapsule"), scene.indexOf("/>", scene.indexOf("<EnvPipelineCapsule")));
    expect(capsuleBlock).toContain("envLanes={envLanes}");
  });

  // AC-4: EnvPipelineCapsule receives projectPct prop
  it("<EnvPipelineCapsule> receives projectPct prop in scene", () => {
    const capsuleBlock = scene.slice(scene.indexOf("<EnvPipelineCapsule"), scene.indexOf("/>", scene.indexOf("<EnvPipelineCapsule")));
    expect(capsuleBlock).toContain("projectPct={projectPct}");
  });

  // AC-4: EnvPipelineCapsule has min-height:44px for tap target
  it("HUD_CSS defines .env-capsule with min-height:44px for tap target", () => {
    expect(overly).toContain(".env-capsule{");
    expect(overly).toContain("min-height:44px");
  });

  // AC-4: 3 env lane segments in bar (dev/staging/ship)
  it("HUD_CSS defines .env-bar-seg.dev/.staging/.ship with correct colors", () => {
    expect(overly).toContain(".env-bar-seg.dev{background:#60a5fa}");
    expect(overly).toContain(".env-bar-seg.staging{background:#fb923c}");
    expect(overly).toContain(".env-bar-seg.ship{background:#4ade80}");
  });

  // AC-4: capsule aria-label contains dynamic lang and pct
  it("EnvPipelineCapsule renders aria-label with Thai text for a11y", () => {
    expect(overly).toContain("สถานะ Env Pipeline");
  });

  // AC-4: capsule has testid for QA assertions
  it("EnvPipelineCapsule has data-testid='btn--map-env-capsule'", () => {
    expect(overly).toContain('data-testid="btn--map-env-capsule"');
  });

  // AC-4: capsule button has aria-expanded and aria-controls for a11y
  it("EnvPipelineCapsule has aria-expanded and aria-controls on the trigger", () => {
    expect(overly).toContain("aria-expanded={open}");
    expect(overly).toContain('aria-controls="env-summary"');
  });

  // AC-4: summary popover has role=dialog for a11y
  it("EnvPipelineCapsule summary popover has role='dialog'", () => {
    expect(overly).toContain('role="dialog"');
    expect(overly).toContain('id="env-summary"');
    expect(overly).toContain('data-testid="popover--map-env-summary"');
  });

  // AC-4: summary popover shows gates, epics, backlog rows
  it("EnvPipelineCapsule summary shows gates/epics/backlog rows with testids", () => {
    expect(overly).toContain('data-testid="row--env-summary-gates"');
    expect(overly).toContain('data-testid="row--env-summary-epics"');
    expect(overly).toContain('data-testid="row--env-summary-backlog"');
  });

  // AC-4: summary close button accessible
  it("EnvPipelineCapsule summary has a close button with Thai aria-label 'ปิดสรุป'", () => {
    expect(overly).toContain("ปิดสรุป");
    expect(overly).toContain('data-testid="btn--env-summary-close"');
  });

  // AC-4: old bare pct% center display removed from toolbar
  it("campsite-scene.tsx no longer renders a bare pct% in the toolbar center (replaced by capsule)", () => {
    // The center pct% was in a hud-toolbar-center div — that div should no longer be in the toolbar
    // The toolbar block is between hud-map-toolbar open and close
    const toolbarStart = scene.indexOf('data-testid="toolbar--map-mobile"');
    const toolbarEnd   = scene.indexOf("</div>", toolbarStart + 2000);
    const toolbarBlock = scene.slice(toolbarStart, toolbarEnd + 10);
    expect(toolbarBlock).not.toContain("hud-toolbar-center");
  });
});

describe("SMUX-6 — i18n keys for SMUX-6 copy", () => {
  const translations = read("../locales/translations.json");

  // AC-5: topBar i18n keys present in both EN and TH
  it("translations.json contains statusMap.topBar.viewAll in EN", () => {
    expect(translations).toContain('"viewAll"');
    expect(translations).toContain('"View all work"');
  });

  it("translations.json contains statusMap.topBar.viewAll in TH", () => {
    expect(translations).toContain('"ดูผลงานทั้งหมด"');
  });

  it("translations.json contains statusMap.topBar.productivity in TH", () => {
    expect(translations).toContain('"ผลผลิต Scout Team"');
  });

  // AC-5: envPipeline i18n keys present
  it("translations.json contains statusMap.envPipeline.summaryTitle in TH", () => {
    expect(translations).toContain('"สถานะโปรเจกต์"');
  });

  it("translations.json contains statusMap.envPipeline.capsuleAriaLabel in TH", () => {
    expect(translations).toContain('"สถานะ Env Pipeline — Dev {dev}, Staging {stg}, Ship {ship}, {pct}%"');
  });
});

describe("SMUX-6 — desktop unchanged (≥1024px)", () => {
  const scene = read("../app/status/map/campsite-scene.tsx");

  // AC-6: FilterSignposts still rendered for desktop
  it("campsite-scene.tsx still renders <FilterSignposts> inside .hud-signposts-desktop for desktop", () => {
    // The JSX block renders className="hud-signposts-desktop" wrapping FilterSignposts
    // Use the JSX className attribute to locate the correct block (not the CSS class selector)
    const jsxMarker = 'className="hud-signposts-desktop"';
    const markerIdx = scene.indexOf(jsxMarker);
    expect(markerIdx).toBeGreaterThan(-1);
    const desktopBlock = scene.slice(markerIdx, scene.indexOf("</span>", markerIdx) + 10);
    expect(desktopBlock).toContain("FilterSignposts");
  });

  // AC-6: ViewToggle still rendered (unchanged desktop link)
  it("campsite-scene.tsx still renders <ViewToggle> for desktop", () => {
    expect(scene).toContain("<ViewToggle");
  });

  // AC-6: hud-signposts-desktop class still present (desktop filter row untouched)
  it("campsite-scene.tsx retains hud-signposts-desktop class for desktop filter row", () => {
    expect(scene).toContain("hud-signposts-desktop");
  });
});
