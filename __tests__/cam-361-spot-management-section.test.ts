/**
 * cam-361-spot-management-section.test.ts — CAM-361
 *
 * Embeds the spot list + management surface (CAM-352) into the campsite
 * edit page, full-width, below the main form — grouped by zone with a
 * single-select FilterChip row. This suite covers what CAM-352's own
 * (retargeted) suite does not:
 *
 *   1. Extraction guard — both surfaces (the standalone /spots route AND
 *      CampgroundForm's edit page) import the SAME shared component; the
 *      /spots route is a thin shell (no duplicated list/dialog logic).
 *   2. Embedding gate — CampgroundForm only renders the section in edit
 *      mode with a real camp id; create mode renders nothing (AC).
 *   3. Zone-grouping + filter-chip source guards — FilterChip is reused
 *      exactly (variant="pill", no new primitive/token), single-select
 *      (one activeZone value, not a multi-select array).
 *   4. i18n — the new copy keys (`filterAllLabel` / `unassignedZoneLabel`)
 *      exist in both locales with the exact Thai copy from the ticket.
 *
 * Same node-env/no-jsdom constraint as the rest of this codebase's frontend
 * suites — source-inspection gives structural coverage; real behavioral
 * coverage of the pure grouping logic lives in
 * __tests__/cam-361-spot-zone-grouping.test.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import translations from '../locales/translations.json';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const sectionSrc = src('components/spot-management-section.tsx');
const spotsPageSrc = src('app/dashboard/campsites/[id]/spots/page.tsx');
const campgroundFormSrc = src('components/CampgroundForm.tsx');

describe('CAM-361 — extraction guard: both surfaces import the SAME shared component', () => {
  it('the standalone /spots route imports SpotManagementSection (thin shell, no duplicated logic)', () => {
    expect(spotsPageSrc).toContain(
      'import { SpotManagementSection } from "@/components/spot-management-section"'
    );
    expect(spotsPageSrc).toContain('<SpotManagementSection campSiteId={campSiteId} variant="page" />');
  });

  it('the /spots route no longer re-implements the fetch/dialog logic itself (thin shell)', () => {
    expect(spotsPageSrc).not.toContain('useMinimumLoading');
    expect(spotsPageSrc).not.toContain('SpotFormDialog');
    expect(spotsPageSrc).not.toContain('ConfirmDialog');
  });

  it("CampgroundForm (the campsite edit page) imports the SAME SpotManagementSection", () => {
    expect(campgroundFormSrc).toContain(
      'import { SpotManagementSection } from "@/components/spot-management-section"'
    );
  });

  it('the shared component itself exports SpotManagementSection with a page/embedded variant prop', () => {
    expect(sectionSrc).toContain('export function SpotManagementSection');
    expect(sectionSrc).toContain('variant: "page" | "embedded"');
  });
});

// CAM-363 RETARGET (honest note): CAM-363 unifies the Capacity card and this
// spot-management section into ONE mode-driven section. Two of this
// describe's original assertions pinned the CAM-361-era architecture and now
// read differently on purpose:
//   1. the embed still gates on `isEditing && initialData?.id`, but the JSX
//      now also carries the additive `hideCard` prop (nests inside the
//      unified Card instead of rendering its own).
//   2. the embed used to sit OUTSIDE the campsite <form> (this suite's
//      original rationale: no nested <form>). CAM-363 moves it INSIDE the
//      <form> instead, because the whole-camp inputs it now sits beside must
//      stay form-bound. This is still HTML-safe: SpotFormDialog/ConfirmDialog
//      render through Radix DialogPortal/AlertDialogPortal straight to
//      <body> (see components/ui/dialog.tsx, alert-dialog.tsx), so no <form>
//      is ever nested inside another <form> - see the CAM-363 type="button"
//      audit test file for the sibling half of this proof (every
//      non-portal-rendered control in spot-management-section.tsx is
//      explicitly type="button", so it can never submit the campsite form).
//   3. the "manage spots" link to the standalone /spots route is retired -
//      edit mode embeds the manager directly, so there is nothing left to
//      link to from here (everything is manageable from this one page).
describe('CAM-361/CAM-363 — embedding gate on the campsite edit page (edit mode only, real camp id)', () => {
  it('renders the section only when isEditing AND initialData?.id is present (create mode has no camp id yet)', () => {
    expect(campgroundFormSrc).toContain('{isEditing && initialData?.id && (');
    expect(campgroundFormSrc).toContain('<SpotManagementSection campSiteId={initialData.id} variant="embedded" hideCard />');
  });

  it('[CAM-363 retarget] sits INSIDE the campsite <form> (whole-camp inputs beside it must stay form-bound); still HTML-safe because the CRUD dialogs are portal-rendered', () => {
    const formCloseIndex = campgroundFormSrc.indexOf('</form>');
    const embedIndex = campgroundFormSrc.indexOf('<SpotManagementSection campSiteId={initialData.id}');
    expect(formCloseIndex).toBeGreaterThan(-1);
    expect(embedIndex).toBeGreaterThan(-1);
    expect(embedIndex).toBeLessThan(formCloseIndex);
  });

  it('[CAM-363 retarget] the standalone-route "manage spots" link is retired - edit mode embeds the manager directly instead', () => {
    expect(campgroundFormSrc).not.toContain('/dashboard/campsites/${initialData.id}/spots');
    expect(campgroundFormSrc).toContain('data-testid="btn--capacity-manage-spots"');
  });
});

describe('CAM-361 — embedded variant renders a Card-wrapped section (visual fit on the edit page)', () => {
  it('uses the Card/CardHeader/CardTitle/CardContent primitives (no hand-rolled card)', () => {
    expect(sectionSrc).toContain(
      'import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"'
    );
    expect(sectionSrc).toContain('data-testid="section--spots-management"');
  });
});

describe('CAM-361 — zone grouping + FilterChip source guards', () => {
  it('reuses the pure grouping helper (no parallel/inline grouping logic)', () => {
    expect(sectionSrc).toContain('import { groupSpotsByZone } from "@/lib/spot-zone-grouping"');
    expect(sectionSrc).toContain('groupSpotsByZone(spots ?? [])');
  });

  it('reuses FilterChip variant="pill" exactly — no new primitive, no new token', () => {
    expect(sectionSrc).toContain('import { FilterChip } from "@/components/ui/filter-chip"');
    expect(sectionSrc).toMatch(/<FilterChip\s*\n\s*variant="pill"/);
  });

  it('the filter is single-select: one activeZone string value, not a multi-select array', () => {
    expect(sectionSrc).toContain('useState<string>(ALL_ZONES_VALUE)');
    // Guard against regressing to a multi-select array (the pattern FilterModal
    // uses for its OWN multi-select filters, which is the wrong shape here).
    expect(sectionSrc).not.toContain('useState<string[]>');
  });

  it('renders one "all" chip plus one chip per distinct zone group', () => {
    expect(sectionSrc).toContain('data-testid="filter-chip--spot-zone-all"');
    expect(sectionSrc).toContain('data-testid={`filter-chip--spot-zone-${index}`}');
    expect(sectionSrc).toContain('label={copy.filterAllLabel}');
    expect(sectionSrc).toContain('label={group.isUnassigned ? copy.unassignedZoneLabel : group.key}');
  });

  it('defensively resets the filter to "all" if the selected zone group disappears after a reload', () => {
    expect(sectionSrc).toContain('setActiveZone(ALL_ZONES_VALUE)');
  });
});

describe('CAM-361 — i18n: new copy keys exist in both locales with the exact Thai copy', () => {
  it('filterAllLabel — Thai copy is exactly ทั้งหมด verbatim', () => {
    expect(translations.th.spotManagement.filterAllLabel).toBe('ทั้งหมด');
    expect(translations.en.spotManagement.filterAllLabel).toBeTruthy();
  });

  it('unassignedZoneLabel — Thai copy is exactly ไม่ระบุโซน verbatim', () => {
    expect(translations.th.spotManagement.unassignedZoneLabel).toBe('ไม่ระบุโซน');
    expect(translations.en.spotManagement.unassignedZoneLabel).toBeTruthy();
  });

  it('neither new Thai string uses an em-dash separator', () => {
    expect(translations.th.spotManagement.filterAllLabel).not.toContain('—');
    expect(translations.th.spotManagement.unassignedZoneLabel).not.toContain('—');
  });
});
