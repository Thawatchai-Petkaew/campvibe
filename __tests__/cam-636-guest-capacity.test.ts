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
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary
 * (0, both-null) · error/validation (a falsy-check regression guard).
 */
import { describe, expect, it } from "vitest";
import { computeGuestCeiling, buildGuestOptions, UNBOUNDED_GUEST_OPTIONS_MAX } from "@/lib/guest-capacity";

describe("computeGuestCeiling — four capacity shapes, null branched explicitly", () => {
  it("[boundary] both null -> null (genuinely unbounded, never treated as 0)", () => {
    expect(computeGuestCeiling(null, null)).toBeNull();
  });

  it("[normal] maxGuestsPerDay set only (no dates picked yet) -> the camp's stated cap", () => {
    expect(computeGuestCeiling(null, 50)).toBe(50);
  });

  it("[normal] remaining set only (host never set a per-day cap) -> the live remaining count", () => {
    expect(computeGuestCeiling(3, null)).toBe(3);
  });

  it("[normal] both set, remaining is the tighter constraint -> takes remaining", () => {
    expect(computeGuestCeiling(2, 50)).toBe(2);
  });

  it("[normal] both set, maxGuestsPerDay is the tighter constraint -> takes maxGuestsPerDay", () => {
    expect(computeGuestCeiling(50, 4)).toBe(4);
  });

  it("[boundary] remaining: 0 (fully booked for the exact stay) -> ceiling 0, never dropped to unbounded", () => {
    expect(computeGuestCeiling(0, 50)).toBe(0);
    expect(computeGuestCeiling(0, null)).toBe(0);
  });

  it("[error/validation] a falsy check would wrongly collapse remaining:0 into maxGuestsPerDay — this must NOT happen", () => {
    // Regression guard for the exact trap named in the ticket: `remaining || x`
    // would read 0 as "no value" and fall through to maxGuestsPerDay (50).
    const ceiling = computeGuestCeiling(0, 50);
    expect(ceiling).not.toBe(50);
    expect(ceiling).toBe(0);
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
});
