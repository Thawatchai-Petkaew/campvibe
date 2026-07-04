/**
 * cam-341-fee-policy-form.test.ts — CAM-341
 *
 * Host extra-fee + cancellation-policy form sections. CAM-268 already shipped the
 * columns + zod schema + PUT whitelist + detail-page render; this story is the
 * form-UI + wiring half (components/CampgroundForm.tsx) — NO schema/API/zod change.
 *
 * Layer: source-inspection (fs.readFileSync). Same precedent as
 * __tests__/f4-forms-operator.test.ts and __tests__/cam-268-price-fee-cancellation-policy.test.ts
 * for this exact file — CampgroundForm.tsx has 10+ mocked module boundaries
 * (LanguageContext, ImageUpload, LogoUpload, LocationPicker, getFilterOptions
 * server action, multiple fetches) and no isolated render harness.
 *
 * AC coverage matrix:
 *   AC-1  extraFeeAmount/extraFeeLabel wired into campPayload + the Extra Fee section
 *   AC-2  cancellationPolicy Select persists a chosen enum value
 *   AC-3  the "not set" option clears cancellationPolicy to "" (-> undefined in payload)
 *   AC-4  partial fill (one of amount/label) shows the non-blocking transparency hint
 *   AC-5  the six CAM-305 anchors exist so completeness deep-links resolve
 *   AC-7  new-listing defaults: empty amount/label, policy on "not set"
 *   EC-1/EC-2/EC-8  client inline validation copy matches the zod source verbatim
 *   EC-3  both empty -> no hint (XOR formula, not an OR/AND that would mis-fire)
 *   EC-6  a deep-link hash is resolved (scrollIntoView) only after the form mounts
 *   BR-3  policy option copy comes from t.campground.cancellationPolicy.* (no
 *         parallel Thai policy map authored in this file)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";
import { CANCELLATION_POLICY_VALUES } from "@/lib/cancellation-policy";
import { campSiteSchema } from "@/lib/validations/campsite";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const formSrc = src("components/CampgroundForm.tsx");
const en = (translations as any).en;
const th = (translations as any).th;

// ---------------------------------------------------------------------------
// AC-1 / BR-6 — payload wiring (set + clear-to-undefined paths)
// ---------------------------------------------------------------------------
describe("campPayload wiring: extraFeeAmount / extraFeeLabel / cancellationPolicy (AC-1, BR-6)", () => {
  it("extraFeeAmount converts blank to undefined and coerces a filled value with Number()", () => {
    expect(formSrc).toMatch(
      /extraFeeAmount: formData\.extraFeeAmount === "" \? undefined : Number\(formData\.extraFeeAmount\)/
    );
  });

  it("extraFeeLabel clears via `|| undefined` (mirrors the existing optional-string fields)", () => {
    expect(formSrc).toContain("extraFeeLabel: formData.extraFeeLabel || undefined");
  });

  it("cancellationPolicy clears via `|| undefined`", () => {
    expect(formSrc).toContain("cancellationPolicy: formData.cancellationPolicy || undefined");
  });

  it("the three fields ride the existing PUT/POST payload — no new fetch/endpoint added", () => {
    // Still a single POST/PUT to /api/campsites(/:id) as before this story.
    const putCalls = (formSrc.match(/\/api\/campsites/g) || []).length;
    expect(putCalls).toBeGreaterThan(0);
    expect(formSrc).not.toMatch(/\/api\/campsites\/[^"'`]*\/(fee|policy|cancellation)/);
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
