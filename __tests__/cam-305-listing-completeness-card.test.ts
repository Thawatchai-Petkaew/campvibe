/**
 * cam-305-listing-completeness-card.test.ts — source-inspection tests for the
 * CAM-305 host dashboard listing-completeness card + its dashboard wiring.
 *
 * The repo's vitest config runs in the `node` environment with no jsdom/
 * @testing-library/react (see vitest.config.ts), so a real component-render
 * test is not available here. This follows the same source-inspection
 * pattern established by __tests__/cam-56-blocked-dates-availability-page.test.ts
 * and the CAM-302/303/304 suites to give structural coverage of the AC/BR/EC
 * contract without adding new test infra (out of scope for this atomic story).
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  header renders `ครบ {N}%` with the API score; missing[] maps to one
 *       row per item rendering the verbatim API label (never merged).
 * AC-2  each missing item links to `/dashboard/campsites/{id}/edit#{anchor}`
 *       per the BR-2 table, derived from `key` (never from `label`).
 * AC-3  score===100 && missing empty -> renders the complete affirmation +
 *       success badge, no missing-item list (EC-4).
 * AC-4  uses useMinimumLoading; skeleton mirrors the card shape; a11y wiring
 *       (aria-busy, role=status, aria-live=polite, กำลังโหลด… via t.common).
 * AC-5  error branch renders ErrorBanner + retry button; retry re-fetches
 *       only this card (attempt state re-triggers the effect) (EC-1).
 * AC-6  dashboard: zero campSites -> the completeness section is not
 *       rendered at all (EC-2).
 * AC-7  dashboard: maps over data.campSites -> one card per campsite, never
 *       aggregated; title = campsite name from the dashboard payload.
 * BR-1  no hardcoded Thai missing-item label literal anywhere in the card.
 * BR-2  link map covers all six keys + the unknown-key fallback (EC-5); a
 *       not-yet-built field (cancellationPolicy/extraFee) still links + is
 *       clickable (EC-6).
 * BR-5  client-fetch anti-flicker (useMinimumLoading) + a11y.
 * BR-6  one card's error state never blanks another card (separate fetch
 *       per instance, no shared/module-level error state).
 * Story-specific: read-only (GET-only, no write path).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

import {
  LISTING_COMPLETENESS_WEIGHTS,
  type ListingCompletenessKey,
} from '@/lib/listing-completeness';

const cardSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/ListingCompletenessCard.tsx'),
  'utf-8'
);
const dashboardSrc = fs.readFileSync(
  path.join(process.cwd(), 'app/dashboard/page.tsx'),
  'utf-8'
);

// ===========================================================================
// BR-1 — labels verbatim from the API, never hardcoded in the card
// ===========================================================================

describe('CAM-305 card — BR-1: no hardcoded Thai missing-item label', () => {
  const BR1_LABELS = [
    'ยังไม่มีรูปภาพ',
    'ยังไม่ระบุราคา',
    'ยังไม่ระบุนโยบายยกเลิก',
    'ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ',
    'ยังไม่มีโซนหรือจุดกางเต็นท์',
    'ยังไม่ระบุสิ่งอำนวยความสะดวก',
  ];

  it.each(BR1_LABELS)('does not contain the literal label %s', (label) => {
    expect(cardSrc).not.toContain(label);
  });

  it('never re-derives a label from `key` (renders item.label verbatim, one row per item)', () => {
    expect(cardSrc).toContain('result.missing.map((item) =>');
    expect(cardSrc).toContain('<span>{item.label}</span>');
  });

  it('does not hardcode a Thai string literal outside the i18n layer', () => {
    const thaiRange = /[฀-๿]/;
    expect(thaiRange.test(cardSrc)).toBe(false);
  });
});

// ===========================================================================
// AC-1/BR-3 — score header
// ===========================================================================

describe('CAM-305 card — AC-1/BR-3: score header', () => {
  it('renders the header with the API score substituted for {N}', () => {
    expect(cardSrc).toContain('copy.header.replace("{N}", String(result.score))');
  });

  it('pulls the header copy from the i18n listingCompleteness namespace, not hardcoded', () => {
    expect(cardSrc).toContain('const copy = t.listingCompleteness');
  });
});

// ===========================================================================
// AC-2/BR-2 — link map (all six keys + unknown fallback)
// ===========================================================================

describe('CAM-305 card — AC-2/BR-2: link map derived from key, not label', () => {
  const EXPECTED_ANCHORS: Record<ListingCompletenessKey, string> = {
    photos: 'photos',
    price: 'price',
    cancellationPolicy: 'cancellation-policy',
    extraFee: 'extra-fee',
    zones: 'zones',
    amenities: 'amenities',
  };

  it('the weight table keys and the link map keys are the same six, in sync', () => {
    const weightKeys = LISTING_COMPLETENESS_WEIGHTS.map((c) => c.key);
    expect(weightKeys.sort()).toEqual(Object.keys(EXPECTED_ANCHORS).sort());
  });

  it.each(Object.entries(EXPECTED_ANCHORS))(
    'maps key "%s" to anchor "%s" in ANCHOR_BY_KEY',
    (key, anchor) => {
      expect(cardSrc).toContain(`${key}: "${anchor}"`);
    }
  );

  it('builds the href as /dashboard/campsites/{id}/edit#{anchor}', () => {
    expect(cardSrc).toContain(
      '`/dashboard/campsites/${campSiteId}/edit#${anchor}`'
    );
  });

  it('[EC-5] falls back to the edit page with NO hash for an unrecognized key (never hidden, never a dead link)', () => {
    expect(cardSrc).toContain('`/dashboard/campsites/${campSiteId}/edit`');
    expect(cardSrc).toContain('return anchor');
  });

  it('links by the item key, not the item label (href built from fixLinkFor(campSiteId, item.key))', () => {
    expect(cardSrc).toContain('href={fixLinkFor(campSiteId, item.key)}');
  });

  it('[EC-6] cancellationPolicy and extraFee (fields not built yet, CAM-341) still have a real anchor, not omitted', () => {
    expect(cardSrc).toContain('cancellationPolicy: "cancellation-policy"');
    expect(cardSrc).toContain('extraFee: "extra-fee"');
  });
});

// ===========================================================================
// AC-3/EC-4 — complete state
// ===========================================================================

describe('CAM-305 card — AC-3/EC-4: complete state (score=100, missing empty)', () => {
  it('computes isComplete from score===100 AND an empty missing array', () => {
    expect(cardSrc).toContain(
      'const isComplete = result != null && result.score === 100 && result.missing.length === 0;'
    );
  });

  it('renders the complete affirmation copy + a success badge (color+icon+text, never color-only)', () => {
    expect(cardSrc).toContain('isComplete ? (');
    expect(cardSrc).toContain('<Badge variant="success" data-testid="badge--listing-completeness-complete">');
    expect(cardSrc).toContain('<CheckCircle2 aria-hidden="true" />');
    expect(cardSrc).toContain('{copy.complete}');
  });

  it('renders no missing-item list in the complete branch (badge is a sibling branch to the list branch)', () => {
    const completeBranchStart = cardSrc.indexOf('isComplete ? (');
    const nextBranchStart = cardSrc.indexOf(') : result ? (');
    const completeBranch = cardSrc.slice(completeBranchStart, nextBranchStart);
    expect(completeBranch).not.toContain('section--listing-completeness-missing');
  });
});

// ===========================================================================
// AC-4/BR-5 — loading state + a11y
// ===========================================================================

describe('CAM-305 card — AC-4/BR-5: loading state (skeleton + anti-flicker + a11y)', () => {
  it('uses the client-fetch anti-flicker hook useMinimumLoading', () => {
    expect(cardSrc).toContain('useMinimumLoading(isLoading)');
  });

  it('renders a skeleton (not blank/spinner) that mirrors the card shape while showSkeleton is true', () => {
    expect(cardSrc).toContain('showSkeleton ? (');
    expect(cardSrc).toContain('data-testid="skeleton--listing-completeness"');
    expect(cardSrc).toContain('<Skeleton');
  });

  it('marks the skeleton region aria-hidden (decorative shapes, meaning carried by the live region)', () => {
    expect(cardSrc).toContain('aria-hidden="true"\n            data-testid="skeleton--listing-completeness"');
  });

  it('sets aria-busy on the async region', () => {
    expect(cardSrc).toContain('aria-busy={showSkeleton}');
  });

  it('wires role="status" aria-live="polite" with the shared loading_sr copy (not a hardcoded string)', () => {
    expect(cardSrc).toContain('role="status" aria-live="polite"');
    expect(cardSrc).toContain('{showSkeleton ? t.common.loading_sr : ""}');
  });
});

// ===========================================================================
// AC-5/BR-6/EC-1 — error state + isolated retry
// ===========================================================================

describe('CAM-305 card — AC-5/BR-6/EC-1: error state + per-card retry', () => {
  it('renders ErrorBanner with the loadError copy on a failed fetch', () => {
    expect(cardSrc).toContain('hasError ? (');
    expect(cardSrc).toContain('message={copy.loadError}');
    expect(cardSrc).toContain('data-testid="banner--listing-completeness-error"');
  });

  it('renders a retry button that re-triggers only this card\'s fetch', () => {
    expect(cardSrc).toContain('data-testid="btn--listing-completeness-retry"');
    expect(cardSrc).toContain('onClick={handleRetry}');
    expect(cardSrc).toContain('const handleRetry = () => setAttempt((n) => n + 1);');
  });

  it('the fetch effect depends on [campSiteId, attempt] — retry re-fetches without touching other cards\' state (BR-6)', () => {
    expect(cardSrc).toContain('}, [campSiteId, attempt]);');
  });

  it('treats any non-ok response (network / 5xx / defensive 403 / 404) as the same error branch', () => {
    expect(cardSrc).toContain('if (!res.ok) throw new Error');
    expect(cardSrc).toContain('.catch(() => {');
  });
});

// ===========================================================================
// Story-specific — read-only (GET-only, no write path)
// ===========================================================================

describe('CAM-305 card — read-only guarantee (no write path)', () => {
  it('fetches with no `method` option (GET is the default, no PUT/POST/PATCH/DELETE anywhere)', () => {
    expect(cardSrc).not.toMatch(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  });

  it('never imports a Prisma client (client component, all data via fetch)', () => {
    expect(cardSrc).not.toContain('@prisma/client');
    expect(cardSrc).not.toContain("from '@/lib/prisma'");
  });
});

// ===========================================================================
// AC-6/AC-7/BR-4/BR-7 — dashboard wiring
// ===========================================================================

describe('CAM-305 dashboard — AC-7/BR-4: one card per owned campsite (never aggregated)', () => {
  it('imports ListingCompletenessCard', () => {
    expect(dashboardSrc).toContain(
      'import { ListingCompletenessCard } from "@/components/ListingCompletenessCard";'
    );
  });

  it('maps over data.campSites — one card per campsite, keyed by campsite id', () => {
    expect(dashboardSrc).toContain('{data.campSites.map((camp) => (');
    expect(dashboardSrc).toContain('<ListingCompletenessCard');
    expect(dashboardSrc).toContain('key={camp.id}');
    expect(dashboardSrc).toContain('campSiteId={camp.id}');
  });

  it('the card title (campSiteName) comes from the existing dashboard payload, language-resolved', () => {
    expect(dashboardSrc).toContain(
      "campSiteName={language === 'th' ? camp.nameTh : camp.nameEn}"
    );
  });

  it('never renders a single aggregated completeness card (no roll-up score/props passed)', () => {
    // The only usage of the component is inside the .map() over campSites — a
    // second, non-mapped invocation would indicate an aggregated roll-up card.
    const usages = dashboardSrc.match(/<ListingCompletenessCard/g) ?? [];
    expect(usages.length).toBe(1);
  });
});

describe('CAM-305 dashboard — AC-6/BR-7/EC-2: zero campsites -> no section at all', () => {
  it('gates the entire section on campSites.length > 0 (not an empty-card fallback)', () => {
    expect(dashboardSrc).toContain(
      'data.campSites && data.campSites.length > 0 && ('
    );
  });

  it('the section carries its own test id, scoped separately from the stats/bookings sections', () => {
    expect(dashboardSrc).toContain(
      'data-testid="section--dashboard-listing-completeness"'
    );
  });

  it('pulls the section title from i18n (t.listingCompleteness.sectionTitle), not hardcoded', () => {
    expect(dashboardSrc).toContain('{t.listingCompleteness.sectionTitle}');
  });
});
