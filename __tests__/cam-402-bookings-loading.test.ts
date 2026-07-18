/**
 * cam-402-bookings-loading.test.ts — bookings list loading is honest (CAM-402)
 *
 * Layer: unit / static source-inspection (vitest env = 'node'), matching the
 * established precedent for app/bookings/page.tsx (see cam-398-bookings-list.test.ts) —
 * the page is a "use client" component whose render depends on LanguageContext/
 * next-auth/lucide; rendering it in jsdom would require mocking every dependency,
 * so source-inspection is the correct layer here.
 *
 * AC coverage matrix:
 *   AC-1 (BR-1)  skeleton thumbnail wrapper mirrors the real card's md:w-64 h-48
 *                md:h-auto exactly (CLS ~= 0) — EC-1 twin-drift guard: one test
 *                fails if either file's wrapper diverges from the other.
 *   AC-2 (BR-2)  render branch order gates empty/error/list on !isLoading, so the
 *                ~300ms delay window (showSkeleton=false, isLoading=true) renders
 *                nothing instead of flashing "ยังไม่มีการจอง" — EC-2.
 *   AC-3          empty state unchanged when genuinely empty (loading finished,
 *                 no error, zero bookings).
 *
 * Prove-It notes (each assertion fails on the pre-fix source):
 *   AC-1: before the fix, the skeleton wrapper was `md:w-64 h-48 flex-shrink-0`
 *         (no md:h-auto) — pinned to the PRE-CAM-398 layout, showing the bottom
 *         gap the real card was cured of.
 *   AC-2: before the fix, the branch order was
 *         `showSkeleton ? skeleton : hasError ? error : bookings.length===0 ? empty : list`
 *         — during the delay window (showSkeleton=false, isLoading=true, bookings=[])
 *         this fell through to the empty-state branch and flashed "ยังไม่มีการจอง".
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relPath: string): string {
    return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const bookingsSrc = readSrc('app/bookings/page.tsx');
const skeletonSrc = readSrc('components/ui/booking-list-skeleton.tsx');

// The real card's image wrapper line (CAM-398 BR-2) and the skeleton's thumbnail
// wrapper line — isolated by the actual className marker (not a bare "md:w-64"
// substring, which also occurs in this file's docstring comment).
const realWrapperLine = bookingsSrc.split('\n').find((l) => l.includes('className="md:w-64')) ?? '';
const skeletonWrapperLine = skeletonSrc.split('\n').find((l) => l.includes('className="md:w-64')) ?? '';

// ===========================================================================
// AC-1 / BR-1 — skeleton thumbnail wrapper mirrors the real card exactly
// ===========================================================================

describe('AC-1/BR-1 — skeleton thumbnail wrapper mirrors the real card (md:w-64 h-48 md:h-auto)', () => {
    it('[skeleton] thumbnail wrapper carries md:h-auto (stretches on desktop, no bottom gap)', () => {
        expect(skeletonWrapperLine).toContain('md:h-auto');
    });

    it('[skeleton] thumbnail wrapper keeps the base dimensions md:w-64 and h-48', () => {
        expect(skeletonWrapperLine).toContain('md:w-64');
        expect(skeletonWrapperLine).toMatch(/(?:^|\s)h-48(?:\s|$)/);
    });

    it('[skeleton] inner Skeleton fills the wrapper (w-full h-full)', () => {
        const idx = skeletonSrc.indexOf('className="md:w-64');
        const window = skeletonSrc.slice(idx, idx + 200);
        expect(window).toContain('w-full h-full');
    });

    it('[EC-1 twin-drift guard] the real card wrapper and the skeleton wrapper carry the SAME dimensional classes — a future drift in either file fails this test', () => {
        // Pin both files to the identical set of dimensional tokens. If CAM-398's
        // real-card layout changes again (or the skeleton falls out of sync),
        // one side changes and this equality breaks.
        const dimensionalTokens = ['md:w-64', 'h-48', 'md:h-auto'];
        for (const token of dimensionalTokens) {
            expect(realWrapperLine, `real card wrapper missing "${token}"`).toContain(token);
            expect(skeletonWrapperLine, `skeleton wrapper missing "${token}"`).toContain(token);
        }
    });

    it('[EC-1] the skeleton wrapper no longer matches the PRE-CAM-398 pinned layout (bare md:w-64 h-48 with no md:h-auto)', () => {
        // Prove-It: the exact pre-fix wrapper string had no md:h-auto at all.
        expect(skeletonWrapperLine).not.toBe('                <div className="md:w-64 h-48 flex-shrink-0">');
    });
});

// ===========================================================================
// AC-2 / BR-2 — render branch order: showSkeleton ? skeleton : isLoading ? null : hasError ? error : empty/list
// ===========================================================================

describe('AC-2/BR-2 — render branch gates empty/error/list on !isLoading (no empty-state flash during the delay window)', () => {
    // Isolate the ternary chain that starts right after the async-section comment.
    const branchStart = bookingsSrc.indexOf('{showSkeleton ?');
    const branchBlock = bookingsSrc.slice(branchStart, branchStart + 600);

    it('[order] showSkeleton is checked first', () => {
        // branchBlock is sliced starting at "{showSkeleton ?", so the marker
        // sits right after the leading "{".
        expect(branchBlock.indexOf('showSkeleton ?')).toBe(1);
    });

    it('[order] isLoading is checked immediately after showSkeleton, before hasError', () => {
        const showSkeletonIdx = branchBlock.indexOf('showSkeleton ?');
        const isLoadingIdx = branchBlock.indexOf('isLoading ? null');
        const hasErrorIdx = branchBlock.indexOf('hasError ?');
        expect(isLoadingIdx).toBeGreaterThan(showSkeletonIdx);
        expect(hasErrorIdx).toBeGreaterThan(isLoadingIdx);
    });

    it('[order] the delay-window branch renders null (nothing), not a state', () => {
        expect(branchBlock).toContain('isLoading ? null : hasError ?');
    });

    it('[EC-2 Prove-It] empty/error branches are unreachable while isLoading is true — the empty-state JSX no longer sits directly behind hasError with no isLoading gate', () => {
        // Prove-It: the exact pre-fix chain had hasError immediately after
        // showSkeleton with no isLoading gate in between.
        expect(branchBlock).not.toMatch(/showSkeleton \? \(\s*<BookingListSkeleton count=\{3\} \/>\s*\) : hasError \?/);
    });
});

// ===========================================================================
// AC-3 — empty state unchanged when genuinely empty
// ===========================================================================

describe('AC-3 — empty state unchanged (still renders when loading is finished, no error, zero bookings)', () => {
    it('[empty] noBookingsYet copy key still renders in the empty-state branch', () => {
        expect(bookingsSrc).toContain('{t.bookings.noBookingsYet}');
    });

    it('[empty] empty-state branch condition is still bookings.length === 0', () => {
        expect(bookingsSrc).toContain('bookings.length === 0 ?');
    });

    it('[empty] explore-camps CTA link still present in the empty state', () => {
        expect(bookingsSrc).toContain('{t.bookings.exploreButton}');
    });
});

// ===========================================================================
// Regression guards — BR-3: no behavior change to error state, list, or the hook
// ===========================================================================

describe('regression — BR-3: error state, list rendering, and useMinimumLoading untouched', () => {
    it('[hook] useMinimumLoading is still called with its default options (no delay/minDisplay override)', () => {
        expect(bookingsSrc).toContain('const showSkeleton = useMinimumLoading(isLoading);');
    });

    it('[hook] the hook source itself is unmodified (still exposes delay=300, minDisplay=400 defaults)', () => {
        const hookSrc = readSrc('lib/hooks/use-minimum-loading.ts');
        expect(hookSrc).toContain('opts?.delay ?? 300');
        expect(hookSrc).toContain('opts?.minDisplay ?? 400');
    });

    it('[error] ErrorBanner still renders with the errorOccurred copy key', () => {
        expect(bookingsSrc).toContain('<ErrorBanner message={t.bookings.errorOccurred} />');
    });

    it('[list] section--booking-list wrapper still present', () => {
        expect(bookingsSrc).toContain('data-testid="section--booking-list"');
    });

    it('[skeleton] BookingListSkeleton still rendered with count={3}', () => {
        expect(bookingsSrc).toContain('<BookingListSkeleton count={3} />');
    });
});
