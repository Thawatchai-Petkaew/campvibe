/**
 * cam-636-guests-select-wiring.test.ts — CAM-636 (epic CAM-630)
 *
 * components/CampgroundDetailClient.tsx has ~15 heavy dependencies (dynamic
 * MapComponent, next-auth useSession, ImageGallery, AmenitiesModal) with no
 * existing render harness — the established precedent for THIS component in
 * this repo (cam-397, cam-354, cam-528, f3-detail-surface, cam-616 all
 * source-inspect it) is source-inspection with Prove-It position/behaviour
 * assertions, not a bare "the string is present" grep. The pure decision
 * logic itself (computeGuestCeiling/buildGuestOptions) is fully behavior-
 * tested in cam-636-guest-capacity.test.ts; this file proves the component
 * actually WIRES that logic in, instead of the old hardcoded literal.
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
    expect(detailSrc).toContain(
      'import { computeGuestCeiling, buildGuestOptions } from "@/lib/guest-capacity";'
    );
  });

  it("[unit] maxGuestsPerDay is read from the campground prop with a typeof guard (never a falsy `||`/`??` on the raw value)", () => {
    expect(detailSrc).toContain(
      'typeof campground?.maxGuestsPerDay === "number" ? campground.maxGuestsPerDay : null'
    );
  });

  it("[unit] the ceiling combines remainingCapacity.remaining with maxGuestsPerDay via computeGuestCeiling", () => {
    expect(detailSrc).toContain(
      "const guestCeiling = computeGuestCeiling(remainingCapacity?.remaining ?? null, maxGuestsPerDay);"
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
});
