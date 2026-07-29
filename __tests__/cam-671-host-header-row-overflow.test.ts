/**
 * CAM-671 — a HOST viewing their OWN camp detail page at 360px got a
 * sideways-scrolling page: document.documentElement.scrollWidth (408) vs
 * clientWidth (360), a 48px overflow. A camper never hits this (they only
 * ever see 2 of the row's 3 controls).
 *
 * Test layer: unit (node, no jsdom/RTL — this repo's vitest.config.ts runs
 * `environment: 'node'` and does not mount React components; see the same
 * constraint documented in __tests__/wishlist-detail-toggle.test.ts). A real
 * rendered-DOM/browser measurement (scrollWidth vs clientWidth on an
 * authenticated host session) is out of reach here and is the
 * Playwright-e2e / owner-verify-on-localhost layer instead (see the PR
 * report). This file proves what a node-only environment CAN prove:
 *
 *  1. Source structure — the fix's exact classes are present, on the exact
 *     elements, and every desktop-affecting (`md:`) token from the
 *     PRE-fix row survives unchanged (byte-identical desktop guarantee).
 *  2. Prove-It arithmetic — using the real, ticket-reported control widths
 *     (Edit 177px / Share 82px / Wishlist 94px, `gap-4`=16px, `px-6`=24px)
 *     recreates the actual overflow math: the OLD single-row grouping does
 *     NOT fit a 360px viewport's content width, the NEW per-row grouping
 *     (Edit alone / Share+Wishlist together) DOES.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_PATH = path.join(__dirname, '../components/CampgroundDetailClient.tsx');
let fullSource: string;
let actionRow: string;

beforeAll(() => {
    fullSource = fs.readFileSync(SOURCE_PATH, 'utf8');
    const start = fullSource.indexOf('{/* Header - Title & Actions */}');
    const end = fullSource.indexOf('{/* Hero Grid - Responsive Layout */}');
    expect(start, 'anchor comment "Header - Title & Actions" not found — has the file moved?').toBeGreaterThan(-1);
    expect(end, 'anchor comment "Hero Grid - Responsive Layout" not found — has the file moved?').toBeGreaterThan(-1);
    actionRow = fullSource.slice(start, end);
});

// =============================================================================
// 1. Structure — mobile-stack fix present, desktop tokens untouched
// =============================================================================

describe('CAM-671 fix: header action row source structure', () => {
    it('the outer action-row div stacks on mobile and rejoins a row at md: (flex-col md:flex-row)', () => {
        // The exact div this ticket's root cause named: className carries both the
        // NEW mobile stacking classes and every original desktop-affecting token.
        const outerRowMatch = actionRow.match(
            /<div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">/
        );
        expect(
            outerRowMatch,
            'expected the outer row to add flex-col/md:flex-row while keeping every original token (w-full md:w-auto, justify-between md:justify-end, border-t md:border-t-0, pt-4 md:pt-0, gap-4) byte-identical'
        ).not.toBeNull();
    });

    it('the Edit (owner-only) button is full-width on mobile and auto-width at md: (unchanged desktop size)', () => {
        const editButtonMatch = actionRow.match(
            /<Button asChild variant="default" size="lg" className="gap-2 px-6 w-full md:w-auto">/
        );
        expect(
            editButtonMatch,
            'expected the Edit button to gain "w-full md:w-auto" alongside its original "gap-2 px-6"'
        ).not.toBeNull();
    });

    it('Share + Wishlist share one wrapper that disappears at md: (display:contents) so desktop DOM/layout is unaffected', () => {
        const wrapperMatch = actionRow.match(
            /<div className="flex items-center justify-between gap-4 w-full md:contents">/
        );
        expect(
            wrapperMatch,
            'expected a Share+Wishlist wrapper carrying justify-between (preserves the pre-fix edge-to-edge camper layout) + md:contents (collapses the wrapper box at md:, so Share/Wishlist rejoin the outer row exactly as before)'
        ).not.toBeNull();
    });

    it('the wrapper contains BOTH the Share button and the wishlist toggle (btn--wishlist-detail-toggle), in that order', () => {
        const wrapperStart = actionRow.indexOf('md:contents">');
        expect(wrapperStart).toBeGreaterThan(-1);
        const afterWrapper = actionRow.slice(wrapperStart);
        const shareIdx = afterWrapper.indexOf('t.common.share');
        const wishlistIdx = afterWrapper.indexOf('data-testid="btn--wishlist-detail-toggle"');
        expect(shareIdx, 'Share control not found inside the wrapper').toBeGreaterThan(-1);
        expect(wishlistIdx, 'wishlist toggle not found inside the wrapper').toBeGreaterThan(-1);
        expect(shareIdx).toBeLessThan(wishlistIdx);
    });

    it('no copy was hardcoded — the four i18n key references used by this row are all still present', () => {
        expect(actionRow).toContain('t.newCampground.editCampground');
        expect(actionRow).toContain('t.common.share');
        expect(actionRow).toContain('t.wishlist.savedLabel');
        expect(actionRow).toContain('t.common.save');
    });

    it('button sizes are unchanged (Edit stays size="lg"; Share/Wishlist stay default-size, no shrink introduced)', () => {
        expect(actionRow).toMatch(/<Button asChild variant="default" size="lg"/);
        expect(actionRow).toMatch(/<Button variant="ghost" className="gap-2 px-4 hover:bg-muted font-medium underline">\s*<Share/);
        expect(actionRow).not.toMatch(/size="(xs|sm)"/); // no control was shrunk below the 44px floor
    });
});

// =============================================================================
// 2. Prove-It arithmetic — the ticket's own measured numbers
// =============================================================================

describe('CAM-671 Prove-It: 360px overflow math (real measured control widths)', () => {
    // Measured by QA (story dispatch), reproduced on two independent camps —
    // data-independent. gap-4 = 1rem = 16px; px-6 = 1.5rem = 24px (Tailwind
    // default spacing scale, same scale this file already uses throughout).
    const EDIT_WIDTH_PX = 177;
    const SHARE_WIDTH_PX = 82;
    const WISHLIST_WIDTH_PX = 94;
    const GAP_PX = 16;
    const VIEWPORT_PX = 360;
    const CONTAINER_PADDING_PX = 24; // px-6, one side

    it('container content width at 360px is 312px (viewport minus both px-6 paddings)', () => {
        expect(fullSource).toContain('className="container mx-auto px-6 pt-6 pb-24 md:pb-0"');
        const contentWidth = VIEWPORT_PX - 2 * CONTAINER_PADDING_PX;
        expect(contentWidth).toBe(312);
    });

    it('[defect] the OLD single-row grouping (Edit + Share + Wishlist, 2 gaps, no wrap) does NOT fit 312px — this is the bug', () => {
        const contentWidth = VIEWPORT_PX - 2 * CONTAINER_PADDING_PX;
        const preFixRowWidth = EDIT_WIDTH_PX + SHARE_WIDTH_PX + WISHLIST_WIDTH_PX + 2 * GAP_PX;
        expect(preFixRowWidth).toBe(385);
        expect(preFixRowWidth).toBeGreaterThan(contentWidth); // 385 > 312 — reproduces the overflow
    });

    it('[fix] row 1 (Edit alone, host only) fits 312px', () => {
        const contentWidth = VIEWPORT_PX - 2 * CONTAINER_PADDING_PX;
        expect(EDIT_WIDTH_PX).toBeLessThanOrEqual(contentWidth);
    });

    it('[fix] row 2 (Share + Wishlist, 1 gap) fits 312px — same grouping a camper already saw pre-fix, unchanged', () => {
        const contentWidth = VIEWPORT_PX - 2 * CONTAINER_PADDING_PX;
        const row2Width = SHARE_WIDTH_PX + WISHLIST_WIDTH_PX + GAP_PX;
        expect(row2Width).toBe(192);
        expect(row2Width).toBeLessThanOrEqual(contentWidth);
    });

    it('[camper, unaffected] a camper (no Edit control) never had 3 items in the row and still does not', () => {
        // isOwner=false renders only Share+Wishlist directly — same 192px math
        // as row 2 above; the camper path was never broken and stays untouched.
        const row2Width = SHARE_WIDTH_PX + WISHLIST_WIDTH_PX + GAP_PX;
        expect(row2Width).toBeLessThanOrEqual(VIEWPORT_PX - 2 * CONTAINER_PADDING_PX);
    });
});
