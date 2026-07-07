// @vitest-environment jsdom
/**
 * cam-378-lod-predicate.test.ts — CAM-378 (S6) mobile/low-end LOD tier predicate.
 *
 * Real behavioral unit test (not a source-grep guard, per .claude/rules/qa.md's
 * guidance to prefer a measurable assertion where the environment allows) for
 * `preferLowLod()`, exported (named, per .claude/rules/code.md's util
 * convention) from canvas-3d.tsx. Scoped to jsdom via the file-level pragma —
 * same documented, isolated exception used by
 * status-map-shell-renderer-swap.test.ts; the repo's default vitest
 * environment stays `node` (vitest.config.ts unchanged).
 *
 * Covers every branch of the predicate: narrow viewport alone, coarse pointer
 * alone, low deviceMemory alone, none matching (desktop default tier), and the
 * two "does not opt in" edges (deviceMemory absent entirely — most browsers;
 * deviceMemory present but above the 4GB threshold).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { preferLowLod } from "../app/status/map/canvas-3d";

type MediaQueryMatchers = Record<string, boolean>;

function stubMatchMedia(matches: MediaQueryMatchers): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: matches[query] ?? false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function stubDeviceMemory(value: number | undefined): void {
  Object.defineProperty(window.navigator, "deviceMemory", {
    value,
    configurable: true,
  });
}

describe("preferLowLod — CAM-378 (S6) mobile/low-end LOD tier predicate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error — deviceMemory is a non-standard property; clean up between cases.
    delete window.navigator.deviceMemory;
  });

  it("[unit] returns true for a narrow (<=768px) viewport", () => {
    stubMatchMedia({ "(max-width: 768px)": true, "(pointer: coarse)": false });
    expect(preferLowLod()).toBe(true);
  });

  it("[unit] returns true for a coarse (touch) pointer regardless of viewport width", () => {
    stubMatchMedia({ "(max-width: 768px)": false, "(pointer: coarse)": true });
    expect(preferLowLod()).toBe(true);
  });

  it("[unit] returns true when navigator.deviceMemory is <=4GB", () => {
    stubMatchMedia({ "(max-width: 768px)": false, "(pointer: coarse)": false });
    stubDeviceMemory(4);
    expect(preferLowLod()).toBe(true);
  });

  it("[unit] returns false on a wide desktop viewport with no coarse pointer and no low-memory signal", () => {
    stubMatchMedia({ "(max-width: 768px)": false, "(pointer: coarse)": false });
    expect(preferLowLod()).toBe(false);
  });

  it("[null/empty] returns false when navigator.deviceMemory is entirely absent (most browsers — Safari/Firefox)", () => {
    stubMatchMedia({ "(max-width: 768px)": false, "(pointer: coarse)": false });
    // deviceMemory left undefined (afterEach's delete + no stubDeviceMemory call).
    expect(preferLowLod()).toBe(false);
  });

  it("[boundary] returns false when navigator.deviceMemory is above the 4GB threshold (e.g. 8)", () => {
    stubMatchMedia({ "(max-width: 768px)": false, "(pointer: coarse)": false });
    stubDeviceMemory(8);
    expect(preferLowLod()).toBe(false);
  });

  it("[error] fails open to the default tier when matchMedia throws", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => {
        throw new Error("matchMedia unavailable");
      }),
    );
    expect(preferLowLod()).toBe(false);
  });
});
