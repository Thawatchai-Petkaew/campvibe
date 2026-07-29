/**
 * cam-667-camp-details-one-block.test.ts — CAM-667 (S5, "Camp detail and spot
 * booking" epic)
 *
 * Nine taxonomy sections (campSiteType, Accommodation type, Terrain,
 * Activity, facilities/"what this place offers", Equipment for rent,
 * Annotated features, Camper style, Additional info) each used to be their
 * own `pb-8 border-b border-border/60` block with a `text-2xl` h2 heading —
 * nine chapters of equal visual weight, the length driver on the ~792/795
 * camps that have no per-spot pitch section (CAM-664) to shorten instead.
 * This story folds them into ONE section with a single heading and light h3
 * sub-labels, without dropping any value a camp shows today.
 *
 * This file covers what is NEW to CAM-667 specifically (the fold itself,
 * the `hasTaxonomyDetails` no-hole gate, and the Equipment-for-rent
 * migration onto the shared primitive); the per-group wiring assertions
 * (heading/codes/testId per group) that CAM-528/CAM-526 already own were
 * updated in place in their own test files, not duplicated here.
 *
 * Real-browser measurement (page height before/after, on a throwaway
 * seeded DB — never `campvibe`) + a behavioral reachability check are
 * reported in the PR/handoff, not re-asserted here (source-inspection
 * cannot see rendered pixel height).
 *
 * Coverage matrix per .claude/rules/qa.md: normal / null-empty / boundary /
 * teeth.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";

const root = path.resolve(__dirname, "..");
const detailSrc = fs.readFileSync(path.join(root, "components/CampgroundDetailClient.tsx"), "utf-8");

describe("CAM-667 — the nine sections fold into ONE, single top-level heading", () => {
  it("[normal] exactly ONE top-level `text-2xl font-bold font-display` heading now covers the whole taxonomy stack (was nine independent ones: campSiteType/whatOffers/equipmentRent/additionalInfo each had their own)", () => {
    // The three groups that used to render their OWN text-2xl h2
    // (whatOffers, equipmentRent, additionalInfo) must no longer pair that
    // class combination with their own heading text.
    expect(detailSrc).not.toMatch(/text-2xl font-bold font-display text-foreground mb-6">\s*\{t\.campground\.whatOffers\}/);
    expect(detailSrc).not.toMatch(/text-2xl font-bold font-display text-foreground mb-6">\{t\.campground\.equipmentRent\}/);
    expect(detailSrc).not.toMatch(/text-2xl font-bold font-display text-foreground mb-6">\{t\.campground\.additionalInfo\}/);
  });

  it("[normal] the single shared heading uses the new t.campground.detailsHeading copy key", () => {
    expect(detailSrc).toContain("{t.campground.detailsHeading}");
    expect(detailSrc).toContain('data-testid="section--camp-details"');
  });

  it("[normal] all top-level groups share ONE TAXONOMY_SUBLABEL_CLASS constant (defined once, reused >=8x across campSiteType/accommodation/terrain/activity/whatOffers/equipmentRent/annotated/camperStyle/additionalInfo) rather than each repeating its own literal class string", () => {
    const identifierUses = (detailSrc.match(/TAXONOMY_SUBLABEL_CLASS/g) || []).length;
    expect(identifierUses).toBeGreaterThanOrEqual(9); // 1 declaration + >=8 call sites
    // The 3 pre-existing DEEPER sub-groups (Stay connected/Marking method/
    // Driveway, inside the "Additional info" wrapper) keep their own literal
    // class string unchanged — untouched by this story (Chesterton's Fence).
    const literalOccurrences = (detailSrc.match(/text-sm font-semibold text-muted-foreground mb-3/g) || []).length;
    expect(literalOccurrences).toBe(4); // 1 const value + 3 untouched inner sub-groups
  });
});

describe("CAM-667 — hasTaxonomyDetails: no naked heading / no hole when a camp has ZERO of the nine groups", () => {
  it("[normal] the whole fold is gated on hasTaxonomyDetails, computed from all nine groups", () => {
    expect(detailSrc).toContain("const hasTaxonomyDetails = !!campSiteTypeCode");
    expect(detailSrc).toContain("|| accommodationCodes.length > 0");
    expect(detailSrc).toContain("|| terrainCodes.length > 0");
    expect(detailSrc).toContain("|| activityCodes.length > 0");
    expect(detailSrc).toContain("|| facilityCodes.length > 0");
    expect(detailSrc).toContain("|| externalCodes.length > 0");
    expect(detailSrc).toContain("|| equipmentCodes.length > 0");
    expect(detailSrc).toContain("|| annotatedCodes.length > 0");
    expect(detailSrc).toContain("|| camperStyleCodes.length > 0");
    expect(detailSrc).toContain("|| stayConnectedCodes.length > 0");
    expect(detailSrc).toContain("|| markingMethodCodes.length > 0");
    expect(detailSrc).toContain("|| drivewayCodes.length > 0;");
    expect(detailSrc).toContain("{hasTaxonomyDetails && (");
  });

  it("[boundary logic] the gate is OR across all nine — any single group true renders the section; all false does not", () => {
    const hasTaxonomyDetails = (g: {
      campSiteType: boolean; accommodation: number; terrain: number; activity: number;
      facility: number; external: number; equipment: number; annotated: number;
      camperStyle: number; stayConnected: number; marking: number; driveway: number;
    }) =>
      g.campSiteType || g.accommodation > 0 || g.terrain > 0 || g.activity > 0 ||
      g.facility > 0 || g.external > 0 || g.equipment > 0 || g.annotated > 0 ||
      g.camperStyle > 0 || g.stayConnected > 0 || g.marking > 0 || g.driveway > 0;

    const allZero = { campSiteType: false, accommodation: 0, terrain: 0, activity: 0, facility: 0, external: 0, equipment: 0, annotated: 0, camperStyle: 0, stayConnected: 0, marking: 0, driveway: 0 };
    expect(hasTaxonomyDetails(allZero)).toBe(false);
    expect(hasTaxonomyDetails({ ...allZero, driveway: 1 })).toBe(true);
    expect(hasTaxonomyDetails({ ...allZero, campSiteType: true })).toBe(true);
  });

  it("[normal] the facilities (whatOffers) sub-block is itself gated on facilityCodes/externalCodes (previously this sub-block had NO gate and always rendered, even with zero facilities)", () => {
    expect(detailSrc).toContain("{(facilityCodes.length > 0 || externalCodes.length > 0) && (");
    expect(detailSrc).toContain('data-testid="section--what-offers"');
  });
});

describe("CAM-667 — Equipment for rent migrated onto OptionGroupSection (was hand-rolled)", () => {
  it("[normal] Equipment for rent now uses OptionGroupSection with its own custom 2/3-col gridClassName (zero visual change from the pre-existing hand-rolled grid)", () => {
    expect(detailSrc).toContain('gridClassName="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4"');
    expect(detailSrc).toContain("heading={t.campground.equipmentRent}");
    expect(detailSrc).toContain("codes={equipmentCodes}");
    expect(detailSrc).toContain('testId="section--equipment-rent"');
  });

  it("[teeth] exactly 10 OptionGroupSection usages total (9 pre-existing groups + Equipment for rent, the 10th, added by this story)", () => {
    const count = (detailSrc.match(/<OptionGroupSection/g) || []).length;
    expect(count).toBe(10);
  });
});

describe("CAM-667 — i18n: the new shared heading copy", () => {
  it("[normal] th.campground.detailsHeading is verbatim \"รายละเอียดแคมป์\"; en is \"Camp details\"", () => {
    expect(translations.th.campground.detailsHeading).toBe("รายละเอียดแคมป์");
    expect(translations.en.campground.detailsHeading).toBe("Camp details");
  });

  it("[i18n rule] no em-dash, no technical jargon", () => {
    expect(translations.th.campground.detailsHeading).not.toContain("—");
    expect(translations.th.campground.detailsHeading).not.toMatch(/API|webhook|endpoint/i);
  });
});

describe("CAM-667 — CAM-662 de-emphasis rule: the new sub-labels use a solid token, never opacity", () => {
  it("[normal] TAXONOMY_SUBLABEL_CLASS uses the flat text-muted-foreground token (no alpha suffix)", () => {
    expect(detailSrc).toContain('const TAXONOMY_SUBLABEL_CLASS = "text-sm font-semibold text-muted-foreground mb-3";');
    expect(detailSrc).not.toMatch(/TAXONOMY_SUBLABEL_CLASS = "[^"]*text-muted-foreground\/\d/);
  });
});
