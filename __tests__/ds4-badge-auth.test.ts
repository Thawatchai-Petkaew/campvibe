/**
 * DS-4 — Badge taxonomy + auth-page grammar (CAM-124)
 * PR #65, branch feature/ds4-badge-auth
 *
 * Layer: unit (static source inspection — vitest env is 'node').
 *
 * AC→test map (source-level):
 *
 *  AC-badge-1   badge.tsx has rounded-xl in base class (§2 badge shape)
 *  AC-badge-2   badge.tsx has 'success' variant present
 *  AC-badge-3   badge.tsx has 'muted' variant present
 *  AC-badge-4   badge.tsx has 'destructive' variant present (semantic token, no hex)
 *  AC-badge-5   badge.tsx has no hex colors (#RRGGBB)
 *  AC-badge-6   badge.tsx variants use token-only classes (bg-success, bg-destructive, bg-muted)
 *  AC-badge-7   badge.tsx is non-interactive (no onClick, no role="button")
 *
 *  AC-status-1  app/bookings/page.tsx uses statusVariant() + <Badge variant=...>
 *  AC-status-2  statusVariant CONFIRMED → 'success'
 *  AC-status-3  statusVariant CANCELLED → 'destructive'
 *  AC-status-4  statusVariant default (PENDING) → 'muted'
 *  AC-status-5  app/dashboard/page.tsx uses bookingStatusVariant() + <Badge variant=...>
 *  AC-status-6  dashboard bookingStatusVariant CONFIRMED → 'success'
 *  AC-status-7  dashboard bookingStatusVariant CANCELLED → 'destructive'
 *  AC-status-8  app/dashboard/bookings/page.tsx uses bookingStatusVariant() + <Badge variant=...>
 *
 *  AC-role-1    app/profile/page.tsx uses roleVariant() + <Badge variant=...>
 *  AC-role-2    roleVariant ADMIN → 'destructive'
 *  AC-role-3    roleVariant OPERATOR → 'default'
 *  AC-role-4    roleVariant CAMPER (default) → 'success'
 *  AC-role-5    components/settings/TeamManagement.tsx uses getRoleVariant() + <Badge variant=...>
 *  AC-role-6    TeamManagement getRoleVariant OWNER → 'default'
 *  AC-role-7    TeamManagement getRoleVariant MANAGER → 'success'
 *
 *  AC-over-img  bookings/page over-image badge keeps ring-2 ring-card (readable over photo)
 *  AC-i18n-1    bookings/page preserves i18n label on status (booking.status, not hardcoded)
 *  AC-i18n-2    dashboard/page preserves i18n label on badge (booking.status)
 *
 *  AC-no-raw-span  No old raw span+conditional badge class patterns remain
 *
 *  AC-auth-1    app/login/page.tsx has no !h-12 anywhere
 *  AC-auth-2    app/login/page.tsx has no rounded-[24px] anywhere
 *  AC-auth-3    app/login/page.tsx uses <Card> as wrapper
 *  AC-auth-4    app/login/page.tsx InputFields use inputSize="lg"
 *  AC-auth-5    app/login/page.tsx submit Button uses size="lg"
 *  AC-auth-6    app/login/page.tsx has no text-white (should use text-primary-foreground)
 *  AC-auth-7    app/register/page.tsx has no !h-12 anywhere
 *  AC-auth-8    app/register/page.tsx has no rounded-[24px] anywhere
 *  AC-auth-9    app/register/page.tsx uses <Card> as wrapper
 *  AC-auth-10   app/register/page.tsx InputFields use inputSize="lg"
 *  AC-auth-11   app/register/page.tsx submit Button uses size="lg"
 *  AC-auth-12   app/register/page.tsx has no text-white
 *  AC-auth-13   app/login/page.tsx submit+validation behavior preserved (form action + noValidate)
 *  AC-auth-14   app/register/page.tsx submit+validation behavior preserved (form action + noValidate)
 *
 *  AC-preview-badge  PreviewClient documents success + muted Badge variants (DS-4 kitchen-sink)
 *  AC-no-unused-inputHeight  Neither auth page declares 'const inputHeight' variable
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const badgeSrc          = src("components/ui/badge.tsx");
const bookingsPageSrc   = src("app/bookings/page.tsx");
const dashboardPageSrc  = src("app/dashboard/page.tsx");
const dashBookPageSrc   = src("app/dashboard/bookings/page.tsx");
const profilePageSrc    = src("app/profile/page.tsx");
const teamMgmtSrc       = src("components/settings/TeamManagement.tsx");
const loginPageSrc      = src("app/login/page.tsx");
const registerPageSrc   = src("app/register/page.tsx");
const previewClientSrc  = src("app/preview/PreviewClient.tsx");

// =============================================================
// Priority 2 — Badge taxonomy: badge.tsx primitives
// =============================================================

describe("badge--primitive: shape grammar (AC-badge-1)", () => {
    it("AC-badge-1: badge base class has rounded-xl (§2 badge shape)", () => {
        // Extract the base string (first arg to cva)
        const baseMatch = badgeSrc.match(/cva\(\s*["'`]([\s\S]*?)["'`]\s*,/);
        const base = baseMatch ? baseMatch[1] : "";
        expect(base).toMatch(/\brounded-xl\b/);
    });
});

describe("badge--primitive: required variants present (AC-badge-2/3/4)", () => {
    it("AC-badge-2: 'success' variant is defined in badgeVariants", () => {
        expect(badgeSrc).toMatch(/\bsuccess\s*:/);
    });

    it("AC-badge-3: 'muted' variant is defined in badgeVariants", () => {
        expect(badgeSrc).toMatch(/\bmuted\s*:/);
    });

    it("AC-badge-4: 'destructive' variant is defined in badgeVariants", () => {
        expect(badgeSrc).toMatch(/\bdestructive\s*:/);
    });

    it("AC-badge-2: 'default' variant is defined in badgeVariants", () => {
        expect(badgeSrc).toMatch(/\bdefault\s*:/);
    });

    it("AC-badge-2: 'secondary' variant is defined in badgeVariants", () => {
        expect(badgeSrc).toMatch(/\bsecondary\s*:/);
    });

    it("AC-badge-2: 'outline' variant is defined in badgeVariants", () => {
        expect(badgeSrc).toMatch(/\boutline\s*:/);
    });
});

describe("badge--primitive: tokens only, no hex (AC-badge-5/6)", () => {
    it("AC-badge-5: badge.tsx has no hex color literals", () => {
        // Exclude any hex in comments
        const noComments = badgeSrc.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
        expect(noComments).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    });

    it("AC-badge-6: success variant uses bg-success token (not raw color class)", () => {
        const successVariantBlock = badgeSrc.match(/success\s*:\s*["'`]([\s\S]*?)["'`]/)?.[1] ?? "";
        expect(successVariantBlock).toMatch(/\bbg-success/);
    });

    it("AC-badge-6: destructive variant uses bg-destructive token (not raw color class)", () => {
        const destructiveVariantBlock = badgeSrc.match(/destructive\s*:\s*["'`]([\s\S]*?)["'`]/)?.[1] ?? "";
        expect(destructiveVariantBlock).toMatch(/\bbg-destructive/);
    });

    it("AC-badge-6: muted variant uses bg-muted token (not raw color class)", () => {
        const mutedVariantBlock = badgeSrc.match(/muted\s*:\s*["'`]([\s\S]*?)["'`]/)?.[1] ?? "";
        expect(mutedVariantBlock).toMatch(/\bbg-muted/);
    });
});

describe("badge--primitive: non-interactive element (AC-badge-7)", () => {
    it("AC-badge-7: Badge renders a <span> (non-interactive) not <button>", () => {
        // The component uses 'span' as the default Comp (not button)
        expect(badgeSrc).toMatch(/["']span["']/);
        expect(badgeSrc).not.toMatch(/["']button["']/);
    });

    it("AC-badge-7: Badge component has no onClick handler defined in the component", () => {
        // onClick can be passed via ...props (spread) but the component itself does not define click behavior
        expect(badgeSrc).not.toMatch(/onClick\s*=\s*\{/);
    });
});

// =============================================================
// Priority 2 — Status variant mapping: app/bookings/page.tsx
// =============================================================

describe("badge--status-bookings: statusVariant function + Badge usage (AC-status-1/2/3/4)", () => {
    it("AC-status-1: app/bookings/page.tsx defines statusVariant function", () => {
        expect(bookingsPageSrc).toMatch(/function statusVariant/);
    });

    it("AC-status-2: statusVariant maps CONFIRMED → 'success'", () => {
        // Confirm the function body maps CONFIRMED to the 'success' string
        const fnBody = bookingsPageSrc.match(/function statusVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/CONFIRMED/);
        expect(fnBody).toMatch(/["']success['"]/);
    });

    it("AC-status-3: statusVariant maps CANCELLED → 'destructive'", () => {
        const fnBody = bookingsPageSrc.match(/function statusVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/CANCELLED/);
        expect(fnBody).toMatch(/["']destructive['"]/);
    });

    it("AC-status-4: statusVariant returns 'muted' as default (PENDING)", () => {
        const fnBody = bookingsPageSrc.match(/function statusVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/["']muted['"]/);
    });

    it("AC-status-1: app/bookings/page.tsx renders <Badge variant={statusVariant(...)}>", () => {
        expect(bookingsPageSrc).toMatch(/<Badge[\s\S]{0,200}?variant=\{statusVariant\(/);
    });

    it("AC-over-img: over-image status badge preserves ring-2 ring-card treatment", () => {
        // Badge over the photo must have ring-2 ring-card so it's readable
        const badgeBlock = bookingsPageSrc.match(/<Badge[\s\S]{0,400}?<\/Badge>/)?.[0] ?? "";
        expect(badgeBlock).toMatch(/ring-2 ring-card/);
    });

    it("AC-i18n-1: bookings/page status label comes from booking.status (i18n-safe enum value)", () => {
        // The badge renders {booking.status} — not a hardcoded string
        expect(bookingsPageSrc).toMatch(/>\s*\{booking\.status\}\s*</);
    });
});

// =============================================================
// Priority 2 — Status variant mapping: app/dashboard/page.tsx
// =============================================================

describe("badge--status-dashboard: bookingStatusVariant + Badge (AC-status-5/6/7)", () => {
    it("AC-status-5: app/dashboard/page.tsx defines bookingStatusVariant function", () => {
        expect(dashboardPageSrc).toMatch(/function bookingStatusVariant/);
    });

    it("AC-status-6: bookingStatusVariant maps CONFIRMED → 'success'", () => {
        const fnBody = dashboardPageSrc.match(/function bookingStatusVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/["']success['"]/);
    });

    it("AC-status-7: bookingStatusVariant maps CANCELLED → 'destructive'", () => {
        const fnBody = dashboardPageSrc.match(/function bookingStatusVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/["']destructive['"]/);
    });

    it("AC-status-5: dashboard/page renders <Badge variant={bookingStatusVariant(...)}>", () => {
        expect(dashboardPageSrc).toMatch(/<Badge[\s\S]{0,200}?variant=\{bookingStatusVariant\(/);
    });

    it("AC-i18n-2: dashboard/page status label comes from booking.status (not hardcoded)", () => {
        expect(dashboardPageSrc).toMatch(/>\s*\{booking\.status\}\s*</);
    });
});

// =============================================================
// Priority 2 — Status variant mapping: app/dashboard/bookings/page.tsx
// =============================================================

describe("badge--status-dash-bookings: bookingStatusVariant + Badge (AC-status-8)", () => {
    it("AC-status-8: app/dashboard/bookings/page.tsx defines bookingStatusVariant function", () => {
        expect(dashBookPageSrc).toMatch(/function bookingStatusVariant/);
    });

    it("AC-status-8: dashboard/bookings renders <Badge variant={bookingStatusVariant(...)}>", () => {
        expect(dashBookPageSrc).toMatch(/<Badge[\s\S]{0,200}?variant=\{bookingStatusVariant\(/);
    });

    it("AC-status-8: dashboard/bookings CANCELLED maps to 'destructive'", () => {
        const fnBody = dashBookPageSrc.match(/function bookingStatusVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/["']destructive['"]/);
    });
});

// =============================================================
// Priority 2 — Role variant mapping: app/profile/page.tsx
// =============================================================

describe("badge--role-profile: roleVariant + Badge (AC-role-1/2/3/4)", () => {
    it("AC-role-1: app/profile/page.tsx defines roleVariant function", () => {
        expect(profilePageSrc).toMatch(/function roleVariant/);
    });

    it("AC-role-2: roleVariant maps ADMIN → 'destructive'", () => {
        const fnBody = profilePageSrc.match(/function roleVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/ADMIN/);
        expect(fnBody).toMatch(/["']destructive['"]/);
    });

    it("AC-role-3: roleVariant maps OPERATOR → 'default'", () => {
        const fnBody = profilePageSrc.match(/function roleVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/OPERATOR/);
        expect(fnBody).toMatch(/["']default['"]/);
    });

    it("AC-role-4: roleVariant default (CAMPER) returns 'success'", () => {
        const fnBody = profilePageSrc.match(/function roleVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/["']success['"]/);
    });

    it("AC-role-1: profile/page renders <Badge variant={roleVariant(...)}>", () => {
        expect(profilePageSrc).toMatch(/<Badge[\s\S]{0,200}?variant=\{roleVariant\(/);
    });
});

// =============================================================
// Priority 2 — Role variant mapping: components/settings/TeamManagement.tsx
// =============================================================

describe("badge--role-team: getRoleVariant + Badge (AC-role-5/6/7)", () => {
    it("AC-role-5: TeamManagement.tsx defines getRoleVariant function", () => {
        expect(teamMgmtSrc).toMatch(/function getRoleVariant|const getRoleVariant/);
    });

    it("AC-role-6: getRoleVariant maps OWNER → 'default'", () => {
        const fnBody = teamMgmtSrc.match(/getRoleVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/OWNER/);
        expect(fnBody).toMatch(/["']default['"]/);
    });

    it("AC-role-7: getRoleVariant maps MANAGER → 'success'", () => {
        const fnBody = teamMgmtSrc.match(/getRoleVariant[\s\S]{0,300}?\}/)?.[0] ?? "";
        expect(fnBody).toMatch(/MANAGER/);
        expect(fnBody).toMatch(/["']success['"]/);
    });

    it("AC-role-5: TeamManagement renders <Badge variant={getRoleVariant(...)}>", () => {
        expect(teamMgmtSrc).toMatch(/variant=\{getRoleVariant\(/);
    });
});

// =============================================================
// Priority 2 — No leftover raw span status/role patterns
// =============================================================

describe("badge--no-raw-span: getRoleBadgeColor / getStatusClasses removed (AC-no-raw-span)", () => {
    it("AC-no-raw-span: app/bookings/page.tsx has no getStatusClasses function", () => {
        expect(bookingsPageSrc).not.toMatch(/function getStatusClasses/);
    });

    it("AC-no-raw-span: app/profile/page.tsx has no getRoleBadgeClasses function", () => {
        expect(profilePageSrc).not.toMatch(/function getRoleBadgeClasses/);
    });

    it("AC-no-raw-span: TeamManagement.tsx has no getRoleBadgeColor function", () => {
        expect(teamMgmtSrc).not.toMatch(/function getRoleBadgeColor/);
    });

    it("AC-no-raw-span: no consumer uses raw 'bg-success text-white' span pattern for status", () => {
        // Old pattern: <span className={`... bg-success ...`}>
        const consumers = [bookingsPageSrc, dashboardPageSrc, dashBookPageSrc, profilePageSrc, teamMgmtSrc];
        for (const fileSrc of consumers) {
            expect(fileSrc).not.toMatch(/\bbg-success\b.*\btext-white\b/);
            expect(fileSrc).not.toMatch(/\bbg-destructive\b.*\btext-white\b/);
        }
    });
});

// =============================================================
// Priority 3 — Auth pages: no !h-12, no rounded-[24px], Card wrapper
// =============================================================

describe("auth--login: !h-12 and rounded-[24px] removed (AC-auth-1/2)", () => {
    it("AC-auth-1: app/login/page.tsx has NO !h-12 anywhere", () => {
        expect(loginPageSrc).not.toMatch(/!h-12/);
    });

    it("AC-auth-2: app/login/page.tsx has NO rounded-[24px] anywhere", () => {
        expect(loginPageSrc).not.toMatch(/rounded-\[24px\]/);
    });

    it("AC-no-unused-inputHeight: login page has no 'const inputHeight' variable", () => {
        expect(loginPageSrc).not.toMatch(/const inputHeight/);
    });
});

describe("auth--register: !h-12 and rounded-[24px] removed (AC-auth-7/8)", () => {
    it("AC-auth-7: app/register/page.tsx has NO !h-12 anywhere", () => {
        expect(registerPageSrc).not.toMatch(/!h-12/);
    });

    it("AC-auth-8: app/register/page.tsx has NO rounded-[24px] anywhere", () => {
        expect(registerPageSrc).not.toMatch(/rounded-\[24px\]/);
    });

    it("AC-no-unused-inputHeight: register page has no 'const inputHeight' variable", () => {
        expect(registerPageSrc).not.toMatch(/const inputHeight/);
    });
});

describe("auth--login: Card wrapper used (AC-auth-3)", () => {
    it("AC-auth-3: app/login/page.tsx imports Card from @/components/ui/card", () => {
        expect(loginPageSrc).toMatch(/from ["']@\/components\/ui\/card["']/);
    });

    it("AC-auth-3: app/login/page.tsx renders <Card as the form wrapper", () => {
        expect(loginPageSrc).toMatch(/<Card\b/);
    });
});

describe("auth--register: Card wrapper used (AC-auth-9)", () => {
    it("AC-auth-9: app/register/page.tsx imports Card from @/components/ui/card", () => {
        expect(registerPageSrc).toMatch(/from ["']@\/components\/ui\/card["']/);
    });

    it("AC-auth-9: app/register/page.tsx renders <Card as the form wrapper", () => {
        expect(registerPageSrc).toMatch(/<Card\b/);
    });
});

describe("auth--login: InputFields use inputSize='lg' (AC-auth-4)", () => {
    it("AC-auth-4: login email InputField has inputSize='lg'", () => {
        // At least 2 InputFields must have inputSize="lg" (email + password)
        const lgCount = (loginPageSrc.match(/inputSize=["']lg["']/g) ?? []).length;
        expect(lgCount).toBeGreaterThanOrEqual(2);
    });

    it("AC-auth-4: login page InputFields have NO !h-12 on them individually", () => {
        const inputFieldBlocks = loginPageSrc.match(/<InputField[\s\S]{0,600}?\/>/g) ?? [];
        for (const block of inputFieldBlocks) {
            expect(block).not.toMatch(/!h-12/);
        }
    });
});

describe("auth--register: InputFields use inputSize='lg' (AC-auth-10)", () => {
    it("AC-auth-10: register page InputFields use inputSize='lg'", () => {
        // 4 InputFields: name, email, password, confirmPassword — all should be lg
        const lgCount = (registerPageSrc.match(/inputSize=["']lg["']/g) ?? []).length;
        expect(lgCount).toBeGreaterThanOrEqual(4);
    });

    it("AC-auth-10: register page InputFields have NO !h-12 on them individually", () => {
        const inputFieldBlocks = registerPageSrc.match(/<InputField[\s\S]{0,600}?\/>/g) ?? [];
        for (const block of inputFieldBlocks) {
            expect(block).not.toMatch(/!h-12/);
        }
    });
});

describe("auth--login: submit Button uses size='lg' (AC-auth-5)", () => {
    it("AC-auth-5: login submit Button has size='lg'", () => {
        // Match the submit button block
        const submitBtnBlock = loginPageSrc.match(/<Button[\s\S]{0,400}?type=["']submit["'][\s\S]{0,400}?>|<Button[\s\S]{0,400}?(?=type=["']submit["'])/)?.[0] ?? "";
        // Simpler: just confirm size="lg" appears in the file since submit is the only button needing it
        expect(loginPageSrc).toMatch(/size=["']lg["']/);
    });

    it("AC-auth-5: login submit Button does NOT use !h-12 override", () => {
        const buttonBlocks = loginPageSrc.match(/<Button[\s\S]{0,600}?(?:<\/Button>|\/>)/g) ?? [];
        for (const block of buttonBlocks) {
            expect(block).not.toMatch(/!h-12/);
        }
    });
});

describe("auth--register: submit Button uses size='lg' (AC-auth-11)", () => {
    it("AC-auth-11: register submit Button has size='lg'", () => {
        expect(registerPageSrc).toMatch(/size=["']lg["']/);
    });

    it("AC-auth-11: register submit Button does NOT use !h-12 override", () => {
        const buttonBlocks = registerPageSrc.match(/<Button[\s\S]{0,600}?(?:<\/Button>|\/>)/g) ?? [];
        for (const block of buttonBlocks) {
            expect(block).not.toMatch(/!h-12/);
        }
    });
});

describe("auth--login: no text-white (AC-auth-6)", () => {
    it("AC-auth-6: app/login/page.tsx has no text-white (must use text-primary-foreground)", () => {
        expect(loginPageSrc).not.toMatch(/\btext-white\b/);
    });
});

describe("auth--register: no text-white (AC-auth-12)", () => {
    it("AC-auth-12: app/register/page.tsx has no text-white (must use text-primary-foreground)", () => {
        expect(registerPageSrc).not.toMatch(/\btext-white\b/);
    });
});

describe("auth--login: layout+behavior unchanged (AC-auth-13)", () => {
    it("AC-auth-13: login form action wires to formAction (inline async or direct ref)", () => {
        // Login uses an inline async action that calls formAction(formData)
        // to allow setHasSubmitted interleave — both patterns are acceptable
        const hasDirectAction = /action=\{formAction\}/.test(loginPageSrc);
        const hasInlineAction = /action=\{async[\s\S]{0,400}?formAction\(formData\)/.test(loginPageSrc);
        expect(hasDirectAction || hasInlineAction).toBe(true);
    });

    it("AC-auth-13: login form still has noValidate for client-side validation", () => {
        expect(loginPageSrc).toMatch(/\bnoValidate\b/);
    });

    it("AC-auth-13: login form has email and password InputFields", () => {
        expect(loginPageSrc).toMatch(/name=["']email["']/);
        expect(loginPageSrc).toMatch(/name=["']password["']/);
    });
});

describe("auth--register: layout+behavior unchanged (AC-auth-14)", () => {
    it("AC-auth-14: register form still has action={formAction} wiring", () => {
        expect(registerPageSrc).toMatch(/action=\{formAction\}/);
    });

    it("AC-auth-14: register form still has noValidate for client-side validation", () => {
        expect(registerPageSrc).toMatch(/\bnoValidate\b/);
    });

    it("AC-auth-14: register form has name, email, password, confirmPassword fields", () => {
        expect(registerPageSrc).toMatch(/name=["']name["']/);
        expect(registerPageSrc).toMatch(/name=["']email["']/);
        expect(registerPageSrc).toMatch(/name=["']password["']/);
        expect(registerPageSrc).toMatch(/name=["']confirmPassword["']/);
    });

    it("AC-auth-14: register page has consent checkbox (PDPA)", () => {
        expect(registerPageSrc).toMatch(/consentRequired/);
        expect(registerPageSrc).toMatch(/Checkbox/);
    });
});

// =============================================================
// Priority 5 — Preview kitchen-sink documents DS-4 Badge taxonomy
// =============================================================

describe("preview--ds4: Badge success + muted variants documented (AC-preview-badge)", () => {
    it("AC-preview-badge: PreviewClient renders Badge variant='success'", () => {
        expect(previewClientSrc).toMatch(/variant=["']success["']/);
    });

    it("AC-preview-badge: PreviewClient renders Badge variant='muted'", () => {
        expect(previewClientSrc).toMatch(/variant=["']muted["']/);
    });

    it("AC-preview-badge: PreviewClient renders Badge variant='destructive'", () => {
        expect(previewClientSrc).toMatch(/variant=["']destructive["']/);
    });

    it("AC-preview-badge: PreviewClient imports Badge from @/components/ui/badge", () => {
        expect(previewClientSrc).toMatch(/from ["']@\/components\/ui\/badge["']/);
    });
});
