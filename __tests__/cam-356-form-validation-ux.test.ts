/**
 * cam-356-form-validation-ux.test.ts — CAM-356
 *
 * Defect 1: `PUT /api/campsites/[id]` returns the zod field details in
 * `err.details` (see lib/api-utils.ts apiError - `validation.error.format()`
 * is exposed on every 4xx) but the old submit handler only read `err.error`
 * (the flat "Validation Error" string) and threw the details away. This adds
 * `flattenZodFieldErrors` / `getFieldLabel` / `buildValidationBannerMessage`
 * (exported, pure) that turn those details into (a) inline text under the
 * failing input, (b) a banner naming the failing fields by their real label,
 * and (c) a scroll/focus to the first failing section - generic for ANY
 * field, not a hardcoded list.
 *
 * Root-cause finding for the repro camp (ภูลมโลทุ่งหมอก,
 * 02628ed3-8ee1-4c14-a711-b0939f0e98ea, staging DB): fetching
 * GET /api/campsites/<id> and replaying the exact campPayload the form
 * builds through campSiteSchema.partial().safeParse(...) showed the ONLY
 * failing field is `groundType` - the schema expects
 * `z.record(string, number)` (an object) but the form sent
 * `JSON.stringify(formData.groundType)` (a string) on every save, for ANY
 * camp with a ground-type breakdown set (this camp has {"WOOD":6} from
 * seed data the host never touched). No amount of re-typing a field fixes
 * this - the bug is in the client's own serialization - so this story fixes
 * it directly (still within components/CampgroundForm.tsx, no schema/API
 * change): the form now sends the object as-is; the PUT/POST routes already
 * branch on `typeof data.groundType === 'string'` and stringify it for
 * storage, so the DB shape is unchanged.
 *
 * Defect 2: every section CardHeader carried `bg-muted/40` layered inside
 * the Card's own `py-(--card-spacing)` padding - since CardHeader sits
 * INSET from the Card's real top edge, its own rounded rect never reaches
 * the Card's edge, showing the Card's plain `bg-card` band above/around it
 * (the "double-tinted" band the owner reported). No other CardHeader in the
 * app tints itself this way (ListingCompletenessCard, dashboard cards all
 * render a plain CardHeader) - removing the tint restores one clean surface,
 * token-only (no new token, an existing class is simply dropped).
 *
 * Layer: unit (pure exported functions) + source-inspection (fs.readFileSync)
 * - same precedent as __tests__/cam-341-fee-policy-form.test.ts and
 * __tests__/cam-348-edit-form-images-prefill.test.ts; CampgroundForm.tsx has
 * no isolated render harness (node environment, no jsdom - see vitest.config.ts).
 *
 * AC coverage matrix:
 *   AC-1  zod details -> per-field inline error + banner naming real labels (TH/EN)
 *   AC-2  client pre-check reuses the SAME shared campSiteSchema (no re-declare)
 *   EC-1  unmapped/future field path falls back to the raw path, never throws
 *   EC-2  empty/no details -> generic banner copy, never the bare "Validation Error"
 *   EC-3  nested zod paths (e.g. an array index) roll up under their top-level field
 *   BR-1  groundType is sent as the record object the schema expects (Prove-It)
 *   AC-3  (defect 2) CardHeader no longer double-tints; token-only removal
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import translations from "../locales/translations.json";
import { campSiteSchema } from "@/lib/validations/campsite";
import {
  flattenZodFieldErrors,
  getFieldLabel,
  buildValidationBannerMessage,
} from "@/components/CampgroundForm";

const en = (translations as any).en;
const th = (translations as any).th;

const formSrc = fs.readFileSync(
  path.join(process.cwd(), "components", "CampgroundForm.tsx"),
  "utf8"
);

// ---------------------------------------------------------------------------
// flattenZodFieldErrors — AC-1, EC-3
// ---------------------------------------------------------------------------
describe("flattenZodFieldErrors (AC-1, EC-3)", () => {
  it("[normal] a top-level field error is grouped under its own key", () => {
    const formatted = {
      _errors: [],
      groundType: { _errors: ["Invalid input: expected record, received string"] },
    };
    expect(flattenZodFieldErrors(formatted)).toEqual({
      groundType: ["Invalid input: expected record, received string"],
    });
  });

  it("[EC-3] a nested path (array index) rolls up under the top-level field", () => {
    const formatted = {
      _errors: [],
      images: {
        _errors: [],
        "1": { _errors: ["Invalid url"] },
      },
    };
    expect(flattenZodFieldErrors(formatted)).toEqual({
      images: ["Invalid url"],
    });
  });

  it("multiple messages on the same field are concatenated, not overwritten", () => {
    const formatted = {
      _errors: [],
      extraFeeLabel: { _errors: ["too long", "bad format"] },
    };
    expect(flattenZodFieldErrors(formatted)).toEqual({
      extraFeeLabel: ["too long", "bad format"],
    });
  });

  it("[null/empty] undefined/null/non-object input never throws and returns {}", () => {
    expect(flattenZodFieldErrors(undefined)).toEqual({});
    expect(flattenZodFieldErrors(null)).toEqual({});
    expect(flattenZodFieldErrors("Validation Error")).toEqual({});
    expect(flattenZodFieldErrors(42)).toEqual({});
  });

  it("an object-level _errors entry (no field key) is not surfaced as a field", () => {
    const formatted = { _errors: ["form-level failure"] };
    expect(flattenZodFieldErrors(formatted)).toEqual({});
  });

  it("a real campSiteSchema failure (groundType shape mismatch) flattens correctly (Prove-It)", () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: "test",
      groundType: JSON.stringify({ WOOD: 6 }),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodFieldErrors(result.error.format());
      expect(Object.keys(errors)).toEqual(["groundType"]);
      expect(errors.groundType[0]).toMatch(/record/i);
    }
  });
});

// ---------------------------------------------------------------------------
// getFieldLabel — AC-1, EC-1
// ---------------------------------------------------------------------------
describe("getFieldLabel (AC-1, EC-1)", () => {
  it("[normal] a mapped field resolves to the SAME label already shown on its input (TH)", () => {
    expect(getFieldLabel(th, "phone")).toBe(th.newCampground.phoneNumber);
    expect(getFieldLabel(th, "latitude")).toBe(th.newCampground.latitude);
    expect(getFieldLabel(th, "groundType")).toBe(th.newCampground.groundType);
    expect(getFieldLabel(th, "cancellationPolicy")).toBe(th.campground.cancellationPolicy.title);
  });

  it("[normal] a mapped field resolves correctly in EN too", () => {
    expect(getFieldLabel(en, "phone")).toBe(en.newCampground.phoneNumber);
    expect(getFieldLabel(en, "images")).toBe(en.newCampground.photos);
  });

  it("[EC-1] an unmapped/future field name falls back to the raw path, never throws", () => {
    expect(getFieldLabel(th, "someBrandNewField")).toBe("someBrandNewField");
    expect(getFieldLabel(en, "operatorId")).toBe("operatorId");
  });

  // CAM-515 (S3) — the FIRST new MasterData group's FIELD_LABEL_RESOLVERS
  // entry, exercised through the real exported fn (not a source regex) —
  // proves the map entry actually resolves, in both languages.
  it("[normal] annotatedFeatures resolves to the SAME 'Annotated features' group-heading label the amenities card renders (TH + EN)", () => {
    expect(getFieldLabel(th, "annotatedFeatures")).toBe(th.filter["Annotated features"]);
    expect(getFieldLabel(en, "annotatedFeatures")).toBe(en.filter["Annotated features"]);
  });

  // CAM-516 (S4) — the SECOND new MasterData group's FIELD_LABEL_RESOLVERS entry.
  it("[normal] camperStyle resolves to the SAME 'Camper style' group-heading label the amenities card renders (TH + EN)", () => {
    expect(getFieldLabel(th, "camperStyle")).toBe(th.filter["Camper style"]);
    expect(getFieldLabel(en, "camperStyle")).toBe(en.filter["Camper style"]);
  });
});

// ---------------------------------------------------------------------------
// CAM-515 (S3) — campSiteSchema.annotatedFeatures + the CampgroundForm.tsx
// source touchpoints (source-inspection, same precedent this file/CAM-341/
// CAM-348 already use for CampgroundForm — no jsdom render harness here).
// ---------------------------------------------------------------------------
describe("CAM-515 (S3) — Annotated features host-form wiring (AC-2, EC-2)", () => {
  it("[normal] campSiteSchema accepts an annotatedFeatures code array (host-form payload shape)", () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: "test",
      annotatedFeatures: ["ALCO", "FIRE"],
    });
    expect(result.success).toBe(true);
  });

  it("[normal] CampgroundForm.tsx source carries all 6 annotatedFeatures touchpoints (state field, renderOptionGroup call, edit-prefill _byGroup, payload line, FIELD_SECTION_ID map, publish-completeness Set)", () => {
    expect(formSrc).toMatch(/annotatedFeatures:\s*\[\]\s*as\s*string\[\]/);
    expect(formSrc).toContain(
      `renderOptionGroup(t.filter["Annotated features"], "Annotated features", "annotatedFeatures")`
    );
    expect(formSrc).toContain(`annotatedFeatures: _byGroup('Annotated features')`);
    expect(formSrc).toContain("annotatedFeatures: formData.annotatedFeatures,");
    expect(formSrc).toMatch(/annotatedFeatures:\s*"amenities"/);
    expect(formSrc).toContain("...formData.annotatedFeatures,");
  });
});

// ---------------------------------------------------------------------------
// CAM-516 (S4) — campSiteSchema.camperStyle + the CampgroundForm.tsx source
// touchpoints (source-inspection, same precedent as the CAM-515 block above).
// ---------------------------------------------------------------------------
describe("CAM-516 (S4) — Camper style host-form wiring (AC-2, EC-2)", () => {
  it("[normal] campSiteSchema accepts a camperStyle code array (host-form payload shape)", () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: "test",
      camperStyle: ["CHIC", "GENR"],
    });
    expect(result.success).toBe(true);
  });

  it("[normal] CampgroundForm.tsx source carries all 6 camperStyle touchpoints (state field, renderOptionGroup call, edit-prefill _byGroup, payload line, FIELD_SECTION_ID map, publish-completeness Set)", () => {
    expect(formSrc).toMatch(/camperStyle:\s*\[\]\s*as\s*string\[\]/);
    expect(formSrc).toContain(
      `renderOptionGroup(t.filter["Camper style"], "Camper style", "camperStyle")`
    );
    expect(formSrc).toContain(`camperStyle: _byGroup('Camper style')`);
    expect(formSrc).toContain("camperStyle: formData.camperStyle,");
    expect(formSrc).toMatch(/camperStyle:\s*"amenities"/);
    expect(formSrc).toContain("...formData.camperStyle,");
  });
});

// ---------------------------------------------------------------------------
// buildValidationBannerMessage — AC-1, EC-1, EC-2
// ---------------------------------------------------------------------------
describe("buildValidationBannerMessage (AC-1, EC-1, EC-2)", () => {
  it("[normal] composes the TH banner naming the real field labels, comma-joined", () => {
    const message = buildValidationBannerMessage(th, ["phone", "latitude"]);
    expect(message).toBe(
      th.newCampground.validationErrorBanner.replace(
        "{fields}",
        `${th.newCampground.phoneNumber}, ${th.newCampground.latitude}`
      )
    );
    // Matches the dispatch's example shape: "กรอกข้อมูลไม่ถูกต้อง: <label>, <label>"
    expect(message.startsWith("กรอกข้อมูลไม่ถูกต้อง:")).toBe(true);
  });

  it("[normal] composes the EN banner the same way", () => {
    const message = buildValidationBannerMessage(en, ["phone"]);
    expect(message).toBe(en.newCampground.validationErrorBanner.replace("{fields}", en.newCampground.phoneNumber));
  });

  it("[EC-2] zero fields falls back to the generic banner (never the bare 'Validation Error' string)", () => {
    expect(buildValidationBannerMessage(th, [])).toBe(th.newCampground.validationErrorGeneric);
    expect(buildValidationBannerMessage(th, [])).not.toBe("Validation Error");
  });

  it("[EC-1] an unmapped field name is listed once by its raw path, never crashes", () => {
    const message = buildValidationBannerMessage(th, ["nameThSlug"]);
    expect(message).toContain("nameThSlug");
  });
});

// ---------------------------------------------------------------------------
// BR-1 (Prove-It) — the actual repro-camp fix: groundType sent as an object,
// not a JSON string, so it satisfies the schema campSiteSchema already
// enforces (z.record(string, number)).
// ---------------------------------------------------------------------------
describe("BR-1: groundType payload matches the shared schema shape (Prove-It, repro camp)", () => {
  it("the OLD stringify-before-send shape fails campSiteSchema (documents the bug that shipped)", () => {
    const result = campSiteSchema.partial().safeParse({ groundType: JSON.stringify({ WOOD: 6 }) });
    expect(result.success).toBe(false);
  });

  it("the FIXED object shape (what the form now sends) passes campSiteSchema", () => {
    const result = campSiteSchema.partial().safeParse({ groundType: { WOOD: 6 } });
    expect(result.success).toBe(true);
  });

  it("the exact repro-camp value {WOOD:6} round-trips clean through the shared schema", () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: "ภูลมโลทุ่งหมอก",
      groundType: { WOOD: 6 },
    });
    expect(result.success).toBe(true);
  });

  it("the form no longer JSON.stringify's groundType before sending (regression guard)", () => {
    expect(formSrc).not.toContain(
      "groundType: Object.keys(formData.groundType).length > 0 ? JSON.stringify(formData.groundType) : undefined"
    );
    expect(formSrc).toContain(
      "groundType: Object.keys(formData.groundType).length > 0 ? formData.groundType : undefined"
    );
  });
});

// ---------------------------------------------------------------------------
// AC-2 — client pre-check reuses the shared schema (no round-trip needed,
// server stays authoritative per .claude/rules/ux.md rule 1)
// ---------------------------------------------------------------------------
describe("AC-2: client-side pre-check parity", () => {
  it("imports campSiteSchema from the shared validations module (does not re-declare it)", () => {
    // CAM-520: the import now also pulls CampSiteTypeEnum (single-select
    // fallback/default) alongside campSiteSchema — same shared module, no
    // re-declaration, so this checks for the module specifier + campSiteSchema
    // token rather than an exact-line match against the old solo import.
    expect(formSrc).toContain('from "@/lib/validations/campsite"');
    expect(formSrc).toMatch(/import \{[^}]*\bcampSiteSchema\b[^}]*\} from "@\/lib\/validations\/campsite"/);
  });

  it("handleSubmit runs campSiteSchema.partial().safeParse on the exact campPayload before fetch", () => {
    expect(formSrc).toContain("const clientCheck = campSiteSchema.partial().safeParse(campPayload);");
    expect(formSrc).toContain("if (!clientCheck.success) {");
  });

  it("a client pre-check failure never calls fetch (returns before the PUT/POST)", () => {
    const idx = formSrc.indexOf("const clientCheck = campSiteSchema.partial().safeParse(campPayload);");
    const nextReturn = formSrc.indexOf("return;", idx);
    const nextFetch = formSrc.indexOf("await fetch(url", idx);
    expect(idx).toBeGreaterThan(-1);
    expect(nextReturn).toBeGreaterThan(idx);
    expect(nextReturn).toBeLessThan(nextFetch);
  });
});

// ---------------------------------------------------------------------------
// AC-1 (server path) — the 400 response's err.details drives the same mapper
// ---------------------------------------------------------------------------
describe("AC-1: server 400 details wired through the same mapper (no round-trip re-parse)", () => {
  it("reads err.details from the 400 body instead of only err.error", () => {
    expect(formSrc).toContain("const errors = flattenZodFieldErrors(err.details);");
  });

  it("falls back to err.error (or the generic copy) only when there are no field-level details", () => {
    expect(formSrc).toContain(
      "setServerError(topFields.length > 0 ? buildValidationBannerMessage(t, topFields) : (err.error || t.newCampground.errorOccurred));"
    );
  });

  it("scrolls/focuses the first failing field's section on both the client and server paths", () => {
    const occurrences = formSrc.match(/scrollToFirstErrorField\(topFields\)/g) || [];
    expect(occurrences.length).toBe(2);
  });

  it("no hardcoded 'Failed to save' / 'Something went wrong' string remains (i18n)", () => {
    expect(formSrc).not.toContain('"Failed to save"');
    expect(formSrc).not.toContain('"Something went wrong. Please try again."');
  });
});

// ---------------------------------------------------------------------------
// Inline wiring spot-checks — the InputField error= slot reads fieldErrors too
// ---------------------------------------------------------------------------
describe("inline error wiring: InputField error= merges zErr(field) (AC-1)", () => {
  const FIELDS_WITH_INLINE_WIRING = [
    "nameTh", "nameEn", "videoUrl", "address", "latitude", "longitude",
    "phone", "lineId", "facebookUrl", "facebookMessageUrl", "tiktokUrl",
    "minimumAge", "partner", "nationalPark", "tags",
    "priceLow", "priceHigh", "extraFeeAmount", "extraFeeLabel",
    "maxGuestsPerDay", "maxTentsPerDay", "groundType",
    "checkInTime", "checkOutTime", "campSiteType", "ownershipType", "cancellationPolicy",
  ];

  FIELDS_WITH_INLINE_WIRING.forEach((field) => {
    it(`${field} reads zErr('${field}')`, () => {
      expect(formSrc).toContain(`zErr('${field}')`);
    });
  });
});

// ---------------------------------------------------------------------------
// Defect 2 — section CardHeader no longer double-tints (AC-3)
// ---------------------------------------------------------------------------
describe("AC-3 (defect 2): section CardHeader renders one clean surface", () => {
  it("no CardHeader carries bg-muted/40 anymore (the double-tint band)", () => {
    expect(formSrc).not.toContain("bg-muted/40 border-b border-border pb-4");
  });

  it("all 14 section headers keep the border-b divider (still visually separated, just not double-tinted)", () => {
    const matches = formSrc.match(/<CardHeader className="border-b border-border pb-4">/g) || [];
    expect(matches.length).toBe(14);
  });

  it("no new token/hex introduced by the fix (removal only, check:palette stays green)", () => {
    expect(formSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// Scroll/focus targets — every FIELD_SECTION_ID destination Card is focusable
// ---------------------------------------------------------------------------
describe("scroll/focus targets exist for every mapped section (AC-1 c)", () => {
  const SECTION_IDS = [
    "basic-info", "photos", "location", "contact-info", "additional-info",
    "amenities", "campground-type", "ownership", "price", "extra-fee",
    "cancellation-policy", "zones", "operations", "status-visibility",
  ];

  SECTION_IDS.forEach((id) => {
    it(`id="${id}" is present exactly once and is focusable (tabIndex={-1})`, () => {
      const idMatches = formSrc.match(new RegExp(`id="${id}"`, "g")) || [];
      expect(idMatches.length).toBe(1);
      const cardLine = formSrc
        .split("\n")
        .find((line) => line.includes(`id="${id}"`));
      expect(cardLine).toContain("tabIndex={-1}");
    });
  });
});

// ---------------------------------------------------------------------------
// i18n — new banner copy exists in both locales, no em-dash, has the {fields}
// placeholder, and never hardcodes a raw field key in the shipped copy.
// ---------------------------------------------------------------------------
describe("i18n: validationErrorBanner / validationErrorGeneric (both locales)", () => {
  it("both keys exist as non-empty strings in EN and TH", () => {
    expect(typeof en.newCampground.validationErrorBanner).toBe("string");
    expect(typeof th.newCampground.validationErrorBanner).toBe("string");
    expect(typeof en.newCampground.validationErrorGeneric).toBe("string");
    expect(typeof th.newCampground.validationErrorGeneric).toBe("string");
  });

  it("the banner copy carries a {fields} placeholder to interpolate", () => {
    expect(en.newCampground.validationErrorBanner).toContain("{fields}");
    expect(th.newCampground.validationErrorBanner).toContain("{fields}");
  });

  it("no em-dash separator in the new Thai copy", () => {
    expect(th.newCampground.validationErrorBanner).not.toContain("—");
    expect(th.newCampground.validationErrorGeneric).not.toContain("—");
  });

  it("th.newCampground.validationErrorBanner matches the dispatch's quoted example verbatim", () => {
    expect(th.newCampground.validationErrorBanner).toBe("กรอกข้อมูลไม่ถูกต้อง: {fields}");
  });
});
