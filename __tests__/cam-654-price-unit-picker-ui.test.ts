/**
 * cam-654-price-unit-picker-ui.test.ts — CAM-654 (epic CAM-648, ADR-014)
 *
 * UI-layer proof for the host-facing pricing-unit picker in
 * `CampgroundForm.tsx` (camp-level, the one that actually charges) and
 * `spot-form-dialog.tsx` (spot-level, inert until spot selection ships).
 *
 * Layer: source-inspection (fs.readFileSync) — same "no jsdom render harness
 * in this repo" precedent as __tests__/cam-623-price-band-client-check.test.ts
 * and __tests__/cam-520-campsitetype-single-select.test.ts. The route-level
 * write-path proof lives in __tests__/cam-654-price-unit-write-path.test.ts.
 *
 * AC coverage matrix:
 *   AC-1  a NEW camp's form starts on PER_PERSON (ADR-014 §2 form default)
 *   AC-2  an EXISTING camp's edit form shows its real stored value
 *         (round-trip — never re-defaulted to PER_PERSON on edit)
 *   AC-3  the picker shows which option is active without colour alone
 *         (filled/unfilled dot SHAPE, not just a background colour class)
 *   AC-4  all copy comes from locales/translations.json (TH/EN), no hardcoded
 *         string, no em-dash
 *   AC-5  the spot-level picker is wired the same way (Select, PER_PERSON default N/A —
 *         inert field, ADR-014 §2)
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import translations from "../locales/translations.json";

const en = (translations as any).en;
const th = (translations as any).th;

const formSrc = fs.readFileSync(path.join(process.cwd(), "components", "CampgroundForm.tsx"), "utf8");
const spotDialogSrc = fs.readFileSync(path.join(process.cwd(), "components", "spot-form-dialog.tsx"), "utf8");

// ---------------------------------------------------------------------------
// locales — the 3 new copy keys exist in BOTH languages, no em-dash
// ---------------------------------------------------------------------------
describe("locales/translations.json — priceUnit copy (CAM-654)", () => {
  it("[en] carries priceUnitLabel/priceUnitPerPerson/priceUnitPerSite under newCampground", () => {
    expect(en.newCampground.priceUnitLabel).toBe("How is this price charged?");
    expect(en.newCampground.priceUnitPerPerson).toBe("Per person (multiplied by the number of guests)");
    expect(en.newCampground.priceUnitPerSite).toBe("Per site (one price, no matter how many people)");
  });

  it("[th] carries the exact Thai copy verbatim", () => {
    expect(th.newCampground.priceUnitLabel).toBe("ราคานี้คิดแบบไหน");
    expect(th.newCampground.priceUnitPerPerson).toBe("คิดต่อคน (คูณจำนวนผู้เข้าพัก)");
    expect(th.newCampground.priceUnitPerSite).toBe("คิดต่อจุด (ราคาเดียว ไม่ว่าจะมากี่คน)");
  });

  it("[teeth] no em-dash separator in either language's new copy", () => {
    for (const value of [
      en.newCampground.priceUnitLabel, en.newCampground.priceUnitPerPerson, en.newCampground.priceUnitPerSite,
      th.newCampground.priceUnitLabel, th.newCampground.priceUnitPerPerson, th.newCampground.priceUnitPerSite,
    ]) {
      expect(value.includes("—")).toBe(false); // em-dash U+2014
    }
  });
});

// ---------------------------------------------------------------------------
// AC-1/AC-2 — CampgroundForm defaults: create=PER_PERSON, edit=real stored
// value (fallback PER_SITE, never re-defaulted to PER_PERSON)
// ---------------------------------------------------------------------------
describe("CampgroundForm — priceUnit defaults (AC-1/AC-2, ADR-014 §2)", () => {
  it('[create] the form state initializer defaults priceUnit to "PER_PERSON"', () => {
    expect(formSrc).toContain('priceUnit: "PER_PERSON" as string,');
  });

  it('[edit] the initialData effect reads the real stored value, falling back to "PER_SITE" (the DB column default) — never PER_PERSON', () => {
    expect(formSrc).toContain('priceUnit: initialData.priceUnit ?? "PER_SITE",');
  });

  it("submit payload carries the current formData.priceUnit through the `...formData` spread (no field explicitly dropped or overridden before submit)", () => {
    const payloadIdx = formSrc.indexOf("const campPayload: any = {");
    const payloadBlockEnd = formSrc.indexOf("\n            };", payloadIdx);
    const payloadBlock = formSrc.slice(payloadIdx, payloadBlockEnd);
    expect(payloadBlock).toContain("...formData");
    expect(payloadBlock).not.toMatch(/\bpriceUnit:/); // never re-set/overridden after the spread
  });
});

// ---------------------------------------------------------------------------
// AC-3 — a11y: the selected option is not colour-only (radio-dot SHAPE state)
// ---------------------------------------------------------------------------
describe("CampgroundForm — priceUnit picker a11y (AC-3, not colour alone)", () => {
  it("both options carry aria-pressed reflecting the live selection", () => {
    expect(formSrc).toContain('aria-pressed={formData.priceUnit === "PER_PERSON"}');
    expect(formSrc).toContain('aria-pressed={formData.priceUnit === "PER_SITE"}');
  });

  it("the selected option renders a filled dot (shape), the unselected one an empty ring — not colour alone", () => {
    // Each option's dot indicator is a radio-style filled-circle-on-select,
    // matching the pre-existing Ownership Type picker's a11y pattern (shape
    // carries state, not colour alone).
    expect(formSrc).toMatch(/\{formData\.priceUnit === "PER_PERSON" && \(\s*<div className="w-2\.5 h-2\.5 rounded-full bg-white" \/>/);
    expect(formSrc).toMatch(/\{formData\.priceUnit === "PER_SITE" && \(\s*<div className="w-2\.5 h-2\.5 rounded-full bg-white" \/>/);
    expect(formSrc).toContain('bg-transparent border-border');
  });

  it("has data-testid hooks on both options for QA", () => {
    expect(formSrc).toContain('data-testid="btn--campground-price-unit-per-person"');
    expect(formSrc).toContain('data-testid="btn--campground-price-unit-per-site"');
  });
});

// ---------------------------------------------------------------------------
// AC-4 — copy pulled from locales, never hardcoded (source-inspection form of
// the i18n check — CampgroundForm.tsx has plenty of pre-existing `t.` calls,
// so this asserts the SPECIFIC new keys are referenced, not a blanket
// no-Thai-literal scan (the file legitimately reads Thai strings from `t`)).
// ---------------------------------------------------------------------------
describe("CampgroundForm — priceUnit copy pulled from locales, not hardcoded (AC-4)", () => {
  it("references t.newCampground.priceUnitLabel / priceUnitPerPerson / priceUnitPerSite", () => {
    expect(formSrc).toContain("{t.newCampground.priceUnitLabel}");
    expect(formSrc).toContain("{t.newCampground.priceUnitPerPerson}");
    expect(formSrc).toContain("{t.newCampground.priceUnitPerSite}");
  });

  it("does not hardcode the English or Thai copy inline", () => {
    expect(formSrc).not.toContain("How is this price charged?");
    expect(formSrc).not.toContain("ราคานี้คิดแบบไหน");
  });
});

// ---------------------------------------------------------------------------
// AC-5 — spot-level picker (inert today), same locale keys reused (one
// source, no per-form duplicate string)
// ---------------------------------------------------------------------------
describe("spot-form-dialog — priceUnit picker (AC-5, ADR-014 §2, inert until spot selection ships)", () => {
  it("adds a priceUnit state defaulting to PER_SITE on both create and edit-with-no-stored-value", () => {
    expect(spotDialogSrc).toContain('useState<string>("PER_SITE")');
    expect(spotDialogSrc).toContain('setPriceUnit(spot.priceUnit ?? "PER_SITE")');
    expect(spotDialogSrc).toContain('setPriceUnit("PER_SITE")');
  });

  it("sends priceUnit in the submit body (always a real value, no clear path)", () => {
    const bodyIdx = spotDialogSrc.indexOf("const body = {");
    const bodyEnd = spotDialogSrc.indexOf("\n    };", bodyIdx);
    const body = spotDialogSrc.slice(bodyIdx, bodyEnd);
    expect(body).toContain("priceUnit,");
  });

  it("renders a Select control reusing the SAME shared newCampground copy keys (no duplicate string)", () => {
    expect(spotDialogSrc).toContain("{t.newCampground.priceUnitLabel}");
    expect(spotDialogSrc).toContain('<SelectItem value="PER_PERSON">{t.newCampground.priceUnitPerPerson}</SelectItem>');
    expect(spotDialogSrc).toContain('<SelectItem value="PER_SITE">{t.newCampground.priceUnitPerSite}</SelectItem>');
  });

  it('has a data-testid hook ("select--spot-price-unit") for QA', () => {
    expect(spotDialogSrc).toContain('data-testid="select--spot-price-unit"');
  });
});
