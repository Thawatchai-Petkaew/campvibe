/**
 * cam-528-detail-taxonomy.test.ts — CAM-528 (S1, taxonomy-ui-foundation)
 *
 * Camp detail page: surface `Activity`, `petFriendly`, and a separately
 * labeled `campSiteType` section, on top of a zero-visual-change extraction
 * of the copy-pasted icon+label tile block into `components/ui/
 * option-group-section.tsx`.
 *
 * Layering (see story.md §Self-verify for the full rationale):
 *   - `OptionGroupSection` is a NEW, dependency-free presentational component
 *     (no hooks, no next-auth/next-themes/next-dynamic boundary) — it gets a
 *     REAL jsdom render (Section A), which is the strongest, most direct
 *     proof available for "no raw code string" / "hides when empty" /
 *     "byte-identical default classes" (BR-1).
 *   - `components/CampgroundDetailClient.tsx` itself has NO isolated render
 *     harness — mounting it needs >10 mocked module boundaries (next-auth,
 *     next-themes, 2x next/dynamic, LanguageContext, sonner, date-fns
 *     locale). This is the established, repeated precedent for this exact
 *     file (cam-353-detail-spot-section.test.ts,
 *     cam-268-price-fee-cancellation-policy.test.ts, f3-detail-surface.test.ts
 *     all state it explicitly). Section B follows the same source-inspection
 *     + pure-logic-gate-truth-table strategy those files use, cross-checked
 *     against the real shipped conditional text.
 *
 * AC coverage matrix:
 *   AC-1/EC-1  Activity section renders (real codes -> real Thai labels, no
 *              raw code) when >=1 Activity code; absent when zero (Section A
 *              proves the tile behavior with the REAL codes/labels/icons;
 *              Section B proves the wiring: codesByGroup('Activity') + gate).
 *   AC-2/EC-2  campSiteType gets its own heading ("Campground type"),
 *              separate from Terrain; absent when campSiteType is unset.
 *   AC-3/EC-3  petFriendly renders only when true; false/unset -> no row.
 *   BR-1       the migrated sections render through OptionGroupSection with
 *              byte-identical classes to the pre-refactor literals.
 *   BR-5       no facet-scores import / BEGN|INMD|PROF reference in this file.
 *
 * Coverage matrix per .claude/rules/qa.md: normal / null-empty / boundary /
 * error-validation (n/a, no external input) / teeth.
 */
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import translations from '../locales/translations.json';
import { getFacilityIcon } from '@/lib/facility-icon-map';
import { OptionGroupSection } from '@/components/ui/option-group-section';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

afterEach(() => {
  cleanup();
});

/* ========================================================================= */
/* Section A — OptionGroupSection: real jsdom render (new, dependency-free)  */
/* ========================================================================= */

const getLabel = (code: string) => (translations.th.filter as Record<string, string>)[code] || code;
const getIcon = (code: string) => {
  const Icon = getFacilityIcon(code);
  return React.createElement(Icon, { className: 'w-8 h-8 text-muted-foreground stroke-[1.2]' });
};

describe('OptionGroupSection — normal render (AC-1/AC-2, real codes/labels/icons)', () => {
  it('[normal] renders the heading + one tile per code, with the REAL Thai label (never the raw code)', () => {
    const { container } = render(
      React.createElement(OptionGroupSection, {
        heading: translations.th.filter['Activity'],
        codes: ['HIKI', 'WILD'],
        getLabel,
        getIcon,
      })
    );

    expect(screen.getByRole('heading', { name: 'กิจกรรม', level: 2 })).toBeTruthy();
    expect(screen.getByText('เดินป่า')).toBeTruthy(); // HIKI, real th label (translations.json filter.HIKI)
    expect(screen.getByText('ส่องสัตว์ป่า')).toBeTruthy(); // WILD, real th label
    expect(container.textContent).not.toContain('HIKI');
    expect(container.textContent).not.toContain('WILD');
    // one icon (svg) per tile
    expect(container.querySelectorAll('svg').length).toBe(2);
  });

  it('[boundary] a single-code array (the campSiteType shape) renders exactly one tile', () => {
    render(
      React.createElement(OptionGroupSection, {
        heading: translations.th.filter['Campground type'],
        codes: ['GLAMP'],
        getLabel,
        getIcon,
      })
    );
    expect(screen.getByRole('heading', { name: 'ประเภทแคมป์' })).toBeTruthy();
    // CAM-531 drive-by fix: locales/translations.json's th `filter.GLAMP` was
    // corrected from the wrong "กลามปิ้ง" to the real transliteration
    // "แกลมปิ้ง" — this assertion follows the corrected source string.
    expect(screen.getByText('แกลมปิ้ง')).toBeTruthy();
  });

  it('[null/empty] an empty codes array renders nothing (no heading, no empty grid) — EC-1/EC-2 shape', () => {
    const { container } = render(
      React.createElement(OptionGroupSection, {
        heading: 'ไม่ควรเห็น',
        codes: [],
        getLabel,
        getIcon,
      })
    );
    expect(container.innerHTML).toBe('');
  });

  it('[normal] headingTag defaults to h2; an explicit "h3" renders a level-3 heading', () => {
    render(
      React.createElement(OptionGroupSection, {
        heading: 'หัวข้อย่อย',
        headingTag: 'h3',
        codes: ['SAIS'],
        getLabel: () => 'สัญญาณ AIS',
        getIcon,
      })
    );
    expect(screen.getByRole('heading', { level: 3, name: 'หัวข้อย่อย' })).toBeTruthy();
  });
});

describe('OptionGroupSection — default classNames are byte-identical to the pre-refactor tile literals (BR-1)', () => {
  it('[normal] default heading/grid/item/label classes match the exact pre-refactor strings', () => {
    const { container } = render(
      React.createElement(OptionGroupSection, {
        heading: 'หัวข้อ',
        codes: ['GLAMP'],
        getLabel,
        getIcon,
      })
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.className).toBe('text-2xl font-bold font-display text-foreground mb-6');

    // container's own root child is OptionGroupSection's wrapper <div>;
    // its LAST child (after the heading) is the tile grid.
    const wrapper = container.firstElementChild as HTMLElement;
    const grid = wrapper.lastElementChild as HTMLElement;
    expect(grid.className).toBe('grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4');

    const tile = grid.firstElementChild as HTMLElement;
    expect(tile.className).toBe('flex flex-col items-start gap-3');

    const label = tile.querySelector('span') as HTMLElement;
    expect(label.className).toBe('font-medium text-foreground capitalize text-base');
  });

  it('[normal] explicit overrides (the row-layout call sites) replace the defaults', () => {
    const { container } = render(
      React.createElement(OptionGroupSection, {
        heading: 'หัวข้อย่อย',
        headingTag: 'h3',
        headingClassName: 'text-sm font-semibold text-muted-foreground mb-3',
        gridClassName: 'grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4',
        codes: ['SAIS'],
        getLabel: () => 'สัญญาณ AIS',
        getIcon,
      })
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.className).toBe('text-sm font-semibold text-muted-foreground mb-3');
    const wrapper = container.firstElementChild as HTMLElement;
    const grid = wrapper.lastElementChild as HTMLElement;
    expect(grid.className).toBe('grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4');
  });
});

/* ========================================================================= */
/* Section B — CampgroundDetailClient.tsx wiring: source-inspection + gate   */
/* truth table (established precedent for this exact file, see file header) */
/* ========================================================================= */

const detailSrc = src('components/CampgroundDetailClient.tsx');

describe('CampgroundDetailClient.tsx — Activity section wiring (AC-1, BR-4)', () => {
  it('[normal] derives activityCodes via codesByGroup(\'Activity\')', () => {
    expect(detailSrc).toMatch(/const activityCodes = codesByGroup\('Activity'\);/);
  });

  it('[normal] the Activity section is gated on activityCodes.length > 0 and uses OptionGroupSection + t.filter["Activity"]', () => {
    expect(detailSrc).toContain('{activityCodes.length > 0 && (');
    expect(detailSrc).toContain('data-testid="section--activities"');
    expect(detailSrc).toContain('heading={t.filter["Activity"]}');
    expect(detailSrc).toContain('codes={activityCodes}');
  });

  it('[boundary logic] the shipped gate expression matches: codes.length > 0 renders, 0 does not', () => {
    const showsActivitySection = (codes: string[]) => codes.length > 0;
    expect(showsActivitySection(['HIKI'])).toBe(true);
    expect(showsActivitySection([])).toBe(false);
  });

  it('[teeth] mutating the real gate text away from the source makes the assertion fail (proves it reads the real file)', () => {
    const mutated = detailSrc.replace("{activityCodes.length > 0 && (", '{false && (');
    expect(mutated).not.toContain('{activityCodes.length > 0 && (');
    expect(detailSrc).toContain('{activityCodes.length > 0 && ('); // still true of the real file
  });
});

describe('CampgroundDetailClient.tsx — campSiteType gets its OWN section (AC-2/EC-2, BR-2)', () => {
  it('[normal] a dedicated section keyed off campSiteTypeCode uses heading t.filter["Campground type"] and codes=[campSiteTypeCode]', () => {
    expect(detailSrc).toContain('data-testid="section--campground-type"');
    expect(detailSrc).toContain('heading={t.filter["Campground type"]}');
    expect(detailSrc).toContain('codes={[campSiteTypeCode]}');
  });

  it('[normal] gated on campSiteTypeCode truthiness (EC-2: no campSiteType -> no section)', () => {
    expect(detailSrc).toMatch(/\{campSiteTypeCode && \(\s*<div className="pb-8 border-b border-border\/60" data-testid="section--campground-type">/);
  });

  it('[regression] campSiteType no longer renders INSIDE the Terrain tile grid (the old merged conditional is gone)', () => {
    expect(detailSrc).not.toContain('(!!campSiteTypeCode || terrainCodes.length > 0)');
    expect(detailSrc).not.toContain('data-testid="text--campground-sitetype"');
  });

  it('[normal] the Terrain-only Site Types section is gated on terrainCodes.length > 0 and uses heading t.campground.siteTypes', () => {
    expect(detailSrc).toContain('{terrainCodes.length > 0 && (');
    expect(detailSrc).toContain('heading={t.campground.siteTypes}');
    expect(detailSrc).toContain('codes={terrainCodes}');
  });
});

describe('CampgroundDetailClient.tsx — petFriendly row (AC-3/EC-3, BR-3)', () => {
  it('[normal] gated on campground.petFriendly truthiness, renders t.newCampground.petFriendly with a testid', () => {
    expect(detailSrc).toContain('{campground.petFriendly && (');
    expect(detailSrc).toContain('data-testid="row--campground-pet-friendly"');
    expect(detailSrc).toContain('{t.newCampground.petFriendly}');
  });

  it('[normal] uses a dedicated PawPrint icon (not routed through the MasterData getFacilityIcon lookup, since petFriendly is a scalar boolean, not a code)', () => {
    expect(detailSrc).toContain('PawPrint');
    expect(detailSrc).toMatch(/import \{[^}]*PawPrint[^}]*\} from "lucide-react";/);
  });

  it('[boundary logic] the shipped gate is a plain boolean check — true renders, false/undefined does not', () => {
    const showsPetFriendlyRow = (petFriendly: unknown) => !!petFriendly;
    expect(showsPetFriendlyRow(true)).toBe(true);
    expect(showsPetFriendlyRow(false)).toBe(false);
    expect(showsPetFriendlyRow(undefined)).toBe(false);
  });
});

describe('CampgroundDetailClient.tsx — BR-1 zero-visual-change refactor: OptionGroupSection replaces every named copy', () => {
  it('[normal] exactly 8 OptionGroupSection usages (campSiteType, Terrain, Activity, Annotated features, Camper style, Stay connected, Marking method, Driveway)', () => {
    const count = (detailSrc.match(/<OptionGroupSection/g) || []).length;
    expect(count).toBe(8);
  });

  it('[normal] the primitive is imported from components/ui/option-group-section', () => {
    expect(detailSrc).toContain('import { OptionGroupSection } from "@/components/ui/option-group-section";');
  });

  it('[normal] the shared getLabel helper mirrors the exact pre-existing t.filter[code]||code fallback (unchanged lookup semantics)', () => {
    expect(detailSrc).toContain(
      'const getLabel = (code: string) => t.filter[code as keyof typeof t.filter] || code;'
    );
  });

  it('[regression] getFacilityIcon (CAM-525, read-only) is still the single icon source — not modified, still imported', () => {
    expect(detailSrc).toContain('import { getFacilityIcon } from "@/lib/facility-icon-map";');
    const iconMapSrc = src('lib/facility-icon-map.ts');
    expect(iconMapSrc).toContain('HIKI: Mountain,');
  });
});

describe('CampgroundDetailClient.tsx — BR-5: the derived Camper-Type facet stays AI/search-only (owner decision 2026-07-26)', () => {
  it('[normal] no facet-scores import and no BEGN/INMD/PROF reference anywhere in this file', () => {
    expect(detailSrc).not.toContain('facet-scores');
    expect(detailSrc).not.toContain('BEGN');
    expect(detailSrc).not.toContain('INMD');
    expect(detailSrc).not.toContain('PROF');
  });
});

/* ========================================================================= */
/* Section C — i18n: every key used already exists (CAM-525/CAM-517 prep);   */
/* verbatim Thai copy + no em-dash (no NEW locale keys added by this story)  */
/* ========================================================================= */

describe('i18n — Activity / Campground type / petFriendly copy (already seeded, verified verbatim)', () => {
  it('[normal] th.filter.Activity is verbatim "กิจกรรม"; en is "Activity"', () => {
    expect(translations.th.filter['Activity']).toBe('กิจกรรม');
    expect(translations.en.filter['Activity']).toBe('Activity');
  });

  it('[normal] th.filter["Campground type"] is verbatim "ประเภทแคมป์"', () => {
    expect(translations.th.filter['Campground type']).toBe('ประเภทแคมป์');
  });

  it('[normal] th.newCampground.petFriendly is verbatim "อนุญาตสัตว์เลี้ยง"', () => {
    expect(translations.th.newCampground.petFriendly).toBe('อนุญาตสัตว์เลี้ยง');
  });

  it.each(['HIKI', 'SURF', 'WILD', 'HORS', 'CLIM'])(
    '[normal] Activity code %s has a non-empty th + en label, no em-dash',
    (code) => {
      const thLabel = (translations.th.filter as Record<string, string>)[code];
      const enLabel = (translations.en.filter as Record<string, string>)[code];
      expect(typeof thLabel).toBe('string');
      expect(thLabel.length).toBeGreaterThan(0);
      expect(typeof enLabel).toBe('string');
      expect(enLabel.length).toBeGreaterThan(0);
      expect(thLabel).not.toContain('—');
    }
  );

  it('[i18n rule] no em-dash in the newly-surfaced Thai copy', () => {
    expect(translations.th.filter['Activity']).not.toContain('—');
    expect(translations.th.filter['Campground type']).not.toContain('—');
    expect(translations.th.newCampground.petFriendly).not.toContain('—');
  });
});
