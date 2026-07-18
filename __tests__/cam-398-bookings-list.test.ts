/**
 * cam-398-bookings-list.test.ts — bookings list click-through + image gap fix (CAM-398)
 *
 * Layer: unit / static source-inspection (vitest env = 'node'), matching the
 * established precedent for app/bookings/page.tsx (see cam-61-booking-detail.test.ts,
 * cam-194-perf4-next-image.test.ts, booking-status.test.ts) — the page is a
 * "use client" component whose render depends on LanguageContext/next-auth/lucide;
 * rendering it in jsdom would require mocking every dependency, so source-inspection
 * is the correct layer here.
 *
 * AC coverage matrix — every CAM-398 AC/BR/EC row mapped 1:1:
 *
 *   AC-1 (BR-1)  card body + "ดูรายละเอียด" button both navigate to /bookings/{id}
 *                — the orphaned /bookings/[id] route becomes reachable; the broken
 *                /campgrounds/undefined link (nameThSlug never in the API select) is
 *                replaced entirely.
 *   AC-2 (BR-2)  image column stretches on desktop (md:h-auto, aspect-[4/3] dropped);
 *                object-cover (already present) absorbs the aspect mismatch.
 *   EC-1         booking detail navigation depends only on booking.id, never on the
 *                campground/campsite slug — so a deleted campground behind a booking
 *                cannot break the link (proven by asserting nameThSlug no longer
 *                appears anywhere in this file's navigation targets).
 *   EC-2         mobile layout unchanged — bare h-48 (no md: prefix) still applies
 *                below the md breakpoint.
 *   a11y/HTML    the card is a plain <div> (not <a>/<Link>) so the real "ดูรายละเอียด"
 *                Link and the Cancel button can nest as valid interactive controls —
 *                a <button>/<a> nested inside <a> is invalid HTML5 content model.
 *                Cancel + the ViewDetails Link's Button both stopPropagation so a
 *                click on either does not also fire the card-level navigation.
 *
 * Prove-It notes (the fix under test; each assertion fails on the pre-fix source):
 *   AC-1: before the fix, the only navigable link on the card targeted
 *         `/campgrounds/${booking.campSite?.nameThSlug || booking.campground?.nameThSlug}`
 *         (undefined field → /campgrounds/undefined) and the card body had no
 *         onClick/Link at all.
 *   AC-2: before the fix, the wrapper was `md:w-64 h-48 md:aspect-[4/3] ...`
 *         (pinned to 192px inside a taller flex row → bottom gap on desktop).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSrc(relPath: string): string {
    return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const bookingsSrc = readSrc('app/bookings/page.tsx');

// Isolate the single booking-card JSX block (inside bookings.map) so assertions
// about "the card" don't accidentally match the unrelated header/empty-state Links.
// Sliced to end-of-file rather than a "))}" marker — that literal sequence also
// occurs mid-block (the nights-calculation expression), which truncated the slice
// prematurely. bookings.map(...) is the last JSX in the file, so end-of-file is safe.
const cardBlockStart = bookingsSrc.indexOf('{bookings.map((booking) => (');
const cardBlock = bookingsSrc.slice(cardBlockStart);

// ===========================================================================
// AC-1 / BR-1 — card body + "ดูรายละเอียด" button both navigate to /bookings/{id}
// ===========================================================================

describe('AC-1/BR-1 — booking card + view-details button navigate to /bookings/{id}', () => {
    it('[import] useRouter imported from "next/navigation"', () => {
        expect(bookingsSrc).toContain('import { useRouter } from "next/navigation"');
    });

    it('[wiring] component calls useRouter()', () => {
        expect(bookingsSrc).toContain('const router = useRouter();');
    });

    it('[card] the booking card root is a plain <div> (not <Link>/<a>) — avoids nesting an <a>/<button> inside an <a>', () => {
        // The nearest opening tag before key={booking.id} must be <div, never <Link/<a.
        const keyIdx = cardBlock.indexOf('key={booking.id}');
        const before = cardBlock.slice(Math.max(0, keyIdx - 50), keyIdx);
        expect(before).toMatch(/<div\s*$/);
    });

    it('[card] card div navigates via router.push(`/bookings/${booking.id}`) on click', () => {
        expect(cardBlock).toMatch(/onClick=\{\(\) => router\.push\(`\/bookings\/\$\{booking\.id\}`\)\}/);
    });

    it('[card] card div carries data-testid="card--booking-item"', () => {
        expect(cardBlock).toContain('data-testid="card--booking-item"');
    });

    it('[card] card div is cursor-pointer (visual affordance that it is clickable)', () => {
        const keyLine = cardBlock.split('\n').find((l) => l.includes('key={booking.id}')) ?? '';
        // className is on a following line for the same element; search the small window after the key line.
        const idx = cardBlock.indexOf('key={booking.id}');
        const window = cardBlock.slice(idx, idx + 300);
        expect(window).toContain('cursor-pointer');
    });

    it('[button] "ดูรายละเอียด" Link hrefs /bookings/${booking.id} (the healthy detail route)', () => {
        expect(cardBlock).toMatch(/<Link href=\{`\/bookings\/\$\{booking\.id\}`\}/);
    });

    it('[button] the broken /campgrounds/undefined target (nameThSlug) is fully removed', () => {
        // Prove-It: this is the exact bug — nameThSlug is never in the GET /api/bookings
        // select, so the old href always resolved to /campgrounds/undefined.
        expect(bookingsSrc).not.toContain('nameThSlug');
        expect(bookingsSrc).not.toMatch(/\/campgrounds\/\$\{/);
    });

    it('[nested-interactive] Cancel button stopPropagation before opening the confirm dialog', () => {
        // Must run stopPropagation so clicking Cancel does not also trigger the
        // card-level router.push to the detail page.
        const cancelBtnIdx = cardBlock.indexOf('cancelBookingAriaLabel');
        const window = cardBlock.slice(cancelBtnIdx, cancelBtnIdx + 900);
        expect(window).toContain('e.stopPropagation()');
        expect(window).toContain('setCancelConfirmId(booking.id)');
    });

    it('[nested-interactive] view-details Button stopPropagation (skips the duplicate card-level push)', () => {
        const viewDetailsIdx = cardBlock.indexOf('t.bookings.viewDetails');
        const btnOpenIdx = cardBlock.lastIndexOf('<Button', viewDetailsIdx);
        const window = cardBlock.slice(btnOpenIdx, viewDetailsIdx);
        expect(window).toContain('onClick={(e) => e.stopPropagation()}');
    });
});

// ===========================================================================
// AC-2 / BR-2 — image column stretches on desktop, no bottom gap
// ===========================================================================

describe('AC-2/BR-2 — image column fills the card height on desktop (no bottom gap)', () => {
    const wrapperLine = cardBlock.split('\n').find((l) => l.includes('md:w-64')) ?? '';

    it('[wrapper] image wrapper uses md:h-auto (stretches to the row height on desktop)', () => {
        expect(wrapperLine).toContain('md:h-auto');
    });

    it('[wrapper] image wrapper does NOT use md:aspect-[4/3] anymore (dropped per BR-2)', () => {
        // Prove-It: aspect-[4/3] pinned the image to 192px inside a taller flex row.
        expect(wrapperLine).not.toContain('aspect-[4/3]');
    });

    it('[wrapper] image wrapper keeps overflow-hidden + relative (unchanged layout primitives)', () => {
        expect(wrapperLine).toContain('overflow-hidden');
        expect(wrapperLine).toContain('relative');
    });

    it('[object-fit] ImageWithFallback still uses object-cover to absorb the aspect mismatch', () => {
        const imgIdx = cardBlock.indexOf('ImageWithFallback');
        const window = cardBlock.slice(imgIdx, imgIdx + 600);
        expect(window).toContain('object-cover');
    });
});

// ===========================================================================
// EC-1 — booking detail page is reachable independent of the campground
// ===========================================================================

describe('EC-1 — navigation depends only on booking.id, never the campground/campsite slug', () => {
    it('[independence] no navigation target in the card references campSite/campground slug fields', () => {
        expect(cardBlock).not.toMatch(/href=\{`[^`]*campSite[^`]*slug[^`]*`\}/i);
        expect(cardBlock).not.toContain('booking.campSite?.nameThSlug');
        expect(cardBlock).not.toContain('booking.campground?.nameThSlug');
    });
});

// ===========================================================================
// EC-2 — mobile layout unchanged (bare h-48 still applies below md)
// ===========================================================================

describe('EC-2 — mobile layout unchanged (h-48 base height still applies below md)', () => {
    it('[wrapper] image wrapper still carries a bare h-48 (mobile, no md: prefix)', () => {
        const wrapperLine = cardBlock.split('\n').find((l) => l.includes('md:w-64')) ?? '';
        expect(wrapperLine).toMatch(/(?:^|\s)h-48(?:\s|$)/);
    });

    it('[wrapper] the stacked mobile layout class (flex-col md:flex-row) is unchanged', () => {
        expect(cardBlock).toContain('flex flex-col md:flex-row');
    });
});

// ===========================================================================
// Regression guards — section wrapper + status badge + skeleton wiring intact
// ===========================================================================

describe('regression — surrounding structure untouched by the fix', () => {
    it('[section] section--booking-list wrapper still present', () => {
        expect(bookingsSrc).toContain('data-testid="section--booking-list"');
    });

    it('[badge] status badge (getBookingStatusMeta) still rendered over the image', () => {
        expect(cardBlock).toContain('getBookingStatusMeta(booking.status)');
    });

    it('[confirm-dialog] ConfirmDialog for cancel is still wired (BR-1 does not touch cancel flow)', () => {
        expect(cardBlock).toContain('<ConfirmDialog');
        expect(cardBlock).toContain('onConfirm');
    });
});
