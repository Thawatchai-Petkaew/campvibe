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

  it("builds the agents projection from rmap + work", () => {
    expect(src).toContain("agents:");
    expect(src).toContain("buildAgents");
    expect(src).toContain("rmap");
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
