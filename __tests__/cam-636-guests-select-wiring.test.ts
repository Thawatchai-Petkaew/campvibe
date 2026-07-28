/**
 * cam-636-guests-select-wiring.test.ts — CAM-636 (epic CAM-630)
 *
 * components/CampgroundDetailClient.tsx has ~15 heavy dependencies (dynamic
 * MapComponent, next-auth useSession, ImageGallery, AmenitiesModal) with no
 * existing render harness — the established precedent for THIS component in
 * this repo (cam-397, cam-354, cam-528, f3-detail-surface, cam-616 all
 * source-inspect it) is source-inspection with Prove-It position/behaviour
 * assertions, not a bare "the string is present" grep.
 *
 * LIMITATION (stated explicitly per G3 review): this file is WIRING PROOF
 * ONLY — it proves the component imports the shared helpers, passes the
 * right arguments, and renders their output, instead of hand-rolling (or
 * reverting to) the old hardcoded literal. It CANNOT catch a defect in the
 * decision logic itself (e.g. a wrong combining rule, or a known-stale
 * input silently trusted) — a source match can be textually present while
 * the underlying math is still wrong. The per-spot known-stale-column class
 * of bug (G3 finding: `maxGuestsPerDay` capping a per-spot camp at a stale
 * 0) is proven CLOSED behaviorally, with real per-spot fixtures, at the
 * pure-function layer only: `cam-636-guest-capacity.test.ts`
 * (`computeGuestCeiling`'s `isPerSpot` describe block). Read that file for
 * the actual regression proof; this file only confirms the wiring calls it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const detailSrc = readFileSync(
  path.join(process.cwd(), "components/CampgroundDetailClient.tsx"),
  "utf-8"
);

describe("CampgroundDetailClient — guests options come from real capacity, never a hardcoded list (CAM-636)", () => {
  it("[error/teeth regression] the old hardcoded [1,2,3,4,5,6] literal is gone", () => {
    expect(detailSrc).not.toMatch(/\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*\]/);
  });

  it("[unit] imports the shared ceiling/options helpers from lib/guest-capacity (not hand-rolled inline)", () => {
    // CAM-635: the import now also carries `clampGuestsToInitialCeiling`
    // (the chat-prefill guests seed, lib/guest-capacity.ts) alongside these
    // two — updating this pin to the new canonical import line is correct,
    // not weakening (CAM-224/226/229: a real, intentional source change
    // updates the pin instead of reverting it).
    expect(detailSrc).toContain(
      'import { computeGuestCeiling, buildGuestOptions, clampGuestsToInitialCeiling } from "@/lib/guest-capacity";'
    );
  });

  it("[unit] maxGuestsPerDay is read from the campground prop with a typeof guard (never a falsy `||`/`??` on the raw value)", () => {
    expect(detailSrc).toContain(
      'typeof campground?.maxGuestsPerDay === "number" ? campground.maxGuestsPerDay : null'
    );
  });

  it("[unit, G3 fix] isPerSpot is derived from campground.useSpotView and passed into computeGuestCeiling as the 3rd argument (never omitted)", () => {
    expect(detailSrc).toContain("const isPerSpot = campground?.useSpotView === true;");
    expect(detailSrc).toContain(
      "const guestCeiling = computeGuestCeiling(remainingCapacity?.remaining ?? null, maxGuestsPerDay, isPerSpot);"
    );
    expect(detailSrc).toContain("const guestOptions = buildGuestOptions(guestCeiling);");
  });

  it("[unit] a clamp effect keeps `guests` inside the current ceiling when it shrinks", () => {
    const effect = detailSrc.match(
      /useEffect\(\(\) => \{\s*\n\s*if \(guestCeiling !== null && guests > guestCeiling\) \{\s*\n\s*setGuests\(Math\.max\(1, guestCeiling\)\);\s*\n\s*\}\s*\n\s*\}, \[guestCeiling\]\);/
    );
    expect(effect).not.toBeNull();
  });

  it("[unit] the <Select> renders guestOptions.map(...) instead of a literal array", () => {
    expect(detailSrc).toContain("{guestOptions.map(num => (");
  });

  it("[error/validation] the <Select> is disabled when there are no valid guest options (ceiling 0 -> unusable control)", () => {
    expect(detailSrc).toContain("disabled={guestOptions.length === 0}");
  });

  it("[a11y] the guests select carries a data-testid per the <type>--<module>-<detail> convention", () => {
    expect(detailSrc).toContain('data-testid="select--booking-guests"');
  });

  it("[unit, G3 nit] the remaining-capacity effect resets to null immediately for a fresh valid date pair, before the fetch resolves (never shows a stale prior-stay number mid-fetch)", () => {
    const effectBody = detailSrc.match(
      /useEffect\(\(\) => \{\s*\n\s*if \(!campground\.id \|\| !checkIn \|\| !checkOut \|\| checkOut <= checkIn\) \{[\s\S]*?\n\s*\}, \[campground\.id, checkIn, checkOut\]\);/
    );
    expect(effectBody).not.toBeNull();
    const body = effectBody![0];
    const guardResetPos = body.indexOf("setRemainingCapacity(null);");
    const fetchDeclPos = body.indexOf("const fetchRemaining = async () => {");
    const secondResetPos = body.indexOf("setRemainingCapacity(null);", guardResetPos + 1);
    expect(guardResetPos).toBeGreaterThan(-1);
    expect(secondResetPos).toBeGreaterThan(-1);
    // the second reset (the new-fetch-starts reset) must appear BEFORE fetchRemaining is even declared/invoked
    expect(secondResetPos).toBeLessThan(fetchDeclPos);
  });
});
