/**
 * cam-520-campsitetype-single-select.test.ts — CAM-520
 *
 * `campSiteType` is a SCALAR column on CampSite (one code per camp — CAGD /
 * CACP / GLAMP / LAKE / FOREST / VIEW / BAOT). Two layers had drifted out of
 * step with that column: the shared zod schema modeled it as
 * `z.array(CampSiteTypeEnum).default([])`, and the host form rendered it as a
 * multi-select (with a "(เลือกได้หลายรายการ)" hint the storage could never
 * honor). The two write routes papered over the mismatch with a silent
 * `Array.isArray(...) ? [0] : ...` coercion PLUS an invalid `"CAMPGROUND"`
 * sentinel fallback (not a real `CampSiteTypeEnum` member — matches no label,
 * no filter). This story removes the coercion at its root: the schema and
 * form now both model `campSiteType` as a single required string, so the
 * write paths can write it verbatim.
 *
 * No migration (story.md `## Data`) — the DB column was always scalar; only
 * the schema + form catch up to it. AI/catalog filter (`lib/campsite-filters.ts`),
 * detail display, seed, and mock are untouched (BR-4) — they were already
 * correct (see __tests__/cam-517-campground-type.test.ts, cam-408, cam-270).
 *
 * Layer: zod unit + source-inspection (form + POST route, same "awkward to
 * double-mock in one file" precedent as __tests__/cam-360-logo-clear-persists.test.ts)
 * + a mocked-Prisma behavioral integration test for the PUT route (same
 * pattern as cam-360's `requireCampSitePermission` mock).
 *
 * AC coverage matrix:
 *   AC-1  form single-select: picking one clears any prior selection; no
 *         "multiple selection" hint remains for this field
 *   AC-2  edit round-trips the scalar value unchanged; a legacy array/invalid
 *         value falls back to a valid default rather than crashing (EC-2)
 *   AC-3  POST/PUT write the picked code verbatim — no `[0]` truncation, no
 *         "CAMPGROUND" sentinel fallback
 *   EC-1  create never ends up with an empty campSiteType (non-nullable column)
 *   EC-2  a legacy invalid stored value never crashes the edit prefill
 *   BR-1  campSiteSchema.campSiteType is a single required enum, not an array
 *   BR-2  CampgroundForm models + renders it as single-select
 *   BR-3  POST/PUT write `data.campSiteType` directly, no coercion
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import { campSiteSchema, CampSiteTypeEnum } from "@/lib/validations/campsite";

// ---------------------------------------------------------------------------
// Module mocks for the PUT-route integration tests — same pattern as
// __tests__/cam-360-logo-clear-persists.test.ts (mock requireCampSitePermission
// directly rather than the full ownership-lookup chain).
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

const postRouteSrc = src("app/api/campsites/route.ts");
const putRouteSrc = src("app/api/campsites/[id]/route.ts");
const formSrc = src("components/CampgroundForm.tsx");

const CAMP_ID = "550e8400-e29b-41d4-a716-446655440520";
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: { id: CAMP_ID, operatorId: "op-1", isPublished: false } as never,
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

/* -------------------------------------------------------------------------- */
/* BR-1 — campSiteSchema.campSiteType is a single required enum              */
/* -------------------------------------------------------------------------- */

describe("campSiteSchema.campSiteType — single required enum (BR-1)", () => {
  it("[normal] a single valid code passes (partial, update-shape)", () => {
    const result = campSiteSchema.partial().safeParse({ campSiteType: "GLAMP" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.campSiteType).toBe("GLAMP");
  });

  it("[error/validation] an ARRAY is now REJECTED (documents the AC-3/BR-1 behavior change)", () => {
    const result = campSiteSchema.partial().safeParse({ campSiteType: ["GLAMP"] });
    expect(result.success).toBe(false);
  });

  it("[error/validation] an empty array is also rejected (the old `.default([])` shape is gone)", () => {
    const result = campSiteSchema.partial().safeParse({ campSiteType: [] });
    expect(result.success).toBe(false);
  });

  it("[error/validation] the invalid \"CAMPGROUND\" sentinel is not a valid enum member", () => {
    const result = CampSiteTypeEnum.safeParse("CAMPGROUND");
    expect(result.success).toBe(false);
  });

  it("[error/validation] a full (non-partial) create payload omitting campSiteType fails — required on create", () => {
    const result = campSiteSchema.safeParse({
      nameTh: "แคมป์ทดสอบ",
      latitude: 13.0,
      longitude: 100.0,
      checkInTime: "14:00",
      checkOutTime: "12:00",
      bookingMethod: "ONLI",
      locationId: "550e8400-e29b-41d4-a716-446655440000",
      // campSiteType intentionally omitted
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("campSiteType");
    }
  });

  it("[normal] the same full create payload succeeds once a valid campSiteType is present", () => {
    const result = campSiteSchema.safeParse({
      nameTh: "แคมป์ทดสอบ",
      latitude: 13.0,
      longitude: 100.0,
      checkInTime: "14:00",
      checkOutTime: "12:00",
      bookingMethod: "ONLI",
      locationId: "550e8400-e29b-41d4-a716-446655440000",
      campSiteType: "CAGD",
    });
    expect(result.success).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* BR-3 — POST /api/campsites writes campSiteType verbatim (source-inspection */
/* — same "awkward to double-mock in one file" precedent as CAM-360's POST   */
/* logo checks, since this file already mocks @/lib/prisma for the PUT test) */
/* -------------------------------------------------------------------------- */

describe("POST /api/campsites — write path (BR-3, source-inspection)", () => {
  it("writes campSiteType verbatim from validated data, no coercion", () => {
    expect(postRouteSrc).toContain("campSiteType: data.campSiteType,");
  });

  it("the old Array.isArray([0]) coercion no longer exists on the create path", () => {
    expect(postRouteSrc).not.toContain(
      "Array.isArray(data.campSiteType) ? data.campSiteType[0] : data.campSiteType"
    );
  });

  it("the invalid \"CAMPGROUND\" fallback sentinel no longer exists on the create path", () => {
    expect(postRouteSrc).not.toContain('|| "CAMPGROUND"');
  });
});

/* -------------------------------------------------------------------------- */
/* BR-3 — PUT /api/campsites/[id] writes campSiteType verbatim, behaviorally */
/* -------------------------------------------------------------------------- */

describe("PUT /api/campsites/[id] — campSiteType write (AC-3, BR-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      nameThSlug: "slug-th",
      nameEnSlug: "slug-en",
    });
  });

  it("[AC-3] campSiteType: 'GLAMP' is written verbatim (not truncated, not 'CAMPGROUND')", async () => {
    const res = await campSitePUT(putRequest({ campSiteType: "GLAMP" }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.campSiteType).toBe("GLAMP");
  });

  it("[AC-3] campSiteType: 'LAKE' is written verbatim (proves this isn't a hardcoded single value)", async () => {
    await campSitePUT(putRequest({ campSiteType: "LAKE" }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.campSiteType).toBe("LAKE");
  });

  it("[EC regression] omitting campSiteType never touches the column (partial price-only update)", async () => {
    await campSitePUT(putRequest({ priceLow: 700 }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBe(700);
    expect("campSiteType" in call.data).toBe(false);
  });

  it("[error/validation] an ARRAY campSiteType (legacy client shape) is now REJECTED with 400, no write", async () => {
    const res = await campSitePUT(putRequest({ campSiteType: ["GLAMP", "LAKE"] }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });

  it("the old Array.isArray([0]) coercion no longer exists on the update path", () => {
    expect(putRouteSrc).not.toContain(
      "Array.isArray(data.campSiteType) ? data.campSiteType[0] : data.campSiteType"
    );
  });

  it("[teeth] the presence guard is `!== undefined` (not `?.length`, a leftover array-ism)", () => {
    expect(putRouteSrc).toContain("...(data.campSiteType !== undefined && { campSiteType: data.campSiteType }),");
  });
});

/* -------------------------------------------------------------------------- */
/* BR-2 — CampgroundForm.tsx models + renders campSiteType as single-select   */
/* (source-inspection — no jsdom render harness in this repo, same precedent  */
/* as cam-356/cam-360/cam-517)                                                */
/* -------------------------------------------------------------------------- */

describe("CampgroundForm.tsx — campSiteType single-select (BR-2, AC-1, AC-2)", () => {
  it("[AC-1] state initializes campSiteType as a scalar string, not an array", () => {
    expect(formSrc).toContain('campSiteType: "", // CAM-520: scalar column, single-select');
    expect(formSrc).not.toContain("campSiteType: [] as string[]");
  });

  it("[AC-1] the type-picker no longer uses toggleArrayItem (that's an array-add/remove, not a single choice)", () => {
    expect(formSrc).not.toContain("toggleArrayItem('campSiteType'");
  });

  it("[AC-1] selecting a code REPLACES the selection via setFormData (radio-style, not toggle)", () => {
    expect(formSrc).toContain("onClick={() => setFormData({ ...formData, campSiteType: opt.code })}");
  });

  it("[AC-1] isSelected compares by scalar equality, not array membership", () => {
    expect(formSrc).toContain("const isSelected = formData.campSiteType === opt.code;");
    expect(formSrc).not.toContain("formData.campSiteType.includes(opt.code)");
  });

  it('[AC-1] the "multiple selection" hint is removed for the campground-type field', () => {
    expect(formSrc).not.toContain(
      '{t.newCampground.type} <span className="text-xs text-muted-foreground">{t.newCampground.multipleSelection}</span>'
    );
  });

  it("[EC-1] create-default pre-selects a valid code (column is non-nullable)", () => {
    expect(formSrc).toContain("campSiteType: prev.campSiteType || data['Campground type'][0].code");
  });

  it("[AC-2/EC-2] edit-prefill accepts a scalar, falls back to a valid enum member (never crashes on a legacy invalid value)", () => {
    expect(formSrc).toContain("CampSiteTypeEnum.safeParse(scalar).success ? scalar : CampSiteTypeEnum.options[0]");
  });

  it("payload sends the single scalar string (no stale 'array' comment)", () => {
    expect(formSrc).toContain("campSiteType: formData.campSiteType, // CAM-520: single scalar string");
    expect(formSrc).not.toContain("campSiteType: formData.campSiteType, // Now an array");
  });

  it("imports CampSiteTypeEnum from the shared validations module (reused, not re-declared)", () => {
    expect(formSrc).toContain('import { campSiteSchema, CampSiteTypeEnum } from "@/lib/validations/campsite";');
  });
});

/* -------------------------------------------------------------------------- */
/* BR-4 — untouched consumers stay scalar-equals / unaffected (regression     */
/* guard only; the real coverage lives in cam-517/cam-408/cam-270)          */
/* -------------------------------------------------------------------------- */

describe("BR-4 — out-of-scope consumers untouched (regression guard)", () => {
  it("lib/campsite-filters.ts still assigns campSiteType as a plain scalar equals", () => {
    const filtersSrc = src("lib/campsite-filters.ts");
    expect(filtersSrc).toContain("where.campSiteType = type;");
  });
});
