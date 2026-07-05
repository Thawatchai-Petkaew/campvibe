/**
 * cam-360-logo-clear-persists.test.ts — CAM-360
 *
 * Bug found by CAM-359's E2E AC-3: clearing a campsite's logo then saving
 * silently kept the OLD logo. Root cause (same defect class as CAM-341):
 *
 *  - `components/CampgroundForm.tsx` sent `logo: formData.logo || undefined`
 *    - a cleared `""` collapsed to `undefined`, dropped by `JSON.stringify`,
 *    so the request body never carried the `logo` key at all.
 *  - `app/api/campsites/[id]/route.ts` PUT only writes `logo` when
 *    `data.logo !== undefined` (an absent key = "skip, partial update").
 *    With the key always absent on a clear, the column was never touched
 *    and the old logo reappeared on reload.
 *
 * Fix mirrors CAM-341's explicit-null clearing pattern: the form now sends
 * an explicit `null` on clear (when editing), the zod schema accepts `null`,
 * and the PUT/POST routes map `''`/`null` -> `null` while an omitted key
 * still skips the field entirely (REGRESSION-CRITICAL).
 *
 * Layer: source-inspection (fs.readFileSync) for the FE payload line + a
 * mocked-Prisma integration test for the PUT route's clearing/no-op mapping
 * (same precedent as __tests__/cam-341-fee-policy-form.test.ts) + a unit
 * test for the zod boundary.
 *
 * AC coverage matrix:
 *   AC-1  clearing the logo and saving writes NULL to the column
 *   AC-2  saving an unrelated field never touches an existing logo
 *         (REGRESSION-CRITICAL: an omitted key must stay a no-op skip)
 *   AC-3  a valid logo URL still persists unchanged (CAM-358 regression guard)
 *   EC-1  an omitted `logo` key leaves the column completely untouched
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import { campSiteSchema } from "@/lib/validations/campsite";

// ---------------------------------------------------------------------------
// Module mocks for the PUT-route integration tests (hoisted before imports —
// same pattern as __tests__/cam-341-fee-policy-form.test.ts)
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: {
      update: vi.fn(),
    },
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
import { PUT as campSitePUT } from "@/app/api/campsites/[id]/route";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const formSrc = src("components/CampgroundForm.tsx");
const postRouteSrc = src("app/api/campsites/route.ts");

const CAMP_ID = "550e8400-e29b-41d4-a716-446655440360";
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: { id: CAMP_ID, operatorId: "op-1" } as never,
    session: { user: { id: "op-1" } } as never,
  });
}

function putRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// AC-1/AC-2 — campPayload wiring: blank sends an EXPLICIT null on edit, never
// undefined. undefined is dropped by JSON.stringify -> the PUT would skip the
// field entirely -> a clear could never round-trip (the exact CAM-359 bug).
// ---------------------------------------------------------------------------
describe("campPayload wiring: logo (AC-1, AC-2)", () => {
  it("logo sends explicit null when blank AND editing (not `|| undefined`)", () => {
    expect(formSrc).toContain(
      'logo: formData.logo === "" ? (isEditing ? null : undefined) : formData.logo'
    );
  });

  it("the old `|| undefined` collapse no longer exists for logo (that mapping can never clear)", () => {
    expect(formSrc).not.toContain("logo: formData.logo || undefined");
  });

  it("logo still rides the existing PUT/POST payload — no new fetch/endpoint added", () => {
    const putCalls = (formSrc.match(/\/api\/campsites/g) || []).length;
    expect(putCalls).toBeGreaterThan(0);
    expect(formSrc).not.toMatch(/\/api\/campsites\/[^"'`]*\/logo/);
  });
});

// ---------------------------------------------------------------------------
// AC-1/AC-2/EC-1 — PUT route clearing fix, verified against the real handler
// with a mocked Prisma (same pattern as __tests__/cam-341-fee-policy-form.test.ts).
// REGRESSION-CRITICAL: an omitted key must stay a no-op skip.
// ---------------------------------------------------------------------------
describe("PUT /api/campsites/[id] — logo explicit-null clearing (AC-1, AC-2, EC-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      nameThSlug: "slug-th",
      nameEnSlug: "slug-en",
    });
  });

  it("[AC-1] logo: null clears the column to null", async () => {
    const res = await campSitePUT(putRequest({ logo: null }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.logo).toBeNull();
  });

  it("[AC-1] logo: '' (empty string) also clears the column to null", async () => {
    const res = await campSitePUT(putRequest({ logo: "" }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.logo).toBeNull();
  });

  it("[AC-3] logo: a valid absolute URL still sets it (regression guard)", async () => {
    await campSitePUT(
      putRequest({ logo: "https://blob.vercel-storage.com/campvibe-logo-abc123.jpg" }),
      makeParams(CAMP_ID)
    );

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.logo).toBe("https://blob.vercel-storage.com/campvibe-logo-abc123.jpg");
  });

  it("[AC-3] logo: a valid root-relative URL still sets it (CAM-358 regression guard)", async () => {
    await campSitePUT(putRequest({ logo: "/uploads/campvibe-logo-1700000000000.jpg" }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.logo).toBe("/uploads/campvibe-logo-1700000000000.jpg");
  });

  it("logo: '//evil.com' (unsafe shape) is still rejected with 400, no write (CAM-358 rule unweakened)", async () => {
    const res = await campSitePUT(putRequest({ logo: "//evil.com" }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });

  it("[AC-2/EC-1] REGRESSION-CRITICAL: omitting the logo key never touches it (partial price-only update)", async () => {
    await campSitePUT(putRequest({ priceLow: 700 }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBe(700);
    expect("logo" in call.data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/campsites — create-path consistency (source-inspection; the
// route imports next/server + prisma at module load in a way that is
// awkward to mock a second time in the same file, so this is asserted at
// the source level like the CAM-341 form-payload checks above).
// ---------------------------------------------------------------------------
describe("POST /api/campsites — logo create-path mapping (consistency, not a behavior change)", () => {
  it("maps '' or null to null (same shape as the PUT route), a value passes through", () => {
    expect(postRouteSrc).toContain(
      "logo: data.logo === '' || data.logo === null ? null : data.logo,"
    );
  });

  it("the old blanket `|| undefined` collapse no longer exists for logo on create", () => {
    expect(postRouteSrc).not.toContain("logo: data.logo || undefined,");
  });
});

// ---------------------------------------------------------------------------
// Zod boundary — logo now accepts an explicit null (in addition to the
// existing undefined/''/valid-url shapes); an unsafe URL is still rejected.
// ---------------------------------------------------------------------------
describe("campSiteSchema.logo — nullable (AC-1, AC-3)", () => {
  const base = {
    nameTh: "ทดสอบ",
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    bookingMethod: "ONLI" as const,
    locationId: "c2fef996-3f4c-4ff0-99ab-4425438f2fce",
  };

  it("[normal] logo accepts an explicit null (was rejected before this fix)", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, logo: null });
    expect(result.success).toBe(true);
  });

  it("[null/empty] logo still accepts an empty string (no logo set)", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, logo: "" });
    expect(result.success).toBe(true);
  });

  it("[null/empty] omitting logo entirely is still valid (no regression to the optional contract)", () => {
    const result = campSiteSchema.partial().safeParse(base);
    expect(result.success).toBe(true);
  });

  it("[normal] logo still accepts a valid absolute URL", () => {
    const result = campSiteSchema.partial().safeParse({
      ...base,
      logo: "https://blob.vercel-storage.com/campvibe-logo-abc123.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("[normal] logo still accepts a valid root-relative URL (CAM-358)", () => {
    const result = campSiteSchema.partial().safeParse({
      ...base,
      logo: "/uploads/campvibe-logo-1700000000000.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("[error/validation] logo still rejects an unsafe protocol-relative shape (CAM-358 rule unweakened)", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, logo: "//evil.com" });
    expect(result.success).toBe(false);
  });

  it("[error/validation] logo still rejects a javascript: scheme (CAM-358 rule unweakened)", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, logo: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });
});
