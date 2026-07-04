/**
 * cam-352-spot-management-page.test.ts — source-inspection tests for the
 * CAM-352 host spot-management screen (list + create + edit + soft-delete).
 *
 * Same testing constraint + precedent as
 * __tests__/cam-56-blocked-dates-availability-page.test.ts (vitest runs
 * `node` env, no jsdom/@testing-library/react) — source-inspection gives
 * structural coverage of the 8-state / i18n / a11y / testid contract.
 *
 * AC coverage: AC-1 (list + capacity template), AC-2 (empty state + add
 * button), AC-3/AC-4/EC-6 (loading skeleton / error+retry, never blank),
 * AC-7 (soft-delete confirm copy), AC-9/EC-8 (read-only gate for a
 * non-owner/non-admin), AC-11 (panorama badge on the list thumbnail).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

const pageSrc = fs.readFileSync(
  path.join(process.cwd(), 'app/dashboard/campsites/[id]/spots/page.tsx'),
  'utf-8'
);

describe('CAM-352 spots page — i18n (no hardcoded copy)', () => {
  it('pulls all user-facing copy from t.spotManagement (i18n namespace), not hardcoded strings', () => {
    expect(pageSrc).toContain('const copy = t.spotManagement');
  });

  it('does not hardcode a Thai string literal outside the i18n layer', () => {
    const thaiRange = /[฀-๿]/;
    expect(thaiRange.test(pageSrc)).toBe(false);
  });
});

describe('CAM-352 spots page — 8 states present', () => {
  it('[loading] uses the client-fetch anti-flicker hook (useMinimumLoading) per loading-ui-standard §4', () => {
    expect(pageSrc).toContain('useMinimumLoading(loading');
  });

  it('[loading] renders a skeleton mirroring the real row layout (thumbnail + 2 text lines + action button)', () => {
    expect(pageSrc).toContain('showSkeleton ?');
    expect(pageSrc).toContain('data-testid="skeleton--spots-list"');
    expect(pageSrc).toContain('h-16 w-16 rounded-xl');
  });

  it('[empty] AC-2: renders the exact empty-state copy with the add button visible on the page', () => {
    expect(pageSrc).toContain('copy.emptyTitle');
    expect(pageSrc).toContain('copy.emptyDescription');
    expect(pageSrc).toContain('data-testid="empty--spots-list"');
    expect(pageSrc).toContain('data-testid="btn--spots-add"');
  });

  it('[error] AC-4/EC-6: renders ErrorBanner + a retry action on a load failure (never blank)', () => {
    expect(pageSrc).toContain('loadError');
    expect(pageSrc).toContain('copy.loadFailed');
    expect(pageSrc).toContain('data-testid="btn--spots-retry"');
  });

  it('[disabled/hidden] AC-9/EC-8: the add + edit + delete controls render only when canManage is true', () => {
    expect(pageSrc).toContain('{canManage && (');
    // Both the header Add button and the per-row edit/delete actions are gated.
    const canManageGates = pageSrc.match(/\{canManage && \(/g) ?? [];
    expect(canManageGates.length).toBeGreaterThanOrEqual(3);
  });

  it('[success] renders the list rows + the edit dialog + the delete ConfirmDialog', () => {
    expect(pageSrc).toContain('data-testid={`row--spot-${spot.id}`}');
    expect(pageSrc).toContain('<SpotFormDialog');
    expect(pageSrc).toContain('data-testid="modal--spots-delete-confirm"');
  });
});

describe('CAM-352 spots page — AC-1/AC-6: capacity template rendered verbatim ({N} placeholder)', () => {
  it('uses copy.capacityLabel.replace("{N}", ...) — the exact placeholder from the spec', () => {
    expect(pageSrc).toContain('copy.capacityLabel.replace("{N}", String(spot.maxCampers))');
  });

  it('only shows the capacity line when maxCampers is present (optional field)', () => {
    expect(pageSrc).toContain('spot.maxCampers != null &&');
  });
});

describe('CAM-352 spots page — AC-11: panorama badge on the list thumbnail', () => {
  it('shows the panorama badge only when the first image kind === PANORAMA', () => {
    expect(pageSrc).toContain('firstImage.kind === "PANORAMA"');
    expect(pageSrc).toContain('copy.panoramaBadge');
  });

  it('reuses the Badge primitive (variant="overlay") — not a raw styled span (DESIGN.md R6)', () => {
    expect(pageSrc).toMatch(/<Badge\s*\n\s*variant="overlay"/);
  });
});

describe('CAM-352 spots page — AC-7/BR-2: soft-delete confirm + Thai copy verbatim', () => {
  it('passes the exact BR-2 confirm copy to ConfirmDialog', () => {
    expect(pageSrc).toContain('title={copy.deleteConfirmTitle}');
  });

  it('shows a forbidden toast (not a silent failure) on a 403 from DELETE (AC-9)', () => {
    const deleteBlock = pageSrc.slice(
      pageSrc.indexOf('const confirmDelete'),
      pageSrc.indexOf('const handleSaved') > -1 ? pageSrc.length : pageSrc.length
    );
    expect(deleteBlock).toContain("res.status === 403");
    expect(deleteBlock).toContain('toast.error(copy.forbiddenMessage)');
  });

  it('EC-3: a 404 (already gone / cross-camp id) refreshes the list rather than looping on stale state', () => {
    expect(pageSrc).toContain('res.status === 404');
    expect(pageSrc).toContain('toast.error(copy.notFoundMessage)');
    expect(pageSrc).toContain('await loadData()');
  });
});

describe('CAM-352 spots page — reuses existing primitives (no re-implementation)', () => {
  it('reuses ConfirmDialog for the destructive delete action', () => {
    expect(pageSrc).toContain('import { ConfirmDialog }');
  });

  it('reuses ImageWithFallback for the thumbnail (not a raw <img>)', () => {
    expect(pageSrc).toContain('import { ImageWithFallback }');
  });

  it('reuses formatCurrency from useLanguage (tabular-nums pricing, no hand-rolled formatting)', () => {
    expect(pageSrc).toContain('formatCurrency(Number(spot.pricePerNight))');
    expect(pageSrc).toContain('tabular-nums');
  });
});

describe('CAM-352 spots page — a11y wiring (loading-ui-standard §5)', () => {
  it('sets aria-busy on the loading region', () => {
    expect(pageSrc).toContain('aria-busy={showSkeleton}');
  });

  it('uses role="status" + aria-live="polite" with a text label for the loading region', () => {
    expect(pageSrc).toContain('role="status" aria-live="polite"');
  });

  it('every icon-only action button carries an aria-label', () => {
    expect(pageSrc).toContain('aria-label={`${copy.formTitleEdit}: ${spot.name}`}');
    expect(pageSrc).toContain('aria-label={`${copy.deleteAriaLabel}: ${spot.name}`}');
  });
});

describe('CAM-352 spots page — data-testid convention (<type>--<module>-<detail>)', () => {
  const REQUIRED_TESTIDS = [
    'page--campsite-spots',
    'btn--spots-add',
    'section--spots-list',
    'skeleton--spots-list',
    'alert--spots-load-error',
    'btn--spots-retry',
    'empty--spots-list',
    'modal--spots-delete-confirm',
  ];

  it.each(REQUIRED_TESTIDS)('includes the %s test id', (testId) => {
    expect(pageSrc).toContain(`data-testid="${testId}"`);
  });
});
