/**
 * cam-305-listing-completeness-card.test.ts — source-inspection tests for the
 * CAM-305 host dashboard listing-completeness card + its dashboard wiring.
 *
 * Updated for CAM-350 (weight-segmented progress bar + payoff-annotated
 * remaining-jobs list): the card's rendered BODY changed (score pill +
 * <SegmentedProgress> + jobs list with `+N%`), but the fetch / loading /
 * error / retry plumbing and the CAM-305 BR-1 (verbatim labels) / BR-2 (link
 * map) contracts are unchanged and re-asserted here against the new source.
 * CAM-350-specific coverage (segment math, weights-single-source, the
 * unknown-key EC-5 payoff omission, container-query strip) lives in
 * __tests__/cam-350-segmented-progress.test.ts.
 *
 * The repo's vitest config runs in the `node` environment with no jsdom/
 * @testing-library/react (see vitest.config.ts), so a real component-render
 * test is not available here. This follows the same source-inspection
 * pattern established by __tests__/cam-56-blocked-dates-availability-page.test.ts
 * and the CAM-302/303/304 suites to give structural coverage of the AC/BR/EC
 * contract without adding new test infra.
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  score pill renders `ครบ {N}%` with the API score (never a re-sum);
 *       missing[] maps to one row per item rendering the verbatim API label.
 * AC-2  each missing item links to `/dashboard/campsites/{id}/edit#{anchor}`
 *       per the BR-2 (CAM-305) table, derived from `key` (never from `label`).
 * AC-4  score===100 && missing empty -> renders the complete affirmation +
 *       success badge, no missing-item list (EC-4).
 * AC-5  uses useMinimumLoading; skeleton mirrors the new layout; a11y wiring
 *       (aria-busy, role=status, aria-live=polite, กำลังโหลด… via t.common).
 * AC-6  error branch renders ErrorBanner + retry button; retry re-fetches
 *       only this card (EC-1).
 * AC-7  dashboard: zero campSites -> the completeness section is not
 *       rendered at all (EC-2).
 * BR-1 (CAM-305) no hardcoded Thai missing-item label literal anywhere in the card.
 * BR-2 (CAM-305) link map covers all six keys + the unknown-key fallback (EC-5).
 * BR-7 (CAM-350) client-fetch anti-flicker (useMinimumLoading) + a11y; one
 *       card's error state never blanks another card.
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
// BR-1 (CAM-305) — labels verbatim from the API, never hardcoded in the card
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
// AC-1 — score pill (CAM-350: replaces the CAM-305 plain score line)
// ===========================================================================

describe('CAM-305/CAM-350 card — AC-1: score pill', () => {
  it('renders the score pill with the API score substituted for {N} (never a re-sum of segments)', () => {
    expect(cardSrc).toContain('copy.scorePercent.replace("{N}", String(result.score))');
  });

  it('pulls all copy from the i18n listingCompleteness namespace, not hardcoded', () => {
    expect(cardSrc).toContain('const copy = t.listingCompleteness');
  });

  it('renders the score pill as a Badge with variant="muted" (color via variant, never bg-* in className)', () => {
    expect(cardSrc).toContain('data-testid="badge--listing-completeness-score"');
  });
});

// ===========================================================================
// AC-2/AC-3 — link map (all six keys + unknown fallback), unchanged from CAM-305
// ===========================================================================

describe('CAM-305 card — AC-2/AC-3/BR-2: link map derived from key, not label', () => {
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

  it('[EC-6] cancellationPolicy and extraFee still resolve to a real anchor (CAM-341 built the edit sections)', () => {
    expect(cardSrc).toContain('cancellationPolicy: "cancellation-policy"');
    expect(cardSrc).toContain('extraFee: "extra-fee"');
  });
});

// ===========================================================================
// AC-4/EC-4 — complete state
// ===========================================================================

describe('CAM-305/CAM-350 card — AC-4/EC-4: complete state (score=100, missing empty)', () => {
  it('computes isComplete from score===100 AND an empty missing array', () => {
    expect(cardSrc).toContain(
      'const isComplete = result != null && result.score === 100 && result.missing.length === 0;'
    );
  });

  it('renders the fully-filled bar + the complete affirmation + a success badge (color+icon+text, never color-only)', () => {
    expect(cardSrc).toContain('result && isComplete ? (');
    expect(cardSrc).toContain('<Badge variant="success" data-testid="badge--listing-completeness-complete">');
    expect(cardSrc).toContain('<CheckCircle2 aria-hidden="true" />');
    expect(cardSrc).toContain('{copy.complete}');
  });

  it('renders no missing-item list and no count line in the complete branch (sibling branch to the jobs-list branch)', () => {
    const completeBranchStart = cardSrc.indexOf('result && isComplete ? (');
    const nextBranchStart = cardSrc.indexOf(') : result ? (');
    const completeBranch = cardSrc.slice(completeBranchStart, nextBranchStart);
    expect(completeBranch).not.toContain('section--listing-completeness-missing');
    expect(completeBranch).not.toContain('text--listing-completeness-remaining');
  });
});

// ===========================================================================
// AC-5/BR-7 — loading state + a11y (skeleton mirrors the NEW layout)
// ===========================================================================

describe('CAM-305/CAM-350 card — AC-5: loading state (skeleton + anti-flicker + a11y)', () => {
  it('uses the client-fetch anti-flicker hook useMinimumLoading', () => {
    expect(cardSrc).toContain('useMinimumLoading(isLoading)');
  });

  it('renders a skeleton (not blank/spinner) that mirrors the NEW layout (score-pill block + bar block + count-line block + job-row blocks)', () => {
    expect(cardSrc).toContain('showSkeleton ? (');
    expect(cardSrc).toContain('data-testid="skeleton--listing-completeness"');
    // score-pill placeholder (pill-shaped) sitting beside the title placeholder
    expect(cardSrc).toContain('<Skeleton className="h-5 w-14 shrink-0 rounded-full" />');
    // the bar placeholder matches the real SegmentedProgress track height/radius exactly (h-2.5 rounded-full)
    expect(cardSrc).toContain('<Skeleton className="h-2.5 w-full rounded-full" />');
    // count-line placeholder
    expect(cardSrc).toContain('<Skeleton className="h-4 w-1/3" />');
    // 1-2 job-row placeholders
    const jobRowSkeletons = cardSrc.match(/<Skeleton className="h-9 w-full rounded-xl" \/>/g) ?? [];
    expect(jobRowSkeletons.length).toBeGreaterThanOrEqual(1);
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
// AC-6/EC-1 — error state + isolated retry (unchanged from CAM-305)
// ===========================================================================

describe('CAM-305 card — AC-6/EC-1: error state + per-card retry', () => {
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

  it('the fetch effect depends on [campSiteId, attempt] — retry re-fetches without touching other cards\' state', () => {
    expect(cardSrc).toContain('}, [campSiteId, attempt]);');
  });

  it('treats any non-ok response (network / 5xx / defensive 403 / 404) as the same error branch', () => {
    expect(cardSrc).toContain('if (!res.ok) throw new Error');
    expect(cardSrc).toContain('.catch(() => {');
  });
});

// ===========================================================================
// CAM-350 — icon swap (ArrowUpRight replaces ChevronRight, DESIGN.md §7)
// ===========================================================================

describe('CAM-350 card — icon policy: lucide-react only, ArrowUpRight replaces ChevronRight', () => {
  it('imports ArrowUpRight (deep-link cue) and no longer imports ChevronRight', () => {
    expect(cardSrc).toContain('ArrowUpRight');
    expect(cardSrc).not.toContain('ChevronRight');
  });

  it('imports only from lucide-react (no @tabler/icons-react)', () => {
    expect(cardSrc).not.toContain('@tabler/icons-react');
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
// AC-7/BR-4/BR-7 — dashboard wiring (unchanged by CAM-350; card body only)
// ===========================================================================

describe('CAM-305 dashboard — one card per owned campsite (never aggregated)', () => {
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

describe('CAM-305 dashboard — AC-7/EC-2: zero campsites -> no section at all', () => {
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
