import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { canonRole } from "@/lib/status-derive";
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
describe("app/status/map/scene-loader.tsx — S7 AC4: loading state", () => {
  const src = read("../app/status/map/scene-loader.tsx");

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

  it("ViewToggle CSS positions fixed top:18px centered (not top-left)", () => {
    expect(src).toContain(".hud-view-toggle");
    expect(src).toContain("top:18px");
    // centered via left:50% + translateX(-50%)
    expect(src).toContain("left:50%");
  });

  it("ViewToggle renders nav[role='tablist'] with แดชบอร์ด and แผนที่ links", () => {
    expect(src).toContain("แดชบอร์ด");
    expect(src).toContain("แผนที่");
    expect(src).toContain('data-testid="nav--map-view-toggle"');
    expect(src).toContain('data-testid="link--map-toggle-dashboard"');
    expect(src).toContain('data-testid="tab--map-toggle-map"');
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
