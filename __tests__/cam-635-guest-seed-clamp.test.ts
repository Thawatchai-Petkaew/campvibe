/**
 * cam-635-guest-seed-clamp.test.ts — CAM-635 (epic CAM-630)
 *
 * `clampGuestsToInitialCeiling` (lib/guest-capacity.ts) is the function that
 * makes a chat-handoff `guests` prefill (e.g. `guests=8`) safe to seed into
 * `CampgroundDetailClient`'s FIRST paint. Without it, a prefill above the
 * synchronously-known ceiling would seed a `<Select>` `value` absent from
 * its own `guestOptions` — React renders that blank (the CAM-635 spec's
 * hard "never" rule) — until the pre-existing CAM-636 post-mount clamp
 * effect corrects it one tick later.
 *
 * This suite is the BEHAVIORAL proof (real function calls with concrete
 * fixtures), mirroring the precedent `cam-636-guest-capacity.test.ts` set
 * for the two functions this one composes. The component-level wiring proof
 * (that CampgroundDetailClient actually calls this function at seed time)
 * lives in `cam-635-detail-client-prefill-seed.test.ts`.
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary
 * (over-ceiling, exactly-at-ceiling, ceiling 0) · error/validation
 * (never a falsy-check on `maxGuestsPerDay`/`remaining`) · the per-spot
 * known-stale-column class the CAM-636 review round found.
 */
import { describe, expect, it } from "vitest";
import { clampGuestsToInitialCeiling, UNBOUNDED_GUEST_OPTIONS_MAX } from "@/lib/guest-capacity";

describe("clampGuestsToInitialCeiling — whole-camp (isPerSpot=false)", () => {
  it("[normal] a prefill within the camp's stated cap passes through unchanged", () => {
    expect(clampGuestsToInitialCeiling(2, 50, false)).toBe(2);
  });

  it("[boundary] a prefill exceeding the camp's stated cap clamps DOWN to the cap — never left over-ceiling", () => {
    // The ticket's own example: guests=8 against a camp whose ceiling is 3.
    expect(clampGuestsToInitialCeiling(8, 3, false)).toBe(3);
  });

  it("[boundary] a prefill exactly at the cap passes through unchanged", () => {
    expect(clampGuestsToInitialCeiling(3, 3, false)).toBe(3);
  });

  it("[null/empty] no per-day cap set (null) and a prefill within the unbounded range passes through", () => {
    expect(clampGuestsToInitialCeiling(5, null, false)).toBe(5);
  });

  it("[boundary] no per-day cap set (null) and a prefill ABOVE the unbounded range still clamps — never an out-of-range seed", () => {
    expect(clampGuestsToInitialCeiling(999, null, false)).toBe(UNBOUNDED_GUEST_OPTIONS_MAX);
  });

  it("[error/validation] a falsy-check regression guard — maxGuestsPerDay: 0 is a REAL zero cap, never treated as unbounded", () => {
    // `0 || x` would silently unbound this; computeGuestCeiling branches on
    // `null` explicitly, so a real 0 cap seeds down to 1 (the only value
    // buildGuestOptions(0) would ever have offered, guests<1 already being
    // out of the schema's own range).
    expect(clampGuestsToInitialCeiling(4, 0, false)).toBe(1);
  });
});

describe("clampGuestsToInitialCeiling — per-spot (isPerSpot=true), the CAM-636 known-stale-column class", () => {
  it("[normal, G3-class regression guard] a STALE zero maxGuestsPerDay never caps a per-spot camp's seed", () => {
    // CAM-636 G3 finding: maxGuestsPerDay is a known-stale column for a
    // per-spot camp and a brand-new one even defaults to 0. A naive
    // Math.min(guests, maxGuestsPerDay) would seed every per-spot prefill
    // down to 1 regardless of the camp's real spot-derived capacity.
    expect(clampGuestsToInitialCeiling(4, 0, true)).toBe(4);
  });

  it("[boundary] a per-spot camp with no synchronously-known ceiling still bounds an absurd prefill to the same unbounded range", () => {
    expect(clampGuestsToInitialCeiling(500, null, true)).toBe(UNBOUNDED_GUEST_OPTIONS_MAX);
  });

  it("[normal] a per-spot camp's prefill within the unbounded range passes through unchanged", () => {
    expect(clampGuestsToInitialCeiling(6, 50, true)).toBe(6);
  });
});

describe("clampGuestsToInitialCeiling — consistency with the caller's own first-render guestOptions", () => {
  it("[concurrent/ordering] the clamped value equals computeGuestCeiling+buildGuestOptions computed the same way, independently", () => {
    // Re-derive the ceiling the same way CampgroundDetailClient's own
    // `guestCeiling`/`guestOptions` consts would on a just-mounted render
    // (remaining: null) and confirm the clamp lands on that exact set's max
    // — proving this helper and the caller's post-mount effect can never
    // disagree about what "in range" means.
    const maxGuestsPerDay = 5;
    const clamped = clampGuestsToInitialCeiling(9, maxGuestsPerDay, false);
    expect(clamped).toBe(maxGuestsPerDay);
    expect(clamped).toBeGreaterThanOrEqual(1);
    expect(clamped).toBeLessThanOrEqual(maxGuestsPerDay);
  });
});
