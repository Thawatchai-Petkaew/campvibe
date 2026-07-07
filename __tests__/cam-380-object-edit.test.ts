// @vitest-environment jsdom
/**
 * cam-380-object-edit.test.ts — CAM-380 Object Edit Mode pure-logic unit
 * tests for `parseStoredPropLayout`, `clampPropPosition`, and
 * `capturePropLayout`, exported (named) from canvas-3d.tsx per code.md's util
 * convention — mirrors cam-378-lod-predicate.test.ts / cam-379-board-geometry
 * .test.ts's approach (a real behavioral unit test instead of a source-grep
 * guard). Scoped to jsdom via the file-level pragma, same documented,
 * isolated exception every other canvas-3d.tsx test in this repo already
 * uses (the repo's default vitest environment stays `node` —
 * vitest.config.ts unchanged).
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { capturePropLayout, clampPropPosition, parseStoredPropLayout } from "../app/status/map/canvas-3d";

describe("parseStoredPropLayout — CAM-380 localStorage layout guard", () => {
  it("[unit] parses a well-formed layout with one entry", () => {
    const raw = JSON.stringify({ sofa: { x: 1, y: 0.02, z: 2 } });
    expect(parseStoredPropLayout(raw)).toEqual({ sofa: { x: 1, y: 0.02, z: 2 } });
  });

  it("[null/empty] returns {} for null (absent localStorage key)", () => {
    expect(parseStoredPropLayout(null)).toEqual({});
  });

  it("[null/empty] returns {} for an empty string", () => {
    expect(parseStoredPropLayout("")).toEqual({});
  });

  it("[error] returns {} for malformed JSON instead of throwing", () => {
    expect(() => parseStoredPropLayout("{not valid json")).not.toThrow();
    expect(parseStoredPropLayout("{not valid json")).toEqual({});
  });

  it("[error] returns {} for a JSON array (wrong shape — expects an object map)", () => {
    expect(parseStoredPropLayout("[1,2,3]")).toEqual({});
  });

  it("[error] returns {} for a JSON primitive (wrong shape)", () => {
    expect(parseStoredPropLayout('"just a string"')).toEqual({});
  });

  it("[error] drops only the malformed entry, keeps valid siblings", () => {
    const raw = JSON.stringify({
      sofa: { x: 1, y: 0.02, z: 2 },
      plant: { x: "not-a-number", y: 0.02, z: 1 },
      "table-oval": { x: 3, y: 4.05 }, // missing z
    });
    expect(parseStoredPropLayout(raw)).toEqual({ sofa: { x: 1, y: 0.02, z: 2 } });
  });

  it("[boundary] accepts 0 and negative coordinates (valid world positions)", () => {
    const raw = JSON.stringify({ plant: { x: -2.6, y: 0, z: 0 } });
    expect(parseStoredPropLayout(raw)).toEqual({ plant: { x: -2.6, y: 0, z: 0 } });
  });
});

describe("clampPropPosition — CAM-380 room-bounds + floor/ceiling clamp", () => {
  it("[unit] leaves a well-inside-bounds position untouched", () => {
    expect(clampPropPosition(0, 0.02, 0, 1)).toEqual({ x: 0, y: 0.02, z: 0 });
  });

  it("[boundary] clamps Y to the floor when dragged below OBJECT_FLOOR_WORLD_Y", () => {
    const result = clampPropPosition(0, -5, 0, 1);
    expect(result.y).toBe(0.02);
  });

  it("[boundary] clamps Y to the ceiling when raised above OBJECT_CEILING_WORLD_Y", () => {
    const result = clampPropPosition(0, 999, 0, 1);
    expect(result.y).toBe(4.05);
  });

  it("[boundary] clamps X/Z at the west/south wall (large-radius prop, e.g. the sofa)", () => {
    const result = clampPropPosition(-100, 0.02, -100, 1.62);
    // margin = max(0.52, 1.62*0.48=0.7776) = 0.7776; WALL_INNER = -8.26
    expect(result.x).toBeCloseTo(-8.26 + 0.7776, 5);
    expect(result.z).toBeCloseTo(-8.26 + 0.7776, 5);
  });

  it("[boundary] clamps X/Z at the east/north wall", () => {
    const result = clampPropPosition(100, 0.02, 100, 0.72);
    // margin = max(0.52, 0.72*0.48=0.3456) = 0.52; WALL_END = 9.0
    expect(result.x).toBeCloseTo(9.0 - 0.52, 5);
    expect(result.z).toBeCloseTo(9.0 - 0.52, 5);
  });

  it("[null/empty] does not throw for a zero radius", () => {
    expect(() => clampPropPosition(0, 0.02, 0, 0)).not.toThrow();
  });
});

describe("capturePropLayout — CAM-380 snapshot for localStorage persistence", () => {
  function record(name: string, x: number, y: number, z: number): Parameters<typeof capturePropLayout>[0][number] {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    return { def: { name, file: "", position: new THREE.Vector3(), rotationY: 0, targetSize: 1, radius: 1 }, group, obstacle: { x, z, radius: 1 } };
  }

  it("[unit] captures every record's position keyed by name, rounded to 3 decimals", () => {
    const records = [record("sofa", 0.5001234, 0.02, 1.4)];
    expect(capturePropLayout(records)).toEqual({ sofa: { x: 0.5, y: 0.02, z: 1.4 } });
  });

  it("[null/empty] returns {} for an empty record list", () => {
    expect(capturePropLayout([])).toEqual({});
  });

  it("[unit] captures multiple props independently, one entry per name", () => {
    const records = [record("sofa", 1, 0.02, 2), record("plant", -2.6, 0.02, 1.4)];
    expect(capturePropLayout(records)).toEqual({
      sofa: { x: 1, y: 0.02, z: 2 },
      plant: { x: -2.6, y: 0.02, z: 1.4 },
    });
  });
});
