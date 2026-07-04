/**
 * cam-241-auth-client-sync.test.ts — CAM-241 MEDIA-3
 *
 * Fix: credentials login and logout switched from server actions to client
 * next-auth/react signIn/signOut so the SessionProvider is updated in-memory
 * and the Navbar (navUser) + LoginModal status-effect reflect the change without
 * a full-page reload.
 *
 * Layer: source-inspect (static parse of real production files).
 *
 * AC coverage:
 *
 *  AC-1  LoginModal uses client signIn("credentials", …) from next-auth/react
 *        (not the removed authenticate server action).
 *  AC-2  LoginModal success path calls update() + onClose() + router.refresh().
 *  AC-3  LoginModal bad-creds shows the Thai error copy from t.auth.invalidCredentials.
 *  AC-4  LoginModal preserves email-format validation (emailValidationError guard).
 *  AC-5  LoginModal preserves Google button (googleSignIn server action unchanged).
 *  AC-6  LoginModal preserves onSwitchToRegister prop (modal switch intact).
 *  AC-7  LoginModal form uses onSubmit (not server action=) after CAM-241.
 *  AC-8  app/login/page.tsx uses client signIn("credentials", …) from next-auth/react.
 *  AC-9  app/login/page.tsx open-redirect guard: sanitizeCallbackUrl defined in page source.
 *  AC-10 app/login/page.tsx success path calls router.push(callbackUrl) + router.refresh().
 *  AC-11 Navbar signOut item calls client signOut({ callbackUrl: "/" }) (not handleSignOut).
 *  AC-12 DashboardHeader logout calls client signOut({ callbackUrl: "/" }) (not handleSignOut).
 *  AC-13 lib/actions.ts no longer exports authenticate or handleSignOut.
 *  AC-14 lib/actions.ts still exports register and googleSignIn.
 *  AC-15 rate-limit in lib/auth.ts is NOT modified (authorize callback fires on every signIn).
 *  AC-16 Google OAuth (googleSignIn) is unchanged in lib/actions.ts.
 *  AC-17 RegisterModal is NOT modified by CAM-241 (no auto-login).
 *
 * Prove-It notes:
 *  AC-1:  FAILS if authenticate is still imported into LoginModal.
 *  AC-2:  FAILS if update() call is removed from the success path in LoginModal.
 *  AC-3:  FAILS if t.auth.invalidCredentials is removed from the error branch.
 *  AC-4:  FAILS if emailValidationError guard is removed from LoginModal.
 *  AC-5:  FAILS if googleSignIn import is removed from LoginModal.
 *  AC-6:  FAILS if onSwitchToRegister prop is removed from LoginModal interface.
 *  AC-7:  FAILS if the form reverts to action={formAction} instead of onSubmit.
 *  AC-8:  FAILS if authenticate is still imported into app/login/page.tsx.
 *  AC-9:  FAILS if sanitizeCallbackUrl helper is removed from app/login/page.tsx.
 *  AC-10: FAILS if router.push is removed from the success path in app/login/page.tsx.
 *  AC-11: FAILS if handleSignOut import is re-added to Navbar.tsx.
 *  AC-12: FAILS if handleSignOut import is re-added to DashboardHeader.tsx.
 *  AC-13: FAILS if authenticate or handleSignOut are re-added to lib/actions.ts.
 *  AC-14: FAILS if register or googleSignIn are removed from lib/actions.ts.
 *  AC-15: FAILS if lib/auth.ts no longer contains the rate-limit comment/logic.
 *  AC-16: FAILS if googleSignIn loses the open-redirect guard in lib/actions.ts.
 *  AC-17: FAILS if RegisterModal imports signIn from next-auth/react (not expected).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
function src(relPath: string): string {
    return fs.readFileSync(path.join(root, relPath), 'utf-8');
}

const loginModalSrc      = src('components/LoginModal.tsx');
const loginPageSrc       = src('app/login/page.tsx');
const navbarSrc          = src('components/Navbar.tsx');
const dashboardHeaderSrc = src('components/DashboardHeader.tsx');
const actionsSrc         = src('lib/actions.ts');
const authSrc            = src('lib/auth.ts');
const registerModalSrc   = src('components/RegisterModal.tsx');

// ===========================================================================
// AC-1 — LoginModal: client signIn, not server authenticate
// ===========================================================================

describe('AC-1 — LoginModal uses client signIn from next-auth/react', () => {

    it('[import] LoginModal imports signIn from next-auth/react', () => {
        expect(loginModalSrc).toMatch(/import\s+\{[^}]*\bsignIn\b[^}]*\}\s+from\s+['"]next-auth\/react['"]/);
    });

    it('[no-server-action] LoginModal does NOT import authenticate from @/lib/actions', () => {
        expect(loginModalSrc).not.toMatch(/\bauthenticate\b/);
    });

    it('[no-useActionState] LoginModal does NOT use useActionState', () => {
        expect(loginModalSrc).not.toContain('useActionState');
    });

    it('[signIn-call] LoginModal calls signIn("credentials", …)', () => {
        expect(loginModalSrc).toMatch(/signIn\s*\(\s*["']credentials["']/);
    });

    it('[redirect-false] LoginModal passes redirect: false to signIn', () => {
        expect(loginModalSrc).toContain('redirect: false');
    });
});

// ===========================================================================
// AC-2 — LoginModal success path: update() + onClose() + router.refresh()
// ===========================================================================

describe('AC-2 — LoginModal success path calls update() + onClose + router.refresh()', () => {

    it('[update] LoginModal imports update from useSession', () => {
        expect(loginModalSrc).toMatch(/\bupdate\b/);
        expect(loginModalSrc).toMatch(/useSession/);
    });

    it('[router-refresh] LoginModal calls router.refresh() on success', () => {
        expect(loginModalSrc).toContain('router.refresh()');
    });

    it('[close] LoginModal calls handleClose (which calls onClose) on success', () => {
        expect(loginModalSrc).toContain('handleClose()');
    });
});

// ===========================================================================
// AC-3 — LoginModal error: Thai error copy preserved
// ===========================================================================

describe('AC-3 — LoginModal shows Thai error copy on bad credentials', () => {

    it('[error-copy] LoginModal sets error from t.auth.invalidCredentials', () => {
        expect(loginModalSrc).toContain('t.auth.invalidCredentials');
    });

    it('[fallback-copy] LoginModal has Thai fallback string as literal guard', () => {
        expect(loginModalSrc).toContain('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    });

    it('[error-state] LoginModal has errorMessage state', () => {
        expect(loginModalSrc).toMatch(/\berrorMessage\b/);
    });
});

// ===========================================================================
// AC-4 — LoginModal preserves email-format validation
// ===========================================================================

describe('AC-4 — LoginModal preserves email-format client validation', () => {

    it('[email-validation] LoginModal still has emailValidationError guard', () => {
        expect(loginModalSrc).toContain('emailValidationError');
    });

    it('[email-regex] LoginModal still contains email format validation', () => {
        // The email format check must include an @-sign test (regex)
        expect(loginModalSrc).toContain('@[^');
    });
});

// ===========================================================================
// AC-5 — LoginModal preserves Google button (googleSignIn unchanged)
// ===========================================================================

describe('AC-5 — LoginModal Google button (googleSignIn server action) unchanged', () => {

    it('[google-import] LoginModal still imports googleSignIn from @/lib/actions', () => {
        expect(loginModalSrc).toMatch(/import\s+\{[^}]*googleSignIn[^}]*\}\s+from\s+['"]@\/lib\/actions['"]/);
    });

    it('[google-testid] LoginModal still has data-testid="btn--login-google"', () => {
        expect(loginModalSrc).toContain('data-testid="btn--login-google"');
    });

    it('[google-transition] LoginModal still has isGooglePending for Google button', () => {
        expect(loginModalSrc).toContain('isGooglePending');
    });
});

// ===========================================================================
// AC-6 — LoginModal preserves onSwitchToRegister prop
// ===========================================================================

describe('AC-6 — LoginModal preserves onSwitchToRegister prop (modal switch intact)', () => {

    it('[prop] LoginModal interface still declares onSwitchToRegister?', () => {
        expect(loginModalSrc).toMatch(/onSwitchToRegister\?:/);
    });

    it('[wired] LoginModal footer button still calls onSwitchToRegister', () => {
        expect(loginModalSrc).toContain('onClick={onSwitchToRegister}');
    });
});

// ===========================================================================
// AC-7 — LoginModal form uses onSubmit (not server action)
// ===========================================================================

describe('AC-7 — LoginModal form uses onSubmit={handleSubmit} (not server action=)', () => {

    it('[onSubmit] LoginModal form has onSubmit handler', () => {
        expect(loginModalSrc).toMatch(/onSubmit=\{handleSubmit\}/);
    });

    it('[no-formAction] LoginModal form does NOT use action={formAction}', () => {
        expect(loginModalSrc).not.toMatch(/action=\{formAction\}/);
    });
});

// ===========================================================================
// AC-8 — app/login/page.tsx: client signIn, not server authenticate
// ===========================================================================

describe('AC-8 — app/login/page.tsx uses client signIn from next-auth/react', () => {

    it('[import] app/login/page.tsx imports signIn from next-auth/react', () => {
        expect(loginPageSrc).toMatch(/import\s+\{[^}]*\bsignIn\b[^}]*\}\s+from\s+['"]next-auth\/react['"]/);
    });

    it('[no-authenticate] app/login/page.tsx does NOT import authenticate from @/lib/actions', () => {
        // Check for the import statement specifically — comments may reference "authenticate" by name
        expect(loginPageSrc).not.toMatch(/import\s+\{[^}]*\bauthenticate\b[^}]*\}/);
    });

    it('[no-useActionState] app/login/page.tsx does NOT use useActionState', () => {
        expect(loginPageSrc).not.toContain('useActionState');
    });

    it('[signIn-call] app/login/page.tsx calls signIn("credentials", …)', () => {
        expect(loginPageSrc).toMatch(/signIn\s*\(\s*["']credentials["']/);
    });

    it('[redirect-false] app/login/page.tsx passes redirect: false to signIn', () => {
        expect(loginPageSrc).toContain('redirect: false');
    });
});

// ===========================================================================
// AC-9 — app/login/page.tsx: open-redirect guard preserved
// ===========================================================================

describe('AC-9 — app/login/page.tsx sanitizeCallbackUrl open-redirect guard', () => {

    it('[guard-fn] app/login/page.tsx defines sanitizeCallbackUrl', () => {
        expect(loginPageSrc).toContain('sanitizeCallbackUrl');
    });

    it('[guard-double-slash] guard rejects "//" prefix', () => {
        expect(loginPageSrc).toContain('startsWith("//")');
    });

    it('[guard-backslash] guard rejects "/\\" prefix (backslash trick)', () => {
        expect(loginPageSrc).toMatch(/startsWith\s*\(\s*["']\/\\\\/);
    });

    it('[guard-control-chars] guard rejects control chars (charCode < 0x20)', () => {
        expect(loginPageSrc).toContain('charCodeAt(0) < 0x20');
    });

    it('[guard-fallback] guard falls back to "/"', () => {
        expect(loginPageSrc).toMatch(/:\s*["']\/["']/);
    });
});

// ===========================================================================
// AC-10 — app/login/page.tsx: router.push(callbackUrl) + router.refresh() on success
// ===========================================================================

describe('AC-10 — app/login/page.tsx success path navigates + refreshes', () => {

    it('[router-push] app/login/page.tsx calls router.push(callbackUrl) on success', () => {
        expect(loginPageSrc).toContain('router.push(callbackUrl)');
    });

    it('[router-refresh] app/login/page.tsx calls router.refresh() on success', () => {
        expect(loginPageSrc).toContain('router.refresh()');
    });
});

// ===========================================================================
// AC-11 — Navbar.tsx: client signOut, not handleSignOut server action
// ===========================================================================

describe('AC-11 — Navbar.tsx uses client signOut from next-auth/react', () => {

    it('[import] Navbar.tsx imports signOut from next-auth/react', () => {
        expect(navbarSrc).toMatch(/import\s+\{[^}]*\bsignOut\b[^}]*\}\s+from\s+['"]next-auth\/react['"]/);
    });

    it('[no-handleSignOut] Navbar.tsx does NOT import handleSignOut from @/lib/actions', () => {
        expect(navbarSrc).not.toContain('handleSignOut');
    });

    it('[callbackUrl] Navbar signOut item calls signOut({ callbackUrl: "/" })', () => {
        expect(navbarSrc).toMatch(/signOut\s*\(\s*\{\s*callbackUrl\s*:\s*["']\/["']/);
    });

    it('[onSelect] Navbar signOut uses onSelect (Radix-correct handler)', () => {
        // onSelect is the correct Radix DropdownMenuItem handler (not onClick which fires on keyboard too eagerly)
        const signOutBlock = navbarSrc.match(/onSelect=\{[^}]*signOut[^}]*\}/);
        expect(signOutBlock).not.toBeNull();
    });
});

// ===========================================================================
// AC-12 — DashboardHeader.tsx: client signOut, not handleSignOut server action
// ===========================================================================

describe('AC-12 — DashboardHeader.tsx uses client signOut from next-auth/react', () => {

    it('[import] DashboardHeader.tsx imports signOut from next-auth/react', () => {
        expect(dashboardHeaderSrc).toMatch(/import\s+\{[^}]*\bsignOut\b[^}]*\}\s+from\s+['"]next-auth\/react['"]/);
    });

    it('[no-handleSignOut] DashboardHeader.tsx does NOT import handleSignOut from @/lib/actions', () => {
        expect(dashboardHeaderSrc).not.toContain('handleSignOut');
    });

    it('[callbackUrl] DashboardHeader signOut calls signOut({ callbackUrl: "/" })', () => {
        expect(dashboardHeaderSrc).toMatch(/signOut\s*\(\s*\{\s*callbackUrl\s*:\s*["']\/["']/);
    });
});

// ===========================================================================
// AC-13 — lib/actions.ts: authenticate and handleSignOut removed
// ===========================================================================

describe('AC-13 — lib/actions.ts no longer exports authenticate or handleSignOut', () => {

    it('[no-authenticate] lib/actions.ts does NOT export authenticate', () => {
        expect(actionsSrc).not.toMatch(/export\s+async\s+function\s+authenticate/);
    });

    it('[no-handleSignOut] lib/actions.ts does NOT export handleSignOut', () => {
        expect(actionsSrc).not.toMatch(/export\s+async\s+function\s+handleSignOut/);
    });

    it('[no-authenticate-def] lib/actions.ts has no authenticate function definition', () => {
        // The word may appear in JSDoc comments (e.g. "used in authenticate()") — check for function definition only
        expect(actionsSrc).not.toMatch(/function\s+authenticate\b/);
    });

    it('[no-handleSignOut-def] lib/actions.ts has no handleSignOut function at all', () => {
        expect(actionsSrc).not.toContain('handleSignOut');
    });
});

// ===========================================================================
// AC-14 — lib/actions.ts: register and googleSignIn still exported
// ===========================================================================

describe('AC-14 — lib/actions.ts still exports register and googleSignIn', () => {

    it('[register] lib/actions.ts still exports register', () => {
        expect(actionsSrc).toMatch(/export\s+async\s+function\s+register/);
    });

    it('[googleSignIn] lib/actions.ts still exports googleSignIn', () => {
        expect(actionsSrc).toMatch(/export\s+async\s+function\s+googleSignIn/);
    });
});

// ===========================================================================
// AC-15 — lib/auth.ts: rate-limit NOT modified (authorize callback intact)
// ===========================================================================

describe('AC-15 — lib/auth.ts authorize callback with rate-limit is NOT modified', () => {

    it('[rate-limit-present] lib/auth.ts still contains rate-limit logic in authorize', () => {
        // The authorize callback is in lib/auth.ts; any rate-limit keyword or comment must still be present
        expect(authSrc).toMatch(/rate[\s-]?limit|rateLimit|RATE_LIMIT|rateLimitStore|checkRateLimit/i);
    });

    it('[authorize-present] lib/auth.ts still defines the authorize callback', () => {
        expect(authSrc).toContain('authorize');
    });
});

// ===========================================================================
// AC-16 — googleSignIn open-redirect guard still in lib/actions.ts
// ===========================================================================

describe('AC-16 — googleSignIn open-redirect guard preserved in lib/actions.ts', () => {

    it('[guard-double-slash] googleSignIn guard rejects "//" prefix', () => {
        expect(actionsSrc).toContain('startsWith("//")');
    });

    it('[guard-backslash] googleSignIn guard rejects "/\\" prefix', () => {
        expect(actionsSrc).toMatch(/startsWith\s*\(\s*["']\/\\\\/);
    });

    it('[guard-control-chars] googleSignIn guard rejects control chars', () => {
        expect(actionsSrc).toContain('charCodeAt(0) < 0x20');
    });

    it('[guard-fallback] googleSignIn falls back to "/"', () => {
        expect(actionsSrc).toContain('isSafeInternalPath ? redirectTo : "/"');
    });
});

// ===========================================================================
// AC-17 — RegisterModal NOT modified by CAM-241
// ===========================================================================

describe('AC-17 — RegisterModal is NOT modified by CAM-241 (no auto-login)', () => {

    it('[no-client-signIn] RegisterModal does NOT import signIn from next-auth/react', () => {
        // RegisterModal should not have added client signIn — it is not part of CAM-241 scope
        // (it uses the register server action and onSuccess switches to LoginModal, per CAM-235)
        const registerModalImportBlock = registerModalSrc.match(
            /import\s+\{[^}]*\}\s+from\s+['"]next-auth\/react['"]/g
        ) ?? [];
        for (const importLine of registerModalImportBlock) {
            // signOut and signIn client functions should not appear in RegisterModal
            expect(importLine).not.toMatch(/\bsignIn\b/);
        }
    });

    it('[register-action] RegisterModal still uses the register server action', () => {
        expect(registerModalSrc).toMatch(/import\s+\{[^}]*register[^}]*\}\s+from\s+['"]@\/lib\/actions['"]/);
    });
});
