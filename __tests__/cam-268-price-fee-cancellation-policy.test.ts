/**
 * cam-268-price-fee-cancellation-policy.test.ts — PREP-2 (CAM-268)
 *
 * Ground truth (established before writing this story — see PR body for the full
 * write-up): CampSite had NO atomic fee field (only a free-text `feeInfo`) and NO
 * cancellation-policy field at all. The detail page's booking-summary total never
 * included any fee (lib/booking-pricing.ts's own docstring: "No fees anywhere"), while
 * the "Good to know" card showed a vague fallback ("Entry fees may apply...") that was
 * never reflected in the total — exactly the C-3.4-style trust gap this ticket closes.
 *
 * AC coverage matrix (ticket CAM-268, every row → at least one test):
 *   AC-1  Camp has an extra fee → price summary shows a total that equals base + the
 *         real fee, with an itemized line for the fee (booking-pricing.test.ts covers
 *         the pure computation; this file covers the copy/display + validation layer).
 *   AC-2  Host has set a cancellation policy → detail page shows the exact Thai copy
 *         (e.g. "ยกเลิกฟรีก่อนเข้าพัก 7 วัน" for MODERATE).
 *   AC-3  No policy set (null) → detail page shows "ยังไม่ระบุนโยบายการยกเลิก" verbatim.
 *
 * Layers:
 *   - lib/cancellation-policy.ts → unit (pure function, no DOM, no mocked boundary)
 *   - lib/validations/campsite.ts new fields → unit (zod boundary: normal/null/boundary/error)
 *   - locales/translations.json → i18n presence + Thai-copy-verbatim + no-em-dash
 *   - components/CampgroundDetailClient.tsx → source-inspection (same strategy as
 *     f2-listing-surface.test.ts / f3-detail-surface.test.ts / cam-269's AC-3 — this
 *     component has no isolated test harness and mounting it needs >10 mocked module
 *     boundaries; source-inspection is the established precedent for this exact file)
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (0 / 100000 / 100001) · error/validation · verbatim copy
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import translations from '../locales/translations.json';
import {
  CANCELLATION_POLICY_VALUES,
  isCancellationPolicyValue,
  resolveCancellationPolicyCopy,
} from '@/lib/cancellation-policy';
import { campSiteSchema, CancellationPolicyEnum } from '@/lib/validations/campsite';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ---------------------------------------------------------------------------
// lib/cancellation-policy.ts
// ---------------------------------------------------------------------------
describe('isCancellationPolicyValue', () => {
  it('[normal] accepts every closed enum value', () => {
    for (const v of CANCELLATION_POLICY_VALUES) {
      expect(isCancellationPolicyValue(v)).toBe(true);
    }
  });

  it('[null/empty] rejects null, undefined, and empty string', () => {
    expect(isCancellationPolicyValue(null)).toBe(false);
    expect(isCancellationPolicyValue(undefined)).toBe(false);
    expect(isCancellationPolicyValue('')).toBe(false);
  });

  it('[error/validation] rejects an unrecognized string (never guessed/inferred)', () => {
    expect(isCancellationPolicyValue('SUPER_FLEXIBLE')).toBe(false);
    expect(isCancellationPolicyValue('flexible')).toBe(false); // case-sensitive
  });
});

describe('resolveCancellationPolicyCopy (AC-2 / AC-3)', () => {
  const copy = translations.th.campground.cancellationPolicy;

  it('[AC-2 normal] MODERATE resolves to the exact AC-quoted Thai copy', () => {
    expect(resolveCancellationPolicyCopy('MODERATE', copy)).toBe('ยกเลิกฟรีก่อนเข้าพัก 7 วัน');
  });

  it('[AC-2 normal] every closed value resolves to its own distinct copy', () => {
    const seen = new Set<string>();
    for (const v of CANCELLATION_POLICY_VALUES) {
      const resolved = resolveCancellationPolicyCopy(v, copy);
      expect(resolved).toBe(copy[v]);
      expect(seen.has(resolved)).toBe(false); // no two policies share the same copy
      seen.add(resolved);
    }
  });

  it('[AC-3 null/empty] null resolves to the exact "not set" Thai copy', () => {
    expect(resolveCancellationPolicyCopy(null, copy)).toBe('ยังไม่ระบุนโยบายการยกเลิก');
  });

  it('[AC-3 null/empty] undefined resolves to the "not set" copy', () => {
    expect(resolveCancellationPolicyCopy(undefined, copy)).toBe(copy.notSet);
  });

  it('[error/validation] an unrecognized string falls back to "not set", never crashes', () => {
    expect(resolveCancellationPolicyCopy('NOT_A_REAL_POLICY', copy)).toBe(copy.notSet);
  });
});

// ---------------------------------------------------------------------------
// lib/validations/campsite.ts — zod boundary (server-authoritative, api.md)
// ---------------------------------------------------------------------------
describe('campSiteSchema — extraFeeAmount / extraFeeLabel / cancellationPolicy (CAM-268)', () => {
  const base = {
    nameTh: 'ทดสอบ',
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    bookingMethod: 'ONLI' as const,
    locationId: 'c2fef996-3f4c-4ff0-99ab-4425438f2fce',
    // CAM-520: campSiteType is now required on the full (non-partial)
    // schema — unrelated to this file's fee/policy concern, so a valid
    // code is added here to keep these full-schema parses testing ONLY
    // their intended field.
    campSiteType: 'CAGD' as const,
  };

  it('[normal] accepts a valid fee + label + policy', () => {
    const result = campSiteSchema.safeParse({
      ...base,
      extraFeeAmount: 40,
      extraFeeLabel: 'ค่าเข้าอุทยาน',
      cancellationPolicy: 'MODERATE',
    });
    expect(result.success).toBe(true);
  });

  it('[null/empty] all three fields are optional — omitting them is valid', () => {
    const result = campSiteSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('[boundary] extraFeeAmount = 0 is valid (lower bound)', () => {
    const result = campSiteSchema.safeParse({ ...base, extraFeeAmount: 0 });
    expect(result.success).toBe(true);
  });

  it('[boundary] extraFeeAmount = 100000 is valid (upper bound)', () => {
    const result = campSiteSchema.safeParse({ ...base, extraFeeAmount: 100000 });
    expect(result.success).toBe(true);
  });

  it('[error/validation] extraFeeAmount = -1 is rejected with the Thai catalog message', () => {
    const result = campSiteSchema.safeParse({ ...base, extraFeeAmount: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('ค่าธรรมเนียมต้องอยู่ระหว่าง 0–100,000 บาท');
    }
  });

  it('[error/validation] extraFeeAmount = 100001 is rejected (over the bound)', () => {
    const result = campSiteSchema.safeParse({ ...base, extraFeeAmount: 100001 });
    expect(result.success).toBe(false);
  });

  it('[error/validation] extraFeeLabel over 100 chars is rejected', () => {
    const result = campSiteSchema.safeParse({ ...base, extraFeeLabel: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('[error/validation] cancellationPolicy rejects a value outside the closed set', () => {
    const result = campSiteSchema.safeParse({ ...base, cancellationPolicy: 'REFUNDABLE_MAYBE' });
    expect(result.success).toBe(false);
  });

  it('[normal] CancellationPolicyEnum matches lib/cancellation-policy.ts 1:1', () => {
    expect(CancellationPolicyEnum.options).toEqual(CANCELLATION_POLICY_VALUES);
  });

  it('[normal] partial() (the PUT path) still validates a fee-only update', () => {
    const result = campSiteSchema.partial().safeParse({ extraFeeAmount: 25 });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// i18n — locales/translations.json (both en + th)
// ---------------------------------------------------------------------------
describe('i18n: campground.cancellationPolicy (CAM-268)', () => {
  const KEYS = ['title', 'notSet', ...CANCELLATION_POLICY_VALUES] as const;

  it('[normal] every key exists in both en and th', () => {
    const byLang: Record<'en' | 'th', typeof translations.th.campground.cancellationPolicy> = {
      en: translations.en.campground.cancellationPolicy,
      th: translations.th.campground.cancellationPolicy,
    };
    for (const lang of ['en', 'th'] as const) {
      const copy = byLang[lang];
      for (const key of KEYS) {
        expect(typeof copy[key]).toBe('string');
        expect(copy[key].length).toBeGreaterThan(0);
      }
    }
  });

  it('[AC-2] th.MODERATE is verbatim the AC-quoted copy', () => {
    expect(translations.th.campground.cancellationPolicy.MODERATE).toBe('ยกเลิกฟรีก่อนเข้าพัก 7 วัน');
  });

  it('[AC-3] th.notSet is verbatim the AC-quoted copy', () => {
    expect(translations.th.campground.cancellationPolicy.notSet).toBe('ยังไม่ระบุนโยบายการยกเลิก');
  });

  it('[i18n rule] no em-dash (—) in any Thai cancellationPolicy copy', () => {
    for (const key of KEYS) {
      expect(translations.th.campground.cancellationPolicy[key]).not.toContain('—');
    }
  });
});

// ---------------------------------------------------------------------------
// components/CampgroundDetailClient.tsx — source-inspection
// (mirrors f2/f3-*-surface.test.ts + cam-269's AC-3 precedent for this exact file)
// ---------------------------------------------------------------------------
describe('CampgroundDetailClient.tsx — source-inspection (CAM-268)', () => {
  const detailSrc = src('components/CampgroundDetailClient.tsx');

  it('[AC-1] passes extraFeeAmount into the single shared pricing source', () => {
    expect(detailSrc).toMatch(/computeBookingPrice\(\{[\s\S]{0,200}extraFeeAmount/);
  });

  it('[AC-1] the itemized fee row only renders when extraFeeAmount > 0', () => {
    expect(detailSrc).toMatch(/extraFeeAmount > 0/);
    expect(detailSrc).toContain('data-testid="row--booking-extra-fee"');
  });

  it('[AC-2/AC-3] renders the cancellation policy row via the shared resolver', () => {
    expect(detailSrc).toContain('resolveCancellationPolicyCopy(');
    expect(detailSrc).toContain('data-testid="row--campground-cancellation-policy"');
  });

  it('[regression] the old "fees may apply" implied-charge fallback is removed', () => {
    // That fallback claimed a fee existed ("Entry fees may apply...") without it ever
    // being counted in the total — the exact C-3.4 trust gap this ticket closes.
    expect(detailSrc).not.toContain('Entry fees may apply');
  });

  it('[a11y/testid convention] new rows follow <type>--<module>-<detail>', () => {
    expect(detailSrc).toContain('data-testid="row--campground-fees"');
  });
});

// ---------------------------------------------------------------------------
// API routes — source-inspection: the new fields are actually wired (parity check
// across the live campsites route pair, not just the schema).
// CAM-527: the legacy app/api/campgrounds/* pair (dead, no product caller) was
// deleted; its parallel entries are removed from this list with it.
// ---------------------------------------------------------------------------
describe('campsites API routes wire the new fields (CAM-268)', () => {
  const routeFiles = [
    'app/api/campsites/route.ts',
    'app/api/campsites/[id]/route.ts',
  ];

  it.each(routeFiles)('%s references extraFeeAmount, extraFeeLabel, and cancellationPolicy', (rel) => {
    const content = src(rel);
    expect(content).toContain('extraFeeAmount');
    expect(content).toContain('extraFeeLabel');
    expect(content).toContain('cancellationPolicy');
  });

  it('bookings/route.ts snapshots the fee actually applied (ADR-005 crystallization)', () => {
    const content = src('app/api/bookings/route.ts');
    expect(content).toContain('snapshotExtraFeeAmount');
    expect(content).toMatch(/computeBookingPrice\(\{[\s\S]{0,200}extraFeeAmount/);
  });
});
