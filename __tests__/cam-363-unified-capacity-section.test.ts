/**
 * cam-363-unified-capacity-section.test.ts — CAM-363: unify the Capacity &
 * Ground Type card with the CAM-361 spot section into ONE mode-driven
 * section on the campsite edit page.
 *
 * Owner direction: the host picks the mode FIRST (the existing CAM-351 mode
 * chooser, reused verbatim), and the content below switches - whole-camp
 * inputs stay form-bound; per-spot mode embeds the CAM-361 spot manager
 * directly (grouped list + filter chips + CRUD) plus the derived-total
 * display. The OLD standalone sidebar Capacity card is fully removed from
 * its old position - no duplicate capacity UI anywhere on the page.
 *
 * Same node-env/no-jsdom constraint as the rest of this codebase's frontend
 * suites (see cam-351-capacity-mode.test.ts's header) - source-inspection
 * gives structural coverage.
 *
 * Structure shipped: IN-FORM EMBEDDING (not the split-Card alternative). The
 * unified section (mode chooser + whole-camp inputs + embedded per-spot
 * manager) lives fully INSIDE the campsite <form>, because the whole-camp
 * inputs beside it must stay form-bound. This is HTML-safe because every
 * <form> the embedded spot manager can open (SpotFormDialog, and
 * ConfirmDialog's underlying AlertDialog) renders through a Radix Portal
 * straight to <body> - see components/ui/dialog.tsx / alert-dialog.tsx - so
 * no <form> ends up nested inside this <form>. The other half of that safety
 * proof: every interactive control INSIDE spot-management-section.tsx that
 * is NOT portal-rendered (edit / delete / retry / add) must carry an
 * explicit type="button", or it would inherit the native <button> default
 * (type="submit") and silently submit the campsite form on click - Group C
 * below is the audit guard for that.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import translations from '../locales/translations.json';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const formSrc = src('components/CampgroundForm.tsx');
const sectionSrc = src('components/spot-management-section.tsx');

// ===========================================================================
// Group A — the OLD standalone Capacity card is fully removed (owner
// reinforcement: no duplicate capacity UI may remain anywhere on the page).
// ===========================================================================

describe('CAM-363 — the old standalone Capacity card no longer renders at its old location', () => {
  it('exactly ONE id="zones" Card exists in the whole file (no duplicate capacity section)', () => {
    const matches = formSrc.match(/id="zones"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('exactly ONE CardTitle renders {t.newCampground.capacity} (the old sidebar card is gone, not duplicated)', () => {
    const matches = formSrc.match(/\{t\.newCampground\.capacity\}/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('the retired per-mode Card is now the single unified section, carrying its own test id', () => {
    expect(formSrc).toContain('data-testid="section--capacity-unified"');
    // exactly one occurrence - not present at a second (old) location
    const matches = formSrc.match(/data-testid="section--capacity-unified"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('the old post-form standalone CAM-361 embed block (no hideCard, outside the form) is gone', () => {
    expect(formSrc).not.toContain('<SpotManagementSection campSiteId={initialData.id} variant="embedded" />');
  });
});

// ===========================================================================
// Group B — mode-first, content switches (the owner's core requirement)
// ===========================================================================

describe('CAM-363 — ONE section, mode chooser first, content switches below it', () => {
  it('the mode chooser (CAM-351, reused verbatim) renders inside the unified section', () => {
    const unifiedStart = formSrc.indexOf('data-testid="section--capacity-unified"');
    const chooserIndex = formSrc.indexOf('data-testid="btn--capacity-mode-whole-camp"');
    const perSpotChoiceIndex = formSrc.indexOf('data-testid="btn--capacity-mode-per-spot"');
    expect(unifiedStart).toBeGreaterThan(-1);
    expect(chooserIndex).toBeGreaterThan(unifiedStart);
    expect(perSpotChoiceIndex).toBeGreaterThan(unifiedStart);
  });

  it('WHOLE-CAMP mode content (manual inputs) renders only when !formData.useSpotView', () => {
    expect(formSrc).toContain('{!formData.useSpotView && (');
    expect(formSrc).toContain('label={t.newCampground.maxGuestsPerDay}');
    expect(formSrc).toContain('label={t.newCampground.maxTentsPerDay}');
  });

  it('PER-SPOT mode content (derived display + embedded spot manager) renders only when formData.useSpotView', () => {
    expect(formSrc).toContain('{formData.useSpotView && (');
    expect(formSrc).toContain('data-testid="section--capacity-per-spot-content"');
  });

  it('the embedded spot manager sits inside the per-spot content branch, edit mode with a real camp id only', () => {
    const perSpotContentIndex = formSrc.indexOf('data-testid="section--capacity-per-spot-content"');
    const embedGateIndex = formSrc.indexOf('{isEditing && initialData?.id && (', perSpotContentIndex);
    const embedIndex = formSrc.indexOf(
      '<SpotManagementSection campSiteId={initialData.id} variant="embedded" hideCard />',
      perSpotContentIndex
    );
    expect(perSpotContentIndex).toBeGreaterThan(-1);
    expect(embedGateIndex).toBeGreaterThan(perSpotContentIndex);
    expect(embedIndex).toBeGreaterThan(embedGateIndex);
  });

  it('the derived-total / empty-state / switch-hint display is preserved unchanged (spotCount-gated, CAM-351)', () => {
    expect(formSrc).toContain('data-testid="text--capacity-derived-total"');
    expect(formSrc).toContain('data-testid="text--capacity-derived-empty"');
    expect(formSrc).toContain('data-testid="text--capacity-switch-to-per-spot-hint"');
    expect(formSrc).toContain(
      'const derivedGuestTotal: number = spotCount > 0 ? (initialData?.maxGuestsPerDay ?? 0) : 0;'
    );
  });

  it('the switch-to-whole-camp warning banner is preserved unchanged (session-only, CAM-351)', () => {
    expect(formSrc).toContain('data-testid="banner--capacity-switch-to-whole-warning"');
    expect(formSrc).toContain('{justSwitchedToWholeCamp && spotCount > 0 && (');
  });
});

// ===========================================================================
// Group C — type="button" audit (the form-submit-bleed trap)
// ===========================================================================

describe('CAM-363 — type="button" audit on spot-management-section.tsx (form-submit-bleed guard)', () => {
  it('every <Button in the file carries an explicit type="button" (none inherit the native submit default)', () => {
    const buttonOpens = [...sectionSrc.matchAll(/<Button\b[^>]*>/g)];
    expect(buttonOpens.length).toBeGreaterThan(0);
    for (const match of buttonOpens) {
      expect(match[0]).toMatch(/type="button"/);
    }
  });

  it('FilterChip pill controls stay type="button" internally (unaffected reuse, verified in the #373 review)', () => {
    const filterChipSrc = src('components/ui/filter-chip.tsx');
    const buttonOpens = [...filterChipSrc.matchAll(/<button\b[\s\S]{0,40}/g)];
    expect(buttonOpens.length).toBeGreaterThan(0);
    for (const match of buttonOpens) {
      expect(match[0]).toContain('type="button"');
    }
  });

  it('SpotFormDialog + ConfirmDialog render their own <form>/actions through a Radix Portal (safe to embed in-form)', () => {
    const dialogSrc = src('components/ui/dialog.tsx');
    const alertDialogSrc = src('components/ui/alert-dialog.tsx');
    expect(dialogSrc).toContain('DialogPrimitive.Portal');
    expect(alertDialogSrc).toContain('AlertDialogPrimitive.Portal');
  });
});

// ===========================================================================
// Group D — the additive hideCard prop (embedded variant only)
// ===========================================================================

describe('CAM-363 — SpotManagementSection gains an additive hideCard prop', () => {
  it('hideCard is optional, defaults to false (the standalone /spots page + un-hidden embedded stay unaffected)', () => {
    expect(sectionSrc).toContain('hideCard?: boolean;');
    expect(sectionSrc).toContain(
      'export function SpotManagementSection({ campSiteId, variant, hideCard = false }: SpotManagementSectionProps) {'
    );
  });

  it('hideCard only changes rendering for variant==="embedded" (page variant untouched)', () => {
    expect(sectionSrc).toContain('if (variant === "embedded" && hideCard) {');
    expect(sectionSrc).toContain('if (variant === "embedded") {');
  });

  it('the /spots standalone route still calls variant="page" only (byte-identical behavior)', () => {
    const spotsPageSrc = src('app/dashboard/campsites/[id]/spots/page.tsx');
    expect(spotsPageSrc).toContain('<SpotManagementSection campSiteId={campSiteId} variant="page" />');
    expect(spotsPageSrc).not.toContain('hideCard');
  });

  it('the hideCard branch keeps the same section--spots-management test id (QA selector stability)', () => {
    const hideCardBranchStart = sectionSrc.indexOf('if (variant === "embedded" && hideCard) {');
    const nextBranchStart = sectionSrc.indexOf('if (variant === "embedded") {', hideCardBranchStart + 1);
    const branch = sectionSrc.slice(hideCardBranchStart, nextBranchStart);
    expect(branch).toContain('data-testid="section--spots-management"');
  });
});

// ===========================================================================
// Group E — never-invisible-with-no-path hint (whole-camp mode + live spots)
// ===========================================================================

describe('CAM-363 — whole-camp mode with lingering live spots shows a persistent hint', () => {
  it('renders only in whole-camp mode, with spots, and NOT in the same moment as the just-switched warning', () => {
    expect(formSrc).toContain(
      '{!formData.useSpotView && !justSwitchedToWholeCamp && spotCount > 0 && ('
    );
    expect(formSrc).toContain('data-testid="banner--capacity-whole-camp-has-spots-hint"');
  });

  it('Thai copy verbatim + {N} placeholder + no em-dash separator', () => {
    expect(translations.th.newCampground.capacityWholeCampHasSpotsHint).toBe(
      'มีจุดกางเต็นท์ {N} จุดอยู่ สลับเป็นรายจุดเพื่อจัดการ'
    );
    expect(translations.th.newCampground.capacityWholeCampHasSpotsHint).not.toContain('—');
    expect(translations.en.newCampground.capacityWholeCampHasSpotsHint).toBeTruthy();
  });

  it('the hint interpolates {N} the same way as the other capacity copy (String(spotCount))', () => {
    expect(formSrc).toContain(
      't.newCampground.capacityWholeCampHasSpotsHint.replace("{N}", String(spotCount))'
    );
  });
});

// ===========================================================================
// Group F — create mode (new camp, no id yet): mode chooser + whole-camp
// inputs render; per-spot content shows the CAM-351 save-first empty state.
// ===========================================================================

describe('CAM-363 — create mode (no camp id yet): save-first state, no embed attempted', () => {
  it('the embed is strictly gated on isEditing && initialData?.id - never attempted in create mode', () => {
    expect(formSrc).toContain('{isEditing && initialData?.id && (');
  });

  it('create mode + per-spot chosen shows the save-first prompt instead of the embed', () => {
    expect(formSrc).toContain('{!(isEditing && initialData?.id) && (');
    expect(formSrc).toContain('onClick={() => toast.error(t.newCampground.saveBeforeSpots)}');
  });

  it('useSpotView still defaults to false on a new camp (AC-1, unchanged)', () => {
    expect(formSrc).toContain('useSpotView: false,');
  });
});

// ===========================================================================
// Group G — #zones anchor survives the move (CAM-305 completeness deep-link)
// ===========================================================================

describe('CAM-363 — the #zones anchor lands on the unified section (CAM-305 link map)', () => {
  it('FIELD_SECTION_ID still maps the capacity fields to "zones"', () => {
    expect(formSrc).toContain(
      'maxGuestsPerDay: "zones", maxTentsPerDay: "zones", groundType: "zones", useSpotView: "zones",'
    );
  });

  it('id="zones" is on the unified Card (not on a since-removed sidebar card)', () => {
    const zonesIdIndex = formSrc.indexOf('id="zones"');
    const unifiedTestIdIndex = formSrc.indexOf('data-testid="section--capacity-unified"');
    expect(zonesIdIndex).toBeGreaterThan(-1);
    // both attributes belong to the same <Card ...> opening tag - the
    // distance between them is small (same element), not spread across
    // two different Card elements in the file.
    expect(Math.abs(zonesIdIndex - unifiedTestIdIndex)).toBeLessThan(300);
  });
});
