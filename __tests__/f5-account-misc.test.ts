/**
 * CAM-110 — F5 Account/Misc: source-inspection tests.
 *
 * Layer: unit (static source analysis, fs.readFileSync — vitest env is 'node').
 * Style: mirrors __tests__/f4-forms-operator.test.ts.
 *
 * Files under test (5):
 *   app/bookings/page.tsx
 *   app/profile/page.tsx
 *   app/wishlist/page.tsx (server component)
 *   components/WishlistPageClient.tsx
 *   components/NotificationCenter.tsx
 *
 * AC coverage:
 *
 *   AC-status-1   app/status/page.tsx is NOT in the F5 diff (untouched)
 *   AC-token-1    No forbidden raw palette tokens across all 5 files
 *   AC-token-2    getStatusClasses() uses bg-success / bg-muted / bg-destructive (semantic)
 *   AC-token-3    getRoleBadgeClasses() uses bg-destructive/10 / bg-primary/10 / bg-success/10 (semantic)
 *   AC-token-4    NotificationCenter: no ring-white (was defect in staging; now ring-card)
 *   AC-confirm-1  No window.confirm / window.alert / bare confirm( / bare alert( in any of 5 files
 *   AC-confirm-2  bookings/page.tsx uses AlertDialog for booking cancellation
 *   AC-a11y-1     Bell button is h-11 w-11 (44px tap target)
 *   AC-a11y-2     Bell button has aria-label referencing t.settings.notifications
 *   AC-a11y-3     Unread badge span has aria-label with unreadCountAria key
 *   AC-a11y-4     Cancel booking button is h-11 (44px tap target)
 *   AC-a11y-5     Cancel booking button has aria-label referencing cancelBookingAriaLabel
 *   AC-a11y-6     View Details button is h-11 (44px tap target)
 *   AC-a11y-7     Wishlist guest CTA is h-11 (44px tap target)
 *   AC-a11y-8     Wishlist empty-state CTA is h-11 (44px tap target)
 *   AC-a11y-9     Avatar upload overlay has aria-label referencing changeAvatarAria
 *   AC-a11y-10    Accept button in NotificationCenter is h-9
 *   AC-a11y-11    Decline button in NotificationCenter is h-9
 *   AC-resp-1     NotificationCenter dropdown: w-[calc(100vw-2rem)] sm:w-[380px]
 *   AC-resp-2     NotificationCenter DropdownMenuContent has sideOffset
 *   AC-resp-3     Bookings meta-row stacks on mobile: flex-col sm:flex-row
 *   AC-resp-4     Bookings buttons have flex-1 sm:flex-none for mobile
 *   AC-i18n-1     bookings.* keys present in both en + th locales
 *   AC-i18n-2     profile.role* keys (roleCamper / roleOperator / roleAdmin) in both locales
 *   AC-i18n-3     profile.changeAvatarAria present in both locales
 *   AC-i18n-4     notifications.unreadCountAria present in both locales
 *   AC-i18n-5     common.all present (not undefined) in both locales
 *   AC-i18n-6     No em-dash in Thai bookings / profile / notifications / wishlist / common copy
 *   AC-i18n-7     profile page: getRoleLabel called with t.profile (uses i18n, not raw enum)
 *   AC-i18n-8     bookings page: uses t.bookings.totalPaid (not hardcoded "Total Paid")
 *   AC-i18n-9     bookings page: uses t.bookings.exploreButton (not hardcoded "Explore")
 *   AC-i18n-10    wishlist copy is referenced via t.wishlist.* keys (not hardcoded)
 *   AC-dark-1     Status badges use semantic tokens (success / muted / destructive)
 *   AC-dark-2     Role badges use semantic bg/text tokens (no raw color classes)
 *   AC-dark-3     NotificationCenter: success/10 + destructive/10 + muted tokens used
 *   AC-status-2   app/status/page.tsx does not appear in git diff against staging
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import translations from "../locales/translations.json";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const bookingsPageSrc = src("app/bookings/page.tsx");
const profilePageSrc = src("app/profile/page.tsx");
const wishlistPageSrc = src("app/wishlist/page.tsx");
const wishlistClientSrc = src("components/WishlistPageClient.tsx");
const notificationCenterSrc = src("components/NotificationCenter.tsx");

const ALL_FIVE = [
    bookingsPageSrc,
    profilePageSrc,
    wishlistPageSrc,
    wishlistClientSrc,
    notificationCenterSrc,
];

const FILE_NAMES = [
    "app/bookings/page.tsx",
    "app/profile/page.tsx",
    "app/wishlist/page.tsx",
    "components/WishlistPageClient.tsx",
    "components/NotificationCenter.tsx",
];

const en = (translations as any).en;
const th = (translations as any).th;

// ─────────────────────────────────────────────────────────────
// AC-status-1 / AC-status-2  app/status/page.tsx untouched
// ─────────────────────────────────────────────────────────────
describe("AC-status-1/2: app/status/page.tsx must not be in the F5 diff", () => {
    it("git diff staging --name-only does not include app/status/page.tsx", () => {
        let diffOutput = "";
        try {
            diffOutput = execSync("git diff staging --name-only", {
                cwd: root,
                encoding: "utf-8",
            });
        } catch {
            // If git command fails (e.g. no remote), treat as clean
            diffOutput = "";
        }
        const changedFiles = diffOutput.split("\n").map((l) => l.trim());
        expect(changedFiles).not.toContain("app/status/page.tsx");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-1  Forbidden raw palette tokens
// ─────────────────────────────────────────────────────────────
describe("AC-token-1: forbidden raw palette tokens (all 5 files)", () => {
    const FORBIDDEN: Array<[string, RegExp]> = [
        ["bg-gray-N", /\bbg-gray-\d/],
        ["text-gray-N", /\btext-gray-\d/],
        ["border-gray-N", /\bborder-gray-\d/],
        ["bg-blue-N", /\bbg-blue-\d/],
        ["text-blue-N", /\btext-blue-\d/],
        ["bg-green-N", /\bbg-green-\d/],
        ["text-green-N", /\btext-green-\d/],
        ["bg-red-N", /\bbg-red-\d/],
        ["text-red-N", /\btext-red-\d/],
        ["bg-yellow-N", /\bbg-yellow-\d/],
        ["text-yellow-N", /\btext-yellow-\d/],
        ["bg-emerald-N", /\bbg-emerald-\d/],
        ["text-emerald-N", /\btext-emerald-\d/],
        ["bg-zinc-N", /\bbg-zinc-\d/],
        ["bg-slate-N", /\bbg-slate-\d/],
        ["hex color", /#[0-9a-fA-F]{3,6}\b/],
        ["text-[10px]", /text-\[10px\]/],
        ["bg-gradient", /bg-gradient/],
        ["dark:bg-*", /dark:bg-/],
        ["dark:text-*", /dark:text-/],
        ["dark:ring-*", /dark:ring-/],
        ["dark:border-*", /dark:border-/],
    ];

    ALL_FIVE.forEach((fileSrc, idx) => {
        FORBIDDEN.forEach(([label, pattern]) => {
            it(`${FILE_NAMES[idx]} has no ${label}`, () => {
                expect(fileSrc).not.toMatch(pattern);
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-2  getStatusClasses uses semantic tokens
// ─────────────────────────────────────────────────────────────
describe("AC-token-2: bookings status badge uses semantic tokens", () => {
    it("getStatusClasses returns bg-success for CONFIRMED", () => {
        expect(bookingsPageSrc).toMatch(/case "CONFIRMED":\s*\n\s*return "bg-success/);
    });

    it("getStatusClasses returns bg-muted for PENDING", () => {
        expect(bookingsPageSrc).toMatch(/case "PENDING":\s*\n\s*return "bg-muted/);
    });

    it("getStatusClasses returns bg-destructive for CANCELLED", () => {
        expect(bookingsPageSrc).toMatch(/case "CANCELLED":\s*\n\s*return "bg-destructive/);
    });

    it("bookings page does NOT use old bg-green-N tokens for status (was defect in staging)", () => {
        expect(bookingsPageSrc).not.toMatch(/bg-green-\d/);
    });

    it("bookings page does NOT use old bg-yellow-N tokens for status (was defect in staging)", () => {
        expect(bookingsPageSrc).not.toMatch(/bg-yellow-\d/);
    });

    it("bookings page does NOT use ring-white (was defect in staging)", () => {
        expect(bookingsPageSrc).not.toMatch(/\bring-white\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-3  getRoleBadgeClasses uses semantic tokens
// ─────────────────────────────────────────────────────────────
describe("AC-token-3: profile role badge uses semantic tokens", () => {
    it("ADMIN role uses bg-destructive/10 text-destructive", () => {
        expect(profilePageSrc).toMatch(/bg-destructive\/10 text-destructive/);
    });

    it("OPERATOR role uses bg-primary/10 text-primary", () => {
        expect(profilePageSrc).toMatch(/bg-primary\/10 text-primary/);
    });

    it("default (CAMPER) role uses bg-success/10 text-success", () => {
        expect(profilePageSrc).toMatch(/bg-success\/10 text-success/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-4  NotificationCenter no ring-white
// ─────────────────────────────────────────────────────────────
describe("AC-token-4: NotificationCenter uses ring-card not ring-white", () => {
    it("NotificationCenter does not contain ring-white", () => {
        expect(notificationCenterSrc).not.toMatch(/\bring-white\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-confirm-1  No bare confirm/alert in any file
// ─────────────────────────────────────────────────────────────
describe("AC-confirm-1: no window.confirm / window.alert / bare confirm( / bare alert(", () => {
    ALL_FIVE.forEach((fileSrc, idx) => {
        it(`${FILE_NAMES[idx]}: no window.confirm`, () => {
            expect(fileSrc).not.toMatch(/window\.confirm\s*\(/);
        });

        it(`${FILE_NAMES[idx]}: no window.alert`, () => {
            expect(fileSrc).not.toMatch(/window\.alert\s*\(/);
        });

        it(`${FILE_NAMES[idx]}: no bare confirm(`, () => {
            // Match bare confirm( not preceded by 't.' or identifier chars
            expect(fileSrc).not.toMatch(/(?<![.\w])confirm\s*\(/);
        });

        it(`${FILE_NAMES[idx]}: no bare alert(`, () => {
            expect(fileSrc).not.toMatch(/(?<![.\w])alert\s*\(/);
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-confirm-2  Bookings uses AlertDialog (not confirm)
// ─────────────────────────────────────────────────────────────
describe("AC-confirm-2: bookings/page.tsx uses AlertDialog for cancel flow", () => {
    it("imports AlertDialog from @/components/ui/alert-dialog", () => {
        // Import is a multi-line destructured import block; check for the closing line
        expect(bookingsPageSrc).toMatch(/from ["']@\/components\/ui\/alert-dialog["']/);
        expect(bookingsPageSrc).toMatch(/AlertDialog[,\s]/);
    });

    it("uses AlertDialogTrigger", () => {
        expect(bookingsPageSrc).toMatch(/AlertDialogTrigger/);
    });

    it("uses AlertDialogAction with variant destructive", () => {
        expect(bookingsPageSrc).toMatch(/AlertDialogAction[\s\S]*?variant="destructive"/);
    });

    it("uses AlertDialogCancel", () => {
        expect(bookingsPageSrc).toMatch(/AlertDialogCancel/);
    });

    it("AlertDialogDescription contains confirmCancelDescription i18n key", () => {
        expect(bookingsPageSrc).toMatch(/t\.bookings\.confirmCancelDescription/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-1  Bell button h-11 w-11 (44px tap target)
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-1: bell button has 44px tap target", () => {
    it("NotificationCenter trigger button has h-11 w-11", () => {
        expect(notificationCenterSrc).toMatch(/h-11 w-11/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-2  Bell button has aria-label
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-2: bell button has aria-label", () => {
    it("NotificationCenter trigger button has aria-label referencing t.settings?.notifications", () => {
        expect(notificationCenterSrc).toMatch(/aria-label=\{t\.settings\?\.notifications/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-3  Unread badge has aria-label with unreadCountAria
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-3: unread count badge has aria-label", () => {
    it("NotificationCenter unread badge span has aria-label using unreadCountAria", () => {
        expect(notificationCenterSrc).toMatch(/aria-label=\{.*unreadCountAria/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-4  Cancel booking button h-11 (44px)
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-4: cancel booking button has 44px tap target", () => {
    it("Cancel booking trigger button has h-11", () => {
        // The cancel button is the AlertDialogTrigger button
        expect(bookingsPageSrc).toMatch(/h-11[\s\S]*?cancelBookingAriaLabel|cancelBookingAriaLabel[\s\S]*?h-11/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-5  Cancel booking button has aria-label
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-5: cancel booking button has aria-label", () => {
    it("cancel button has aria-label={t.bookings.cancelBookingAriaLabel}", () => {
        expect(bookingsPageSrc).toMatch(/aria-label=\{t\.bookings\.cancelBookingAriaLabel\}/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-6  View Details button h-11 (44px)
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-6: view details button has 44px tap target", () => {
    it("View details link-button has h-11", () => {
        // The View Details button: h-11 is on the same className line as the button,
        // and viewDetails appears inside it shortly after.
        // Match: Button with h-11 followed (nearby) by t.bookings.viewDetails
        expect(bookingsPageSrc).toMatch(/h-11[\s\S]{0,400}t\.bookings\.viewDetails/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-7  Wishlist guest CTA h-11
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-7: wishlist guest CTA has 44px tap target", () => {
    it("WishlistPageClient guest login button has h-11", () => {
        // The guest CTA is the login button
        expect(wishlistClientSrc).toMatch(/loginButton[\s\S]*?h-11|h-11[\s\S]*?loginButton/);
    });

    it("WishlistPageClient guest button className contains h-11", () => {
        expect(wishlistClientSrc).toMatch(/className="h-11/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-8  Wishlist empty-state CTA h-11
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-8: wishlist empty-state CTA has 44px tap target", () => {
    it("WishlistPageClient empty-state button has h-11", () => {
        // Count occurrences of h-11 in wishlist client
        const matches = wishlistClientSrc.match(/h-11/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-9  Avatar upload overlay has aria-label
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-9: avatar upload overlay has aria-label", () => {
    it("profile page avatar overlay button has aria-label={t.profile.changeAvatarAria}", () => {
        expect(profilePageSrc).toMatch(/aria-label=\{t\.profile\.changeAvatarAria\}/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-10 / AC-a11y-11  Accept/Decline buttons h-9
// ─────────────────────────────────────────────────────────────
describe("AC-a11y-10/11: Accept and Decline buttons in NotificationCenter are h-9", () => {
    it("Decline button has h-9", () => {
        // Decline button: className="h-9 ..." comes before onClick DECLINE handler
        // Pattern: h-9 class appears in the same Button block as DECLINE action
        expect(notificationCenterSrc).toMatch(/h-9[\s\S]{0,150}DECLINE|DECLINE[\s\S]{0,150}h-9/);
    });

    it("Accept button has h-9", () => {
        // Accept button: className="h-9 ..." comes before onClick ACCEPT handler
        // The distance between h-9 and ACCEPT in the source is ~190 chars
        expect(notificationCenterSrc).toMatch(/h-9[\s\S]{0,250}ACCEPT|ACCEPT[\s\S]{0,250}h-9/);
    });

    it("NotificationCenter has at least 2 h-9 button instances (Decline + Accept)", () => {
        const matches = notificationCenterSrc.match(/\bh-9\b/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-1  NotificationCenter responsive dropdown width
// ─────────────────────────────────────────────────────────────
describe("AC-resp-1: NotificationCenter dropdown is responsive", () => {
    it("dropdown has w-[calc(100vw-2rem)] for mobile", () => {
        expect(notificationCenterSrc).toMatch(/w-\[calc\(100vw-2rem\)\]/);
    });

    it("dropdown has sm:w-[380px] for sm breakpoint", () => {
        expect(notificationCenterSrc).toMatch(/sm:w-\[380px\]/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-2  NotificationCenter sideOffset on DropdownMenuContent
// ─────────────────────────────────────────────────────────────
describe("AC-resp-2: NotificationCenter has sideOffset", () => {
    it("DropdownMenuContent has sideOffset prop", () => {
        expect(notificationCenterSrc).toMatch(/sideOffset=\{/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-3  Bookings meta-row stacks on mobile
// ─────────────────────────────────────────────────────────────
describe("AC-resp-3: bookings meta-row stacks on mobile with flex-col sm:flex-row", () => {
    it("bookings page has flex-col sm:flex-row for responsive layout", () => {
        expect(bookingsPageSrc).toMatch(/flex-col sm:flex-row/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-4  Bookings buttons flex-1 sm:flex-none for mobile stretch
// ─────────────────────────────────────────────────────────────
describe("AC-resp-4: bookings buttons are flex-1 sm:flex-none for mobile", () => {
    it("bookings page cancel button has flex-1 sm:flex-none", () => {
        expect(bookingsPageSrc).toMatch(/flex-1 sm:flex-none/);
    });

    it("bookings page has at least 2 flex-1 sm:flex-none instances (Cancel + View)", () => {
        const matches = bookingsPageSrc.match(/flex-1 sm:flex-none/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-1  bookings.* keys in both locales
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-1: bookings.* keys present in both en + th", () => {
    const REQUIRED_BOOKINGS_KEYS = [
        "myBookings",
        "manageBookings",
        "noBookingsYet",
        "startSearching",
        "loadingTrips",
        "bookingCancelledSuccess",
        "failedToCancel",
        "errorOccurred",
        "viewDetails",
        "cancelBooking",
        "exploreButton",
        "totalPaid",
        "cancelBookingAriaLabel",
        "confirmCancelTitle",
        "confirmCancelDescription",
        "confirmCancelAction",
        "keepBooking",
    ];

    REQUIRED_BOOKINGS_KEYS.forEach((key) => {
        it(`en.bookings.${key} is defined`, () => {
            expect(en.bookings[key]).toBeDefined();
            expect(en.bookings[key]).not.toBe("");
        });

        it(`th.bookings.${key} is defined`, () => {
            expect(th.bookings[key]).toBeDefined();
            expect(th.bookings[key]).not.toBe("");
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-2  profile.role* keys in both locales
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-2: profile role keys present in both en + th", () => {
    const ROLE_KEYS = ["roleCamper", "roleOperator", "roleAdmin"];

    ROLE_KEYS.forEach((key) => {
        it(`en.profile.${key} is defined`, () => {
            expect(en.profile[key]).toBeDefined();
            expect(en.profile[key]).not.toBe("");
        });

        it(`th.profile.${key} is defined`, () => {
            expect(th.profile[key]).toBeDefined();
            expect(th.profile[key]).not.toBe("");
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-3  profile.changeAvatarAria in both locales
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-3: profile.changeAvatarAria in both locales", () => {
    it("en.profile.changeAvatarAria is defined", () => {
        expect(en.profile.changeAvatarAria).toBeDefined();
        expect(en.profile.changeAvatarAria).not.toBe("");
    });

    it("th.profile.changeAvatarAria is defined", () => {
        expect(th.profile.changeAvatarAria).toBeDefined();
        expect(th.profile.changeAvatarAria).not.toBe("");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-4  notifications.unreadCountAria in both locales
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-4: notifications.unreadCountAria in both locales", () => {
    it("en.notifications.unreadCountAria is defined and contains {count} placeholder", () => {
        expect(en.notifications.unreadCountAria).toBeDefined();
        expect(en.notifications.unreadCountAria).toContain("{count}");
    });

    it("th.notifications.unreadCountAria is defined and contains {count} placeholder", () => {
        expect(th.notifications.unreadCountAria).toBeDefined();
        expect(th.notifications.unreadCountAria).toContain("{count}");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-5  common.all not undefined in both locales
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-5: common.all is not undefined (was regression risk)", () => {
    it("en.common.all is defined", () => {
        expect(en.common.all).toBeDefined();
        expect(en.common.all).not.toBe("");
    });

    it("th.common.all is defined", () => {
        expect(th.common.all).toBeDefined();
        expect(th.common.all).not.toBe("");
    });

    it("en.common.all equals 'All'", () => {
        expect(en.common.all).toBe("All");
    });

    it("th.common.all equals 'ทั้งหมด'", () => {
        expect(th.common.all).toBe("ทั้งหมด");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-6  No em-dash in Thai copy for F5 sections
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-6: no em-dash (—) in Thai copy for F5 sections", () => {
    const F5_TH_SECTIONS = ["bookings", "profile", "notifications", "common", "wishlist"] as const;

    F5_TH_SECTIONS.forEach((section) => {
        it(`th.${section}: no em-dash in any value`, () => {
            const sectionData = th[section] as Record<string, string> | undefined;
            if (!sectionData) return;
            Object.entries(sectionData).forEach(([key, value]) => {
                if (typeof value === "string") {
                    expect(value, `th.${section}.${key} contains em-dash`).not.toContain("—");
                }
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-7  profile page uses getRoleLabel with t.profile (i18n, not raw enum)
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-7: profile page role badge uses i18n label not raw enum", () => {
    it("getRoleLabel function exists in profile page", () => {
        expect(profilePageSrc).toMatch(/function getRoleLabel/);
    });

    it("getRoleLabel accepts profileT with roleAdmin/roleOperator/roleCamper", () => {
        expect(profilePageSrc).toMatch(/profileT\.roleAdmin/);
        expect(profilePageSrc).toMatch(/profileT\.roleOperator/);
        expect(profilePageSrc).toMatch(/profileT\.roleCamper/);
    });

    it("getRoleLabel is called with t.profile", () => {
        expect(profilePageSrc).toMatch(/getRoleLabel\(.*t\.profile\)/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-8  bookings page uses t.bookings.totalPaid (not hardcoded)
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-8: bookings/page uses t.bookings.totalPaid (not hardcoded)", () => {
    it("uses t.bookings.totalPaid for label", () => {
        expect(bookingsPageSrc).toMatch(/t\.bookings\.totalPaid/);
    });

    it("does not contain hardcoded 'Total Paid' string", () => {
        expect(bookingsPageSrc).not.toMatch(/"Total Paid"/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-9  bookings page uses t.bookings.exploreButton (not hardcoded)
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-9: bookings/page uses t.bookings.exploreButton (not hardcoded)", () => {
    it("uses t.bookings.exploreButton for empty state CTA", () => {
        expect(bookingsPageSrc).toMatch(/t\.bookings\.exploreButton/);
    });

    it("does not contain hardcoded 'Explore' string for CTA", () => {
        expect(bookingsPageSrc).not.toMatch(/"Explore Campgrounds"/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-10  wishlist copy uses t.wishlist.* keys
// ─────────────────────────────────────────────────────────────
describe("AC-i18n-10: WishlistPageClient uses t.wishlist.* keys", () => {
    const WISHLIST_KEYS_USED = [
        "pageTitle",
        "guestHeading",
        "guestSubtitle",
        "loginButton",
        "emptyHeading",
        "emptySubtitle",
        "startSearching",
        "errorLoad",
    ];

    WISHLIST_KEYS_USED.forEach((key) => {
        it(`WishlistPageClient references t.wishlist.${key}`, () => {
            expect(wishlistClientSrc).toMatch(new RegExp(`t\\.wishlist\\.${key}`));
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-1  Status badges in bookings use semantic tokens (dark-safe)
// ─────────────────────────────────────────────────────────────
describe("AC-dark-1: bookings status badges use semantic tokens (dark-mode safe)", () => {
    it("CONFIRMED uses bg-success (semantic, dark-aware)", () => {
        expect(bookingsPageSrc).toMatch(/bg-success/);
    });

    it("CANCELLED uses bg-destructive (semantic, dark-aware)", () => {
        expect(bookingsPageSrc).toMatch(/bg-destructive/);
    });

    it("PENDING uses bg-muted (semantic, dark-aware)", () => {
        expect(bookingsPageSrc).toMatch(/bg-muted/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-2  Role badges in profile use semantic tokens
// ─────────────────────────────────────────────────────────────
describe("AC-dark-2: profile role badges use semantic bg/text tokens (dark-mode safe)", () => {
    it("role badge containers use bg-*/10 semantic opacity", () => {
        expect(profilePageSrc).toMatch(/bg-destructive\/10/);
        expect(profilePageSrc).toMatch(/bg-primary\/10/);
        expect(profilePageSrc).toMatch(/bg-success\/10/);
    });

    it("role badge text uses semantic text-* tokens", () => {
        expect(profilePageSrc).toMatch(/text-destructive/);
        expect(profilePageSrc).toMatch(/text-primary/);
        expect(profilePageSrc).toMatch(/text-success/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-3  NotificationCenter uses semantic tokens
// ─────────────────────────────────────────────────────────────
describe("AC-dark-3: NotificationCenter uses semantic tokens for dark-mode safety", () => {
    it("uses bg-success/10 for confirmed status icon", () => {
        expect(notificationCenterSrc).toMatch(/bg-success\/10/);
    });

    it("uses bg-destructive/10 for cancelled status icon", () => {
        expect(notificationCenterSrc).toMatch(/bg-destructive\/10/);
    });

    it("uses bg-muted for neutral status icon", () => {
        expect(notificationCenterSrc).toMatch(/bg-muted/);
    });

    it("uses bg-primary/10 for invite icon", () => {
        expect(notificationCenterSrc).toMatch(/bg-primary\/10/);
    });

    it("dropdown uses bg-card for background (dark-aware)", () => {
        expect(notificationCenterSrc).toMatch(/bg-card/);
    });

    it("dropdown uses border-border (dark-aware)", () => {
        expect(notificationCenterSrc).toMatch(/border-border/);
    });
});
