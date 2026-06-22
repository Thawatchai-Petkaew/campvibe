/**
 * lib/wishlist-toggle.ts
 *
 * Pure, framework-free toggle logic for the campground detail wishlist button.
 * AC-1/3/5 + BR-1/2/5 (CAM-127).
 *
 * All functions here are free of React state, sonner, and browser APIs so they
 * can be exercised directly in a Vitest node environment.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal API surface injected by the component (matches wishlistAPI shape). */
export interface WishlistAPI {
    save: (campSiteId: string) => Promise<{ error?: string }>;
    remove: (campSiteId: string) => Promise<{ error?: string }>;
}

/** What the toggle decision returns — effects (toast, modal) described as data. */
export interface ToggleResult {
    /** Final saved state after the operation (may be rolled back on error). */
    saved: boolean;
    /** Which API verb was called, or null when skipped. */
    apiCalled: 'save' | 'remove' | null;
    /**
     * The resolved i18n string to show in a toast, or null when no toast.
     * The component maps this to sonner; the test asserts the Thai copy verbatim.
     */
    toastKey: string | null;
    /** True when the guest gate triggered — component opens LoginModal. */
    loginModalOpened: boolean;
}

// ---------------------------------------------------------------------------
// resolveInitialSaved — AC-2, BR-3
// ---------------------------------------------------------------------------

/**
 * Derives the server-side initial saved boolean from the DB wishlist row.
 * Called in the Next.js Server Component (app/campgrounds/[slug]/page.tsx).
 *
 * @param userId  - Session user id; `undefined` when not logged in.
 * @param row     - Wishlist DB row (only the id is needed), or null when absent.
 */
export function resolveInitialSaved(
    userId: string | undefined,
    row: { id: string } | null,
): boolean {
    if (!userId) return false;
    return !!row;
}

// ---------------------------------------------------------------------------
// runWishlistToggle — AC-1/3/4/5, BR-1/2/5
// ---------------------------------------------------------------------------

export interface ToggleInput {
    /** Whether there is an active user session (AC-4, BR-2). */
    isLoggedIn: boolean;
    /** Current saved state before this tap. */
    savedBefore: boolean;
    /** True while a previous request is still in flight (BR-5 debounce). */
    isLoading?: boolean;
    /** The campsite id passed to save/remove. */
    campSiteId: string;
    /** Injected API — matches wishlistAPI.save / wishlistAPI.remove signatures. */
    api: WishlistAPI;
    /**
     * Resolved i18n strings for the four toast messages.
     * The component passes t.wishlist.* values; the test passes verbatim Thai copy.
     */
    strings: {
        toastSaved: string;
        toastRemoved: string;
        toastErrorSave: string;
        toastErrorRemove: string;
    };
}

/**
 * Pure toggle state-machine.
 *
 * Performs the optimistic flip, calls the appropriate API verb, and returns a
 * ToggleResult describing the outcome.  On API failure the state rolls back and
 * an error toast key is returned (AC-5, BR-1).
 *
 * No React, no sonner, no browser API — entirely synchronous-safe for unit tests.
 */
export async function runWishlistToggle(input: ToggleInput): Promise<ToggleResult> {
    const {
        isLoggedIn,
        savedBefore,
        isLoading = false,
        campSiteId,
        api,
        strings,
    } = input;

    // AC-4, BR-2: guest tap → open LoginModal, no API call.
    if (!isLoggedIn) {
        return {
            saved: savedBefore,
            apiCalled: null,
            toastKey: null,
            loginModalOpened: true,
        };
    }

    // BR-5: debounce — ignore while a prior request is still in flight.
    if (isLoading) {
        return {
            saved: savedBefore,
            apiCalled: null,
            toastKey: null,
            loginModalOpened: false,
        };
    }

    // AC-1 / AC-3: optimistic flip.
    const next = !savedBefore;
    const apiCalled: 'save' | 'remove' = next ? 'save' : 'remove';
    let finalSaved = next;
    let toastKey: string | null = null;

    try {
        if (next) {
            // AC-1: save.
            const res = await api.save(campSiteId);
            if (res.error) throw new Error(res.error);
            toastKey = strings.toastSaved;
        } else {
            // AC-3: remove.
            const res = await api.remove(campSiteId);
            if (res.error) throw new Error(res.error);
            toastKey = strings.toastRemoved;
        }
    } catch {
        // AC-5, BR-1: rollback optimistic state on failure.
        finalSaved = !next;
        toastKey = next ? strings.toastErrorSave : strings.toastErrorRemove;
    }

    return { saved: finalSaved, apiCalled, toastKey, loginModalOpened: false };
}
