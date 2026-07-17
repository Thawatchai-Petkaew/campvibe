// @vitest-environment jsdom
/**
 * cam-383-detach-editable-atlas.test.ts — CAM-383 pure-logic unit tests for
 * the seated Atlas's detach from the sofa into a fully independent, editable
 * `RoomPropRecord`. Covers:
 *   (1) SEATED_ATLAS_PROP_DEF's default WORLD transform — independently
 *       re-derived via the SAME parent-child composition the OLD (CAM-381)
 *       childed-to-the-sofa code used, so a drift here would mean the figure
 *       visibly jumps on detach;
 *   (2) backward-compatible layout parsing/restore for the NEW "seated-atlas"
 *       key across `parseStoredPropLayout`/`applyStoredPropLayout` — an old
 *       layout saved before this story (no "seated-atlas" key at all) must
 *       still load without error and leave the record at its module-level
 *       default.
 * Exported (named) from canvas-3d.tsx per code.md's util convention — mirrors
 * cam-380-object-edit.test.ts / cam-382-rotate-props.test.ts's approach (a
 * real behavioral unit test instead of a source-grep guard). Scoped to jsdom
 * via the file-level pragma, same documented, isolated exception every other
 * canvas-3d.tsx test in this repo already uses (the repo's default vitest
 * environment stays `node` — vitest.config.ts unchanged).
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyStoredPropLayout,
  parseStoredPropLayout,
  SEATED_ATLAS_PROP_DEF,
} from "../app/status/map/canvas-3d";

describe("SEATED_ATLAS_PROP_DEF — CAM-391 default world transform (owner-arranged layout)", () => {
  // CAM-391: the seated-Atlas default is now the owner's arranged position
  // (baked from their exported Object Edit Mode localStorage layout),
  // superseding the CAM-383 "detach matches the old childed-to-the-sofa
  // position" default. This guards the baked default against accidental change.
  it("[unit] default world position is the owner-arranged layout", () => {
    expect(SEATED_ATLAS_PROP_DEF.position.x).toBeCloseTo(-1.336, 5);
    expect(SEATED_ATLAS_PROP_DEF.position.y).toBeCloseTo(0.597, 5);
    expect(SEATED_ATLAS_PROP_DEF.position.z).toBeCloseTo(0.846, 5);
  });

  it("[unit] default rotationY is the owner-arranged facing", () => {
    expect(SEATED_ATLAS_PROP_DEF.rotationY).toBeCloseTo(1.571, 5);
  });

  it("[boundary] radius is a small positive footprint (smaller than every ROOM_PROPS radius)", () => {
    expect(SEATED_ATLAS_PROP_DEF.radius).toBeGreaterThan(0);
    expect(SEATED_ATLAS_PROP_DEF.radius).toBeLessThan(1);
  });

  it("[unit] carries targetHeight (character-normalize path), not targetSize (prop-normalize path)", () => {
    expect(SEATED_ATLAS_PROP_DEF.targetHeight).toBe(0.98);
    expect(SEATED_ATLAS_PROP_DEF.targetSize).toBeUndefined();
  });

  it("[unit] name is the persistence key the rest of the machinery keys on", () => {
    expect(SEATED_ATLAS_PROP_DEF.name).toBe("seated-atlas");
  });
});

describe("parseStoredPropLayout — CAM-383 backward-compat, no seated-atlas key", () => {
  it("[unit] BACKWARD-COMPAT: a pre-CAM-383 layout (props only, no seated-atlas key) still parses", () => {
    const raw = JSON.stringify({
      sofa: { x: 0.5, y: 0.02, z: 1.4, rotationY: -1.5708 },
      plant: { x: -2.6, y: 0.02, z: 1.4 },
    });
    const parsed = parseStoredPropLayout(raw);
    expect(parsed.sofa).toEqual({ x: 0.5, y: 0.02, z: 1.4, rotationY: -1.5708 });
    expect(parsed.plant).toEqual({ x: -2.6, y: 0.02, z: 1.4 });
    expect(parsed["seated-atlas"]).toBeUndefined();
  });

  it("[unit] a layout that DOES carry a seated-atlas entry parses it through like any other prop", () => {
    const raw = JSON.stringify({ "seated-atlas": { x: 1.2, y: 0.9, z: 2.0, rotationY: 0.4 } });
    expect(parseStoredPropLayout(raw)).toEqual({ "seated-atlas": { x: 1.2, y: 0.9, z: 2.0, rotationY: 0.4 } });
  });
});

describe("applyStoredPropLayout — CAM-383 backward-compat restore for the seated-Atlas record", () => {
  function makeAtlasRecord(): Parameters<typeof applyStoredPropLayout>[0][number] {
    const group = new THREE.Group();
    group.position.copy(SEATED_ATLAS_PROP_DEF.position);
    group.rotation.y = SEATED_ATLAS_PROP_DEF.rotationY;
    return {
      def: SEATED_ATLAS_PROP_DEF,
      group,
      obstacle: { x: SEATED_ATLAS_PROP_DEF.position.x, z: SEATED_ATLAS_PROP_DEF.position.z, radius: SEATED_ATLAS_PROP_DEF.radius },
    };
  }

  it("[null/empty] BACKWARD-COMPAT: an old layout with no seated-atlas key leaves the record at its module default", () => {
    const record = makeAtlasRecord();
    // Pre-CAM-383 layout — only ever had prop entries, never this key.
    applyStoredPropLayout([record], { sofa: { x: 0.5, y: 0.02, z: 1.4 } });
    expect(record.group.position.x).toBeCloseTo(SEATED_ATLAS_PROP_DEF.position.x, 10);
    expect(record.group.position.y).toBeCloseTo(SEATED_ATLAS_PROP_DEF.position.y, 10);
    expect(record.group.position.z).toBeCloseTo(SEATED_ATLAS_PROP_DEF.position.z, 10);
    expect(record.group.rotation.y).toBeCloseTo(SEATED_ATLAS_PROP_DEF.rotationY, 10);
  });

  it("[unit] a saved seated-atlas entry restores position + rotation", () => {
    const record = makeAtlasRecord();
    applyStoredPropLayout([record], { "seated-atlas": { x: 0.9, y: 0.75, z: 1.5, rotationY: 1.1 } });
    expect(record.group.position.x).toBeCloseTo(0.9, 10);
    expect(record.group.position.y).toBeCloseTo(0.75, 10);
    expect(record.group.position.z).toBeCloseTo(1.5, 10);
    expect(record.group.rotation.y).toBeCloseTo(1.1, 10);
  });

  it("[unit] a saved seated-atlas entry with no rotationY (edge save) leaves rotation untouched", () => {
    const record = makeAtlasRecord();
    applyStoredPropLayout([record], { "seated-atlas": { x: 0.9, y: 0.75, z: 1.5 } });
    expect(record.group.position.x).toBeCloseTo(0.9, 10);
    expect(record.group.rotation.y).toBeCloseTo(SEATED_ATLAS_PROP_DEF.rotationY, 10); // untouched from construction
  });
});
