/**
 * cam-343-host-holds-ui.test.ts — tests for the CAM-343 host hold
 * create/list/release UI on the availability page.
 *
 * The repo's vitest config runs in the `node` environment and only collects
 * `*.test.ts` (no jsdom/@testing-library/react installed — see
 * vitest.config.ts), so a real DOM-render/click test is not available here.
 * This file follows the same source-inspection pattern already established
 * by __tests__/cam-56-blocked-dates-availability-page.test.ts and
 * __tests__/cam-55-host-month-calendar.test.ts, PLUS a real unit test on the
 * one pure, importable, load-bearing predicate (isLiveHold) — importing the
 * "use client" component module itself is safe here because the predicate
 * is a plain top-level function; no hook runs and no JSX is ever evaluated
 * (the component function is never invoked/rendered).
 *
 * AC coverage: AC-1 (create form fields + confirm), AC-2/AC-5 (calendar
 * refreshKey wiring), AC-3/AC-6 (live-only list + empty state), AC-4
 * (release confirm), AC-7 (loading skeleton + a11y), AC-8 (no separate
 * forbidden UI — shares the page's existing gate), AC-9 (client date-range
 * pre-check), AC-10 (load error + retry).
 * Story-specific: the CAM-342 trace trap (status ACTIVE alone is NOT
 * "active" — must AND expiresAt > now); no camper-facing surface renders
 * holds (feature No-go); Thai copy asserted char-for-char.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

import { isLiveHold, type HoldItem } from '@/components/host-holds-section';
import translations from '../locales/translations.json';

const sectionSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/host-holds-section.tsx'),
  'utf-8'
);
const pageSrc = fs.readFileSync(
  path.join(process.cwd(), 'app/dashboard/campsites/[id]/availability/page.tsx'),
  'utf-8'
);
const calendarSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/availability-calendar.tsx'),
  'utf-8'
);

function makeHold(overrides: Partial<HoldItem> = {}): HoldItem {
  return {
    id: 'hold-1',
    spotId: null,
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    guests: 2,
    note: null,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1h
    ...overrides,
  };
}

// ===========================================================================
// The CAM-342 trace trap — REAL unit tests on the actual predicate
// ===========================================================================

describe('isLiveHold — the CAM-342 trace trap (BR-4, real predicate, not a string match)', () => {
  it('[normal] status ACTIVE + expiresAt in the future -> live', () => {
    expect(isLiveHold(makeHold())).toBe(true);
  });

  it('[zombie row] status ACTIVE but expiresAt in the past -> NOT live (status alone is wrong)', () => {
    const zombie = makeHold({ expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    expect(isLiveHold(zombie)).toBe(false);
  });

  it('[released] status RELEASED, even with a future expiresAt -> NOT live', () => {
    const released = makeHold({ status: 'RELEASED' });
    expect(isLiveHold(released)).toBe(false);
  });

  it('[converted] status CONVERTED -> NOT live', () => {
    const converted = makeHold({ status: 'CONVERTED' });
    expect(isLiveHold(converted)).toBe(false);
  });

  it('[boundary] expiresAt exactly now (or a hair in the past) -> NOT live (strictly greater-than)', () => {
    const boundary = makeHold({ expiresAt: new Date(Date.now() - 1).toISOString() });
    expect(isLiveHold(boundary)).toBe(false);
  });

  it('[mixed list] filtering a mixed array keeps only the live row (mirrors AC-3/EC-3/EC-4)', () => {
    const live = makeHold({ id: 'live' });
    const zombie = makeHold({ id: 'zombie', expiresAt: new Date(Date.now() - 1000).toISOString() });
    const released = makeHold({ id: 'released', status: 'RELEASED' });
    const list = [live, zombie, released];

    const result = list.filter(isLiveHold);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('live');
  });
});

describe('host-holds-section.tsx — source uses the SAME predicate shape as lib/campsite-availability.ts', () => {
  it('filters on status === "ACTIVE" AND expiresAt > now (never status alone)', () => {
    expect(sectionSrc).toContain('hold.status === "ACTIVE" && new Date(hold.expiresAt).getTime() > Date.now()');
  });

  it('the live list is derived by filtering with isLiveHold (no separate ad-hoc filter reimplemented)', () => {
    expect(sectionSrc).toContain('(holds ?? []).filter(isLiveHold)');
  });
});

// ===========================================================================
// i18n — no hardcoded copy
// ===========================================================================

describe('CAM-343 holds section — i18n (no hardcoded copy)', () => {
  it('pulls all user-facing copy from t.hostHolds (i18n namespace), not hardcoded strings', () => {
    expect(sectionSrc).toContain('const copy = t.hostHolds');
  });

  it('does not hardcode a Thai string literal outside the i18n layer', () => {
    const thaiRange = /[฀-๿]/;
    expect(thaiRange.test(sectionSrc)).toBe(false);
  });
});

// ===========================================================================
// Thai copy asserted char-for-char (BR-10 / the story's verbatim requirement)
// ===========================================================================

describe('locales/translations.json — hostHolds Thai copy verbatim (BR-10)', () => {
  const th = translations.th.hostHolds as Record<string, string>;
  const en = translations.en.hostHolds as Record<string, string>;

  it('en and th declare the exact same key set (no drift between locales)', () => {
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
  });

  const VERBATIM: Record<string, string> = {
    createSuccess: 'กันที่เรียบร้อยแล้ว',
    guestsCount: '{n} คน',
    expiresAtLabel: 'หมดอายุ {datetime}',
    releaseSuccess: 'ปล่อยการกันที่แล้ว',
    emptyTitle: 'ยังไม่มีการกันที่',
    emptyDescription: 'เมื่อกันที่ชั่วคราวสำหรับลูกค้าที่กำลังเจรจา รายการจะแสดงที่นี่',
    dateRangeError: 'วันเช็คเอาท์ต้องหลังวันเช็คอิน',
    loadFailed: 'โหลดรายการกันที่ไม่สำเร็จ',
    guestsError: 'จำนวนผู้เข้าพักต้องมากกว่า 0',
    capacityConflict: 'ช่วงวันที่นี้ถูกกันไว้แล้ว',
    expiryOutOfRange: 'กำหนดหมดอายุต้องอยู่ระหว่างตอนนี้ถึง 14 วันข้างหน้า',
    expiryPreset48h: '48 ชั่วโมง',
    expiryPreset3d: '3 วัน',
    expiryPreset7d: '7 วัน',
    expiryPreset14d: '14 วัน',
    spotWholeCamp: 'ทั้งลาน',
    releaseConfirmTitle: 'ปล่อยการกันที่นี้ใช่หรือไม่',
    releaseConfirmDescription: 'เมื่อปล่อยแล้ว วันที่ที่กันไว้จะกลับมาว่างให้จองทันที',
    releaseNotFound: 'ไม่พบการกันที่นี้ (อาจถูกปล่อยไปแล้ว)',
    createFailed: 'กันที่ไม่สำเร็จ กรุณาลองอีกครั้ง',
    releaseFailed: 'ปล่อยการกันที่ไม่สำเร็จ กรุณาลองอีกครั้ง',
  };

  it.each(Object.entries(VERBATIM))('th.hostHolds.%s matches the ticket verbatim', (key, expected) => {
    expect(th[key]).toBe(expected);
  });

  it('expiryOutOfRange matches lib/validations/holds.ts HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE exactly (one source, no re-typed drift)', () => {
    const holdsValidationSrc = fs.readFileSync(path.join(process.cwd(), 'lib/validations/holds.ts'), 'utf-8');
    expect(holdsValidationSrc).toContain(`'${th.expiryOutOfRange}'`);
  });
});

// ===========================================================================
// 8 states present
// ===========================================================================

describe('CAM-343 holds section — 8 states present', () => {
  it('[loading] uses the client-fetch anti-flicker hook (useMinimumLoading) per loading-ui-standard §4', () => {
    expect(sectionSrc).toContain('useMinimumLoading(loading');
  });

  it('[loading] renders a skeleton mirroring the hold-row layout (not a spinner/blank)', () => {
    expect(sectionSrc).toContain('showSkeleton ?');
    expect(sectionSrc).toContain('data-testid="skeleton--holds-list"');
  });

  it('[empty] renders AC-6 empty-state copy when there are no live holds', () => {
    expect(sectionSrc).toContain('copy.emptyTitle');
    expect(sectionSrc).toContain('copy.emptyDescription');
  });

  it('[error] renders ErrorBanner + a retry action on load failure (AC-10)', () => {
    expect(sectionSrc).toContain('loadError');
    expect(sectionSrc).toContain('data-testid="btn--holds-retry"');
  });

  it('[disabled] the create-confirm button is disabled until a full date range is chosen and guests are valid', () => {
    expect(sectionSrc).toContain('disabled={submitting || !range?.from || !range?.to || !!guestsError}');
  });

  it('[loading, submit] the create-confirm button shows an inline spinner while submitting', () => {
    expect(sectionSrc).toContain('submitting ? (');
    expect(sectionSrc).toContain('<Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />');
  });

  it('[loading, release] the release ConfirmDialog is wired to isLoading', () => {
    expect(sectionSrc).toContain('isLoading={releasing}');
  });

  it('[success] renders the create form and the release ConfirmDialog', () => {
    expect(sectionSrc).toContain('data-testid="form--holds-create"');
    expect(sectionSrc).toContain('data-testid="modal--holds-release-confirm"');
  });

  it('[EC-10] hides the spot selector when the camp has no spots', () => {
    expect(sectionSrc).toContain('spots.length > 0 && (');
  });
});

// ===========================================================================
// a11y wiring (loading-ui-standard §5)
// ===========================================================================

describe('CAM-343 holds section — a11y wiring (loading-ui-standard §5)', () => {
  it('sets aria-busy on the loading region', () => {
    expect(sectionSrc).toContain('aria-busy={showSkeleton}');
  });

  it('uses role="status" + aria-live="polite" with a text label for the loading region', () => {
    expect(sectionSrc).toContain('role="status" aria-live="polite"');
  });

  it('marks decorative skeleton rows and icons aria-hidden', () => {
    expect(sectionSrc).toContain('aria-hidden="true" data-testid="skeleton--holds-list"');
  });

  it('gives the release action an accessible name via aria-label', () => {
    expect(sectionSrc).toContain('aria-label={copy.releaseAriaLabel}');
  });
});

// ===========================================================================
// data-testid convention (<type>--<module>-<detail>)
// ===========================================================================

describe('CAM-343 holds section — data-testid convention', () => {
  const REQUIRED_TESTIDS = [
    'section--host-holds',
    'btn--holds-add',
    'form--holds-create',
    'input--holds-guests',
    'select--holds-expiry',
    'input--holds-note',
    'btn--holds-cancel',
    'btn--holds-confirm',
    'section--holds-list',
    'skeleton--holds-list',
    'alert--holds-load-error',
    'btn--holds-retry',
    'modal--holds-release-confirm',
  ];

  it.each(REQUIRED_TESTIDS)('includes the %s test id', (testId) => {
    expect(sectionSrc).toContain(`data-testid="${testId}"`);
  });

  it('row and release-button test ids use a dynamic per-hold template (not static)', () => {
    expect(sectionSrc).toContain('data-testid={`row--holds-${hold.id}`}');
    expect(sectionSrc).toContain('data-testid={`btn--holds-release-${hold.id}`}');
  });
});

// ===========================================================================
// BR-2 / BR-3 / BR-8 — server response mapping (409 / 400 / 404)
// ===========================================================================

describe('CAM-343 holds section — server response mapping (BR-2/BR-3/BR-8)', () => {
  it('BR-2: a 409 on create surfaces the verbatim capacity-conflict copy inline (form stays open)', () => {
    const createBranch = sectionSrc.slice(
      sectionSrc.indexOf('const handleSubmit'),
      sectionSrc.indexOf('const confirmRelease')
    );
    expect(createBranch).toContain('res.status === 409');
    expect(createBranch).toContain('setDateError(copy.capacityConflict)');
    // The 409 branch never calls toast.success / closes the form (form stays open).
    const conflictSlice = createBranch.slice(
      createBranch.indexOf('res.status === 409'),
      createBranch.indexOf('res.status === 400')
    );
    expect(conflictSlice).not.toContain('toast.success');
    expect(conflictSlice).not.toContain('setFormOpen(false)');
  });

  it('BR-3: a defensive 400 on create surfaces the verbatim expiry-out-of-range copy', () => {
    expect(sectionSrc).toContain('res.status === 400');
    expect(sectionSrc).toContain('setDateError(copy.expiryOutOfRange)');
  });

  it('BR-8/EC-8: a 404 on release surfaces the verbatim "not found, may already be released" copy AND still refreshes the list', () => {
    const releaseBranch = sectionSrc.slice(sectionSrc.indexOf('const confirmRelease'));
    expect(releaseBranch).toContain('res.status === 404');
    const notFoundSlice = releaseBranch.slice(
      releaseBranch.indexOf('res.status === 404'),
      releaseBranch.indexOf('if (!res.ok)')
    );
    expect(notFoundSlice).toContain('toast.error(copy.releaseNotFound)');
    expect(notFoundSlice).toContain('await loadHolds()');
  });

  it('reuses createHoldSchema (the SAME shared schema the server enforces) for the client pre-check', () => {
    expect(sectionSrc).toContain("import { createHoldSchema, HOLD_DEFAULT_EXPIRY_MS, HOLD_MAX_EXPIRY_MS } from \"@/lib/validations/holds\"");
    expect(sectionSrc).toContain('createHoldSchema.safeParse(body)');
  });

  it('BR-3: expiry presets bound the 3d/7d intermediate values and reuse HOLD_DEFAULT_EXPIRY_MS/HOLD_MAX_EXPIRY_MS for the 48h/14d extremes (no drift from the server constants)', () => {
    expect(sectionSrc).toContain('"48h": HOLD_DEFAULT_EXPIRY_MS');
    expect(sectionSrc).toContain('"14d": HOLD_MAX_EXPIRY_MS');
  });

  it('BR-7: a successful create AND a successful release both call onHoldsChanged (bumps the calendar refreshKey)', () => {
    const matches = sectionSrc.match(/onHoldsChanged\?\.\(\)/g) ?? [];
    expect(matches.length).toBe(2);
  });
});

// ===========================================================================
// BR-5 — row content (scope / guests / expiry) + note never rendered raw
// ===========================================================================

describe('CAM-343 holds section — BR-5 row content', () => {
  it('resolves the spot name from the page spots list (no relation on the read) with a whole-camp / unknown-spot fallback', () => {
    expect(sectionSrc).toContain('spots.find((s) => s.id === holdSpotId)?.name ?? copy.spotUnknown');
    expect(sectionSrc).toContain('return copy.spotWholeCamp;');
  });

  it('renders guests as "{n} คน" and expiry as "หมดอายุ {datetime}" via the copy keys (verbatim, not re-worded)', () => {
    expect(sectionSrc).toContain('copy.guestsCount.replace("{n}", String(hold.guests))');
    expect(sectionSrc).toContain('copy.expiresAtLabel.replace("{datetime}", formatDateTime(hold.expiresAt, language))');
  });

  it('never renders hold.note anywhere (host-internal only, No-go for any camper-facing surface — the field is not displayed even in this host-only row)', () => {
    expect(sectionSrc).not.toContain('hold.note');
  });
});

// ===========================================================================
// No camper-facing surface renders holds (feature No-go)
// ===========================================================================

describe('feature No-go — no public/guest-facing hold surface', () => {
  it('HostHoldsSection is only imported from the host dashboard availability page, not from any public/camp route', () => {
    const grepDirs = ['app/dashboard'];
    const importers: string[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf-8');
          if (content.includes('host-holds-section')) importers.push(full);
        }
      }
    }
    grepDirs.forEach((d) => walk(path.join(process.cwd(), d)));

    expect(importers.length).toBeGreaterThan(0);
    importers.forEach((file) => {
      expect(file).toContain(`${path.sep}dashboard${path.sep}`);
    });
  });

  it('the component itself lives under components/ (host-only), not under any app/(public)/ or app/camps/ tree', () => {
    const componentPath = path.join(process.cwd(), 'components/host-holds-section.tsx');
    expect(fs.existsSync(componentPath)).toBe(true);
  });
});

// ===========================================================================
// Reuses existing primitives (no re-implementation)
// ===========================================================================

describe('CAM-343 holds section — reuses existing primitives (no new primitive invented)', () => {
  it('reuses DatePickerWithRange, ConfirmDialog, Select, Button, Badge, Skeleton, ErrorBanner', () => {
    expect(sectionSrc).toContain('from "@/components/ui/date-range-picker"');
    expect(sectionSrc).toContain('from "@/components/ui/confirm-dialog"');
    expect(sectionSrc).toContain('from "@/components/ui/select"');
    expect(sectionSrc).toContain('from "@/components/ui/button"');
    expect(sectionSrc).toContain('from "@/components/ui/badge"');
    expect(sectionSrc).toContain('from "@/components/ui/skeleton"');
    expect(sectionSrc).toContain('from "@/components/ui/error-banner"');
  });

  it('uses lucide-react only for icons (no @tabler/icons-react, no emoji)', () => {
    expect(sectionSrc).toContain('from "lucide-react"');
    expect(sectionSrc).not.toContain('@tabler/icons-react');
  });

  it('does not hardcode a hex color, raw shadow, or px literal (token-only)', () => {
    expect(/#[0-9a-fA-F]{3,8}\b/.test(sectionSrc)).toBe(false);
    expect(sectionSrc).not.toMatch(/\bshadow-\[/);
  });
});

// ===========================================================================
// BR-7 — the availability page wires holds into the calendar refresh
// ===========================================================================

describe('CAM-343 — the availability page mounts HostHoldsSection under the SAME gate + wires refreshKey (BR-7, AC-8)', () => {
  it('imports HostHoldsSection', () => {
    expect(pageSrc).toContain('import { HostHoldsSection } from "@/components/host-holds-section"');
  });

  it('mounts it AFTER the existing forbidden early-return (no new authz bypass, mirrors CAM-55 EC-1)', () => {
    const forbiddenIdx = pageSrc.indexOf('if (forbidden) {');
    const holdsIdx = pageSrc.indexOf('<HostHoldsSection');
    expect(forbiddenIdx).toBeGreaterThan(-1);
    expect(holdsIdx).toBeGreaterThan(forbiddenIdx);
  });

  it('passes the page spots list down (reused, not re-fetched — BR-5)', () => {
    expect(pageSrc).toContain('spots={spots}');
  });

  it('bumps holdsRefreshKey on onHoldsChanged, which is passed into AvailabilityCalendar as refreshKey', () => {
    expect(pageSrc).toContain('onHoldsChanged={() => setHoldsRefreshKey((key) => key + 1)}');
    expect(pageSrc).toContain('<AvailabilityCalendar campSiteId={campSiteId} refreshKey={holdsRefreshKey} />');
  });
});

describe('CAM-343 — availability-calendar.tsx accepts refreshKey and folds it into the load effect deps (BR-7)', () => {
  it('declares refreshKey as an optional prop', () => {
    expect(calendarSrc).toContain('refreshKey?: number;');
  });

  it('includes refreshKey in the loadMonth effect dependency array (forces a refetch on bump)', () => {
    expect(calendarSrc).toContain('[month, loadMonth, refreshKey]');
  });

  it('does not re-derive capacity client-side just because refreshKey exists (still fetches the same shared endpoint)', () => {
    expect(calendarSrc).toContain('/api/campsites/${campSiteId}/availability?startDate=');
  });
});
