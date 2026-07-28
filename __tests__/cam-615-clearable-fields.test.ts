/**
 * cam-615-clearable-fields.test.ts — CAM-615
 *
 * THE ROOT: `lib/validations/campsite.ts` carried `.nullable()` on exactly 4
 * fields (extraFeeAmount/extraFeeLabel/cancellationPolicy/logo — CAM-341/
 * CAM-360) and bare `.optional()` on every other clearable field. The
 * mechanism: `payload.x || undefined` (client) or `data.x || undefined`
 * (route) collapsed a host's explicit clear (an emptied field) into an
 * omitted key; Prisma treats an omitted key as "leave unchanged"; the
 * `data.x !== undefined` guard then skips the write. Nothing errors — the
 * host just sees their save silently not stick.
 *
 * This story fixes the ROOT (widen `.nullable()` + one shared write mapping,
 * `clearableWrite` / `clearableText`, instead of hand-rolling each field) and
 * adds a guard (`scripts/check-clearable-fields.mjs`, report-mode) so a NEW
 * nullable Prisma column with no zod `.nullable()` counterpart is caught.
 *
 * Layer: (a) the guard's own unit tests (real files -> 0 violations; a
 * deliberately-broken fixture -> the guard fails to prove it has teeth);
 * (b) mocked-Prisma integration tests against the real PUT handlers (same
 * pattern as cam-341-fee-policy-form.test.ts / cam-360-logo-clear-persists.
 * test.ts) for the three verified round-trip fields — one capacity
 * (Spot.maxCampers), one price (CampSite.priceLow), one contact
 * (CampSite.lineId) — each: clear -> write null -> a subsequent GET reads
 * the cleared value back (proves "stays cleared", not just "the write call
 * looked right"); (c) source-inspection for the client payload lines and the
 * CampgroundDetailClient.tsx `|| 50` free-camp display fix.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import { campSiteSchema } from "@/lib/validations/campsite";
import { spotSchema } from "@/lib/validations/spot";
import { clearableWrite } from "@/lib/api-utils";
import {
  parsePrismaNullableFields,
  parseZodFieldBlocks,
  findClearableGuardViolations,
  ALLOWLIST,
  PRISMA_SCHEMA_PATH,
  CAMPSITE_ZOD_PATH,
  SPOT_ZOD_PATH,
} from "../scripts/check-clearable-fields.mjs";

// ---------------------------------------------------------------------------
// Module mocks for the PUT-route integration tests (hoisted before imports —
// same pattern as __tests__/cam-341-fee-policy-form.test.ts /
// __tests__/cam-360-logo-clear-persists.test.ts)
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: { update: vi.fn(), findUnique: vi.fn() },
    spot: { update: vi.fn(), findFirst: vi.fn() },
    zone: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  requireCampSitePermission: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireCampSitePermission } from "@/lib/auth-utils";
import { PUT as campSitePUT, GET as campSiteGET } from "@/app/api/campsites/[id]/route";
import { PUT as spotPUT, GET as spotGET } from "@/app/api/campsites/[id]/spots/[spotId]/route";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");
const formSrc = src("components/CampgroundForm.tsx");
const spotDialogSrc = src("components/spot-form-dialog.tsx");
const detailSrc = src("components/CampgroundDetailClient.tsx");

const CAMP_ID = "550e8400-e29b-41d4-a716-446655440615";
const SPOT_ID = "550e8400-e29b-41d4-a716-446655440616";
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeSpotParams = (id: string, spotId: string) => ({ params: Promise.resolve({ id, spotId }) });

function mockAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: { id: CAMP_ID, operatorId: "op-1" } as never,
    session: { user: { id: "op-1" } } as never,
  });
}

function putRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function spotPutRequest(id: string, spotId: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${id}/spots/${spotId}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// The guard itself — proves it has teeth (fails on a deliberately-broken
// fixture) before trusting its 0-backlog claim against the real files.
// ---------------------------------------------------------------------------
describe("check-clearable-fields.mjs — the guard against the REAL files (backlog = 0)", () => {
  it("[normal] CampSite: 0 violations, every excluded field is documented in the ALLOWLIST", () => {
    const result = findClearableGuardViolations({
      prismaSource: fs.readFileSync(PRISMA_SCHEMA_PATH, "utf8"),
      zodSource: fs.readFileSync(CAMPSITE_ZOD_PATH, "utf8"),
      modelName: "CampSite",
      allowlist: ALLOWLIST.CampSite,
    });
    expect(result.violations).toEqual([]);
    expect(result.checked.length).toBeGreaterThan(15); // the measured ~19-23 clearable fields
  });

  it("[normal] Spot: 0 violations, every excluded field is documented in the ALLOWLIST", () => {
    const result = findClearableGuardViolations({
      prismaSource: fs.readFileSync(PRISMA_SCHEMA_PATH, "utf8"),
      zodSource: fs.readFileSync(SPOT_ZOD_PATH, "utf8"),
      modelName: "Spot",
      allowlist: ALLOWLIST.Spot,
    });
    expect(result.violations).toEqual([]);
    expect(result.checked.length).toBeGreaterThanOrEqual(5);
  });

  it("carries a stated reason for every allowlisted field (no silent exclusion)", () => {
    for (const model of Object.keys(ALLOWLIST) as (keyof typeof ALLOWLIST)[]) {
      for (const [field, reason] of Object.entries(ALLOWLIST[model])) {
        expect(typeof reason).toBe("string");
        expect((reason as string).length).toBeGreaterThan(10);
        expect(field.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("check-clearable-fields.mjs — Prove-It: the guard FAILS on a broken fixture", () => {
  const fixturePrisma = `
model Foo {
  id  String @id
  bar String?
  baz String? // has nullable in zod, should pass
  rel Related? @relation(fields: [relId], references: [id])
}
`;

  it("[error/validation] a nullable column with no zod .nullable() counterpart is flagged", () => {
    const fixtureZod = `
export const fooSchema = z.object({
  bar: z.string().optional(),
  baz: z.string().optional().nullable(),
});
`;
    const result = findClearableGuardViolations({
      prismaSource: fixturePrisma,
      zodSource: fixtureZod,
      modelName: "Foo",
    });
    expect(result.violations).toEqual(["bar"]);
    expect(result.checked).toEqual(["bar", "baz"]);
  });

  it("[normal] adding `.nullable()` to the fixture's `bar` field turns the violation green", () => {
    const fixedZod = `
export const fooSchema = z.object({
  bar: z.string().optional().nullable(),
  baz: z.string().optional().nullable(),
});
`;
    const result = findClearableGuardViolations({
      prismaSource: fixturePrisma,
      zodSource: fixedZod,
      modelName: "Foo",
    });
    expect(result.violations).toEqual([]);
  });

  it("[normal] an allowlisted field is excluded, not counted as a violation, even with no .nullable()", () => {
    const fixtureZod = `
export const fooSchema = z.object({
  bar: z.string().optional(),
});
`;
    const result = findClearableGuardViolations({
      prismaSource: fixturePrisma,
      zodSource: fixtureZod,
      modelName: "Foo",
      allowlist: { bar: "test-only exclusion" },
    });
    expect(result.violations).toEqual([]);
    expect(result.excluded).toEqual([{ name: "bar", reason: "test-only exclusion" }]);
  });

  it("[null/empty] a Prisma field that never appears in the zod schema at all is silently out of scope (not a violation)", () => {
    const fixtureZod = `
export const fooSchema = z.object({
  baz: z.string().optional().nullable(),
});
`;
    const result = findClearableGuardViolations({
      prismaSource: fixturePrisma,
      zodSource: fixtureZod,
      modelName: "Foo",
    });
    expect(result.violations).toEqual([]);
    expect(result.checked).toEqual(["baz"]);
  });

  it("[error/validation] an @relation field (object relation) is never flagged even though it is nullable", () => {
    const names = parsePrismaNullableFields(fixturePrisma, "Foo");
    expect(names).not.toContain("rel");
    expect(names).toEqual(["bar", "baz"]);
  });

  it("parseZodFieldBlocks captures a multi-line chained definition as one block", () => {
    const multiLine = `
export const fooSchema = z.object({
  bar: z
    .number()
    .min(0)
    .nullable()
    .optional(),
});
`;
    const fields = parseZodFieldBlocks(multiLine) as Record<string, string>;
    expect(fields.bar).toContain(".nullable()");
  });
});

// ---------------------------------------------------------------------------
// clearableWrite (lib/api-utils.ts) — the one shared server-side mapping
// ---------------------------------------------------------------------------
describe("clearableWrite (lib/api-utils.ts)", () => {
  it("[normal] a real value passes through unchanged", () => {
    expect(clearableWrite("081-234-5678")).toBe("081-234-5678");
    expect(clearableWrite(500)).toBe(500);
  });
  it("[null/empty] an empty string maps to null", () => {
    expect(clearableWrite("")).toBeNull();
  });
  it("[null/empty] an explicit null maps to null", () => {
    expect(clearableWrite(null)).toBeNull();
  });
  it("[boundary] 0 (a legitimate falsy number) passes through, is NOT treated as empty", () => {
    expect(clearableWrite(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Round trip 1/3 — CAPACITY: Spot.maxCampers (spot-form-dialog + spots/[spotId])
// ---------------------------------------------------------------------------
describe("PUT /api/campsites/[id]/spots/[spotId] — maxCampers clearing (capacity round trip)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
  });

  it("[normal] maxCampers: 10 sets the value", async () => {
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID, maxCampers: 10 });
    const res = await spotPUT(spotPutRequest(CAMP_ID, SPOT_ID, { maxCampers: 10 }), makeSpotParams(CAMP_ID, SPOT_ID));
    expect(res.status).toBe(200);
    const call = (prisma.spot.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.maxCampers).toBe(10);
  });

  it("[Prove-It] maxCampers: null clears the column to null (a host removing a per-spot cap)", async () => {
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID, maxCampers: null });
    const res = await spotPUT(spotPutRequest(CAMP_ID, SPOT_ID, { maxCampers: null }), makeSpotParams(CAMP_ID, SPOT_ID));
    expect(res.status).toBe(200);
    const call = (prisma.spot.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.maxCampers).toBeNull();
  });

  it('[stays cleared] a subsequent GET reflects the cleared per-spot cap (round trip proof)', async () => {
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID, maxCampers: null });
    await spotPUT(spotPutRequest(CAMP_ID, SPOT_ID, { maxCampers: null }), makeSpotParams(CAMP_ID, SPOT_ID));
    const updateCall = (prisma.spot.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.data.maxCampers).toBeNull();

    // reload: the GET route reads the row back through its own two lookups
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true, isPublished: true, deletedAt: null, operatorId: "op-1",
    });
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: SPOT_ID, maxCampers: null, campSite: null, images: [],
    });
    const getRes = await spotGET(
      new NextRequest(`http://localhost/api/campsites/${CAMP_ID}/spots/${SPOT_ID}`),
      makeSpotParams(CAMP_ID, SPOT_ID)
    );
    const body = await getRes.json();
    expect(body.maxCampers).toBeNull();
  });

  it("[REGRESSION-CRITICAL] omitting maxCampers never touches it (a name-only partial update)", async () => {
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    await spotPUT(spotPutRequest(CAMP_ID, SPOT_ID, { name: "Spot renamed" }), makeSpotParams(CAMP_ID, SPOT_ID));
    const call = (prisma.spot.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect("maxCampers" in call.data).toBe(false);
  });

  it("[error/validation] maxCampers: 0 is rejected with 400 (min(1) — 0 is not a valid stated cap, use null to clear)", async () => {
    const res = await spotPUT(spotPutRequest(CAMP_ID, SPOT_ID, { maxCampers: 0 }), makeSpotParams(CAMP_ID, SPOT_ID));
    expect(res.status).toBe(400);
    expect(prisma.spot.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Round trip 2/3 — PRICE: CampSite.priceLow (CampgroundForm + campsites/[id])
// ---------------------------------------------------------------------------
describe("PUT /api/campsites/[id] — priceLow clearing (price round trip)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
  });

  it("[normal] priceLow: 500 sets the value", async () => {
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, nameThSlug: "s", nameEnSlug: "s-en", priceLow: 500,
    });
    const res = await campSitePUT(putRequest(CAMP_ID, { priceLow: 500 }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBe(500);
  });

  it("[Prove-It] priceLow: null clears the column (a host removing a price band)", async () => {
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, nameThSlug: "s", nameEnSlug: "s-en", priceLow: null,
    });
    const res = await campSitePUT(putRequest(CAMP_ID, { priceLow: null }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBeNull();
  });

  it('[stays cleared] a subsequent GET reflects the cleared price (round trip proof)', async () => {
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, nameThSlug: "s", nameEnSlug: "s-en", priceLow: null,
    });
    await campSitePUT(putRequest(CAMP_ID, { priceLow: null }), makeParams(CAMP_ID));

    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, priceLow: null, isActive: true, isPublished: true, deletedAt: null, spots: [], options: [], images: [],
    });
    const getRes = await campSiteGET(new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`), makeParams(CAMP_ID));
    const body = await getRes.json();
    expect(body.priceLow).toBeNull();
  });

  it("[REGRESSION-CRITICAL] omitting priceLow never touches it (a lineId-only partial update)", async () => {
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, nameThSlug: "s", nameEnSlug: "s-en",
    });
    await campSitePUT(putRequest(CAMP_ID, { lineId: "line-only-edit" }), makeParams(CAMP_ID));
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect("priceLow" in call.data).toBe(false);
    expect(call.data.lineId).toBe("line-only-edit");
  });
});

// ---------------------------------------------------------------------------
// Round trip 3/3 — CONTACT: CampSite.lineId (CampgroundForm + campsites/[id])
// ---------------------------------------------------------------------------
describe("PUT /api/campsites/[id] — lineId clearing (contact round trip)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, nameThSlug: "s", nameEnSlug: "s-en",
    });
  });

  it("[normal] lineId: '@campvibe' sets the value", async () => {
    const res = await campSitePUT(putRequest(CAMP_ID, { lineId: "@campvibe" }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.lineId).toBe("@campvibe");
  });

  it("[Prove-It] lineId: '' (host clears the field) writes null, not skipped (the exact CAM-615 bug)", async () => {
    const res = await campSitePUT(putRequest(CAMP_ID, { lineId: "" }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.lineId).toBeNull();
  });

  it("[Prove-It] lineId: null (explicit) also clears the column", async () => {
    await campSitePUT(putRequest(CAMP_ID, { lineId: null }), makeParams(CAMP_ID));
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.lineId).toBeNull();
  });

  it('[stays cleared] a subsequent GET reflects the cleared contact channel', async () => {
    await campSitePUT(putRequest(CAMP_ID, { lineId: null }), makeParams(CAMP_ID));

    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, lineId: null, isActive: true, isPublished: true, deletedAt: null, spots: [], options: [], images: [],
    });
    const getRes = await campSiteGET(new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`), makeParams(CAMP_ID));
    const body = await getRes.json();
    expect(body.lineId).toBeNull();
  });

  it("[REGRESSION-CRITICAL] omitting lineId never touches it (a price-only partial update)", async () => {
    await campSitePUT(putRequest(CAMP_ID, { priceHigh: 900 }), makeParams(CAMP_ID));
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect("lineId" in call.data).toBe(false);
    expect(call.data.priceHigh).toBe(900);
  });
});

// ---------------------------------------------------------------------------
// Bonus coverage — the other contact channels + partner/nationalPark share
// the exact same clearableWrite mapping (same PUT route, one pass).
// ---------------------------------------------------------------------------
describe("PUT /api/campsites/[id] — the rest of the clearable-field sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID, nameThSlug: "s", nameEnSlug: "s-en",
    });
  });

  const clearableStringFields = ["phone", "facebookUrl", "facebookMessageUrl", "tiktokUrl", "videoUrl", "partner", "nationalPark", "address", "directions", "feeInfo", "toiletInfo", "nameEn", "description"];

  it.each(clearableStringFields)("[Prove-It] %s: '' clears the column to null (was silently skipped)", async (field) => {
    const res = await campSitePUT(putRequest(CAMP_ID, { [field]: "" }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data[field]).toBeNull();
  });

  it("[Prove-It] maxTentsPerDay: null clears the whole-camp column back to unbounded", async () => {
    await campSitePUT(putRequest(CAMP_ID, { maxTentsPerDay: null }), makeParams(CAMP_ID));
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.maxTentsPerDay).toBeNull();
  });

  it("[Prove-It] minimumAge: null clears a previously-set minimum age", async () => {
    await campSitePUT(putRequest(CAMP_ID, { minimumAge: null }), makeParams(CAMP_ID));
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.minimumAge).toBeNull();
  });

  it("[Prove-It] tags: [] (clear every tag) writes null, not skipped (arrayToCsv([]) === undefined trap)", async () => {
    await campSitePUT(putRequest(CAMP_ID, { tags: [] }), makeParams(CAMP_ID));
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.tags).toBeNull();
  });

  it("[normal] tags: ['a','b'] still sets the CSV value", async () => {
    await campSitePUT(putRequest(CAMP_ID, { tags: ["a", "b"] }), makeParams(CAMP_ID));
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.tags).toBe("a,b");
  });
});

// ---------------------------------------------------------------------------
// Zod boundary — the widened fields accept an explicit null
// ---------------------------------------------------------------------------
describe("campSiteSchema — widened .nullable() fields (CAM-615)", () => {
  const base = {
    nameTh: "ทดสอบ",
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    bookingMethod: "ONLI" as const,
    locationId: "c2fef996-3f4c-4ff0-99ab-4425438f2fce",
  };

  it.each(["priceLow", "priceHigh", "phone", "lineId", "partner", "nationalPark", "maxGuestsPerDay", "maxTentsPerDay", "minimumAge"])(
    "[normal] %s accepts an explicit null",
    (field) => {
      const result = campSiteSchema.partial().safeParse({ ...base, [field]: null });
      expect(result.success).toBe(true);
    }
  );

  it("[boundary] maxGuestsPerDay still rejects 0 (0 is not a valid stated cap — use null to clear)", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, maxGuestsPerDay: 0 });
    expect(result.success).toBe(false);
  });

  it("[normal] facebookUrl still accepts a valid URL alongside the new null option", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, facebookUrl: "https://facebook.com/campvibe" });
    expect(result.success).toBe(true);
  });
});

describe("spotSchema — widened .nullable() fields (CAM-615)", () => {
  const base = { name: "Spot A", pricePerNight: 500, campSiteId: "c2fef996-3f4c-4ff0-99ab-4425438f2fce" };

  it.each(["maxCampers", "maxTents", "pricePerSite", "environment"])(
    "[normal] %s accepts an explicit null",
    (field) => {
      const result = spotSchema.partial().safeParse({ ...base, [field]: null });
      expect(result.success).toBe(true);
    }
  );

  it("[normal] viewType accepts an explicit null (clears back to unset)", () => {
    const result = spotSchema.partial().safeParse({ ...base, viewType: null });
    expect(result.success).toBe(true);
  });

  it("[boundary] maxCampers still rejects 0", () => {
    const result = spotSchema.partial().safeParse({ ...base, maxCampers: 0 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Client payload wiring — source-inspection (CampgroundForm has 10+ mocked
// module boundaries and no isolated render harness, same precedent as
// cam-341/cam-360/cam-351).
// ---------------------------------------------------------------------------
describe("CampgroundForm.tsx — campPayload sends explicit null, never `|| undefined` (CAM-615)", () => {
  it("partner/nationalPark use the shared clearableText helper (not `|| undefined`)", () => {
    expect(formSrc).toContain("partner: clearableText(formData.partner)");
    expect(formSrc).toContain("nationalPark: clearableText(formData.nationalPark)");
    expect(formSrc).not.toContain("partner: formData.partner || undefined");
    expect(formSrc).not.toContain("nationalPark: formData.nationalPark || undefined");
  });

  it("priceLow/priceHigh send null (not undefined) when blank", () => {
    expect(formSrc).toContain('priceLow: formData.priceLow === "" ? null : formData.priceLow');
    expect(formSrc).toContain('priceHigh: formData.priceHigh === "" ? null : formData.priceHigh');
  });

  it("minimumAge sends null (not undefined) when blank", () => {
    expect(formSrc).toContain('minimumAge: formData.minimumAge === "" ? null : formData.minimumAge');
  });

  it("maxGuestsPerDay/maxTentsPerDay send null (not undefined) when blank", () => {
    expect(formSrc).toContain('maxGuestsPerDay: formData.maxGuestsPerDay === "" ? null : formData.maxGuestsPerDay');
    expect(formSrc).toContain('maxTentsPerDay: formData.maxTentsPerDay === "" ? null : formData.maxTentsPerDay');
  });

  it("the shared clearableText helper is defined once, module-level (not re-derived per field)", () => {
    const matches = formSrc.match(/const clearableText = /g) || [];
    expect(matches.length).toBe(1);
  });
});

describe("spot-form-dialog.tsx — body sends explicit null, never undefined, when blank (CAM-615)", () => {
  it("viewType sends null for the NO_VIEW_TYPE sentinel (not undefined)", () => {
    expect(spotDialogSrc).toContain("viewType: viewType === NO_VIEW_TYPE ? null : viewType");
  });
  it("maxCampers/maxTents/pricePerSite send null when blank (not undefined)", () => {
    expect(spotDialogSrc).toContain('maxCampers: maxCampers.trim() === "" ? null : Number(maxCampers)');
    expect(spotDialogSrc).toContain('maxTents: maxTents.trim() === "" ? null : Number(maxTents)');
    expect(spotDialogSrc).toContain('pricePerSite: pricePerSite.trim() === "" ? null : Number(pricePerSite)');
  });
});

// ---------------------------------------------------------------------------
// CampgroundDetailClient.tsx — the CAM-351-sibling `|| 50` free-camp display
// ---------------------------------------------------------------------------
describe("CampgroundDetailClient.tsx — the booking-widget headline price honesty fix (CAM-615)", () => {
  it("the old `campground.priceLow || 50` collapse is gone", () => {
    expect(detailSrc).not.toContain("formatCurrency(campground.priceLow || 50)");
  });

  it("a free camp (priceLow null or <= 0) renders t.common.free instead of a fabricated ฿50", () => {
    expect(detailSrc).toContain(
      "const isHeadlinePriceFree = campground.priceLow == null || Number(campground.priceLow) <= 0;"
    );
    expect(detailSrc).toContain("{isHeadlinePriceFree ? (");
  });

  it("reuses the SAME isFree rule CampgroundCard.tsx uses for the catalog price badge (no second divergent rule)", () => {
    const cardSrc = src("components/CampgroundCard.tsx");
    expect(cardSrc).toContain("const isFree = priceLow == null || priceLow <= 0;");
  });
});
