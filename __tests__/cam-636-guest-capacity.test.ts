/**
 * cam-636-guest-capacity.test.ts — CAM-636 (epic CAM-630)
 *
 * Bug: the party-size dropdown on the camp detail page rendered from a
 * literal `[1, 2, 3, 4, 5, 6]` — a camp whose real capacity is 50 could
 * only ever be booked for up to 6, and a camp with 2 places left still
 * offered 6 (discovered only when the booking was rejected).
 *
 * `remaining` (live capacity for the exact selected stay) and
 * `maxGuestsPerDay` (the camp's stated per-day cap) are BOTH nullable, and
 * `null` means "no cap set" (unbounded) — NEVER "full" or "zero". This
 * suite proves computeGuestCeiling/buildGuestOptions branch on `null`
 * explicitly for all four capacity shapes named in the ticket, plus the
 * `remaining: 0` edge (the control becomes unusable).
 *
 * G3 review round: `maxGuestsPerDay` is a KNOWN-STALE column for a
 * per-spot camp (`useSpotView: true`, CAM-355 BR-6) — no spot write route
 * ever rewrites it, and a brand-new per-spot camp's form default is even
 * `0`. `Math.min(remaining, maxGuestsPerDay)` unconditionally let that
 * stale/zero column permanently cap a per-spot camp with real live
 * capacity — this story's own bug, reintroduced through a new mechanism.
 * The `isPerSpot` fixtures below are the BEHAVIORAL proof this class of
 * defect is closed (not source-inspection — a real function call with a
 * concrete stale-zero-column scenario).
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary
 * (0, both-null) · error/validation (a falsy-check regression guard).
 */
import { describe, expect, it } from "vitest";
import { computeGuestCeiling, buildGuestOptions, UNBOUNDED_GUEST_OPTIONS_MAX } from "@/lib/guest-capacity";

describe("computeGuestCeiling — whole-camp (isPerSpot=false), four capacity shapes, null branched explicitly", () => {
  it("[boundary] both null -> null (genuinely unbounded, never treated as 0)", () => {
    expect(computeGuestCeiling(null, null, false)).toBeNull();
  });

  it("[normal] maxGuestsPerDay set only (no dates picked yet) -> the camp's stated cap", () => {
    expect(computeGuestCeiling(null, 50, false)).toBe(50);
  });

  it("[normal] remaining set only (host never set a per-day cap) -> the live remaining count", () => {
    expect(computeGuestCeiling(3, null, false)).toBe(3);
  });

  it("[normal] both set, remaining is the tighter constraint -> takes remaining", () => {
    expect(computeGuestCeiling(2, 50, false)).toBe(2);
  });

  it("[normal] both set, maxGuestsPerDay is the tighter constraint -> takes maxGuestsPerDay", () => {
    expect(computeGuestCeiling(50, 4, false)).toBe(4);
  });

  it("[boundary] remaining: 0 (fully booked for the exact stay) -> ceiling 0, never dropped to unbounded", () => {
    expect(computeGuestCeiling(0, 50, false)).toBe(0);
    expect(computeGuestCeiling(0, null, false)).toBe(0);
  });

  it("[error/validation] a falsy check would wrongly collapse remaining:0 into maxGuestsPerDay — this must NOT happen", () => {
    // Regression guard for the exact trap named in the ticket: `remaining || x`
    // would read 0 as "no value" and fall through to maxGuestsPerDay (50).
    const ceiling = computeGuestCeiling(0, 50, false);
    expect(ceiling).not.toBe(50);
    expect(ceiling).toBe(0);
  });
});

describe("computeGuestCeiling — per-spot (isPerSpot=true): the known-stale maxGuestsPerDay column must NEVER cap it (G3 finding)", () => {
  it("[error/teeth — the exact G3 repro] a per-spot camp with a stale maxGuestsPerDay=0 (brand-new-camp form default) and true live capacity 10 must NOT be capped at 0", () => {
    // per-spot camp, true live capacity from spots = 10; stored maxGuestsPerDay = 0
    // (CampgroundForm.tsx:282/713 default); camper picks dates where remaining = 10.
    const ceiling = computeGuestCeiling(10, 0, true);
    expect(ceiling).not.toBe(0);
    expect(ceiling).toBe(10);
  });

  it("[normal] a stale maxGuestsPerDay LOWER than the live remaining is still ignored -> remaining wins outright", () => {
    // stale column says 6 (an old/never-updated value); the real spot-derived
    // remaining for this stay is 40 — the camp must offer up to 40, not 6.
    expect(computeGuestCeiling(40, 6, true)).toBe(40);
  });

  it("[normal] a stale maxGuestsPerDay HIGHER than the live remaining is still ignored -> remaining still wins (never averaged/combined)", () => {
    expect(computeGuestCeiling(3, 999, true)).toBe(3);
  });

  it("[boundary] no dates picked yet (remaining null) -> unbounded (null), even though maxGuestsPerDay is set -> the stale column contributes NOTHING for this mode", () => {
    expect(computeGuestCeiling(null, 50, true)).toBeNull();
    expect(computeGuestCeiling(null, 0, true)).toBeNull();
  });

  it("[boundary] remaining: 0 (truly fully booked for the exact stay) still caps at 0 -> isPerSpot never hides a REAL zero", () => {
    expect(computeGuestCeiling(0, 999, true)).toBe(0);
  });

  it("[normal] both null (no maxGuestsPerDay ever set either) -> unbounded, same as whole-camp", () => {
    expect(computeGuestCeiling(null, null, true)).toBeNull();
  });
});

describe("buildGuestOptions — the option list a <Select> renders", () => {
  it(`[normal] null ceiling -> a useful bounded range [1..${UNBOUNDED_GUEST_OPTIONS_MAX}], not an unbounded/huge list`, () => {
    const options = buildGuestOptions(null);
    expect(options).toEqual(Array.from({ length: UNBOUNDED_GUEST_OPTIONS_MAX }, (_, i) => i + 1));
  });

  it("[normal] a real ceiling -> exactly [1..ceiling]", () => {
    expect(buildGuestOptions(50)).toHaveLength(50);
    expect(buildGuestOptions(50)[0]).toBe(1);
    expect(buildGuestOptions(50)[49]).toBe(50);
    expect(buildGuestOptions(2)).toEqual([1, 2]);
  });

  it("[boundary] ceiling 0 -> empty list (the control is unusable; the reserve button's own disabled path still holds)", () => {
    expect(buildGuestOptions(0)).toEqual([]);
  });

  it("[error/teeth — the exact G3 repro, end to end] the per-spot stale-zero-column scenario yields a 10-option list, never an empty/disabled one", () => {
    const ceiling = computeGuestCeiling(10, 0, true);
    expect(buildGuestOptions(ceiling)).toHaveLength(10);
  });
});
