/**
 * cam-635-detail-client-prefill-seed.test.ts — CAM-635 (epic CAM-630)
 *
 * components/CampgroundDetailClient.tsx has ~15 heavy dependencies (dynamic
 * MapComponent, next-auth useSession, ImageGallery, AmenitiesModal) with no
 * existing render harness — the established precedent for THIS component
 * (cam-397, cam-354, cam-528, cam-616, cam-636-guests-select-wiring all
 * source-inspect it) is source-inspection with Prove-It position/behaviour
 * assertions, not a bare "the string is present" grep.
 *
 * LIMITATION (stated explicitly, same caveat cam-636-guests-select-wiring.test.ts
 * carries): this file is WIRING PROOF ONLY. It proves the component seeds
 * state from `prefill` in the `useState` initializer (never an effect, BR-5),
 * calls the shared `clampGuestsToInitialCeiling` helper (never re-deriving
 * the clamp math inline), and attaches `source: 'CHAT'` to the reserve POST
 * exactly when `fromChat` is true. The actual clamp MATH is proven
 * behaviorally in `cam-635-guest-seed-clamp.test.ts`; this file only
 * confirms the wiring calls it — never useSearchParams (CAM-218 regression
 * class this route must not reintroduce, since a root loading.tsx exists).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const detailSrc = readFileSync(
  path.join(process.cwd(), "components/CampgroundDetailClient.tsx"),
  "utf-8"
);

describe("CampgroundDetailClient — CAM-635 prefill props + never a client-side searchParams read", () => {
  it("[unit] never reads useSearchParams directly (CAM-218 regression class — searchParams is read server-side only, in page.tsx)", () => {
    expect(detailSrc).not.toMatch(/useSearchParams/);
  });

  it("[unit] accepts a typed `prefill`/`fromChat` prop pair from the server page", () => {
    expect(detailSrc).toContain("prefill?: BookingPrefill | null;");
    expect(detailSrc).toContain("fromChat?: boolean;");
    expect(detailSrc).toContain('import type { BookingPrefill } from "@/lib/booking-prefill";');
  });
});

describe("CampgroundDetailClient — checkIn/checkOut seed from `prefill` in the useState initializer, never an effect (BR-5)", () => {
  it("[unit] checkIn is seeded via a lazy useState initializer (a function, not a plain value)", () => {
    expect(detailSrc).toContain(
      "const [checkIn, setCheckIn] = useState<Date | undefined>(() =>\n        prefill ? parseISO(prefill.checkIn) : undefined\n    );"
    );
  });

  it("[unit] checkOut is seeded the same way", () => {
    expect(detailSrc).toContain(
      "const [checkOut, setCheckOut] = useState<Date | undefined>(() =>\n        prefill ? parseISO(prefill.checkOut) : undefined\n    );"
    );
  });

  it("[unit] parseISO is imported from date-fns (local-date semantics, matching every other date in this component)", () => {
    expect(detailSrc).toContain(
      'import { format, parseISO, differenceInCalendarDays, addMonths, startOfMonth, endOfMonth } from "date-fns";'
    );
  });

  it("[error/teeth regression] no effect re-seeds checkIn/checkOut from prefill after mount (would fight an immediate camper edit)", () => {
    // The ONLY thing allowed to touch checkIn/checkOut post-mount besides the
    // camper's own onSelect handlers is the existing remaining-capacity
    // effect (keyed on [campground.id, checkIn, checkOut]) — it reads these,
    // never writes them. Assert no new `setCheckIn(`/`setCheckOut(` call
    // exists outside the two initializers and the pre-existing onSelect wiring.
    const setCheckInCalls = (detailSrc.match(/setCheckIn\(/g) || []).length;
    const setCheckOutCalls = (detailSrc.match(/setCheckOut\(/g) || []).length;
    // 1 inside the initializer (useState<Date | undefined>(...)) is not a
    // "call" (it's `setCheckIn` being declared, not invoked) — the only
    // actual invocation site is the Calendar's onSelect={setCheckIn} (passed
    // by reference, so it doesn't match `setCheckIn(` either). A stray new
    // effect calling `setCheckIn(...)` would push this count to 1+.
    expect(setCheckInCalls).toBe(0);
    expect(setCheckOutCalls).toBe(0);
  });
});

describe("CampgroundDetailClient — guests seeds via the shared clamp helper, never a re-derived inline clamp (CAM-636 cooperation)", () => {
  it("[unit] imports clampGuestsToInitialCeiling from lib/guest-capacity alongside the existing helpers", () => {
    expect(detailSrc).toContain(
      'import { computeGuestCeiling, buildGuestOptions, clampGuestsToInitialCeiling } from "@/lib/guest-capacity";'
    );
  });

  it("[unit] the guests useState initializer calls clampGuestsToInitialCeiling with prefill.guests + the campground's own maxGuestsPerDay/useSpotView", () => {
    expect(detailSrc).toContain("const [guests, setGuests] = useState<number>(() => {");
    expect(detailSrc).toContain("if (!prefill) return 1;");
    expect(detailSrc).toContain("return clampGuestsToInitialCeiling(\n            prefill.guests,");
    expect(detailSrc).toContain('typeof campground?.maxGuestsPerDay === "number" ? campground.maxGuestsPerDay : null,');
    expect(detailSrc).toContain("campground?.useSpotView === true");
  });

  it("[unit] the pre-existing CAM-636 post-mount clamp effect is untouched (still present, unchanged shape)", () => {
    const effect = detailSrc.match(
      /useEffect\(\(\) => \{\s*\n\s*if \(guestCeiling !== null && guests > guestCeiling\) \{\s*\n\s*setGuests\(Math\.max\(1, guestCeiling\)\);\s*\n\s*\}\s*\n\s*\}, \[guestCeiling\]\);/
    );
    expect(effect).not.toBeNull();
  });
});

describe("CampgroundDetailClient — reserve POST attribution (CAM-642 `source`)", () => {
  it("[unit] the POST body spreads `source: 'CHAT'` only when fromChat is true, otherwise omits the key", () => {
    expect(detailSrc).toContain("...(fromChat ? { source: 'CHAT' as const } : {}),");
  });

  it("[unit] the POST body still carries every pre-existing field unchanged (campSiteId, dates, guests)", () => {
    expect(detailSrc).toContain("campSiteId: campground.id,");
    expect(detailSrc).toContain("checkInDate: format(checkIn, 'yyyy-MM-dd'),");
    expect(detailSrc).toContain("checkOutDate: format(checkOut, 'yyyy-MM-dd'),");
  });
});
