/**
 * cam-341-fee-policy-form.test.ts — CAM-341
 *
 * Host extra-fee + cancellation-policy form sections, PLUS (v1.1) the server
 * clearing fix. CAM-268 shipped the columns + zod schema + PUT whitelist +
 * detail-page render; CAM-341 was scoped to form-UI + wiring only, but build-time
 * verification (a standalone zod parse) proved the PUT's `|| undefined` mapping
 * could never actually clear `cancellationPolicy`/`extraFeeLabel` to `null` (Prisma
 * treats `field: undefined` identically to an omitted key - it never writes NULL,
 * and the old zod schema rejected an explicit `null` for `cancellationPolicy`
 * outright with a 400). The orchestrator folded the minimal server-side clearing
 * fix into this same story so AC-3 is real: `lib/validations/campsite.ts` now
 * accepts an explicit `null` for all three CAM-268 fields, and the PUT maps
 * `null` through explicitly instead of collapsing it to `undefined`.
 *
 * Layer: source-inspection (fs.readFileSync) for the FE + mocked-Prisma
 * integration tests (same precedent as __tests__/spot-rbac.test.ts) for the PUT
 * route's clearing/no-op mapping — CampgroundForm.tsx has 10+ mocked module
 * boundaries and no isolated render harness, so it stays source-inspection;
 * the PUT route handler is a plain function we can call directly.
 *
 * AC coverage matrix:
 *   AC-1  extraFeeAmount/extraFeeLabel wired into campPayload + the Extra Fee section
 *   AC-2  cancellationPolicy Select persists a chosen enum value
 *   AC-3  the "not set" option clears cancellationPolicy to "" -> explicit null in
 *         the payload -> the PUT now writes NULL (verified against the real handler)
 *   AC-4  partial fill (one of amount/label) shows the non-blocking transparency hint
 *   AC-5  the six CAM-305 anchors exist so completeness deep-links resolve
 *   AC-7  new-listing defaults: empty amount/label, policy on "not set"
 *   EC-1/EC-2/EC-8  client inline validation copy matches the zod source verbatim
 *   EC-3  both empty -> no hint (XOR formula, not an OR/AND that would mis-fire)
 *   EC-6  a deep-link hash is resolved (scrollIntoView) only after the form mounts
 *   BR-3  policy option copy comes from t.campground.cancellationPolicy.* (no
 *         parallel Thai policy map authored in this file)
 *   BR-6  (v1.1) explicit null clears; an omitted key is always a no-op skip
 *         (REGRESSION-CRITICAL: a partial PUT must never wipe a field it did not send)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";
import translations from "../locales/translations.json";
import { CANCELLATION_POLICY_VALUES } from "@/lib/cancellation-policy";
import { campSiteSchema } from "@/lib/validations/campsite";

// ---------------------------------------------------------------------------
// Module mocks for the PUT-route integration tests (hoisted before imports —
// same pattern as __tests__/spot-rbac.test.ts)
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
const en = (translations as any).en;
const th = (translations as any).th;

const CAMP_ID = "550e8400-e29b-41d4-a716-446655440099";
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
// AC-1 / BR-6 (v1.1) — payload wiring: blank sends an EXPLICIT null, never
// undefined. undefined is dropped by JSON.stringify -> the PUT would skip the
// field entirely (partial-update semantics) -> a clear could never round-trip.
// ---------------------------------------------------------------------------
describe("campPayload wiring: extraFeeAmount / extraFeeLabel / cancellationPolicy (AC-1, BR-6 v1.1)", () => {
  it("extraFeeAmount sends explicit null when blank, else Number()-coerced", () => {
    expect(formSrc).toContain(
      'extraFeeAmount: formData.extraFeeAmount === "" ? null : Number(formData.extraFeeAmount)'
    );
  });

  it("extraFeeLabel sends explicit null when blank (not `|| undefined`)", () => {
    expect(formSrc).toContain('extraFeeLabel: formData.extraFeeLabel === "" ? null : formData.extraFeeLabel');
  });

  it("cancellationPolicy sends explicit null when blank (not `|| undefined`)", () => {
    expect(formSrc).toContain(
      'cancellationPolicy: formData.cancellationPolicy === "" ? null : formData.cancellationPolicy'
    );
  });

  it("none of the three clear paths collapse through `|| undefined` anymore (that mapping can never clear)", () => {
    expect(formSrc).not.toContain("extraFeeLabel: formData.extraFeeLabel || undefined");
    expect(formSrc).not.toContain("cancellationPolicy: formData.cancellationPolicy || undefined");
  });

  it("the three fields ride the existing PUT/POST payload — no new fetch/endpoint added", () => {
    // Still a single POST/PUT to /api/campsites(/:id) as before this story.
    const putCalls = (formSrc.match(/\/api\/campsites/g) || []).length;
    expect(putCalls).toBeGreaterThan(0);
    expect(formSrc).not.toMatch(/\/api\/campsites\/[^"'`]*\/(fee|policy|cancellation)/);
  });
});

// ---------------------------------------------------------------------------
// AC-3 / BR-6 (v1.1) — PUT route clearing fix, verified against the real
// handler with a mocked Prisma (same pattern as __tests__/spot-rbac.test.ts).
// REGRESSION-CRITICAL: an omitted key must stay a no-op skip — a partial PUT
// (e.g. price-only) must never wipe extraFeeAmount/extraFeeLabel/cancellationPolicy.
// ---------------------------------------------------------------------------
describe("PUT /api/campsites/[id] — explicit-null clearing (AC-3, BR-6 v1.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      nameThSlug: "slug-th",
      nameEnSlug: "slug-en",
    });
  });

  it("[AC-3] cancellationPolicy: null clears the column to null", async () => {
    const res = await campSitePUT(putRequest({ cancellationPolicy: null }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.cancellationPolicy).toBeNull();
  });

  it("cancellationPolicy: 'MODERATE' still sets the enum value (AC-2 regression guard)", async () => {
    await campSitePUT(putRequest({ cancellationPolicy: "MODERATE" }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.cancellationPolicy).toBe("MODERATE");
  });

  it("cancellationPolicy: 'BOGUS' (outside the closed enum) is rejected with 400, no write", async () => {
    const res = await campSitePUT(putRequest({ cancellationPolicy: "BOGUS" }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });

  it("extraFeeLabel: '' (empty string) clears the column to null", async () => {
    await campSitePUT(putRequest({ extraFeeLabel: "" }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.extraFeeLabel).toBeNull();
  });

  it("extraFeeLabel: null (explicit) also clears the column to null", async () => {
    await campSitePUT(putRequest({ extraFeeLabel: null }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.extraFeeLabel).toBeNull();
  });

  it("extraFeeLabel: 'ค่าเข้าอุทยาน' still sets the label (AC-1 regression guard)", async () => {
    await campSitePUT(putRequest({ extraFeeLabel: "ค่าเข้าอุทยาน" }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.extraFeeLabel).toBe("ค่าเข้าอุทยาน");
  });

  it("extraFeeLabel over 100 chars is rejected with 400, no write", async () => {
    const res = await campSitePUT(putRequest({ extraFeeLabel: "a".repeat(101) }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });

  it("extraFeeAmount: null clears the column to null (a host removing a fee must not leave a stale amount)", async () => {
    await campSitePUT(putRequest({ extraFeeAmount: null }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.extraFeeAmount).toBeNull();
  });

  it("extraFeeAmount: 250 still sets the amount (AC-1 regression guard)", async () => {
    await campSitePUT(putRequest({ extraFeeAmount: 250 }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.extraFeeAmount).toBe(250);
  });

  it("extraFeeAmount: -1 (out of range) is rejected with 400, no write", async () => {
    const res = await campSitePUT(putRequest({ extraFeeAmount: -1 }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });

  it("REGRESSION-CRITICAL: omitting all three keys never touches them (partial price-only update)", async () => {
    await campSitePUT(putRequest({ priceLow: 600 }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBe(600);
    expect("extraFeeAmount" in call.data).toBe(false);
    expect("extraFeeLabel" in call.data).toBe(false);
    expect("cancellationPolicy" in call.data).toBe(false);
  });

  it("all three can be set together in one request (AC-1/AC-2 combined save)", async () => {
    await campSitePUT(
      putRequest({ extraFeeAmount: 40, extraFeeLabel: "ค่าเข้าอุทยาน", cancellationPolicy: "STRICT" }),
      makeParams(CAMP_ID)
    );

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.extraFeeAmount).toBe(40);
    expect(call.data.extraFeeLabel).toBe("ค่าเข้าอุทยาน");
    expect(call.data.cancellationPolicy).toBe("STRICT");
  });

  it("all three can be cleared together in one request (AC-3 combined clear)", async () => {
    await campSitePUT(
      putRequest({ extraFeeAmount: null, extraFeeLabel: null, cancellationPolicy: null }),
      makeParams(CAMP_ID)
    );

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.extraFeeAmount).toBeNull();
    expect(call.data.extraFeeLabel).toBeNull();
    expect(call.data.cancellationPolicy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Zod boundary — the three CAM-268 fields now accept an explicit null (v1.1)
// ---------------------------------------------------------------------------
describe("campSiteSchema — nullable CAM-268 fields (v1.1)", () => {
  const base = {
    nameTh: "ทดสอบ",
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    bookingMethod: "ONLI" as const,
    locationId: "c2fef996-3f4c-4ff0-99ab-4425438f2fce",
  };

  it("[normal] cancellationPolicy accepts an explicit null (was rejected before v1.1)", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, cancellationPolicy: null });
    expect(result.success).toBe(true);
  });

  it("[normal] extraFeeLabel accepts an explicit null", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, extraFeeLabel: null });
    expect(result.success).toBe(true);
  });

  it("[normal] extraFeeAmount accepts an explicit null", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, extraFeeAmount: null });
    expect(result.success).toBe(true);
  });

  it("[error/validation] cancellationPolicy still rejects an unrecognized string", () => {
    const result = campSiteSchema.partial().safeParse({ ...base, cancellationPolicy: "REFUNDABLE_MAYBE" });
    expect(result.success).toBe(false);
  });

  it("[null/empty] omitting all three keys is still valid (no regression to the optional contract)", () => {
    const result = campSiteSchema.partial().safeParse(base);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-7 / BR-6 — new-listing defaults (empty amount/label, not-set policy)
// ---------------------------------------------------------------------------
describe("new-listing defaults (AC-7)", () => {
  it("initial formData state defaults extraFeeAmount to empty string", () => {
    expect(formSrc).toMatch(/extraFeeAmount:\s*""\s*as\s*number\s*\|\s*string,/);
  });

  it("initial formData state defaults extraFeeLabel to empty string", () => {
    expect(formSrc).toMatch(/extraFeeLabel:\s*"",\n\s*cancellationPolicy/);
  });

  it("initial formData state defaults cancellationPolicy to empty string (not-set)", () => {
    expect(formSrc).toMatch(/cancellationPolicy:\s*""\s*as\s*string,/);
  });
});

// ---------------------------------------------------------------------------
// AC-1 / BR-6 — prefill (Decimal -> Number coercion, mirrors priceLow)
// ---------------------------------------------------------------------------
describe("initialData prefill (BR-6)", () => {
  it("extraFeeAmount is coerced via Number() when present, else empty string", () => {
    expect(formSrc).toMatch(
      /initialData\.extraFeeAmount !== undefined && initialData\.extraFeeAmount !== null[\s\S]{0,40}\? Number\(initialData\.extraFeeAmount\)/
    );
  });

  it("extraFeeLabel prefills from initialData with an empty-string fallback", () => {
    expect(formSrc).toContain('extraFeeLabel: initialData.extraFeeLabel || ""');
  });

  it("cancellationPolicy prefills from initialData with an empty-string fallback", () => {
    expect(formSrc).toContain('cancellationPolicy: initialData.cancellationPolicy || ""');
  });
});

// ---------------------------------------------------------------------------
// AC-4 / EC-3 — transparency nudge (non-blocking, XOR truth table)
// ---------------------------------------------------------------------------
describe("transparency nudge (AC-4, EC-3, BR-4)", () => {
  it("showExtraFeeHint is an XOR of amount-filled and label-filled (not OR/AND)", () => {
    expect(formSrc).toContain(
      "const showExtraFeeHint = extraFeeAmountFilled !== extraFeeLabelFilled;"
    );
  });

  it("amountFilled checks against the empty-string sentinel (not truthiness, so 0 still counts as filled)", () => {
    expect(formSrc).toContain('const extraFeeAmountFilled = formData.extraFeeAmount !== "";');
  });

  it("labelFilled trims before checking length (whitespace-only does not count as filled)", () => {
    expect(formSrc).toContain(
      "const extraFeeLabelFilled = formData.extraFeeLabel.trim().length > 0;"
    );
  });

  it("the hint copy key is rendered conditionally on showExtraFeeHint", () => {
    expect(formSrc).toMatch(/\{showExtraFeeHint && \(/);
    expect(formSrc).toContain("{t.newCampground.extraFeeHint}");
  });

  it("the hint never disables save (no disabled binding references showExtraFeeHint)", () => {
    expect(formSrc).not.toMatch(/disabled=\{[^}]*showExtraFeeHint/);
  });
});

// ---------------------------------------------------------------------------
// EC-1 / EC-2 / EC-8 — client validation copy matches the zod source verbatim
// ---------------------------------------------------------------------------
describe("client validation copy matches lib/validations/campsite.ts verbatim (EC-1, EC-2, EC-8)", () => {
  // Pull the actual zod error strings so this test fails if either side drifts.
  const amountResult = campSiteSchema.safeParse({
    nameTh: "x",
    latitude: 0,
    longitude: 0,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    bookingMethod: "ONLI",
    locationId: "c2fef996-3f4c-4ff0-99ab-4425438f2fce",
    extraFeeAmount: -1,
  });
  const labelResult = campSiteSchema.safeParse({
    nameTh: "x",
    latitude: 0,
    longitude: 0,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    bookingMethod: "ONLI",
    locationId: "c2fef996-3f4c-4ff0-99ab-4425438f2fce",
    extraFeeLabel: "a".repeat(101),
  });

  it("[boundary] zod rejects extraFeeAmount = -1 with the catalog message", () => {
    expect(amountResult.success).toBe(false);
  });

  it("[boundary] zod rejects extraFeeLabel over 100 chars", () => {
    expect(labelResult.success).toBe(false);
  });

  it("locales.extraFeeAmountError (TH) matches the zod message byte-for-byte", () => {
    if (!amountResult.success) {
      expect(th.newCampground.extraFeeAmountError).toBe(amountResult.error.issues[0].message);
    }
  });

  it("locales.extraFeeLabelError (TH) matches the zod message byte-for-byte", () => {
    if (!labelResult.success) {
      expect(th.newCampground.extraFeeLabelError).toBe(labelResult.error.issues[0].message);
    }
  });

  it("the form computes extraFeeAmountError from a 0-100000 range check (not a re-typed literal)", () => {
    expect(formSrc).toMatch(/Number\(formData\.extraFeeAmount\) < 0/);
    expect(formSrc).toMatch(/Number\(formData\.extraFeeAmount\) > 100000/);
    expect(formSrc).toContain("t.newCampground.extraFeeAmountError");
  });

  it("[EC-8] non-numeric amount is guarded with isNaN before the range check", () => {
    expect(formSrc).toMatch(/isNaN\(Number\(formData\.extraFeeAmount\)\)/);
  });

  it("the form computes extraFeeLabelError from a 100-char length check", () => {
    expect(formSrc).toContain("formData.extraFeeLabel.length > 100");
    expect(formSrc).toContain("t.newCampground.extraFeeLabelError");
  });
});

// ---------------------------------------------------------------------------
// AC-2 / AC-3 / BR-3 — policy Select sourced from the shared resolver, never a
// parallel Thai policy map authored inline in the form.
// ---------------------------------------------------------------------------
describe("cancellation-policy Select (AC-2, AC-3, BR-3)", () => {
  it("imports CANCELLATION_POLICY_VALUES from the shared seam (no local enum copy)", () => {
    expect(formSrc).toContain('import { CANCELLATION_POLICY_VALUES } from "@/lib/cancellation-policy"');
  });

  it("renders every option's copy from t.campground.cancellationPolicy (BR-3)", () => {
    expect(formSrc).toContain("t.campground.cancellationPolicy[value]");
    expect(formSrc).toContain("t.campground.cancellationPolicy.notSet");
    expect(formSrc).toContain("t.campground.cancellationPolicy.title");
  });

  it("carries NO parallel hardcoded Thai policy copy (every AC-quoted policy string lives only in locales)", () => {
    for (const v of CANCELLATION_POLICY_VALUES) {
      const copy = th.campground.cancellationPolicy[v];
      expect(formSrc).not.toContain(copy);
    }
    expect(formSrc).not.toContain(th.campground.cancellationPolicy.notSet);
  });

  it("uses a non-empty sentinel value for the not-set SelectItem (Radix forbids value=\"\")", () => {
    expect(formSrc).toContain('const CANCELLATION_POLICY_NOT_SET = "NOT_SET";');
    expect(formSrc).toContain("value={CANCELLATION_POLICY_NOT_SET}");
  });

  it("onValueChange maps the sentinel back to an empty string (clears the policy)", () => {
    expect(formSrc).toMatch(
      /cancellationPolicy: value === CANCELLATION_POLICY_NOT_SET \? "" : value,/
    );
  });
});

// ---------------------------------------------------------------------------
// AC-5 / BR-5 — the six CAM-305 anchors
// ---------------------------------------------------------------------------
describe("section anchors resolve the CAM-305 deep-link map (AC-5, BR-5)", () => {
  const ANCHORS = ["photos", "price", "cancellation-policy", "extra-fee", "zones", "amenities"];

  ANCHORS.forEach((id) => {
    it(`id="${id}" is present exactly once`, () => {
      const matches = formSrc.match(new RegExp(`id="${id}"`, "g")) || [];
      expect(matches.length).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// EC-6 — hash resolved only after the form has mounted (not an inert link)
// ---------------------------------------------------------------------------
describe("EC-6: deep-link hash resolves after the form mounts", () => {
  it("the scroll effect is gated on optionsLoading (skips while the fetch is in flight)", () => {
    expect(formSrc).toMatch(/useEffect\(\(\) => \{\s*if \(optionsLoading\) return;/);
  });

  it("reads window.location.hash and scrolls the matching element into view", () => {
    expect(formSrc).toContain("window.location.hash.slice(1)");
    expect(formSrc).toContain("document.getElementById(hash)?.scrollIntoView(");
  });

  it("the effect depends on optionsLoading (re-runs once loading flips false)", () => {
    expect(formSrc).toMatch(/scrollIntoView\([\s\S]{0,80}\}, \[optionsLoading\]\);/);
  });
});

// ---------------------------------------------------------------------------
// i18n — every new key exists in both locales, no em-dash, Thai copy verbatim
// ---------------------------------------------------------------------------
describe("i18n: newCampground extra-fee/cancellation keys (both locales)", () => {
  const KEYS = [
    "extraFee",
    "extraFeeAmountLabel",
    "extraFeeAmountPlaceholder",
    "extraFeeAmountHelper",
    "extraFeeAmountError",
    "extraFeeLabelField",
    "extraFeeLabelPlaceholder",
    "extraFeeLabelError",
    "extraFeeHint",
  ];

  KEYS.forEach((key) => {
    it(`newCampground.${key} exists in EN`, () => {
      expect(typeof en.newCampground[key]).toBe("string");
      expect(en.newCampground[key].length).toBeGreaterThan(0);
    });

    it(`newCampground.${key} exists in TH`, () => {
      expect(typeof th.newCampground[key]).toBe("string");
      expect(th.newCampground[key].length).toBeGreaterThan(0);
    });

    it(`TH newCampground.${key} has no em-dash separator`, () => {
      expect(th.newCampground[key]).not.toContain("—");
    });
  });

  it("th.newCampground.extraFee is verbatim the AC-5 quoted heading", () => {
    expect(th.newCampground.extraFee).toBe("ค่าธรรมเนียมเพิ่มเติม");
  });

  it("th.newCampground.extraFeeHint is verbatim the AC-4 quoted hint", () => {
    expect(th.newCampground.extraFeeHint).toBe(
      "กรอกทั้งจำนวนเงินและชื่อค่าธรรมเนียมเพื่อให้ข้อมูลครบถ้วน"
    );
  });

  it("th.newCampground.extraFeeAmountHelper is verbatim the BR-1 quoted helper", () => {
    expect(th.newCampground.extraFeeAmountHelper).toBe(
      "เก็บครั้งเดียวต่อการเข้าพัก ไม่ใช่ต่อคืน"
    );
  });

  it("th.newCampground.extraFeeLabelPlaceholder is verbatim the BR-2 quoted placeholder", () => {
    expect(th.newCampground.extraFeeLabelPlaceholder).toBe("เช่น ค่าเข้าอุทยาน");
  });
});

// ---------------------------------------------------------------------------
// Reuse-first: composed only from existing primitives, no new component
// ---------------------------------------------------------------------------
describe("reuse-first: Extra Fee + Cancellation Policy sections compose existing primitives", () => {
  it("uses the existing Card/CardHeader/CardContent/CardTitle pattern (no new wrapper)", () => {
    expect(formSrc).toContain('<Card id="extra-fee" className="border-border shadow-sm">');
    expect(formSrc).toContain('<Card id="cancellation-policy" className="border-border shadow-sm">');
  });

  it("uses the existing InputField primitive for amount + label (no hand-rolled input)", () => {
    expect(formSrc).toContain("label={t.newCampground.extraFeeAmountLabel}");
    expect(formSrc).toContain("label={t.newCampground.extraFeeLabelField}");
  });

  it("uses the existing Select/SelectTrigger/SelectContent/SelectItem primitives", () => {
    expect(formSrc).toMatch(/<Select\s+value=\{formData\.cancellationPolicy/);
    expect(formSrc).toContain("<SelectTrigger");
    expect(formSrc).toContain("<SelectContent>");
  });
});
