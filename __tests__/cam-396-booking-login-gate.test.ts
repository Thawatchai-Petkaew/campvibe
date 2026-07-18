/**
 * cam-396-booking-login-gate.test.ts — CAM-396: guest booking dead-end.
 *
 * Repo precedent for this component (see __tests__/cam-394-stream-reviews.test.ts,
 * __tests__/wishlist-detail-toggle.test.ts): CampgroundDetailClient is a large
 * client component with no jsdom/RTL harness in this project's Vitest setup
 * (environment: 'node'). Coverage strategy here is:
 *
 *   1. i18n — the exact Thai copy the AC promises is present verbatim in
 *      locales/translations.json (the source of truth for the UI copy).
 *
 *   2. Source-inspection Prove-It — assert the shape of handleReserve directly
 *      from the shipped source. Each assertion FAILS against the pre-fix source
 *      (no isLoggedIn gate; `data.error || t.newCampground.failedToReserve`) and
 *      passes against the fix — the regression guard for this bug.
 *
 * What is NOT covered here (requires Playwright e2e on Staging at G4):
 *  - Rendered DOM: LoginModal actually opening, sonner toast appearing on-screen
 *  - The real POST /api/bookings network call (or its absence) in a browser
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const clientSrc = read("components/CampgroundDetailClient.tsx");

const thT = translations.th;

/** Isolate the handleReserve function body via its start/end markers (repo
 *  precedent: __tests__/cam-368-photo-modal-a11y.test.ts uses the same
 *  indexOf(start) → indexOf("};", start) extraction for a handler). */
function extractHandleReserve(src: string): string {
    const start = src.indexOf("const handleReserve = async () => {");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("};", start);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
}

describe("i18n — Thai copy verbatim (locales/translations.json)", () => {
    it("AC-3: th.newCampground.failedToReserve is \"จองไม่สำเร็จ\"", () => {
        expect(thT.newCampground.failedToReserve).toBe("จองไม่สำเร็จ");
    });

    it("EC-3 (catch path): th.newCampground.errorOccurred is \"เกิดข้อผิดพลาด\"", () => {
        expect(thT.newCampground.errorOccurred).toBe("เกิดข้อผิดพลาด");
    });
});

describe("CAM-396 AC-1/EC-1, BR-1: guest tap opens the login gate before any request", () => {
    const body = extractHandleReserve(clientSrc);

    it("[unit] handleReserve gates on isLoggedIn before the /api/bookings fetch", () => {
        const gateIdx = body.indexOf("if (!isLoggedIn)");
        const fetchIdx = body.indexOf('fetch("/api/bookings"');

        // Prove-It: FAILS on the pre-fix source (no isLoggedIn check at all → -1).
        expect(gateIdx).toBeGreaterThan(-1);
        expect(fetchIdx).toBeGreaterThan(-1);
        expect(gateIdx).toBeLessThan(fetchIdx);
    });

    it("[unit] the guest branch opens the existing LoginModal (setLoginOpen) and returns", () => {
        const gateBlock = body.slice(
            body.indexOf("if (!isLoggedIn)"),
            body.indexOf("if (!isLoggedIn)") + 80,
        );
        expect(gateBlock).toContain("setLoginOpen(true)");
        expect(gateBlock).toContain("return;");
    });

    it("[unit] no new UI/component introduced — reuses the wishlist gate's LoginModal instance", () => {
        // Exactly one <LoginModal ...> mount in the file (BR-1: no new UI).
        const mounts = (clientSrc.match(/<LoginModal/g) || []).length;
        expect(mounts).toBe(1);
    });
});

describe("CAM-396 AC-2/EC-2: logged-in booking flow is unchanged", () => {
    const body = extractHandleReserve(clientSrc);

    it("[unit] the date-selection guard and reserve fetch still run for a logged-in user", () => {
        expect(body).toContain("if (!checkIn || !checkOut)");
        expect(body).toContain('fetch("/api/bookings"');
        expect(body).toContain("method: \"POST\"");
    });

    it("[unit] a successful booking still redirects to the confirmation page (no toast delay)", () => {
        expect(body).toContain("router.push(`/bookings/${data.id}/confirmation`)");
    });
});

describe("CAM-396 AC-3/EC-3, BR-2: failure toast never surfaces the raw server error", () => {
    const body = extractHandleReserve(clientSrc);

    it("[unit] the non-ok branch does NOT pass data.error into the toast", () => {
        // Prove-It: FAILS on the pre-fix source (`toast.error(data.error || ...)`).
        expect(body).not.toContain("toast.error(data.error");
        expect(body).not.toMatch(/toast\.error\([^)]*data\.error/);
    });

    it("[unit] the non-ok branch always shows t.newCampground.failedToReserve", () => {
        expect(body).toContain("toast.error(t.newCampground.failedToReserve)");
    });

    it("[unit] the catch (network error) branch is untouched — still errorOccurred", () => {
        expect(body).toContain("toast.error(t.newCampground.errorOccurred)");
    });
});

describe("CAM-396 BR-3: server 401 remains the authoritative guard (client gate is UX only)", () => {
    it("[unit] POST /api/bookings still requires an authenticated session server-side", () => {
        const routeSrc = read("app/api/bookings/route.ts");
        expect(routeSrc).toContain("requireAuth()");
        expect(routeSrc).toContain("if (authError) return authError;");
    });
});
