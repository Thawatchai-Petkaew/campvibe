/**
 * cam-623-price-band-client-check.test.ts — CAM-623
 *
 * Follow-up to CAM-619: `CampgroundForm.tsx` submits the FULL form state on
 * every save (never a per-field diff), so a host who lowers ONLY priceHigh
 * while priceLow still holds a higher, stale value from an earlier session
 * sends an inverted band. The server correctly 400s it (isPriceOrderValid,
 * lib/validations/campsite.ts, CAM-619), but the message names priceLow - a
 * field the host never touched, and the host only discovers this by failing
 * a save.
 *
 * This story adds a client-side guard in handleSubmit that reuses the SAME
 * exported isPriceOrderValid function (no parallel re-implementation), runs
 * BEFORE any request (including the /api/location POST), and shows one
 * message naming BOTH conflicting values instead of blaming one field.
 *
 * Layer: source-inspection (fs.readFileSync) for the ordering/wiring proof -
 * same precedent as __tests__/cam-356-form-validation-ux.test.ts and
 * __tests__/cam-341-fee-policy-form.test.ts (CampgroundForm.tsx has no jsdom
 * render harness in this repo - environment: 'node', see vitest.config.ts) -
 * plus a real mocked-route integration proof (same precedent as
 * __tests__/cam-619-campsites-create-price-order.test.ts) that the SERVER
 * guard is untouched: an inverted band still 400s at the API regardless of
 * what the client now does, and a valid band still saves.
 *
 * AC coverage matrix:
 *   AC-1  client guard blocks submit on an inverted band, before any request,
 *         names both values (BR-1/BR-2/BR-3)
 *   AC-2  a valid band (or a blank side) is not blocked
 *   AC-3  the server guard is untouched - still 400s an inverted band
 *   EC-1  no /api/location or /api/campsites call on conflict
 *   EC-2  server-side pin (guards against a future refactor moving the
 *         contract to the client)
 *   EC-3  one side blank -> nothing to compare, guard does not fire
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import translations from "../locales/translations.json";
import { isPriceOrderValid } from "@/lib/validations/campsite";

const en = (translations as any).en;
const th = (translations as any).th;

const formSrc = fs.readFileSync(
  path.join(process.cwd(), "components", "CampgroundForm.tsx"),
  "utf8"
);

// ---------------------------------------------------------------------------
// AC-1/BR-1: the client guard reuses isPriceOrderValid, runs before ANY
// request, and returns before both the /api/location POST and the
// /api/campsites POST/PUT.
// ---------------------------------------------------------------------------
describe("CampgroundForm handleSubmit — price-order guard runs before any request (AC-1, BR-1, EC-1)", () => {
  it("imports isPriceOrderValid from the shared validations module (no parallel re-implementation)", () => {
    expect(formSrc).toMatch(
      /import \{[^}]*\bisPriceOrderValid\b[^}]*\} from "@\/lib\/validations\/campsite"/
    );
  });

  it("handleSubmit calls isPriceOrderValid on the null-coerced priceLow/priceHigh", () => {
    expect(formSrc).toContain(
      "if (!isPriceOrderValid({ priceLow: priceLowForOrderCheck, priceHigh: priceHighForOrderCheck })) {"
    );
  });

  it("[teeth] a guard failure returns BEFORE the /api/location POST and BEFORE the /api/campsites POST/PUT — no network call happens", () => {
    const guardIdx = formSrc.indexOf(
      "if (!isPriceOrderValid({ priceLow: priceLowForOrderCheck, priceHigh: priceHighForOrderCheck })) {"
    );
    const returnIdx = formSrc.indexOf("return;", guardIdx);
    const locationFetchIdx = formSrc.indexOf("fetch('/api/location'");
    const campsitesFetchIdx = formSrc.indexOf("await fetch(url");

    expect(guardIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(guardIdx);
    // The guard's return is textually BEFORE both fetch call sites — proves
    // neither request can fire once the guard has decided to bail.
    expect(returnIdx).toBeLessThan(locationFetchIdx);
    expect(returnIdx).toBeLessThan(campsitesFetchIdx);
  });

  it("the guard runs strictly before the lat/lng-driven /api/location fetch block (not just textually before the string)", () => {
    const guardIdx = formSrc.indexOf(
      "if (!isPriceOrderValid({ priceLow: priceLowForOrderCheck, priceHigh: priceHighForOrderCheck })) {"
    );
    const letLocationIdx = formSrc.indexOf("let locationId = formData.locationId;");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(letLocationIdx);
  });
});

// ---------------------------------------------------------------------------
// AC-1/BR-2: the message names BOTH conflicting values, not one field.
// ---------------------------------------------------------------------------
describe("i18n: newCampground.priceOrderConflict names the pair, not one field (BR-2)", () => {
  it("both locales carry the key as a non-empty string", () => {
    expect(typeof en.newCampground.priceOrderConflict).toBe("string");
    expect(typeof th.newCampground.priceOrderConflict).toBe("string");
  });

  it("the copy carries BOTH {min} and {max} placeholders (names the pair, not a single field)", () => {
    expect(en.newCampground.priceOrderConflict).toContain("{min}");
    expect(en.newCampground.priceOrderConflict).toContain("{max}");
    expect(th.newCampground.priceOrderConflict).toContain("{min}");
    expect(th.newCampground.priceOrderConflict).toContain("{max}");
  });

  it("the Thai copy matches the exact shipped string, plain language, no em-dash separator", () => {
    expect(th.newCampground.priceOrderConflict).toBe(
      "ราคาต่ำสุด {min} บาท มากกว่าราคาสูงสุด {max} บาท กรุณาแก้ไขราคาใดราคาหนึ่ง"
    );
    expect(th.newCampground.priceOrderConflict).not.toContain("—");
  });

  it("handleSubmit builds the banner + both field errors from this SAME key (one message, not two asymmetric ones)", () => {
    expect(formSrc).toContain("const conflictMessage = t.newCampground.priceOrderConflict");
    expect(formSrc).toContain(
      "setFieldErrors({ priceLow: [conflictMessage], priceHigh: [conflictMessage] });"
    );
    expect(formSrc).toContain("setServerError(conflictMessage);");
  });

  it("the live inline hint under both inputs is wired from the SAME priceOrderConflictMessage (no duplicate old asymmetric copy left blocking it)", () => {
    expect(formSrc).toContain("error={priceOrderConflictMessage || zErr('priceLow')}");
    expect(formSrc).toContain("error={priceOrderConflictMessage || zErr('priceHigh')}");
  });
});

// ---------------------------------------------------------------------------
// AC-1/AC-2 — the underlying comparison, exercised with the dispatch's own
// repro numbers (priceLow stale at 250, priceHigh just lowered to 200) and
// the accepted-band counterpart.
// ---------------------------------------------------------------------------
describe("isPriceOrderValid — the repro from the ticket (AC-1) and a valid band (AC-2)", () => {
  it("[error/validation, teeth] priceLow=250 (stale) > priceHigh=200 (just lowered) is REJECTED — the exact repro", () => {
    expect(isPriceOrderValid({ priceLow: 250, priceHigh: 200 })).toBe(false);
  });

  it("[normal] a valid band (priceLow=250, priceHigh=600) is accepted — matches AC-2", () => {
    expect(isPriceOrderValid({ priceLow: 250, priceHigh: 600 })).toBe(true);
  });

  it("[EC-3] one side blank (null) is nothing-to-compare — never blocks", () => {
    expect(isPriceOrderValid({ priceLow: 250, priceHigh: null })).toBe(true);
    expect(isPriceOrderValid({ priceLow: null, priceHigh: 200 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-3/EC-2 — the server guard is UNTOUCHED: an inverted band still 400s at
// the real route, and a valid band still saves. Same mocked-route precedent
// as __tests__/cam-619-campsites-create-price-order.test.ts. This is the pin
// that stops a future refactor from quietly moving the contract to the
// client only.
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: { create: vi.fn() },
    masterData: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { POST as campSitePOST } from "@/app/api/campsites/route";
import { _store } from "@/lib/rate-limit";

const mockCreate = prisma.campSite.create as unknown as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.masterData.findMany as unknown as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;

function postRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/campsites", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID_BASE = {
  nameTh: "ทดสอบ",
  campSiteType: "CAGD",
  latitude: 13.75,
  longitude: 100.5,
  checkInTime: "12:00",
  checkOutTime: "12:00",
  bookingMethod: "ONST",
  locationId: "550e8400-e29b-41d4-a716-446655440099",
};

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  mockRequireAuth.mockResolvedValue({ error: null, session: { user: { id: "user-cam-623", role: "HOST" } } });
  mockFindMany.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ id: "new-camp-id-cam-623" });
});

describe("Server guard untouched (AC-3, EC-2) — POST /api/campsites", () => {
  it("[error/validation, teeth] priceLow=250 > priceHigh=200 (the ticket's exact repro) is still 400 at the API, no Prisma write", async () => {
    const res = await campSitePOST(postRequest({ ...VALID_BASE, priceLow: 250, priceHigh: 200 }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("[normal] a valid band (priceLow=250, priceHigh=600) still saves (AC-2)", async () => {
    const res = await campSitePOST(postRequest({ ...VALID_BASE, priceLow: 250, priceHigh: 600 }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
