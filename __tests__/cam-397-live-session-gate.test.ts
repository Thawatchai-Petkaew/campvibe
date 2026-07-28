/**
 * cam-397-live-session-gate.test.ts — CAM-397: first press after login works
 * (gates read the live client session, reserve + wishlist).
 *
 * Repo precedent for this component (see __tests__/cam-396-booking-login-gate.test.ts,
 * __tests__/cam-394-stream-reviews.test.ts): CampgroundDetailClient is a large
 * client component with no jsdom/RTL harness in this project's Vitest setup
 * (environment: 'node'). Coverage strategy here is source-inspection Prove-It:
 * each assertion FAILS against the pre-fix source (gate reads the stale
 * `isLoggedIn` prop) and passes against the fix (gate reads `isLoggedInLive`,
 * derived from `useSession()`).
 *
 * What is NOT covered here (requires Playwright e2e on Staging, or an owner
 * browser check on localhost — see story.md EC-2, "browser-only transition"):
 *  - The actual login-modal-then-first-press-succeeds transition in a browser
 *  - useSession() actually re-rendering after LoginModal's update() call
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const clientSrc = read("components/CampgroundDetailClient.tsx");
const layoutSrc = read("app/layout.tsx");
const providersSrc = read("components/Providers.tsx");

function extractHandleReserve(src: string): string {
    const start = src.indexOf("const handleReserve = async () => {");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("};", start);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
}

function extractHandleWishlistToggle(src: string): string {
    const start = src.indexOf("const handleWishlistToggle = useCallback(async () => {");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("}, [isLoggedInLive", start);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
}

describe("CAM-397 BR-1: both gates derive from useSession(), never a prop", () => {
    it("[unit] the component imports useSession from next-auth/react", () => {
        expect(clientSrc).toMatch(/import\s*\{[^}]*useSession[^}]*\}\s*from\s*["']next-auth\/react["']/);
    });

    it("[unit] isLoggedInLive is derived from useSession().status === \"authenticated\"", () => {
        expect(clientSrc).toMatch(/const\s*\{\s*status:\s*sessionStatus\s*\}\s*=\s*useSession\(\);/);
        expect(clientSrc).toMatch(/isLoggedInLive\s*=\s*sessionStatus\s*===\s*["']authenticated["']/);
    });

    it("[unit] the isLoggedIn PROP is no longer destructured/read anywhere as a gate input", () => {
        // Prove-It: FAILS on the pre-fix source, where `isLoggedIn = false,` is
        // destructured and read directly inside handleReserve/handleWishlistToggle.
        expect(clientSrc).not.toMatch(/isLoggedIn\s*=\s*false,/);
        expect(clientSrc).not.toMatch(/if\s*\(!isLoggedIn\)/);
        expect(clientSrc).not.toMatch(/isLoggedIn,\n/); // the old bare shorthand passed into runWishlistToggle
    });

    it("[unit] the prop stays declared in the type (so existing callers keep compiling)", () => {
        // app/campgrounds/[slug]/page.tsx and app/wishlist/page.tsx still pass
        // isLoggedIn={...} — the prop type must keep accepting it even though
        // the component body never reads it as a gate.
        expect(clientSrc).toMatch(/isLoggedIn\?:\s*boolean;/);
    });
});

describe("CAM-397 AC-2: handleReserve gates on the live session (reserve path)", () => {
    const body = extractHandleReserve(clientSrc);

    it("[unit] gates on isLoggedInLive before the /api/bookings fetch", () => {
        const gateIdx = body.indexOf("if (!isLoggedInLive)");
        const fetchIdx = body.indexOf('fetch("/api/bookings"');
        expect(gateIdx).toBeGreaterThan(-1);
        expect(fetchIdx).toBeGreaterThan(-1);
        expect(gateIdx).toBeLessThan(fetchIdx);
    });

    it("[unit] the guest branch still opens the existing LoginModal (setLoginOpen) and returns", () => {
        const gateBlock = body.slice(
            body.indexOf("if (!isLoggedInLive)"),
            body.indexOf("if (!isLoggedInLive)") + 90,
        );
        expect(gateBlock).toContain("setLoginOpen(true)");
        expect(gateBlock).toContain("return;");
    });
});

describe("CAM-397 AC-3: handleWishlistToggle passes the live session into runWishlistToggle", () => {
    const body = extractHandleWishlistToggle(clientSrc);

    it("[unit] passes isLoggedIn: isLoggedInLive into the runWishlistToggle call (util itself untouched)", () => {
        // Prove-It: FAILS on the pre-fix source (`isLoggedIn,` bare shorthand — the
        // stale prop). lib/wishlist-toggle.ts is out of scope and stays unchanged.
        expect(body).toContain("isLoggedIn: isLoggedInLive,");
    });

    it("[unit] the hook's dependency array tracks isLoggedInLive, not the stale prop", () => {
        expect(clientSrc).toContain("}, [isLoggedInLive, isWishlistLoading, saved, campground.id, t]);");
    });
});

describe("CAM-397 BR-3: root layout hydrates SessionProvider with the server session", () => {
    it("[unit] app/layout.tsx resolves the session server-side via auth() and passes it to Providers", () => {
        expect(layoutSrc).toContain("const session = await auth();");
        // CAM-610 added a sibling `nonce` prop after `session`; match the
        // opening tag without anchoring on `>` immediately after session.
        expect(layoutSrc).toMatch(/<Providers session=\{session\}/);
    });

    it("[unit] Providers hydrates next-auth's SessionProvider with that session (CAM-242)", () => {
        expect(providersSrc).toMatch(/import\s*\{\s*SessionProvider\s*\}\s*from\s*["']next-auth\/react["']/);
        expect(providersSrc).toMatch(/<SessionProvider session=\{session\}>/);
    });
});

describe("CAM-397 BR-2: server behavior is unchanged (requireAuth 401 stays authoritative)", () => {
    it("[unit] POST /api/bookings still requires an authenticated session server-side", () => {
        const routeSrc = read("app/api/bookings/route.ts");
        expect(routeSrc).toContain("requireAuth()");
        expect(routeSrc).toContain("if (authError) return authError;");
    });
});
