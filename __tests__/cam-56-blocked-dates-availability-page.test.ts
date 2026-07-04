/**
 * cam-56-blocked-dates-availability-page.test.ts — source-inspection tests for
 * the CAM-56 host availability page (list + create + cancel).
 *
 * The repo's vitest config runs in the `node` environment and only collects
 * `*.test.ts` (no jsdom/@testing-library/react installed — see vitest.config.ts),
 * so a real component-render test is not "cheap" here (it would require adding
 * new test infra, out of scope for this atomic backend-owned story). This file
 * follows the same source-inspection pattern already established by
 * __tests__/cam-190-avail1-blockeddate.test.ts to give structural coverage of
 * the 8-state / i18n / a11y contract without that new infra.
 *
 * AC coverage: AC-1/2 (create form fields + buttons), AC-4/5 (cancel confirm),
 * AC-7 (403 forbidden state), loading-ui-standard §5 (a11y wiring).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

const pageSrc = fs.readFileSync(
  path.join(process.cwd(), 'app/dashboard/campsites/[id]/availability/page.tsx'),
  'utf-8'
);

describe('CAM-56 availability page — i18n (no hardcoded copy)', () => {
  it('pulls all user-facing copy from t.blockedDates (i18n namespace), not hardcoded strings', () => {
    expect(pageSrc).toContain('const copy = t.blockedDates');
  });

  it('does not hardcode a Thai string literal outside the i18n layer', () => {
    // Thai unicode block U+0E00–U+0E7F. The only Thai-range text in this file
    // itself must live inside translations.json (imported), never inline here.
    const thaiRange = /[฀-๿]/;
    expect(thaiRange.test(pageSrc)).toBe(false);
  });
});

describe('CAM-56 availability page — 8 states present', () => {
  it('[loading] uses the client-fetch anti-flicker hook (useMinimumLoading) per loading-ui-standard §4', () => {
    expect(pageSrc).toContain('useMinimumLoading(loading');
  });

  it('[loading] renders a skeleton (not a spinner/blank) while showSkeleton is true', () => {
    expect(pageSrc).toContain('showSkeleton ?');
    expect(pageSrc).toContain('data-testid="skeleton--availability-list"');
  });

  it('[empty] renders the empty-state copy when there are no blocks', () => {
    expect(pageSrc).toContain('copy.emptyTitle');
    expect(pageSrc).toContain('copy.emptyDescription');
  });

  it('[error] renders ErrorBanner + a retry action on a non-403 load failure', () => {
    expect(pageSrc).toContain('loadError');
    expect(pageSrc).toContain('data-testid="btn--availability-retry"');
  });

  it('[forbidden/403] renders the shared ErrorState "forbidden" variant, not a custom 403 page', () => {
    expect(pageSrc).toContain('<ErrorState variant="forbidden" compact />');
  });

  it('[disabled] the confirm button is disabled until a full date range + valid reason are present', () => {
    expect(pageSrc).toContain('disabled={submitting || !range?.from || !range?.to || !!reasonError}');
  });

  it('[success] renders the create form and the cancel ConfirmDialog', () => {
    expect(pageSrc).toContain('data-testid="form--availability-block"');
    expect(pageSrc).toContain('data-testid="modal--availability-delete-confirm"');
  });
});

describe('CAM-56 availability page — a11y wiring (loading-ui-standard §5)', () => {
  it('sets aria-busy on the loading region', () => {
    expect(pageSrc).toContain('aria-busy={showSkeleton}');
  });

  it('uses role="status" + aria-live="polite" with a text label for the loading region', () => {
    expect(pageSrc).toContain('role="status" aria-live="polite"');
  });

  it('marks decorative skeleton rows aria-hidden', () => {
    expect(pageSrc).toContain('aria-hidden="true" data-testid="skeleton--availability-list"');
  });
});

describe('CAM-56 availability page — data-testid convention (<type>--<module>-<detail>)', () => {
  const REQUIRED_TESTIDS = [
    'page--campsite-availability',
    'btn--availability-add',
    'form--availability-block',
    'input--availability-reason',
    'btn--availability-cancel',
    'btn--availability-confirm',
    'section--availability-list',
    'modal--availability-delete-confirm',
  ];

  it.each(REQUIRED_TESTIDS)('includes the %s test id', (testId) => {
    expect(pageSrc).toContain(`data-testid="${testId}"`);
  });
});

describe('CAM-56 availability page — reuses existing primitives (no re-implementation)', () => {
  it('reuses DatePickerWithRange (components/ui/date-range-picker) rather than a hand-rolled calendar', () => {
    expect(pageSrc).toContain('DatePickerWithRange');
  });

  it('reuses the shared ConfirmDialog for the destructive cancel action', () => {
    expect(pageSrc).toContain('import { ConfirmDialog }');
  });

  it('client pre-validates with the SAME zod schema the server enforces (one schema, shared)', () => {
    expect(pageSrc).toContain('createBlockedDateSchema.safeParse(body)');
  });
});
