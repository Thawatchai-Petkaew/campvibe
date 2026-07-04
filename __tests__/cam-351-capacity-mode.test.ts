/**
 * cam-351-capacity-mode.test.ts — CAM-351: explicit capacity-mode chooser
 * (WHOLE-CAMP vs PER-SPOT) + the listing-completeness "zones" fairness fix.
 *
 * Layer: unit (lib/listing-completeness.ts truth table) + mocked-Prisma
 * integration (the completeness route forwarding the two new fields) +
 * source-inspection (fs.readFileSync) for CampgroundForm.tsx — same
 * precedent as __tests__/cam-341-fee-policy-form.test.ts / cam-356 (no jsdom
 * render harness in this repo's vitest config, node environment only).
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  new camp: mode chooser renders both choices, ทั้งลาน pre-selected
 *       (useSpotView defaults false).
 * AC-2  WHOLE-CAMP mode: manual maxGuestsPerDay input wired, no schema change.
 * AC-3  PER-SPOT + spots present: read-only derived total + note rendered.
 * AC-4  PER-SPOT + zero spots: empty-state copy rendered (never "0 คน").
 * AC-5  switch PER-SPOT -> WHOLE-CAMP with existing spots: warning rendered,
 *       spots preserved (no delete call anywhere in the form).
 * AC-6  switch WHOLE-CAMP -> PER-SPOT: hint rendered, manual field hidden.
 * AC-7  WHOLE-CAMP + maxGuestsPerDay stated + 0 spots: zones satisfied (fairness fix).
 * AC-8  PER-SPOT + spots >= 1: zones satisfied (unchanged CAM-304 path).
 * AC-9  existing per-spot camp loads with the mode mapped from the stored flag.
 * AC-11 WHOLE-CAMP + empty/0 maxGuestsPerDay: blocked save + Thai error under field.
 * BR-1  mode lives only in the existing useSpotView column (no new field/migration).
 * BR-5  zones truth table (4 combinations) + weight table still sums to 100.
 * BR-7  derived total + zones both exclude soft-deleted spots (delegated to
 *       lib/spot-aggregation.ts + spot.count({deletedAt:null}), already covered
 *       by cam-352-spot-aggregation-soft-delete.test.ts — not re-asserted here).
 * EC-1..EC-7 — see the story's Edge cases section; each is covered inline below.
 * AC-10/EC-7 — Do-NOT-touch regression guard: no availability/booking/filter
 *       file references useSpotView (unchanged-by-construction proof).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import translations from '../locales/translations.json';

import {
  computeListingCompleteness,
  LISTING_COMPLETENESS_WEIGHTS,
  type ListingCompletenessInput,
} from '@/lib/listing-completeness';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports (mirrors cam-304's route test setup)
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findUnique: vi.fn(),
    },
    spot: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { GET as completenessGET } from '@/app/api/campsites/[id]/completeness/route';

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440351';
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
const getReq = () => new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/completeness`);

function baseCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPSITE_ID,
    deletedAt: null,
    priceLow: null,
    isFree: false,
    extraFeeAmount: null,
    extraFeeLabel: null,
    cancellationPolicy: null,
    useSpotView: false,
    maxGuestsPerDay: null,
    ...overrides,
  };
}

function mockAllowed(campSite: ReturnType<typeof baseCampSite> = baseCampSite()) {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: campSite as never,
    session: { user: { id: 'host-1' } } as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Group A: BR-5 — zones fairness truth table (unit, real weight table)
// ===========================================================================

describe('computeListingCompleteness — CAM-351 BR-5 zones truth table', () => {
  const base: ListingCompletenessInput = {
    imageCount: 3,
    priceLow: 500,
    isFree: false,
    extraFeeAmount: null,
    extraFeeLabel: null,
    cancellationPolicy: 'MODERATE',
    spotCount: 0,
    optionsCount: 4,
    useSpotView: false,
    maxGuestsPerDay: null,
  };

  it('[AC-8] spot-mode with spots (spotCount >= 1) -> satisfied regardless of useSpotView/maxGuestsPerDay', () => {
    const result = computeListingCompleteness({ ...base, spotCount: 3, useSpotView: true, maxGuestsPerDay: null });
    expect(result.missing.some((m) => m.key === 'zones')).toBe(false);
  });

  it('[AC-7] whole-mode with a stated capacity (useSpotView=false, maxGuestsPerDay>=1) -> satisfied (the fairness fix)', () => {
    const result = computeListingCompleteness({ ...base, spotCount: 0, useSpotView: false, maxGuestsPerDay: 50 });
    expect(result.missing.some((m) => m.key === 'zones')).toBe(false);
  });

  it('[boundary] whole-mode WITHOUT a stated capacity (maxGuestsPerDay=null) -> unsatisfied', () => {
    const result = computeListingCompleteness({ ...base, spotCount: 0, useSpotView: false, maxGuestsPerDay: null });
    expect(result.missing.some((m) => m.key === 'zones')).toBe(true);
  });

  it('[AC-4/EC-2] spot-mode without spots (useSpotView=true, spotCount=0) -> unsatisfied even if maxGuestsPerDay is stale-populated', () => {
    const result = computeListingCompleteness({ ...base, spotCount: 0, useSpotView: true, maxGuestsPerDay: 50 });
    expect(result.missing.some((m) => m.key === 'zones')).toBe(true);
  });

  it('[boundary] maxGuestsPerDay = 0 in whole-mode does NOT satisfy zones (must be >= 1)', () => {
    const result = computeListingCompleteness({ ...base, spotCount: 0, useSpotView: false, maxGuestsPerDay: 0 });
    expect(result.missing.some((m) => m.key === 'zones')).toBe(true);
  });

  it('[boundary] maxGuestsPerDay = 1 in whole-mode DOES satisfy zones', () => {
    const result = computeListingCompleteness({ ...base, spotCount: 0, useSpotView: false, maxGuestsPerDay: 1 });
    expect(result.missing.some((m) => m.key === 'zones')).toBe(false);
  });

  it('the mode-neutral label replaces the old spot-only wording when zones is unsatisfied', () => {
    const result = computeListingCompleteness({ ...base, spotCount: 0, useSpotView: false, maxGuestsPerDay: null });
    const zonesItem = result.missing.find((m) => m.key === 'zones');
    expect(zonesItem?.label).toBe('ยังไม่ระบุความจุ (จำนวนรวม หรือจุดกางเต็นท์)');
    expect(zonesItem?.label).not.toBe('ยังไม่มีโซนหรือจุดกางเต็นท์');
  });

  it('BR-5: weight table still sums to exactly 100 (zones stays weight 10)', () => {
    const sum = LISTING_COMPLETENESS_WEIGHTS.reduce((acc, c) => acc + c.weight, 0);
    expect(sum).toBe(100);
    expect(LISTING_COMPLETENESS_WEIGHTS.find((c) => c.key === 'zones')?.weight).toBe(10);
  });
});

// ===========================================================================
// Group B: completeness route forwards useSpotView/maxGuestsPerDay (AC-7/AC-8)
// ===========================================================================

describe('GET /api/campsites/[id]/completeness — CAM-351 forwards the two new fields', () => {
  it('[AC-7] a WHOLE-CAMP camp with maxGuestsPerDay=50 and 0 spots -> zones counts as satisfied end-to-end', async () => {
    mockAllowed(baseCampSite({ priceLow: 500, cancellationPolicy: 'MODERATE', useSpotView: false, maxGuestsPerDay: 50 }));
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 2, options: 3 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.missing.some((m: { key: string }) => m.key === 'zones')).toBe(false);
  });

  it('[AC-8] a PER-SPOT camp with 1 non-deleted spot -> zones stays satisfied (unchanged path)', async () => {
    mockAllowed(baseCampSite({ priceLow: 500, cancellationPolicy: 'MODERATE', useSpotView: true, maxGuestsPerDay: 16 }));
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 2, options: 3 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.missing.some((m: { key: string }) => m.key === 'zones')).toBe(false);
  });

  it('a WHOLE-CAMP camp with NO stated capacity and 0 spots -> zones stays missing (no silent pass)', async () => {
    mockAllowed(baseCampSite({ useSpotView: false, maxGuestsPerDay: null }));
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 0, options: 0 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(body.missing.map((m: { key: string }) => m.key)).toContain('zones');
  });
});

// ===========================================================================
// Group C: CampgroundForm.tsx — source-inspection (mode chooser + states)
// ===========================================================================

const formSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/CampgroundForm.tsx'),
  'utf-8'
);

describe('CampgroundForm — AC-1: explicit mode chooser, WHOLE-CAMP pre-selected', () => {
  it('renders both choice buttons with the verbatim mode-question label', () => {
    expect(formSrc).toContain('data-testid="btn--capacity-mode-whole-camp"');
    expect(formSrc).toContain('data-testid="btn--capacity-mode-per-spot"');
    expect(formSrc).toContain('{t.newCampground.capacityModeQuestion}');
  });

  it('the whole-camp choice is selected by default (aria-pressed={!formData.useSpotView})', () => {
    expect(formSrc).toContain('aria-pressed={!formData.useSpotView}');
    expect(formSrc).toContain('aria-pressed={formData.useSpotView}');
  });

  it('useSpotView defaults to false in the create-form initial state (AC-1)', () => {
    expect(formSrc).toContain('useSpotView: false,');
  });

  it('no jargon "Use Spot View" / "Spot View" copy keys remain referenced', () => {
    expect(formSrc).not.toContain('t.newCampground.useSpotViewDesc');
    expect(formSrc).not.toContain('t.newCampground.spotViewEnabled');
    expect(formSrc).not.toContain('t.newCampground.createSpotsDesc');
  });
});

describe('CampgroundForm — AC-9/BR-6: existing camp maps the stored flag, no write on load', () => {
  it('initial-load mapping reads initialData.useSpotView with a false fallback only (no write)', () => {
    expect(formSrc).toContain('useSpotView: initialData.useSpotView ?? false,');
  });

  it('the lazily-initialized initialModeWasPerSpot captures the load-time mode once (BR-1/BR-6)', () => {
    expect(formSrc).toContain(
      'const [initialModeWasPerSpot] = useState<boolean>(() => initialData?.useSpotView ?? false);'
    );
  });
});

describe('CampgroundForm — AC-3/AC-4/EC-2/EC-5: PER-SPOT derived total vs empty state', () => {
  it('derived total is gated on derivedGuestTotal > 0 (never shows "0 คน" — EC-2/EC-5)', () => {
    expect(formSrc).toContain('derivedGuestTotal > 0 ? (');
    expect(formSrc).toContain('data-testid="text--capacity-derived-total"');
    expect(formSrc).toContain(
      't.newCampground.capacityDerivedTotal.replace("{N}", String(derivedGuestTotal))'
    );
  });

  it('empty state renders when the derived sum is 0 (zero spots, all-null capacity, or all soft-deleted)', () => {
    expect(formSrc).toContain('data-testid="text--capacity-derived-empty"');
    expect(formSrc).toContain('{t.newCampground.capacityDerivedEmpty}');
  });

  it('derivedGuestTotal reads the GET payload\'s already-derived sum, gated on the LIVE spot count (BR-3/BR-7, G3 fix)', () => {
    expect(formSrc).toContain(
      'const derivedGuestTotal: number = spotCount > 0 ? (initialData?.maxGuestsPerDay ?? 0) : 0;'
    );
  });

  it('spotCount reads spotStats.totalSpots (non-deleted only, per lib/spot-aggregation.ts)', () => {
    expect(formSrc).toContain('const spotCount: number = initialData?.spotStats?.totalSpots ?? 0;');
  });
});

// ===========================================================================
// G3 review fix — AC-4/EC-2/EC-5 regression: a WHOLE-CAMP -> PER-SPOT switch
// with zero LIVE spots must show the empty state, never the stale stored
// maxGuestsPerDay (BR-4 keeps that column kept-but-ignored on a mode switch).
// ===========================================================================

describe('CampgroundForm — G3 fix: zero live spots after a mode switch never displays the stale maxGuestsPerDay', () => {
  // Mirrors lib/spot-aggregation.ts getCampSiteWithCapacity's real, documented
  // behavior (covered by __tests__/cam-352-spot-aggregation-soft-delete.test.ts):
  // for a PER-SPOT camp with zero non-deleted spots, `spotCapacity.maxGuestsPerDay`
  // is 0 (falsy), so `spotCapacity.maxGuestsPerDay || campSite.maxGuestsPerDay`
  // falls back to the RAW stored column - the value BR-4 explicitly keeps
  // (kept-but-ignored) after a WHOLE-CAMP -> PER-SPOT switch.
  function payloadAfterSwitchWithZeroLiveSpots() {
    return {
      useSpotView: true,
      maxGuestsPerDay: 50, // stale, kept-but-ignored WHOLE-CAMP value (BR-4)
      spotStats: { totalSpots: 0, groundTypeBreakdown: undefined },
    };
  }

  it('[repro] reading useSpotView + maxGuestsPerDay with no live-spot-count gate reproduces the G3-flagged defect (would render 50 คน for 0 spots)', () => {
    const payload = payloadAfterSwitchWithZeroLiveSpots();
    const buggyFormula = payload.useSpotView ? (payload.maxGuestsPerDay ?? 0) : 0;
    expect(buggyFormula).toBe(50); // proves the stale-fallback trap is real
  });

  it('[fix] gating on the live spot count (spotStats.totalSpots) yields 0 -> the empty state (AC-4/EC-2/EC-5), not "50"', () => {
    const payload = payloadAfterSwitchWithZeroLiveSpots();
    const spotCount = payload.spotStats?.totalSpots ?? 0;
    const fixedFormula = spotCount > 0 ? (payload.maxGuestsPerDay ?? 0) : 0;
    expect(fixedFormula).toBe(0);
  });

  it('the shipped derivedGuestTotal line matches the fixed formula exactly (source-inspection)', () => {
    expect(formSrc).toContain(
      'const derivedGuestTotal: number = spotCount > 0 ? (initialData?.maxGuestsPerDay ?? 0) : 0;'
    );
  });
});

describe('CampgroundForm — AC-6/EC-1/EC-6: switch hints + no manual field in PER-SPOT mode', () => {
  it('a just-switched-to-per-spot session shows the transient hint, distinct from the empty state', () => {
    expect(formSrc).toContain('justSwitchedToPerSpot ? (');
    expect(formSrc).toContain('data-testid="text--capacity-switch-to-per-spot-hint"');
    expect(formSrc).toContain('{t.newCampground.capacitySwitchToPerSpotHint}');
  });

  it('the manual maxGuestsPerDay/maxTentsPerDay inputs render only when !formData.useSpotView', () => {
    expect(formSrc).toContain('{!formData.useSpotView && (');
  });

  it('the PER-SPOT section (derived display + CTA) renders only when formData.useSpotView', () => {
    expect(formSrc).toContain('{formData.useSpotView && (');
    expect(formSrc).toContain('data-testid="section--capacity-per-spot"');
  });
});

describe('CampgroundForm — AC-5/EC-1: switch-to-whole-camp warning, spots preserved', () => {
  it('the warning renders only on a just-switched session with existing spots (justSwitchedToWholeCamp && spotCount > 0)', () => {
    expect(formSrc).toContain('{justSwitchedToWholeCamp && spotCount > 0 && (');
    expect(formSrc).toContain('data-testid="banner--capacity-switch-to-whole-warning"');
    expect(formSrc).toContain(
      't.newCampground.capacitySwitchToWholeWarning.replace("{N}", String(spotCount))'
    );
  });

  it('no spot DELETE/removal fetch call exists anywhere in the form (mode switch never deletes data, BR-4)', () => {
    expect(formSrc).not.toMatch(/fetch\(`[^`]*\/spots[^`]*`[\s\S]{0,80}method:\s*['"]DELETE['"]/);
  });
});

describe('CampgroundForm — AC-2/AC-11/BR-2: WHOLE-CAMP manual capacity + blocking validation', () => {
  it('the manual maxGuestsPerDay input is wired to campSiteSchema-shared state (no new field)', () => {
    expect(formSrc).toContain('label={t.newCampground.maxGuestsPerDay}');
    expect(formSrc).toContain("error={zErr('maxGuestsPerDay')}");
  });

  it('save is blocked in WHOLE-CAMP mode when maxGuestsPerDay is empty/0/<1, with the catalog Thai copy (AC-11)', () => {
    expect(formSrc).toContain('if (!formData.useSpotView) {');
    expect(formSrc).toContain(
      'const guestsInvalid = guests === "" || isNaN(Number(guests)) || Number(guests) < 1;'
    );
    expect(formSrc).toContain(
      'setFieldErrors({ maxGuestsPerDay: [t.newCampground.maxGuestsPerDayError] });'
    );
  });
});

describe('CampgroundForm — BR-8: PER-SPOT links to the CAM-352 spot-management screen', () => {
  it('links to /dashboard/campsites/{id}/spots when editing; gates the CTA on isEditing otherwise (no dead link)', () => {
    expect(formSrc).toContain('href={isEditing ? `/dashboard/campsites/${initialData.id}/spots` : "#"}');
    expect(formSrc).toContain('toast.error(t.newCampground.saveBeforeSpots);');
    expect(formSrc).toContain('data-testid="btn--capacity-manage-spots"');
  });
});

describe('CampgroundForm — BR-1: mode lives only in the existing useSpotView column (no new field)', () => {
  it('the payload sends useSpotView (existing column), not a new capacityMode field', () => {
    expect(formSrc).toContain('useSpotView: formData.useSpotView,');
    expect(formSrc).not.toContain('capacityMode:');
  });
});

// ===========================================================================
// Group D: locales — new keys present in TH + EN, jargon keys removed
// ===========================================================================

describe('locales/translations.json — CAM-351 capacity-mode copy (TH verbatim + EN present)', () => {
  const NEW_KEYS = [
    'capacityModeQuestion',
    'capacityModeWholeCamp',
    'capacityModeWholeCampDesc',
    'capacityModePerSpot',
    'capacityModePerSpotDesc',
    'capacityDerivedTotal',
    'capacityDerivedNote',
    'capacityDerivedEmpty',
    'capacitySwitchToWholeWarning',
    'capacitySwitchToPerSpotHint',
    'manageSpotsButton',
    'maxGuestsPerDayError',
  ];

  it.each(NEW_KEYS)('key "%s" exists in both en and th newCampground namespaces', (key) => {
    expect(translations.en.newCampground).toHaveProperty(key);
    expect(translations.th.newCampground).toHaveProperty(key);
    expect(typeof (translations.th.newCampground as Record<string, string>)[key]).toBe('string');
    expect((translations.th.newCampground as Record<string, string>)[key].length).toBeGreaterThan(0);
  });

  it('AC-1 Thai copy verbatim: the mode question + both choice labels + descriptions', () => {
    expect(translations.th.newCampground.capacityModeQuestion).toBe('กำหนดความจุของแคมป์แบบไหน');
    expect(translations.th.newCampground.capacityModeWholeCamp).toBe('ทั้งลาน');
    expect(translations.th.newCampground.capacityModeWholeCampDesc).toBe(
      'กำหนดจำนวนผู้เข้าพักรวมของทั้งแคมป์'
    );
    expect(translations.th.newCampground.capacityModePerSpot).toBe('รายจุด');
    expect(translations.th.newCampground.capacityModePerSpotDesc).toBe(
      'กำหนดจำนวนผู้เข้าพักในแต่ละจุด แล้วระบบจะรวมเป็นความจุของทั้งแคมป์'
    );
  });

  it('AC-3/AC-4 Thai copy verbatim: derived total + empty state', () => {
    expect(translations.th.newCampground.capacityDerivedTotal).toBe(
      'ความจุรวมของทั้งแคมป์ (คำนวณจากทุกจุด): {N} คน'
    );
    expect(translations.th.newCampground.capacityDerivedNote).toBe(
      'หนึ่งจุดรองรับได้หลายคน จำนวนจุดไม่เท่ากับจำนวนคน'
    );
    expect(translations.th.newCampground.capacityDerivedEmpty).toBe(
      'ยังไม่ได้เพิ่มจุดกางเต็นท์ ความจุจะคำนวณเมื่อคุณเพิ่มจุด'
    );
  });

  it('AC-5/AC-6 Thai copy verbatim: switch warning + switch hint', () => {
    expect(translations.th.newCampground.capacitySwitchToWholeWarning).toBe(
      'คุณมีจุดกางเต็นท์อยู่ {N} จุด หากเปลี่ยนเป็นแบบทั้งลาน ระบบจะใช้จำนวนที่คุณกรอกแทน (จุดเดิมจะถูกเก็บไว้แต่ไม่นำมาคำนวณ)'
    );
    expect(translations.th.newCampground.capacitySwitchToPerSpotHint).toBe(
      'เปลี่ยนเป็นการกำหนดความจุแบบรายจุด กรุณาเพิ่มจุดกางเต็นท์เพื่อให้ระบบคำนวณความจุ'
    );
  });

  it('AC-11/BR-2 Thai copy verbatim: matches the shared validation catalog (.claude/rules/ux.md §2 capacity)', () => {
    expect(translations.th.newCampground.maxGuestsPerDayError).toBe('จำนวนผู้เข้าพักต้องมากกว่า 0');
  });

  it('no Thai copy uses an em-dash (—) as a separator', () => {
    for (const key of NEW_KEYS) {
      const value = (translations.th.newCampground as Record<string, string>)[key];
      expect(value).not.toContain('—');
    }
  });

  it('the retired jargon keys (useSpotView/useSpotViewDesc/createSpots*/spotViewEnabled/spotViewDisabled) are gone', () => {
    const RETIRED_KEYS = [
      'useSpotView',
      'useSpotViewDesc',
      'createSpots',
      'createSpotsDesc',
      'spotViewEnabled',
      'spotViewDisabled',
    ];
    for (const key of RETIRED_KEYS) {
      expect(translations.en.newCampground).not.toHaveProperty(key);
      expect(translations.th.newCampground).not.toHaveProperty(key);
    }
  });

  it('maxGuestsPerDay/maxTentsPerDay labels are kept unchanged (BR-2)', () => {
    expect(translations.th.newCampground.maxGuestsPerDay).toBe('จำนวนผู้เข้าพักสูงสุดต่อวัน');
    expect(translations.th.newCampground.maxTentsPerDay).toBe('จำนวนเต็นท์สูงสุดต่อวัน (โดยประมาณ)');
  });
});

// ===========================================================================
// Group E: AC-10/EC-7 — Do-NOT-touch regression guard (unchanged-by-construction)
// ===========================================================================

describe('AC-10/EC-7 — availability/booking consumers stay mode-unaware (regression guard)', () => {
  const DO_NOT_TOUCH_FILES = [
    'lib/campsite-availability.ts',
    'lib/campsite-filters.ts',
    'app/api/bookings/route.ts',
  ];

  it.each(DO_NOT_TOUCH_FILES)('%s never references useSpotView (no mode-awareness added by this story)', (rel) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
    expect(src).not.toContain('useSpotView');
  });
});
