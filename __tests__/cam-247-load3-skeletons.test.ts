/**
 * cam-247-load3-skeletons.test.ts — LOAD-3 / CAM-247
 *
 * Section-level skeletons: dashboard, profile, bookings-list, campground detail.
 *
 * AC coverage (source-inspect layer — same precedent as cam-197/246):
 *
 *   AC-1  Dashboard: section skeleton + chrome-instant pattern
 *         - page.tsx uses useMinimumLoading (anti-flicker)
 *         - page.tsx does NOT use LoadingSpinner as full-page loader
 *         - page.tsx imports DashboardOverviewSkeleton
 *         - loading.tsx imports DashboardOverviewSkeleton (NOT LoadingSpinner)
 *         - loading.tsx has role="status" + aria-busy + aria-live + sr-only
 *
 *   AC-2  Profile: section skeleton + no fullScreen spinner
 *         - ProfileFormSkeleton component exists + correct a11y attrs
 *         - page.tsx imports ProfileFormSkeleton + useMinimumLoading
 *         - page.tsx does NOT use LoadingSpinner fullScreen
 *         - loading.tsx imports ProfileFormSkeleton
 *
 *   AC-3  Bookings: section skeleton + no client spinner
 *         - BookingListSkeleton component exists + correct a11y attrs
 *         - page.tsx imports BookingListSkeleton + useMinimumLoading
 *         - page.tsx does NOT use LoadingSpinner as data loader
 *         - loading.tsx imports BookingListSkeleton
 *
 *   AC-4  Campground detail: route-specific loading.tsx (not root shell)
 *         - app/campgrounds/[slug]/loading.tsx exists
 *         - has role="status" + aria-busy + aria-live + sr-only Thai label
 *         - contains detail-shaped content (cover image + name + booking card)
 *         - does NOT render CampgroundGridSkeleton (wrong shape for a detail page)
 *
 *   AC-5  Anti-flicker: client-fetch routes use useMinimumLoading
 *         - dashboard, profile, bookings all import useMinimumLoading
 *
 *   AC-6  a11y cross-cutting
 *         - all new skeletons have role="status" + aria-busy="true" + aria-live="polite"
 *         - all have an sr-only Thai label from common.loading_sr (not hardcoded)
 *         - decorative shapes are aria-hidden="true"
 *         - token-only (no hardcoded hex)
 *
 * Layer: source-inspect (same as cam-197, cam-246).
 * Prove-It: each assertion names the exact change that would make it fail.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = process.cwd();

function src(relPath: string): string {
    return readFileSync(path.join(root, relPath), 'utf-8');
}

const dashboardPageSrc        = src('app/dashboard/page.tsx');
const dashboardLoadingSrc     = src('app/dashboard/loading.tsx');
const profilePageSrc          = src('app/profile/page.tsx');
const profileLoadingSrc       = src('app/profile/loading.tsx');
const profileSkeletonSrc      = src('components/ui/profile-form-skeleton.tsx');
const bookingsPageSrc         = src('app/bookings/page.tsx');
const bookingsLoadingSrc      = src('app/bookings/loading.tsx');
const bookingSkeletonSrc      = src('components/ui/booking-list-skeleton.tsx');
const detailLoadingSrc        = src('app/campgrounds/[slug]/loading.tsx');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const translations = require('../locales/translations.json') as {
    en: { common: Record<string, string> };
    th: { common: Record<string, string> };
};

// ===========================================================================
// AC-1 — Dashboard: section-level skeleton (not full-page spinner)
// ===========================================================================

describe('AC-1 — Dashboard section-level skeleton (app/dashboard/page.tsx + loading.tsx)', () => {

    // Prove-It: FAILS if useMinimumLoading import is removed from dashboard page
    it('[anti-flicker] page.tsx imports useMinimumLoading', () => {
        expect(dashboardPageSrc).toContain('useMinimumLoading');
    });

    // Prove-It: FAILS if DashboardOverviewSkeleton import is removed from page.tsx
    it('[skeleton] page.tsx imports DashboardOverviewSkeleton', () => {
        expect(dashboardPageSrc).toContain('DashboardOverviewSkeleton');
    });

    // Prove-It: FAILS if the full-page pattern (early return with spinner) is re-introduced
    it('[removed] page.tsx does NOT import LoadingSpinner', () => {
        expect(dashboardPageSrc).not.toContain('LoadingSpinner');
    });

    // Prove-It: FAILS if fullScreen prop usage is re-introduced
    it('[removed] page.tsx does NOT use fullScreen spinner prop', () => {
        expect(dashboardPageSrc).not.toContain('fullScreen');
    });

    // Prove-It: FAILS if console.log is re-introduced (debug UI guard)
    it('[debug] page.tsx has no console.log statements', () => {
        expect(dashboardPageSrc).not.toContain('console.log');
    });

    // Prove-It: FAILS if DashboardOverviewSkeleton import is removed from loading.tsx
    it('[loading.tsx] loading.tsx imports DashboardOverviewSkeleton', () => {
        expect(dashboardLoadingSrc).toContain('DashboardOverviewSkeleton');
    });

    // Prove-It: FAILS if LoadingSpinner is added to loading.tsx
    it('[loading.tsx] loading.tsx does NOT import LoadingSpinner', () => {
        expect(dashboardLoadingSrc).not.toContain('LoadingSpinner');
    });

    // Prove-It: FAILS if role="status" is removed from loading.tsx
    it('[a11y] loading.tsx has role="status"', () => {
        expect(dashboardLoadingSrc).toContain('role="status"');
    });

    // Prove-It: FAILS if aria-busy="true" is removed from loading.tsx
    it('[a11y] loading.tsx has aria-busy="true"', () => {
        expect(dashboardLoadingSrc).toContain('aria-busy="true"');
    });

    // Prove-It: FAILS if aria-live="polite" is removed from loading.tsx
    it('[a11y] loading.tsx has aria-live="polite"', () => {
        expect(dashboardLoadingSrc).toContain('aria-live="polite"');
    });

    // Prove-It: FAILS if the sr-only label is removed
    it('[a11y] loading.tsx has an sr-only Thai label', () => {
        expect(dashboardLoadingSrc).toContain('sr-only');
    });

    // Prove-It: FAILS if "use client" is added to loading.tsx
    it('[server] loading.tsx has no "use client" directive', () => {
        const lines = dashboardLoadingSrc.split('\n');
        const directive = lines.find(l => l.trim() === '"use client"' || l.trim() === "'use client'");
        expect(directive).toBeUndefined();
    });

    // Prove-It: FAILS if data-testid is removed from page
    it('[testid] page.tsx has data-testid="page--dashboard-overview"', () => {
        expect(dashboardPageSrc).toContain('data-testid="page--dashboard-overview"');
    });

    // Prove-It: FAILS if section data-testid is removed
    it('[testid] page.tsx has data-testid="section--dashboard-data"', () => {
        expect(dashboardPageSrc).toContain('data-testid="section--dashboard-data"');
    });

    // Prove-It: FAILS if token-only rule is broken (no hardcoded hex)
    it('[tokens] page.tsx has no hardcoded hex color', () => {
        expect(dashboardPageSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
});

// ===========================================================================
// AC-2 — Profile: ProfileFormSkeleton + no fullScreen spinner
// ===========================================================================

describe('AC-2 — Profile section-level skeleton (components/ui/profile-form-skeleton.tsx)', () => {

    // Prove-It: FAILS if role="status" is removed from ProfileFormSkeleton
    it('[a11y] ProfileFormSkeleton has role="status"', () => {
        expect(profileSkeletonSrc).toContain('role="status"');
    });

    // Prove-It: FAILS if aria-busy="true" is removed
    it('[a11y] ProfileFormSkeleton has aria-busy="true"', () => {
        expect(profileSkeletonSrc).toContain('aria-busy="true"');
    });

    // Prove-It: FAILS if aria-live="polite" is removed
    it('[a11y] ProfileFormSkeleton has aria-live="polite"', () => {
        expect(profileSkeletonSrc).toContain('aria-live="polite"');
    });

    // Prove-It: FAILS if sr-only label is removed
    it('[a11y] ProfileFormSkeleton has sr-only Thai label', () => {
        expect(profileSkeletonSrc).toContain('sr-only');
    });

    // Prove-It: FAILS if SR_LABEL is disconnected from translations
    it('[i18n] ProfileFormSkeleton reads SR_LABEL from translations.th.common.loading_sr', () => {
        expect(profileSkeletonSrc).toContain('translations.th.common.loading_sr');
    });

    // Prove-It: FAILS if decorative wrapper loses aria-hidden
    it('[a11y] ProfileFormSkeleton has aria-hidden="true" on decorative content', () => {
        expect(profileSkeletonSrc).toContain('aria-hidden="true"');
    });

    // Prove-It: FAILS if rounded-full is removed from avatar placeholder
    it('[shape] ProfileFormSkeleton has a rounded-full avatar block', () => {
        expect(profileSkeletonSrc).toContain('rounded-full');
    });

    // Prove-It: FAILS if Skeleton import is removed
    it('[primitive] ProfileFormSkeleton uses <Skeleton> from ui/skeleton', () => {
        expect(profileSkeletonSrc).toContain('@/components/ui/skeleton');
        expect(profileSkeletonSrc).toContain('<Skeleton');
    });

    // Prove-It: FAILS if hardcoded hex is added
    it('[tokens] ProfileFormSkeleton has no hardcoded hex color', () => {
        expect(profileSkeletonSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    // Prove-It: FAILS if data-testid is removed
    it('[testid] ProfileFormSkeleton has data-testid="section--profile-form-skeleton"', () => {
        expect(profileSkeletonSrc).toContain('data-testid="section--profile-form-skeleton"');
    });
});

describe('AC-2 — Profile page.tsx + loading.tsx', () => {

    // Prove-It: FAILS if ProfileFormSkeleton import is removed from page.tsx
    it('[skeleton] page.tsx imports ProfileFormSkeleton', () => {
        expect(profilePageSrc).toContain('ProfileFormSkeleton');
    });

    // Prove-It: FAILS if useMinimumLoading is removed from page.tsx
    it('[anti-flicker] page.tsx imports useMinimumLoading', () => {
        expect(profilePageSrc).toContain('useMinimumLoading');
    });

    // Prove-It: FAILS if fullScreen spinner is re-introduced
    it('[removed] page.tsx does NOT use LoadingSpinner fullScreen', () => {
        expect(profilePageSrc).not.toContain('fullScreen');
    });

    // Prove-It: FAILS if LoadingSpinner is re-imported
    it('[removed] page.tsx does NOT import LoadingSpinner', () => {
        expect(profilePageSrc).not.toContain('LoadingSpinner');
    });

    // Prove-It: FAILS if ProfileFormSkeleton import is removed from loading.tsx
    it('[loading.tsx] loading.tsx imports ProfileFormSkeleton', () => {
        expect(profileLoadingSrc).toContain('ProfileFormSkeleton');
    });

    // Prove-It: FAILS if "use client" is added to loading.tsx
    it('[server] loading.tsx has no "use client" directive', () => {
        const lines = profileLoadingSrc.split('\n');
        const directive = lines.find(l => l.trim() === '"use client"' || l.trim() === "'use client'");
        expect(directive).toBeUndefined();
    });

    // Prove-It: FAILS if data-testid is removed from page
    it('[testid] page.tsx has data-testid="page--profile"', () => {
        expect(profilePageSrc).toContain('data-testid="page--profile"');
    });
});

// ===========================================================================
// AC-3 — Bookings: BookingListSkeleton + no client spinner
// ===========================================================================

describe('AC-3 — Bookings section-level skeleton (components/ui/booking-list-skeleton.tsx)', () => {

    // Prove-It: FAILS if role="status" is removed from BookingListSkeleton
    it('[a11y] BookingListSkeleton has role="status"', () => {
        expect(bookingSkeletonSrc).toContain('role="status"');
    });

    // Prove-It: FAILS if aria-busy="true" is removed
    it('[a11y] BookingListSkeleton has aria-busy="true"', () => {
        expect(bookingSkeletonSrc).toContain('aria-busy="true"');
    });

    // Prove-It: FAILS if aria-live="polite" is removed
    it('[a11y] BookingListSkeleton has aria-live="polite"', () => {
        expect(bookingSkeletonSrc).toContain('aria-live="polite"');
    });

    // Prove-It: FAILS if sr-only label is removed
    it('[a11y] BookingListSkeleton has sr-only Thai label', () => {
        expect(bookingSkeletonSrc).toContain('sr-only');
    });

    // Prove-It: FAILS if SR_LABEL is disconnected from translations
    it('[i18n] BookingListSkeleton reads SR_LABEL from translations.th.common.loading_sr', () => {
        expect(bookingSkeletonSrc).toContain('translations.th.common.loading_sr');
    });

    // Prove-It: FAILS if decorative wrapper loses aria-hidden
    it('[a11y] BookingListSkeleton has aria-hidden="true" on decorative content', () => {
        expect(bookingSkeletonSrc).toContain('aria-hidden="true"');
    });

    // Prove-It: FAILS if Skeleton import is removed
    it('[primitive] BookingListSkeleton uses <Skeleton> from ui/skeleton', () => {
        expect(bookingSkeletonSrc).toContain('@/components/ui/skeleton');
        expect(bookingSkeletonSrc).toContain('<Skeleton');
    });

    // Prove-It: FAILS if hardcoded hex is added
    it('[tokens] BookingListSkeleton has no hardcoded hex color', () => {
        expect(bookingSkeletonSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    // Prove-It: FAILS if data-testid is removed
    it('[testid] BookingListSkeleton has data-testid="section--booking-list-skeleton"', () => {
        expect(bookingSkeletonSrc).toContain('data-testid="section--booking-list-skeleton"');
    });

    // Prove-It: FAILS if count prop is removed (must be configurable)
    it('[props] BookingListSkeleton accepts a count prop with default', () => {
        expect(bookingSkeletonSrc).toContain('count = 3');
    });
});

describe('AC-3 — Bookings page.tsx + loading.tsx', () => {

    // Prove-It: FAILS if BookingListSkeleton import is removed from page.tsx
    it('[skeleton] page.tsx imports BookingListSkeleton', () => {
        expect(bookingsPageSrc).toContain('BookingListSkeleton');
    });

    // Prove-It: FAILS if useMinimumLoading is removed from page.tsx
    it('[anti-flicker] page.tsx imports useMinimumLoading', () => {
        expect(bookingsPageSrc).toContain('useMinimumLoading');
    });

    // Prove-It: FAILS if LoadingSpinner is re-introduced
    it('[removed] page.tsx does NOT import LoadingSpinner', () => {
        expect(bookingsPageSrc).not.toContain('LoadingSpinner');
    });

    // Prove-It: FAILS if BookingListSkeleton import is removed from loading.tsx
    it('[loading.tsx] loading.tsx imports BookingListSkeleton', () => {
        expect(bookingsLoadingSrc).toContain('BookingListSkeleton');
    });

    // Prove-It: FAILS if "use client" is added to loading.tsx
    it('[server] loading.tsx has no "use client" directive', () => {
        const lines = bookingsLoadingSrc.split('\n');
        const directive = lines.find(l => l.trim() === '"use client"' || l.trim() === "'use client'");
        expect(directive).toBeUndefined();
    });

    // Prove-It: FAILS if data-testid is removed from header section
    it('[testid] page.tsx has data-testid="section--bookings-header"', () => {
        expect(bookingsPageSrc).toContain('data-testid="section--bookings-header"');
    });
});

// ===========================================================================
// AC-4 — Campground detail: route-specific loading.tsx (not root shell or grid)
// ===========================================================================

describe('AC-4 — Campground detail loading.tsx (app/campgrounds/[slug]/loading.tsx)', () => {

    // Prove-It: FAILS if role="status" is removed from detail loading.tsx
    it('[a11y] has role="status"', () => {
        expect(detailLoadingSrc).toContain('role="status"');
    });

    // Prove-It: FAILS if aria-busy="true" is removed
    it('[a11y] has aria-busy="true"', () => {
        expect(detailLoadingSrc).toContain('aria-busy="true"');
    });

    // Prove-It: FAILS if aria-live="polite" is removed
    it('[a11y] has aria-live="polite"', () => {
        expect(detailLoadingSrc).toContain('aria-live="polite"');
    });

    // Prove-It: FAILS if sr-only Thai label is removed
    it('[a11y] has sr-only label from i18n (not hardcoded)', () => {
        expect(detailLoadingSrc).toContain('sr-only');
        expect(detailLoadingSrc).toContain('SR_LABEL');
    });

    // Prove-It: FAILS if the hero cover skeleton is removed
    it('[shape] has a cover/hero image skeleton (aspect-[4/3] or similar)', () => {
        expect(detailLoadingSrc).toContain('aspect-[4/3]');
    });

    // Prove-It: FAILS if the booking card skeleton is removed
    it('[shape] has a booking-card right-column skeleton', () => {
        // The sticky booking panel has a price + date inputs + reserve button
        expect(detailLoadingSrc).toContain('sticky');
    });

    // Prove-It: FAILS if CampgroundGridSkeleton is introduced (wrong shape for detail)
    it('[regression] does NOT render CampgroundGridSkeleton (wrong shape for a detail page)', () => {
        const noComments = detailLoadingSrc
            .replace(/\/\/[^\n]*/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
        expect(noComments).not.toContain('CampgroundGridSkeleton');
    });

    // Prove-It: FAILS if hardcoded hex is added
    it('[tokens] has no hardcoded hex color', () => {
        expect(detailLoadingSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    // Prove-It: FAILS if "use client" is added (must stay a Server Component)
    it('[server] has no "use client" directive', () => {
        const lines = detailLoadingSrc.split('\n');
        const directive = lines.find(l => l.trim() === '"use client"' || l.trim() === "'use client'");
        expect(directive).toBeUndefined();
    });

    // Prove-It: FAILS if data-testid is removed
    it('[testid] has data-testid="shell--campground-detail-loading"', () => {
        expect(detailLoadingSrc).toContain('data-testid="shell--campground-detail-loading"');
    });

    // Prove-It: FAILS if SR_LABEL is disconnected from translations
    it('[i18n] reads SR_LABEL from translations.th.common.loading_sr (not hardcoded)', () => {
        expect(detailLoadingSrc).toContain('translations.th.common.loading_sr');
    });
});

// ===========================================================================
// AC-5 — Anti-flicker: all client-fetch routes use useMinimumLoading
// ===========================================================================

describe('AC-5 — useMinimumLoading used in all client-fetch routes', () => {

    // Prove-It: FAILS if useMinimumLoading is removed from dashboard page
    it('[dashboard] page.tsx uses useMinimumLoading for anti-flicker', () => {
        expect(dashboardPageSrc).toContain('useMinimumLoading');
    });

    // Prove-It: FAILS if useMinimumLoading is removed from profile page
    it('[profile] page.tsx uses useMinimumLoading for anti-flicker', () => {
        expect(profilePageSrc).toContain('useMinimumLoading');
    });

    // Prove-It: FAILS if useMinimumLoading is removed from bookings page
    it('[bookings] page.tsx uses useMinimumLoading for anti-flicker', () => {
        expect(bookingsPageSrc).toContain('useMinimumLoading');
    });
});

// ===========================================================================
// AC-6 — i18n: common.loading_sr key still present in both locales
// ===========================================================================

describe('AC-6 — common.loading_sr i18n key (regression guard)', () => {

    // Prove-It: FAILS if common.loading_sr is removed from EN
    it('[i18n] common.loading_sr exists in EN locale', () => {
        expect(translations.en.common['loading_sr']).toBeTruthy();
    });

    // Prove-It: FAILS if common.loading_sr is removed from TH
    it('[i18n] common.loading_sr exists in TH locale', () => {
        expect(translations.th.common['loading_sr']).toBeTruthy();
    });

    // Prove-It: FAILS if TH value is changed (verbatim check)
    it('[i18n] TH common.loading_sr is "กำลังโหลด…" (verbatim)', () => {
        expect(translations.th.common['loading_sr']).toBe('กำลังโหลด…');
    });
});
