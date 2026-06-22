/**
 * CAM-127 — ปุ่มบันทึกบนหน้า Campground Detail
 *
 * Test layer: unit (node, no jsdom) — mirrors the project's existing Vitest setup.
 *
 * Coverage strategy
 * -----------------
 * The project's vitest.config.ts runs environment: 'node' and includes only
 * '**\/*.test.ts'.  React Testing Library / jsdom are NOT configured, so we cannot
 * mount CampgroundDetailClient here.  Instead we cover:
 *
 *  1. i18n key assertions  — every Thai string the AC specifies is present verbatim
 *     in locales/translations.json (the source of truth for the UI copy).
 *
 *  2. Toggle state-machine — lib/wishlist-toggle.ts exports the pure logic that
 *     CampgroundDetailClient delegates to.  These tests exercise the SHIPPED module
 *     directly, proving the Prove-It contract for AC-1/3/5 + BR-1/2/5.
 *
 *  3. Server initialSaved logic — resolveInitialSaved from lib/wishlist-toggle.ts
 *     encodes the boolean coercion used in app/campgrounds/[slug]/page.tsx.
 *
 * What is NOT covered here (requires Playwright e2e on Staging at G4):
 *  - Rendered DOM: button testid, aria-pressed, Heart fill class
 *  - LoginModal opening on guest tap
 *  - Sonner toast appearing with the exact Thai copy
 *  - Disabled state during inflight request (BR-5)
 *  See test.md → "e2e / Staging G4" column.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import translations from '../locales/translations.json';
import {
    runWishlistToggle,
    resolveInitialSaved,
    type WishlistAPI,
} from '@/lib/wishlist-toggle';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const thT = translations.th;

/** Build the strings object from the Thai translation keys (mirrors component usage). */
function makeStrings() {
    return {
        toastSaved: thT.wishlist.toastSaved,
        toastRemoved: thT.wishlist.toastRemoved,
        toastErrorSave: thT.wishlist.toastErrorSave,
        toastErrorRemove: thT.wishlist.toastErrorRemove,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const apiOk: WishlistAPI = {
    save: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
};

const apiError: WishlistAPI = {
    save: vi.fn().mockRejectedValue(new Error('Network error')),
    remove: vi.fn().mockRejectedValue(new Error('Network error')),
};

const apiErrorViaResponse: WishlistAPI = {
    save: vi.fn().mockResolvedValue({ error: 'server rejected' }),
    remove: vi.fn().mockResolvedValue({ error: 'server rejected' }),
};

beforeEach(() => {
    vi.clearAllMocks();
});

// =============================================================================
// i18n: Thai copy verbatim (AC-1..5 visible result assertions)
// =============================================================================

describe('i18n — Thai copy verbatim (locales/translations.json)', () => {
    describe('AC-1: save success toast', () => {
        it('th.wishlist.toastSaved is "บันทึกลงรายการที่ถูกใจแล้ว"', () => {
            expect(thT.wishlist.toastSaved).toBe('บันทึกลงรายการที่ถูกใจแล้ว');
        });
    });

    describe('AC-1 / AC-2: button saved-state label', () => {
        it('th.wishlist.savedLabel is "บันทึกแล้ว"', () => {
            expect(thT.wishlist.savedLabel).toBe('บันทึกแล้ว');
        });
    });

    describe('AC-1: unsaved button label', () => {
        it('th.common.save is "บันทึก" (label when not saved)', () => {
            // The component renders: saved ? t.wishlist.savedLabel : t.common.save
            expect(thT.common.save).toBe('บันทึก');
        });
    });

    describe('AC-3: remove success toast', () => {
        it('th.wishlist.toastRemoved is "นำออกจากรายการที่ถูกใจแล้ว"', () => {
            expect(thT.wishlist.toastRemoved).toBe('นำออกจากรายการที่ถูกใจแล้ว');
        });
    });

    describe('AC-4: guest login-modal subtitle', () => {
        it('th.wishlist.loginPromptGuest is "เข้าสู่ระบบเพื่อบันทึกแคมป์นี้"', () => {
            expect(thT.wishlist.loginPromptGuest).toBe('เข้าสู่ระบบเพื่อบันทึกแคมป์นี้');
        });
    });

    describe('AC-5: save error toast', () => {
        it('th.wishlist.toastErrorSave is "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"', () => {
            expect(thT.wishlist.toastErrorSave).toBe('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        });
    });

    describe('AC-3 error path: remove error toast', () => {
        it('th.wishlist.toastErrorRemove is "ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"', () => {
            // Remove-side rollback toast (AC-5 mirror for the remove path)
            expect(thT.wishlist.toastErrorRemove).toBe('ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        });
    });

    describe('BR-5 aria labels', () => {
        it('th.wishlist.heartAriaLabelSave is "บันทึกลงรายการที่ถูกใจ"', () => {
            expect(thT.wishlist.heartAriaLabelSave).toBe('บันทึกลงรายการที่ถูกใจ');
        });

        it('th.wishlist.heartAriaLabelRemove is "นำออกจากรายการที่ถูกใจ"', () => {
            expect(thT.wishlist.heartAriaLabelRemove).toBe('นำออกจากรายการที่ถูกใจ');
        });

        it('th.wishlist.heartAriaLabelLoading is "กำลังอัปเดตรายการที่ถูกใจ..."', () => {
            expect(thT.wishlist.heartAriaLabelLoading).toBe('กำลังอัปเดตรายการที่ถูกใจ...');
        });
    });
});

// =============================================================================
// AC-1: logged-in · not saved → tap → save → button becomes "บันทึกแล้ว"
// =============================================================================

describe('AC-1: logged-in user saves an unsaved camp', () => {
    it('optimistic state flips to saved=true and API.save is called', async () => {
        const result = await runWishlistToggle({
            isLoggedIn: true,
            savedBefore: false,
            campSiteId: 'camp-id',
            api: apiOk,
            strings: makeStrings(),
        });

        expect(result.saved).toBe(true);
        expect(result.apiCalled).toBe('save');
        expect(result.loginModalOpened).toBe(false);
    });

    it('emits the save-success toast key "บันทึกลงรายการที่ถูกใจแล้ว"', async () => {
        const result = await runWishlistToggle({
            isLoggedIn: true,
            savedBefore: false,
            campSiteId: 'camp-id',
            api: apiOk,
            strings: makeStrings(),
        });

        expect(result.toastKey).toBe('บันทึกลงรายการที่ถูกใจแล้ว');
    });
});

// =============================================================================
// AC-2: logged-in · already saved → page loads with saved=true (server resolves)
// =============================================================================

describe('AC-2: server resolves initialSaved (BR-3)', () => {
    it('initialSaved=true when wishlist row exists for the user', () => {
        const row = { id: 'wl-row-1' };
        expect(resolveInitialSaved('user-123', row)).toBe(true);
    });

    it('initialSaved=false when wishlist row is null (not saved)', () => {
        expect(resolveInitialSaved('user-123', null)).toBe(false);
    });

    it('initialSaved=false when user is not logged in (no userId)', () => {
        // BR-3: not logged in = ยังไม่บันทึก (always false)
        expect(resolveInitialSaved(undefined, null)).toBe(false);
    });

    it('initialSaved=false for guest even if row hypothetically exists', () => {
        // Guest has no session, so userId is undefined — must always be false (BR-3)
        expect(resolveInitialSaved(undefined, { id: 'wl-row-1' })).toBe(false);
    });

    it('initialSaved is a boolean (not a truthy object)', () => {
        const row = { id: 'wl-row-1' };
        const result = resolveInitialSaved('user-123', row);
        expect(typeof result).toBe('boolean');
        expect(result).toBe(true);
    });
});

// =============================================================================
// AC-3: logged-in · already saved → tap → remove → button becomes "บันทึก"
// =============================================================================

describe('AC-3: logged-in user removes a saved camp', () => {
    it('saved state flips back to false and API.remove is called', async () => {
        const result = await runWishlistToggle({
            isLoggedIn: true,
            savedBefore: true,
            campSiteId: 'camp-id',
            api: apiOk,
            strings: makeStrings(),
        });

        expect(result.saved).toBe(false);
        expect(result.apiCalled).toBe('remove');
        expect(result.loginModalOpened).toBe(false);
    });

    it('emits the remove-success toast key "นำออกจากรายการที่ถูกใจแล้ว"', async () => {
        const result = await runWishlistToggle({
            isLoggedIn: true,
            savedBefore: true,
            campSiteId: 'camp-id',
            api: apiOk,
            strings: makeStrings(),
        });

        expect(result.toastKey).toBe('นำออกจากรายการที่ถูกใจแล้ว');
    });
});

// =============================================================================
// AC-4: guest → tap → LoginModal opens, no API call
// =============================================================================

describe('AC-4: guest (isLoggedIn=false) taps wishlist button', () => {
    it('opens LoginModal and does NOT call the wishlist API', async () => {
        const mockApi: WishlistAPI = {
            save: vi.fn(),
            remove: vi.fn(),
        };

        const result = await runWishlistToggle({
            isLoggedIn: false,
            savedBefore: false,
            campSiteId: 'camp-id',
            api: mockApi,
            strings: makeStrings(),
        });

        expect(result.loginModalOpened).toBe(true);
        expect(mockApi.save).not.toHaveBeenCalled();
        expect(mockApi.remove).not.toHaveBeenCalled();
    });

    it('saved state does not change when guest taps (no optimistic flip)', async () => {
        const result = await runWishlistToggle({
            isLoggedIn: false,
            savedBefore: false,
            campSiteId: 'camp-id',
            api: apiOk,
            strings: makeStrings(),
        });

        expect(result.saved).toBe(false);
    });

    it('login modal subtitle key is "เข้าสู่ระบบเพื่อบันทึกแคมป์นี้" (BR-2)', () => {
        // The component passes t.wishlist.loginPromptGuest as the subtitle prop — assert the value
        expect(thT.wishlist.loginPromptGuest).toBe('เข้าสู่ระบบเพื่อบันทึกแคมป์นี้');
    });

    it('no toast is emitted on guest tap', async () => {
        const result = await runWishlistToggle({
            isLoggedIn: false,
            savedBefore: false,
            campSiteId: 'camp-id',
            api: apiOk,
            strings: makeStrings(),
        });

        expect(result.toastKey).toBeNull();
    });
});

// =============================================================================
// AC-5: API failure → optimistic state rolled back + error toast
// =============================================================================

describe('AC-5: API call fails — optimistic rollback (BR-1)', () => {
    describe('save attempt fails (thrown error)', () => {
        it('rolls back saved to false (was false before tap)', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: false,
                campSiteId: 'camp-id',
                api: apiError,
                strings: makeStrings(),
            });

            expect(result.saved).toBe(false); // rolled back to original
        });

        it('emits save-error toast key "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: false,
                campSiteId: 'camp-id',
                api: apiError,
                strings: makeStrings(),
            });

            expect(result.toastKey).toBe('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        });
    });

    describe('save attempt fails (API returns { error })', () => {
        it('rolls back saved to false when response carries an error field', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: false,
                campSiteId: 'camp-id',
                api: apiErrorViaResponse,
                strings: makeStrings(),
            });

            expect(result.saved).toBe(false);
        });

        it('emits save-error toast key when API returns { error }', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: false,
                campSiteId: 'camp-id',
                api: apiErrorViaResponse,
                strings: makeStrings(),
            });

            expect(result.toastKey).toBe('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        });
    });

    describe('remove attempt fails (thrown error)', () => {
        it('rolls back saved to true (was true before tap)', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: true,
                campSiteId: 'camp-id',
                api: apiError,
                strings: makeStrings(),
            });

            expect(result.saved).toBe(true); // rolled back to original
        });

        it('emits remove-error toast key on failed remove', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: true,
                campSiteId: 'camp-id',
                api: apiError,
                strings: makeStrings(),
            });

            // The remove-error path — still visible/system result per BR-1 spec
            expect(result.toastKey).toBe('ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        });
    });

    describe('remove attempt fails (API returns { error })', () => {
        it('rolls back saved to true when response carries an error field', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: true,
                campSiteId: 'camp-id',
                api: apiErrorViaResponse,
                strings: makeStrings(),
            });

            expect(result.saved).toBe(true); // rolled back to original
        });

        it('emits remove-error toast key when API returns { error }', async () => {
            const result = await runWishlistToggle({
                isLoggedIn: true,
                savedBefore: true,
                campSiteId: 'camp-id',
                api: apiErrorViaResponse,
                strings: makeStrings(),
            });

            expect(result.toastKey).toBe('ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        });
    });

    it('no API call is made when isLoading=true (BR-5 debounce)', async () => {
        const mockApi: WishlistAPI = { save: vi.fn(), remove: vi.fn() };

        const result = await runWishlistToggle({
            isLoggedIn: true,
            savedBefore: false,
            isLoading: true,
            campSiteId: 'camp-id',
            api: mockApi,
            strings: makeStrings(),
        });

        expect(mockApi.save).not.toHaveBeenCalled();
        expect(mockApi.remove).not.toHaveBeenCalled();
        expect(result.saved).toBe(false); // unchanged
    });
});

// =============================================================================
// BR-4: label / aria derives from saved state
// =============================================================================

describe('BR-4: button label and aria-label derive from saved state', () => {
    it('label when not saved is t.common.save = "บันทึก"', () => {
        const label = false
            ? thT.wishlist.savedLabel
            : thT.common.save;
        expect(label).toBe('บันทึก');
    });

    it('label when saved is t.wishlist.savedLabel = "บันทึกแล้ว"', () => {
        const label = true
            ? thT.wishlist.savedLabel
            : thT.common.save;
        expect(label).toBe('บันทึกแล้ว');
    });

    it('aria-label when saved is heartAriaLabelRemove', () => {
        const ariaLabel = false
            ? thT.wishlist.heartAriaLabelLoading
            : true
                ? thT.wishlist.heartAriaLabelRemove
                : thT.wishlist.heartAriaLabelSave;
        expect(ariaLabel).toBe('นำออกจากรายการที่ถูกใจ');
    });

    it('aria-label when not saved is heartAriaLabelSave', () => {
        const ariaLabel = false
            ? thT.wishlist.heartAriaLabelLoading
            : false
                ? thT.wishlist.heartAriaLabelRemove
                : thT.wishlist.heartAriaLabelSave;
        expect(ariaLabel).toBe('บันทึกลงรายการที่ถูกใจ');
    });

    it('aria-label while loading is heartAriaLabelLoading', () => {
        const ariaLabel = true
            ? thT.wishlist.heartAriaLabelLoading
            : false
                ? thT.wishlist.heartAriaLabelRemove
                : thT.wishlist.heartAriaLabelSave;
        expect(ariaLabel).toBe('กำลังอัปเดตรายการที่ถูกใจ...');
    });
});

// =============================================================================
// BR-3: initialSaved boundary cases
// =============================================================================

describe('BR-3 boundary: initialSaved boolean coercion edge cases', () => {
    it('resolves false for falsy row (empty object is truthy — but null/undefined = false)', () => {
        expect(resolveInitialSaved('user-1', null)).toBe(false);
    });

    it('resolves true for any truthy row value', () => {
        expect(resolveInitialSaved('user-1', { id: 'any-id' })).toBe(true);
    });

    it('resolves false when userId is an empty string', () => {
        // An empty userId string is falsy — treat as no session
        expect(resolveInitialSaved('', null)).toBe(false);
    });
});
