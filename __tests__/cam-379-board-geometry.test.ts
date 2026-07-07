// @vitest-environment jsdom
/**
 * cam-379-board-geometry.test.ts — CAM-379 (S7) wall-screen pure-logic unit
 * tests for `boardFacingY` and `computeBoardsSignature`, exported (named)
 * from canvas-3d.tsx per code.md's util convention — mirrors
 * cam-378-lod-predicate.test.ts's approach (a real behavioral unit test
 * instead of a source-grep guard). Scoped to jsdom via the file-level
 * pragma, same documented, isolated exception every other canvas-3d.tsx test
 * in this repo already uses (the repo's default vitest environment stays
 * `node` — vitest.config.ts unchanged).
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { boardFacingY, computeBoardsSignature } from "../app/status/map/canvas-3d";
import type { MapAgent, MapGate } from "../app/status/map/map-types";

// Mirrors the file's own WORKFLOW station geometry (canvas-3d.tsx) — the
// exact 8 stations, so this test proves boardFacingY reproduces the
// prototype's hardcoded per-item `rotY` (atlas_web_demo/index.html) for
// every real station, not just a synthetic example.
// `characterFile` is irrelevant to boardFacingY's geometry-only computation
// but required by the (unexported) WorkflowStation shape it's typed against.
const STATIONS = [
  { key: "designer", characterFile: "designer.glb", pos: new THREE.Vector3(-5.60, 2.0, -7.65), workSpot: new THREE.Vector3(-5.60, 0.94, -5.95), expectedRotY: 0 },
  { key: "frontend", characterFile: "frontend.glb", pos: new THREE.Vector3(-1.40, 2.0, -7.65), workSpot: new THREE.Vector3(-1.40, 0.94, -5.95), expectedRotY: 0 },
  { key: "backend", characterFile: "backend.glb", pos: new THREE.Vector3(2.80, 2.0, -7.65), workSpot: new THREE.Vector3(2.80, 0.94, -5.95), expectedRotY: 0 },
  { key: "architect", characterFile: "architect.glb", pos: new THREE.Vector3(7.00, 2.0, -7.65), workSpot: new THREE.Vector3(7.00, 0.94, -5.95), expectedRotY: 0 },
  { key: "security", characterFile: "security.glb", pos: new THREE.Vector3(-7.65, 2.0, 7.00), workSpot: new THREE.Vector3(-5.95, 0.94, 7.00), expectedRotY: Math.PI / 2 },
  { key: "atlas", characterFile: "atlas.glb", isAtlas: true, pos: new THREE.Vector3(-7.65, 2.0, 2.80), workSpot: new THREE.Vector3(-5.95, 0.94, 2.80), expectedRotY: Math.PI / 2 },
  { key: "qa", characterFile: "qa.glb", pos: new THREE.Vector3(-7.65, 2.0, -1.40), workSpot: new THREE.Vector3(-5.95, 0.94, -1.40), expectedRotY: Math.PI / 2 },
  { key: "devops", characterFile: "devops.glb", pos: new THREE.Vector3(-7.65, 2.0, -5.60), workSpot: new THREE.Vector3(-5.95, 0.94, -5.60), expectedRotY: Math.PI / 2 },
] as const;

describe("boardFacingY — CAM-379 (S7) board orientation derived from pos->workSpot", () => {
  it.each(STATIONS)("[unit] $key: faces the room (matches the prototype's hardcoded rotY)", (station) => {
    expect(boardFacingY(station)).toBeCloseTo(station.expectedRotY, 10);
  });
});

function buildAgent(overrides: Partial<MapAgent> = {}): MapAgent {
  return {
    role: "frontend-engineer",
    name: "frontend-engineer",
    active: false,
    done: 0,
    activeCount: 0,
    queued: 0,
    task: null,
    ...overrides,
  };
}

const GATE: MapGate = { id: "g1", title: "a gate", url: "", epicKey: "", priority: "High" };

describe("computeBoardsSignature — CAM-379 (S7) redraw-on-signature-change discipline", () => {
  it("[unit] returns the same string for two calls with identical rendered fields", () => {
    const agents = [buildAgent({ active: true, activeCount: 1, task: { id: "T-1", title: "x", startedAt: null, epicKey: "", feature: "" } })];
    expect(computeBoardsSignature(agents, [GATE])).toBe(computeBoardsSignature(agents, [GATE]));
  });

  it("[unit] changes when an agent's active flag changes", () => {
    const idle = [buildAgent({ active: false })];
    const active = [buildAgent({ active: true, activeCount: 1 })];
    expect(computeBoardsSignature(idle, [])).not.toBe(computeBoardsSignature(active, []));
  });

  it("[unit] changes when the task id changes (a new task started)", () => {
    const before = [buildAgent({ active: true, task: { id: "T-1", title: "a", startedAt: null, epicKey: "", feature: "" } })];
    const after = [buildAgent({ active: true, task: { id: "T-2", title: "a", startedAt: null, epicKey: "", feature: "" } })];
    expect(computeBoardsSignature(before, [])).not.toBe(computeBoardsSignature(after, []));
  });

  it("[unit] changes when the gate COUNT changes (Atlas board)", () => {
    expect(computeBoardsSignature([], [])).not.toBe(computeBoardsSignature([], [GATE]));
  });

  it("[null/empty] handles zero agents and zero gates without throwing", () => {
    expect(() => computeBoardsSignature([], [])).not.toThrow();
    expect(computeBoardsSignature([], [])).toBe("#0");
  });

  it("[unit] stays IDENTICAL when only an unrelated field changes (title text/url/priority) — the no-op guarantee", () => {
    const before = [buildAgent({ active: true, task: { id: "T-1", title: "old title", startedAt: null, epicKey: "e1", feature: "f1" } })];
    const after = [buildAgent({ active: true, task: { id: "T-1", title: "brand new title text", startedAt: "2026-01-01T00:00:00.000Z", epicKey: "e2", feature: "f2" } })];
    const gatesBefore: MapGate[] = [{ id: "g1", title: "old", url: "u1", epicKey: "e1", priority: "Low" }];
    const gatesAfter: MapGate[] = [{ id: "g1", title: "brand new gate title", url: "u2", epicKey: "e2", priority: "Urgent" }];
    expect(computeBoardsSignature(before, gatesBefore)).toBe(computeBoardsSignature(after, gatesAfter));
  });

  it("[boundary] changes when done/queued counts change even with active/task unchanged", () => {
    const before = [buildAgent({ active: true, done: 2, queued: 3 })];
    const after = [buildAgent({ active: true, done: 3, queued: 2 })];
    expect(computeBoardsSignature(before, [])).not.toBe(computeBoardsSignature(after, []));
  });
});
