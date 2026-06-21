/**
 * CAM-109 — F4 Forms/Operator: source-inspection tests.
 *
 * Layer: unit (static source analysis, fs.readFileSync — vitest env is 'node').
 * Style: mirrors __tests__/f2-listing-surface.test.ts and f3-detail-surface.test.ts.
 *
 * Files under test (7):
 *   components/CampgroundForm.tsx
 *   components/LocationPicker.tsx
 *   components/settings/TeamManagement.tsx
 *   app/dashboard/page.tsx
 *   app/dashboard/bookings/page.tsx
 *   app/dashboard/campsites/page.tsx
 *   app/dashboard/settings/page.tsx
 *
 * AC coverage:
 *
 *   DEFECT-D1   campsites/page.tsx: bare confirm() on line 90 (window.confirm) — CONFIRMED FAIL
 *   DEFECT-D2   campsites/page.tsx: edit/delete icon-only buttons lack aria-label — CONFIRMED FAIL
 *   DEFECT-D3   bookings/page.tsx: pagination prev/next icon-only buttons lack aria-label — CONFIRMED FAIL
 *   DEFECT-D4   bookings/page.tsx: mobile "Clear all filters" button has hardcoded English — CONFIRMED FAIL
 *   DEFECT-D5   campsites/page.tsx: sort SelectItems have hardcoded English labels — CONFIRMED FAIL
 *   DEFECT-D6   CampgroundForm.tsx: "Create Spots" button uses text-white not text-primary-foreground
 *               over bg-primary (dark-mode fragile) — CONFIRMED FAIL
 *
 *   AC-token-1  No forbidden raw palette tokens in all 7 files
 *   AC-token-2  text-white in CampgroundForm is only over bg-primary fills (icon indicators only)
 *   AC-confirm-1 No window.confirm/alert in CampgroundForm (uses AlertDialog + toast)
 *   AC-confirm-2 No window.confirm/alert in TeamManagement (uses AlertDialog + toast)
 *   AC-confirm-3 No window.confirm/alert in dashboard/page, bookings/page, settings/page
 *   AC-confirm-4 campsites/page.tsx has bare confirm() call — DEFECT-D1
 *   AC-form-1   CampgroundForm handleSubmit sets setHasSubmitted(true) before async
 *   AC-form-2   CampgroundForm resets hasSubmitted + serverError on success
 *   AC-form-3   CampgroundForm ErrorBanner renders on hasSubmitted && serverError
 *   AC-a11y-1   Toggle cards use <button> + aria-pressed + focus-visible:ring-2
 *   AC-a11y-2   Submit button has aria-busy={isLoading}
 *   AC-a11y-3   Delete button in CampgroundForm has aria-label (i18n key)
 *   AC-a11y-4   Role Select in TeamManagement has aria-label
 *   AC-a11y-5   Permission popover has onFocus/onBlur keyboard support
 *   AC-a11y-6   Icon-only edit/delete in campsites/page lack aria-label — DEFECT-D2
 *   AC-a11y-7   Pagination prev/next in bookings/page lack aria-label — DEFECT-D3
 *   AC-a11y-8   table h-11 w-11 icon btns (campsites page)
 *   AC-a11y-9   table h-10 w-10 pagination btns (bookings page)
 *   AC-resp-1   CampgroundForm CardContent p-4 md:p-8
 *   AC-resp-2   TeamManagement table min-w-[700px] + overflow-x-auto
 *   AC-resp-3   bookings/page table min-w-[640px] + overflow-x-auto
 *   AC-resp-4   settings/page nav overflow-x-auto + whitespace-nowrap
 *   AC-i18n-1   settings.* keys present in both en + th
 *   AC-i18n-2   dashboardBookings.* keys present in both en + th
 *   AC-i18n-3   newCampground.* keys present in both en + th
 *   AC-i18n-4   dashboard.* keys present in both en + th
 *   AC-i18n-5   No em-dash in Thai settings/dashboard/newCampground/dashboardBookings copy
 *   AC-i18n-6   CampgroundForm labels reference t. tokens (logo, photos, videoUrl, district,
 *               partner, nationalPark, tags, accommodationTypes)
 *   AC-i18n-7   bookings/page mobile "Clear all filters" button is hardcoded English — DEFECT-D4
 *   AC-i18n-8   campsites/page sort SelectItems are hardcoded English — DEFECT-D5
 *   AC-dark-1   Stat icon backgrounds use semantic tokens (success/10, primary/10, muted)
 *   AC-dark-2   Status badges use semantic tokens (success/10, destructive/10, muted)
 *   AC-dark-3   Role badges in TeamManagement use semantic tokens (primary/10, success/10, muted)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const campgroundFormSrc = src("components/CampgroundForm.tsx");
const locationPickerSrc = src("components/LocationPicker.tsx");
const teamManagementSrc = src("components/settings/TeamManagement.tsx");
const dashboardPageSrc = src("app/dashboard/page.tsx");
const bookingsPageSrc = src("app/dashboard/bookings/page.tsx");
const campsitesPageSrc = src("app/dashboard/campsites/page.tsx");
const settingsPageSrc = src("app/dashboard/settings/page.tsx");

const ALL_SEVEN = [
    campgroundFormSrc,
    locationPickerSrc,
    teamManagementSrc,
    dashboardPageSrc,
    bookingsPageSrc,
    campsitesPageSrc,
    settingsPageSrc,
];

const FILE_NAMES = [
    "CampgroundForm.tsx",
    "LocationPicker.tsx",
    "TeamManagement.tsx",
    "dashboard/page.tsx",
    "dashboard/bookings/page.tsx",
    "dashboard/campsites/page.tsx",
    "dashboard/settings/page.tsx",
];

const en = (translations as any).en;
const th = (translations as any).th;

// ─────────────────────────────────────────────────────────────
// AC-token-1  Forbidden raw palette tokens
// ─────────────────────────────────────────────────────────────
describe("token-compliance: forbidden raw palette tokens (AC-token-1)", () => {
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
        ["bg-purple-N", /\bbg-purple-\d/],
        ["text-purple-N", /\btext-purple-\d/],
        ["hex color", /#[0-9a-fA-F]{3,6}\b/],
        ["dark:bg-*", /dark:bg-/],
        ["dark:text-*", /dark:text-/],
        ["dark:ring-*", /dark:ring-/],
        ["dark:border-*", /dark:border-/],
    ];

    ALL_SEVEN.forEach((fileSrc, idx) => {
        FORBIDDEN.forEach(([label, pattern]) => {
            it(`${FILE_NAMES[idx]} has no ${label}`, () => {
                expect(fileSrc).not.toMatch(pattern);
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-2  text-white only over bg-primary in CampgroundForm
// ─────────────────────────────────────────────────────────────
describe("token-compliance: text-white must be over bg-primary (AC-token-2)", () => {
    it("CampgroundForm: text-white on check-mark icons is colocated with bg-primary container", () => {
        // Every text-white should appear in a context where bg-primary is the container
        // Pattern: we allow text-white only inside "bg-primary" class strings
        const lines = campgroundFormSrc.split("\n");
        const textWhiteLines = lines
            .map((l, i) => ({ line: l, num: i + 1 }))
            .filter(({ line }) => /\btext-white\b/.test(line));

        // Each text-white line should be co-located with bg-primary context
        // (either same line or the immediate container div also carries bg-primary)
        // Verify: all text-white instances are inside bg-primary/bg-destructive/bg-primary... containers
        const violations = textWhiteLines.filter(({ line }) => {
            // Allowed: text-white on Check icon (w-3.5 h-3.5) or on a div with bg-primary
            // Not allowed: standalone text-white without bg-primary backing
            // The "create spots" button uses text-white but should use text-primary-foreground
            return /className="bg-primary hover:bg-primary\/90 text-white/.test(line);
        });

        // DEFECT-D6: the "Create Spots" button uses text-white instead of text-primary-foreground
        expect(violations.length).toBeGreaterThan(0); // This documents the defect
    });

    it("DEFECT-D6: Create Spots button uses text-white instead of text-primary-foreground", () => {
        // This is a defect: bg-primary should pair with text-primary-foreground (CSS var, dark-safe)
        // not text-white (hardcoded, fragile in dark mode if primary token is dark)
        expect(campgroundFormSrc).toMatch(/bg-primary hover:bg-primary\/90 text-white/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-confirm-1/2/3  No window.confirm or bare confirm() — except known defect
// ─────────────────────────────────────────────────────────────
describe("no-confirm-alert: window.confirm and bare confirm() (AC-confirm-*)", () => {
    const CONFIRM_PATTERN = /\bwindow\.(confirm|alert)\b|\bconfirm\s*\(/;

    it("CampgroundForm has NO confirm/alert — uses AlertDialog", () => {
        expect(campgroundFormSrc).not.toMatch(CONFIRM_PATTERN);
        expect(campgroundFormSrc).toContain("AlertDialog");
    });

    it("TeamManagement has NO confirm/alert — uses AlertDialog", () => {
        expect(teamManagementSrc).not.toMatch(CONFIRM_PATTERN);
        expect(teamManagementSrc).toContain("AlertDialog");
    });

    it("dashboard/page.tsx has NO confirm/alert", () => {
        expect(dashboardPageSrc).not.toMatch(CONFIRM_PATTERN);
    });

    it("bookings/page.tsx has NO confirm/alert", () => {
        expect(bookingsPageSrc).not.toMatch(CONFIRM_PATTERN);
    });

    it("settings/page.tsx has NO confirm/alert", () => {
        expect(settingsPageSrc).not.toMatch(CONFIRM_PATTERN);
    });

    it("DEFECT-D1: campsites/page.tsx has bare confirm() — must be replaced with AlertDialog", () => {
        // This test documents the defect. The bare confirm() is on line 90.
        expect(campsitesPageSrc).toMatch(/\bconfirm\s*\(/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-form-1/2/3  CampgroundForm submit/error state management
// ─────────────────────────────────────────────────────────────
describe("form-state: CampgroundForm submit flow (AC-form-*)", () => {
    it("AC-form-1: setHasSubmitted(true) called at start of handleSubmit", () => {
        // hasSubmitted gates the ErrorBanner; must be set before async
        expect(campgroundFormSrc).toContain("setHasSubmitted(true)");
    });

    it("AC-form-2: setHasSubmitted(false) and setServerError(null) called on success", () => {
        expect(campgroundFormSrc).toContain("setHasSubmitted(false)");
        expect(campgroundFormSrc).toContain("setServerError(null)");
    });

    it("AC-form-3: ErrorBanner renders only when hasSubmitted && serverError", () => {
        // The conditional render in JSX
        expect(campgroundFormSrc).toContain("hasSubmitted && serverError");
        expect(campgroundFormSrc).toContain("ErrorBanner");
    });

    it("AC-form-4: ErrorBanner is imported from error-banner component", () => {
        expect(campgroundFormSrc).toContain('from "@/components/ui/error-banner"');
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-1  Toggle cards are <button> with aria-pressed + focus ring
// ─────────────────────────────────────────────────────────────
describe("a11y: toggle cards (AC-a11y-1)", () => {
    it("CampgroundForm: toggle buttons have aria-pressed attribute", () => {
        const matches = campgroundFormSrc.match(/aria-pressed=\{/g);
        // Multiple toggle cards: campSiteType, ownership, isFree, isVerified, isActive, isPublished, useSpotView, petFriendly
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(6);
    });

    it("CampgroundForm: toggle buttons have focus-visible:ring-2 for keyboard nav", () => {
        expect(campgroundFormSrc).toContain("focus-visible:ring-2");
        expect(campgroundFormSrc).toContain("focus-visible:ring-ring");
    });

    it("CampgroundForm: toggle buttons are type=button (not submit)", () => {
        const typeButtons = campgroundFormSrc.match(/type="button"/g);
        expect(typeButtons).not.toBeNull();
        expect(typeButtons!.length).toBeGreaterThanOrEqual(4);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-2  Submit button has aria-busy
// ─────────────────────────────────────────────────────────────
describe("a11y: submit button aria-busy (AC-a11y-2)", () => {
    it("CampgroundForm: submit button has aria-busy={isLoading}", () => {
        expect(campgroundFormSrc).toContain("aria-busy={isLoading}");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-3  Delete button in CampgroundForm has aria-label
// ─────────────────────────────────────────────────────────────
describe("a11y: delete button aria-label in CampgroundForm (AC-a11y-3)", () => {
    it("delete button uses aria-label from i18n key (deleteAria)", () => {
        expect(campgroundFormSrc).toContain("aria-label={t.newCampground.deleteAria}");
    });

    it("newCampground.deleteAria key exists in EN locale", () => {
        expect(en.newCampground?.deleteAria).toBeTruthy();
    });

    it("newCampground.deleteAria key exists in TH locale", () => {
        expect(th.newCampground?.deleteAria).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-4  Role Select in TeamManagement has aria-label
// ─────────────────────────────────────────────────────────────
describe("a11y: role Select aria-label in TeamManagement (AC-a11y-4)", () => {
    it("Select trigger has aria-label prop", () => {
        expect(teamManagementSrc).toContain("aria-label={ts?.changeRole");
    });

    it("settings.changeRole exists in EN locale", () => {
        expect(en.settings?.changeRole).toBeTruthy();
    });

    it("settings.changeRole exists in TH locale", () => {
        expect(th.settings?.changeRole).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-5  Permission popover keyboard (onFocus/onBlur)
// ─────────────────────────────────────────────────────────────
describe("a11y: permission popover keyboard support (AC-a11y-5)", () => {
    it("TeamManagement role popover wrapper has onFocus handler", () => {
        expect(teamManagementSrc).toContain("onFocus=");
    });

    it("TeamManagement role popover wrapper has onBlur handler", () => {
        expect(teamManagementSrc).toContain("onBlur=");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-6  DEFECT: campsites/page icon-only buttons lack aria-label
// ─────────────────────────────────────────────────────────────
describe("a11y: icon-only buttons must have aria-label (AC-a11y-6 — DEFECT-D2)", () => {
    it("DEFECT-D2: campsites/page edit button (h-11 w-11) has no aria-label", () => {
        // The edit button contains only <Edit /> icon — no aria-label on the Button
        // We verify the defect exists: h-11 w-11 buttons present but aria-label not on them
        const editButtonMatch = campsitesPageSrc.match(
            /className="h-11 w-11 rounded-full border-border hover:text-primary[^"]*"/
        );
        expect(editButtonMatch).not.toBeNull(); // button exists
        // Defect: no aria-label on this Button element
        const surroundingContext = campsitesPageSrc.substring(
            campsitesPageSrc.indexOf("h-11 w-11 rounded-full border-border hover:text-primary") - 200,
            campsitesPageSrc.indexOf("h-11 w-11 rounded-full border-border hover:text-primary") + 50
        );
        expect(surroundingContext).not.toContain("aria-label");
    });

    it("DEFECT-D2: campsites/page delete button (h-11 w-11) has no aria-label", () => {
        const deleteButtonMatch = campsitesPageSrc.match(
            /className="h-11 w-11 rounded-full border-border hover:text-destructive[^"]*"/
        );
        expect(deleteButtonMatch).not.toBeNull(); // button exists
        const surroundingContext = campsitesPageSrc.substring(
            campsitesPageSrc.indexOf("h-11 w-11 rounded-full border-border hover:text-destructive") - 200,
            campsitesPageSrc.indexOf("h-11 w-11 rounded-full border-border hover:text-destructive") + 50
        );
        expect(surroundingContext).not.toContain("aria-label");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-7  DEFECT: pagination buttons lack aria-label
// ─────────────────────────────────────────────────────────────
describe("a11y: pagination prev/next buttons must have aria-label (AC-a11y-7 — DEFECT-D3)", () => {
    it("DEFECT-D3: bookings/page prev pagination button (h-10 w-10) has no aria-label", () => {
        const prevButtonIdx = bookingsPageSrc.indexOf("h-10 w-10 rounded-lg border-border");
        expect(prevButtonIdx).toBeGreaterThan(0); // button exists
        const context = bookingsPageSrc.substring(prevButtonIdx - 300, prevButtonIdx + 100);
        expect(context).not.toContain("aria-label");
    });

    it("DEFECT-D3: bookings/page next pagination button (h-10 w-10) has no aria-label", () => {
        // Find the second occurrence (next button)
        const first = bookingsPageSrc.indexOf("h-10 w-10 rounded-lg border-border");
        const second = bookingsPageSrc.indexOf("h-10 w-10 rounded-lg border-border", first + 1);
        expect(second).toBeGreaterThan(0);
        const context = bookingsPageSrc.substring(second - 300, second + 100);
        expect(context).not.toContain("aria-label");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-8  Table icon buttons are h-11 w-11
// ─────────────────────────────────────────────────────────────
describe("a11y: table icon button touch targets (AC-a11y-8)", () => {
    it("campsites/page edit and delete buttons are h-11 w-11 (44px)", () => {
        const count = (campsitesPageSrc.match(/h-11 w-11/g) || []).length;
        expect(count).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-9  Pagination buttons are h-10 w-10
// ─────────────────────────────────────────────────────────────
describe("a11y: pagination button touch targets (AC-a11y-9)", () => {
    it("bookings/page pagination prev/next are h-10 w-10 (40px)", () => {
        const count = (bookingsPageSrc.match(/h-10 w-10/g) || []).length;
        expect(count).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-1  CampgroundForm CardContent responsive padding
// ─────────────────────────────────────────────────────────────
describe("responsive: CardContent padding (AC-resp-1)", () => {
    it("CampgroundForm has p-4 md:p-8 on CardContent (multiple sections)", () => {
        const matches = campgroundFormSrc.match(/p-4 md:p-8/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(3);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-2  TeamManagement table responsive
// ─────────────────────────────────────────────────────────────
describe("responsive: TeamManagement table (AC-resp-2)", () => {
    it("TeamManagement table has min-w-[700px]", () => {
        expect(teamManagementSrc).toContain("min-w-[700px]");
    });

    it("TeamManagement table wrapper has overflow-x-auto", () => {
        expect(teamManagementSrc).toContain("overflow-x-auto");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-3  bookings/page table responsive
// ─────────────────────────────────────────────────────────────
describe("responsive: bookings/page table (AC-resp-3)", () => {
    it("bookings/page table has min-w-[640px]", () => {
        expect(bookingsPageSrc).toContain("min-w-[640px]");
    });

    it("bookings/page table wrapper has overflow-x-auto", () => {
        expect(bookingsPageSrc).toContain("overflow-x-auto");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-resp-4  settings/page nav responsive
// ─────────────────────────────────────────────────────────────
describe("responsive: settings nav (AC-resp-4)", () => {
    it("settings/page nav has overflow-x-auto", () => {
        expect(settingsPageSrc).toContain("overflow-x-auto");
    });

    it("settings/page tab labels have whitespace-nowrap", () => {
        expect(settingsPageSrc).toContain("whitespace-nowrap");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-1  settings.* keys in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: settings keys in both locales (AC-i18n-1)", () => {
    const REQUIRED_SETTINGS_KEYS = [
        "title",
        "description",
        "team",
        "notifications",
        "billing",
        "comingSoon",
        "selectCampSite",
        "addMember",
        "member",
        "contact",
        "role",
        "status",
        "actions",
        "noMembers",
        "addMemberPrompt",
        "joined",
        "pending",
        "selectRole",
        "active",
        "invited",
        "remove",
        "confirmRemove",
        "confirmRemoveDesc",
        "fromTeam",
        "memberRemoved",
        "roleUpdated",
        "changeRole",
        "permissionsTitle",
        "permissionsNote",
    ];

    REQUIRED_SETTINGS_KEYS.forEach((key) => {
        it(`settings.${key} exists in EN`, () => {
            expect(en.settings?.[key]).toBeDefined();
        });

        it(`settings.${key} exists in TH`, () => {
            expect(th.settings?.[key]).toBeDefined();
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-2  dashboardBookings.* keys in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: dashboardBookings keys in both locales (AC-i18n-2)", () => {
    const REQUIRED_BOOKING_KEYS = [
        "manageReservations",
        "searchPlaceholder",
        "status",
        "allStatus",
        "pending",
        "confirmed",
        "cancelled",
        "noBookingsFound",
        "tryAdjustingFilters",
        "bookingUpdatedSuccess",
        "failedToLoad",
        "errorOccurred",
        "show",
        "paginationOf",
        "paginationEntries",
        "actions",
    ];

    REQUIRED_BOOKING_KEYS.forEach((key) => {
        it(`dashboardBookings.${key} exists in EN`, () => {
            expect(en.dashboardBookings?.[key]).toBeDefined();
        });

        it(`dashboardBookings.${key} exists in TH`, () => {
            expect(th.dashboardBookings?.[key]).toBeDefined();
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-3  newCampground critical keys in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: newCampground keys in both locales (AC-i18n-3)", () => {
    const REQUIRED_NC_KEYS = [
        "uploadLogo",
        "videoUrl",
        "district",
        "partner",
        "nationalPark",
        "tags",
        "deleteAria",
        "confirmDelete",
        "confirmDeleteDesc",
        "saving",
        "saveListing",
        "update",
    ];

    REQUIRED_NC_KEYS.forEach((key) => {
        it(`newCampground.${key} exists in EN`, () => {
            expect(en.newCampground?.[key]).toBeDefined();
        });

        it(`newCampground.${key} exists in TH`, () => {
            expect(th.newCampground?.[key]).toBeDefined();
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-4  dashboard keys in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: dashboard keys in both locales (AC-i18n-4)", () => {
    const REQUIRED_DASH_KEYS = [
        "dashboardOverview",
        "welcomeBack",
        "addCampSite",
        "totalRevenue",
        "totalBookings",
        "activeListings",
        "recentBookings",
        "viewAll",
        "guest",
        "campground",
        "total",
        "status",
        "actions",
        "noBookings",
        "confirm",
        "cancel",
        "myCampSites",
        "manageListings",
        "searchCampSites",
        "base",
        "name",
        "location",
        "price",
        "noCampSitesFound",
        "areYouSureDelete",
        "failedToDelete",
        "createListing",
    ];

    REQUIRED_DASH_KEYS.forEach((key) => {
        it(`dashboard.${key} exists in EN`, () => {
            expect(en.dashboard?.[key]).toBeDefined();
        });

        it(`dashboard.${key} exists in TH`, () => {
            expect(th.dashboard?.[key]).toBeDefined();
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-5  No em-dash in Thai copy
// ─────────────────────────────────────────────────────────────
describe("i18n: no em-dash in Thai translations (AC-i18n-5)", () => {
    const EM_DASH = "—";
    const SECTIONS = ["settings", "dashboard", "newCampground", "dashboardBookings", "common"];

    SECTIONS.forEach((section) => {
        it(`TH ${section} section has no em-dash`, () => {
            const sectionData = th[section];
            if (!sectionData) return;
            const asString = JSON.stringify(sectionData);
            expect(asString).not.toContain(EM_DASH);
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-6  CampgroundForm labels reference t. tokens
// ─────────────────────────────────────────────────────────────
describe("i18n: CampgroundForm labels are i18n (AC-i18n-6)", () => {
    it("Logo label uses t.newCampground.uploadLogo", () => {
        expect(campgroundFormSrc).toContain("t.newCampground.uploadLogo");
    });

    it("Photos label uses t.common.photos", () => {
        expect(campgroundFormSrc).toContain("t.common.photos");
    });

    it("Video URL label uses t.newCampground.videoUrl", () => {
        expect(campgroundFormSrc).toContain("t.newCampground.videoUrl");
    });

    it("District label uses t.newCampground.district", () => {
        expect(campgroundFormSrc).toContain("t.newCampground.district");
    });

    it("Partner label uses t.newCampground.partner", () => {
        expect(campgroundFormSrc).toContain("t.newCampground.partner");
    });

    it("National Park label uses t.newCampground.nationalPark", () => {
        expect(campgroundFormSrc).toContain("t.newCampground.nationalPark");
    });

    it("Tags label uses t.newCampground.tags", () => {
        expect(campgroundFormSrc).toContain("t.newCampground.tags");
    });

    it("Accommodation type group uses t.filter key", () => {
        expect(campgroundFormSrc).toContain('t.filter["Accommodation type"]');
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-7  DEFECT: bookings/page mobile "Clear all filters" is hardcoded
// ─────────────────────────────────────────────────────────────
describe("i18n: bookings/page Clear all filters button (AC-i18n-7 — DEFECT-D4)", () => {
    it("DEFECT-D4: mobile Clear all filters button has hardcoded English string", () => {
        expect(bookingsPageSrc).toContain("Clear all filters");
    });

    it("DEFECT-D4: no i18n key for clearAllFilters in dashboard locale", () => {
        expect(en.dashboard?.clearAllFilters).toBeUndefined();
        expect(th.dashboard?.clearAllFilters).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-8  DEFECT: campsites/page sort options are hardcoded English
// ─────────────────────────────────────────────────────────────
describe("i18n: campsites/page sort options (AC-i18n-8 — DEFECT-D5)", () => {
    it("DEFECT-D5: campsites/page has hardcoded sort label 'Newest First'", () => {
        expect(campsitesPageSrc).toContain("Newest First");
    });

    it("DEFECT-D5: campsites/page has hardcoded sort label 'Oldest First'", () => {
        expect(campsitesPageSrc).toContain("Oldest First");
    });

    it("DEFECT-D5: campsites/page has hardcoded sort label 'Price: Low to High'", () => {
        expect(campsitesPageSrc).toContain("Price: Low to High");
    });

    it("DEFECT-D5: campsites/page has hardcoded placeholder 'Sort by'", () => {
        expect(campsitesPageSrc).toContain('"Sort by"');
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-1  Stat icon backgrounds use semantic tokens
// ─────────────────────────────────────────────────────────────
describe("dark-mode: stat icon backgrounds are semantic (AC-dark-1)", () => {
    it("dashboard/page revenue icon uses bg-success/10", () => {
        expect(dashboardPageSrc).toContain("bg-success/10");
    });

    it("dashboard/page bookings icon uses bg-primary/10", () => {
        expect(dashboardPageSrc).toContain("bg-primary/10");
    });

    it("dashboard/page listings icon uses bg-muted", () => {
        expect(dashboardPageSrc).toContain("bg-muted");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-2  Status badges use semantic tokens
// ─────────────────────────────────────────────────────────────
describe("dark-mode: status badge tokens are semantic (AC-dark-2)", () => {
    it("dashboard/page CONFIRMED badge uses bg-success/10 text-success", () => {
        expect(dashboardPageSrc).toContain("bg-success/10 text-success border-success/30");
    });

    it("dashboard/page CANCELLED badge uses bg-destructive/10 text-destructive", () => {
        expect(dashboardPageSrc).toContain("bg-destructive/10 text-destructive border-destructive/30");
    });

    it("bookings/page CONFIRMED badge uses bg-success/10 text-success", () => {
        expect(bookingsPageSrc).toContain("bg-success/10 text-success border-success/30");
    });

    it("bookings/page CANCELLED badge uses bg-destructive/10 text-destructive", () => {
        expect(bookingsPageSrc).toContain("bg-destructive/10 text-destructive border-destructive/30");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-3  Role badges in TeamManagement use semantic tokens
// ─────────────────────────────────────────────────────────────
describe("dark-mode: role badge tokens in TeamManagement (AC-dark-3)", () => {
    it("OWNER role uses bg-primary/10 text-primary", () => {
        expect(teamManagementSrc).toContain("bg-primary/10 text-primary border-primary/30");
    });

    it("MANAGER role uses bg-success/10 text-success", () => {
        expect(teamManagementSrc).toContain("bg-success/10 text-success border-success/30");
    });

    it("default/STAFF/VIEWER uses bg-muted text-muted-foreground", () => {
        expect(teamManagementSrc).toContain("bg-muted text-muted-foreground border-border");
    });
});

// ─────────────────────────────────────────────────────────────
// AC separator  em-dash separator vs middle-dot in popover
// ─────────────────────────────────────────────────────────────
describe("separator: middle-dot not em-dash in role popover", () => {
    it("TeamManagement uses ' · ' (middle-dot) between role and description — not em-dash", () => {
        expect(teamManagementSrc).toContain('" · "');
        expect(teamManagementSrc).not.toContain('" — "');
    });
});
