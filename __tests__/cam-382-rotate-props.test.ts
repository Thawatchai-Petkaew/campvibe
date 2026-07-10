// @vitest-environment jsdom
/**
 * cam-382-rotate-props.test.ts — CAM-382 Object Edit Mode rotate-via-buttons
 * pure-logic unit tests: `normalizeYRotation` (the 15°-step wrap math) and the
 * BACKWARD-COMPATIBLE `{x,y,z,rotationY}` layout schema extension across
 * `parseStoredPropLayout` / `capturePropLayout` / `applyStoredPropLayout`,
 * all exported (named) from canvas-3d.tsx per code.md's util convention —
 * mirrors cam-380-object-edit.test.ts's approach (a real behavioral unit
 * test instead of a source-grep guard). Scoped to jsdom via the file-level
 * pragma, same documented, isolated exception every other canvas-3d.tsx test
 * in this repo already uses (the repo's default vitest environment stays
 * `node` — vitest.config.ts unchanged).
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyStoredPropLayout,
  capturePropLayout,
  normalizeYRotation,
  parseStoredPropLayout,
} from "../app/status/map/canvas-3d";

describe("normalizeYRotation — CAM-382 15°-step Y-rotation wrap", () => {
  it("[unit] leaves an already-in-range angle untouched", () => {
    expect(normalizeYRotation(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10);
  });

  it("[boundary] wraps a negative angle into [0, 2π)", () => {
    expect(normalizeYRotation(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 10);
  });

  it("[boundary] wraps an angle past 2π back into range", () => {
    expect(normalizeYRotation(2 * Math.PI + 0.3)).toBeCloseTo(0.3, 10);
  });

  it("[unit] 0 stays 0 (no wrap needed)", () => {
    expect(normalizeYRotation(0)).toBe(0);
  });

  it("[unit] accumulates 24 taps of 15° back to the start (full circle)", () => {
    // Asserted via sin/cos (not the raw angle) — floating-point drift across
    // 24 additions can land the wrapped value at ~0 OR ~2π (the same
    // physical angle, either side of the wrap boundary), so a direct
    // toBeCloseTo(0) is not robust to which side it lands on.
    const step = THREE.MathUtils.degToRad(15);
    let angle = 0;
    for (let i = 0; i < 24; i++) angle = normalizeYRotation(angle + step);
    expect(Math.sin(angle)).toBeCloseTo(0, 9);
    expect(Math.cos(angle)).toBeCloseTo(1, 9);
  });

  it("[null/empty] does not throw for 0 or a huge value", () => {
    expect(() => normalizeYRotation(0)).not.toThrow();
    expect(() => normalizeYRotation(1e6)).not.toThrow();
  });
});

describe("parseStoredPropLayout — CAM-382 backward-compatible rotationY extension", () => {
  it("[unit] BACKWARD-COMPAT: a pre-CAM-382 {x,y,z}-only entry still loads (no rotationY key)", () => {
    const raw = JSON.stringify({ sofa: { x: 0.5, y: 0.02, z: 1.4 } });
    const parsed = parseStoredPropLayout(raw);
    expect(parsed).toEqual({ sofa: { x: 0.5, y: 0.02, z: 1.4 } });
    expect(parsed.sofa.rotationY).toBeUndefined();
  });

  it("[unit] a post-CAM-382 entry with rotationY parses it through", () => {
    const raw = JSON.stringify({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: 1.309 } });
    expect(parseStoredPropLayout(raw)).toEqual({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: 1.309 } });
  });

  it("[unit] a mixed layout (one old entry, one new entry) loads both correctly", () => {
    const raw = JSON.stringify({
      sofa: { x: 0.5, y: 0.02, z: 1.4 }, // pre-rotate save
      plant: { x: -2.6, y: 0.02, z: 1.4, rotationY: 0.5 }, // post-rotate save
    });
    const parsed = parseStoredPropLayout(raw);
    expect(parsed.sofa).toEqual({ x: 0.5, y: 0.02, z: 1.4 });
    expect(parsed.plant).toEqual({ x: -2.6, y: 0.02, z: 1.4, rotationY: 0.5 });
  });

  it("[boundary] accepts a rotationY of exactly 0", () => {
    const raw = JSON.stringify({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: 0 } });
    expect(parseStoredPropLayout(raw)).toEqual({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: 0 } });
  });

  it("[boundary] accepts a negative rotationY", () => {
    const raw = JSON.stringify({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: -1.5708 } });
    expect(parseStoredPropLayout(raw)).toEqual({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: -1.5708 } });
  });

  it("[error] drops the whole entry when rotationY is present but not a finite number", () => {
    const raw = JSON.stringify({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: "not-a-number" } });
    expect(parseStoredPropLayout(raw)).toEqual({});
  });

  it("[error] keeps a valid sibling when only one entry has a malformed rotationY", () => {
    const raw = JSON.stringify({
      sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: 1.2 },
      plant: { x: -2.6, y: 0.02, z: 1.4, rotationY: Infinity },
    });
    expect(parseStoredPropLayout(raw)).toEqual({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: 1.2 } });
  });
});

describe("capturePropLayout — CAM-382 captures rotation.y alongside position", () => {
  function record(name: string, x: number, y: number, z: number, rotationY: number): Parameters<typeof capturePropLayout>[0][number] {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;
    return { def: { name, file: "", position: new THREE.Vector3(), rotationY: 0, targetSize: 1, radius: 1 }, group, obstacle: { x, z, radius: 1 } };
  }

  it("[unit] captures the group's current rotation.y, rounded to 3 decimals", () => {
    const records = [record("sofa", 0.5, 0.02, 1.4, 1.0471975)];
    expect(capturePropLayout(records)).toEqual({ sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: 1.047 } });
  });

  it("[boundary] captures a rotation of exactly 0", () => {
    const records = [record("plant", -2.6, 0.02, 1.4, 0)];
    expect(capturePropLayout(records)).toEqual({ plant: { x: -2.6, y: 0.02, z: 1.4, rotationY: 0 } });
  });
});

describe("applyStoredPropLayout — CAM-382 backward-compatible rotation restore", () => {
  function makeRecord(name: string, defaultRotationY: number): Parameters<typeof applyStoredPropLayout>[0][number] {
    const group = new THREE.Group();
    group.rotation.y = defaultRotationY; // mirrors loadAssets: group.rotation.y = item.rotationY at construction
    return {
      def: { name, file: "", position: new THREE.Vector3(), rotationY: defaultRotationY, targetSize: 1, radius: 1 },
      group,
      obstacle: { x: 0, z: 0, radius: 1 },
    };
  }

  it("[unit] restores rotationY from a saved post-CAM-382 entry", () => {
    const record = makeRecord("sofa", -Math.PI / 2);
    applyStoredPropLayout([record], { sofa: { x: 1, y: 0.02, z: 2, rotationY: 0.75 } });
    expect(record.group.rotation.y).toBeCloseTo(0.75, 10);
  });

  it("[unit] BACKWARD-COMPAT: leaves the group's current/default rotation untouched when the saved entry has no rotationY", () => {
    const record = makeRecord("sofa", -Math.PI / 2);
    applyStoredPropLayout([record], { sofa: { x: 1, y: 0.02, z: 2 } }); // pre-CAM-382 shape, no rotationY key
    expect(record.group.rotation.y).toBeCloseTo(-Math.PI / 2, 10); // unchanged from construction-time default
  });

  it("[null/empty] a prop with no saved entry keeps its default position AND rotation untouched", () => {
    const record = makeRecord("plant", Math.PI / 2);
    applyStoredPropLayout([record], {}); // no entry for "plant" at all
    expect(record.group.position.x).toBe(0);
    expect(record.group.rotation.y).toBeCloseTo(Math.PI / 2, 10);
  });

  it("[unit] still applies position when rotationY is present (both fields land together)", () => {
    const record = makeRecord("sofa", 0);
    applyStoredPropLayout([record], { sofa: { x: 1, y: 0.02, z: 2, rotationY: 2.1 } });
    expect(record.group.position.x).toBe(1);
    expect(record.group.position.z).toBe(2);
    expect(record.group.rotation.y).toBeCloseTo(2.1, 10);
  });
});
