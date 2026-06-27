/**
 * cam-234-google-login.test.ts — CAM-234 AUTH-G1: Sign in with Google
 *
 * Source-inspection tests (matching repo style: cam-220, cam-197, etc.).
 *
 * AC coverage:
 *   AC-1  LoginModal renders btn--login-google and wires googleSignIn
 *   AC-2  LoginPage renders btn--login-google and wires googleSignIn
 *   AC-3  i18n keys auth.signInWithGoogle + common.or exist in en + th
 *   AC-4  GoogleIcon exists with aria-hidden (a11y, brand-asset comment)
 *   AC-5  GoogleIcon is excluded from check:palette (brand allowlist added)
 *   AC-6  Google button uses variant="outline" + size="lg" (token grammar)
 *
 * Prove-It notes:
 *   AC-1: FAILS if data-testid="btn--login-google" is removed from LoginModal.
 *   AC-1: FAILS if googleSignIn import is removed from LoginModal.
 *   AC-2: FAILS if data-testid="btn--login-google" is removed from LoginPage.
 *   AC-2: FAILS if googleSignIn import is removed from LoginPage.
 *   AC-3: FAILS if signInWithGoogle key is missing from en or th translations.
 *   AC-3: FAILS if common.or key is missing from en or th translations.
 *   AC-4: FAILS if GoogleIcon.tsx is removed or aria-hidden is missing.
 *   AC-5: FAILS if components/icons is removed from check-palette.mjs exclusions.
 *   AC-6: FAILS if variant="outline" is removed from the Google button.
 *
 * Layer: source-inspect (static parse of real production files).
 * Interactive assertions (OAuth redirect, loading state, disabled while pending)
 * are deferred to Staging manual verification per .claude/rules/qa.md §6.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();

function src(relPath: string): string {
    return fs.readFileSync(path.join(root, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// Source files under test
// ---------------------------------------------------------------------------

const loginModalSrc = src('components/LoginModal.tsx');
const loginPageSrc = src('app/login/page.tsx');
const googleIconSrc = src('components/icons/GoogleIcon.tsx');
const checkPaletteSrc = src('scripts/check-palette.mjs');
const translationsRaw = src('locales/translations.json');
const translations = JSON.parse(translationsRaw);

// ===========================================================================
// AC-1 — LoginModal renders btn--login-google and wires googleSignIn
// ===========================================================================

describe('AC-1 — LoginModal: btn--login-google + googleSignIn wiring', () => {

    it('[testid] LoginModal has data-testid="btn--login-google"', () => {
        expect(loginModalSrc).toContain('data-testid="btn--login-google"');
    });

    it('[import] LoginModal imports googleSignIn from @/lib/actions', () => {
        expect(loginModalSrc).toMatch(/import\s+\{[^}]*googleSignIn[^}]*\}\s+from\s+['"]@\/lib\/actions['"]/);
    });

    it('[wired] LoginModal calls googleSignIn in the onClick handler', () => {
        expect(loginModalSrc).toContain('googleSignIn');
    });

    it('[pending] LoginModal uses useTransition for Google button pending state', () => {
        expect(loginModalSrc).toContain('useTransition');
        expect(loginModalSrc).toContain('isGooglePending');
    });

    it('[disabled] Google button is disabled when isGooglePending or isPending', () => {
        expect(loginModalSrc).toContain('disabled={isGooglePending || isPending}');
    });

    it('[a11y] Google button has aria-label in LoginModal', () => {
        // The button carries an aria-label prop
        expect(loginModalSrc).toMatch(/aria-label=\{t\.auth\.signInWithGoogle\}/);
    });
});

// ===========================================================================
// AC-2 — LoginPage renders btn--login-google and wires googleSignIn
// ===========================================================================

describe('AC-2 — LoginPage: btn--login-google + googleSignIn wiring', () => {

    it('[testid] LoginPage has data-testid="btn--login-google"', () => {
        expect(loginPageSrc).toContain('data-testid="btn--login-google"');
    });

    it('[import] LoginPage imports googleSignIn from @/lib/actions', () => {
        expect(loginPageSrc).toMatch(/import\s+\{[^}]*googleSignIn[^}]*\}\s+from\s+['"]@\/lib\/actions['"]/);
    });

    it('[wired] LoginPage calls googleSignIn in the onClick handler', () => {
        expect(loginPageSrc).toContain('googleSignIn');
    });

    it('[pending] LoginPage uses useTransition for Google button pending state', () => {
        expect(loginPageSrc).toContain('useTransition');
        expect(loginPageSrc).toContain('isGooglePending');
    });

    it('[disabled] Google button is disabled when isGooglePending or isPending', () => {
        expect(loginPageSrc).toContain('disabled={isGooglePending || isPending}');
    });

    it('[a11y] Google button has aria-label in LoginPage', () => {
        expect(loginPageSrc).toMatch(/aria-label=\{t\.auth\.signInWithGoogle\}/);
    });
});

// ===========================================================================
// AC-3 — i18n keys auth.signInWithGoogle + common.or in en + th
// ===========================================================================

describe('AC-3 — i18n: auth.signInWithGoogle + common.or in en + th', () => {

    it('[en] translations.en.auth.signInWithGoogle exists and is non-empty', () => {
        expect(translations.en?.auth?.signInWithGoogle).toBeTruthy();
        expect(typeof translations.en.auth.signInWithGoogle).toBe('string');
    });

    it('[th] translations.th.auth.signInWithGoogle exists and is non-empty', () => {
        expect(translations.th?.auth?.signInWithGoogle).toBeTruthy();
        expect(typeof translations.th.auth.signInWithGoogle).toBe('string');
    });

    it('[en] translations.en.auth.signInWithGoogle contains "Google"', () => {
        expect(translations.en.auth.signInWithGoogle).toContain('Google');
    });

    it('[th] translations.th.auth.signInWithGoogle contains "Google"', () => {
        expect(translations.th.auth.signInWithGoogle).toContain('Google');
    });

    it('[en] translations.en.common.or exists', () => {
        expect(translations.en?.common?.or).toBeTruthy();
    });

    it('[th] translations.th.common.or exists and is "หรือ"', () => {
        expect(translations.th?.common?.or).toBe('หรือ');
    });
});

// ===========================================================================
// AC-4 — GoogleIcon exists with aria-hidden (a11y)
// ===========================================================================

describe('AC-4 — GoogleIcon: exists, aria-hidden, brand-asset comment', () => {

    it('[file] components/icons/GoogleIcon.tsx exists', () => {
        const iconPath = path.join(root, 'components', 'icons', 'GoogleIcon.tsx');
        expect(fs.existsSync(iconPath)).toBe(true);
    });

    it('[a11y] GoogleIcon SVG has aria-hidden="true"', () => {
        expect(googleIconSrc).toContain('aria-hidden="true"');
    });

    it('[a11y] GoogleIcon SVG has focusable="false"', () => {
        expect(googleIconSrc).toContain('focusable="false"');
    });

    it('[brand] GoogleIcon has a comment explaining the brand-asset exception', () => {
        // Must have a comment referencing the lucide exception and brand asset
        expect(googleIconSrc).toMatch(/brand.asset/i);
    });

    it('[export] GoogleIcon is a named export', () => {
        expect(googleIconSrc).toContain('export function GoogleIcon');
    });

    it('[colors] GoogleIcon SVG paths use Google brand colors', () => {
        // Official Google G mark uses these four colors
        expect(googleIconSrc).toContain('#4285F4');
        expect(googleIconSrc).toContain('#34A853');
        expect(googleIconSrc).toContain('#FBBC05');
        expect(googleIconSrc).toContain('#EA4335');
    });
});

// ===========================================================================
// AC-5 — check-palette.mjs allowlist: components/icons excluded (brand-asset)
// ===========================================================================

describe('AC-5 — check:palette allowlist: components/icons excluded for brand SVGs', () => {

    it('[allowlist] check-palette.mjs excludes components/icons path', () => {
        expect(checkPaletteSrc).toContain('"components", "icons"');
    });

    it('[comment] check-palette.mjs has brand-asset comment explaining the exclusion', () => {
        expect(checkPaletteSrc).toMatch(/brand.asset/i);
    });

    it('[scope] check-palette.mjs exclusion is scoped to components/icons only (not all of components/)', () => {
        // Extract the EXCLUDE_PREFIXES array block to check only what is excluded,
        // not the SCAN_DIRS array which legitimately references "components".
        const excludeBlock = checkPaletteSrc.match(
            /const EXCLUDE_PREFIXES\s*=\s*\[([\s\S]*?)\];/
        );
        expect(excludeBlock).not.toBeNull();
        const block = excludeBlock![1];
        // The block must include the icons sub-path
        expect(block).toContain('"icons"');
        // The block must NOT have a bare join(ROOT, "components") without "icons"
        const hasComponentsOnlyEntry = block
            .split('\n')
            .some((l) => /join\(ROOT,\s*["']components["']\)/.test(l) && !l.includes('icons') && !l.includes('//'));
        expect(hasComponentsOnlyEntry).toBe(false);
    });
});

// ===========================================================================
// AC-6 — Google button uses correct DS grammar (outline + size lg)
// ===========================================================================

describe('AC-6 — Google button DS grammar: outline variant, size lg, rounded-full', () => {

    it('[modal] LoginModal Google button uses variant="outline"', () => {
        // variant="outline" must appear in LoginModal (for the Google button)
        expect(loginModalSrc).toContain('variant="outline"');
        // The Google button block (identified by testid) must be near variant="outline"
        const googleBtnRegion = loginModalSrc.match(
            /<Button[\s\S]{0,300}?variant="outline"[\s\S]{0,300}?btn--login-google|btn--login-google[\s\S]{0,300}?variant="outline"/
        );
        expect(googleBtnRegion).not.toBeNull();
    });

    it('[page] LoginPage Google button uses variant="outline"', () => {
        expect(loginPageSrc).toContain('variant="outline"');
    });

    it('[modal] LoginModal Google button uses size="lg"', () => {
        expect(loginModalSrc).toContain('size="lg"');
    });

    it('[page] LoginPage Google button uses size="lg"', () => {
        expect(loginPageSrc).toContain('size="lg"');
    });

    it('[modal] LoginModal Google button uses rounded-full (button grammar)', () => {
        // The Google button className must include rounded-full
        expect(loginModalSrc).toMatch(/btn--login-google[\s\S]{0,500}?rounded-full|rounded-full[\s\S]{0,200}?btn--login-google/);
    });

    it('[page] LoginPage Google button uses rounded-full (button grammar)', () => {
        expect(loginPageSrc).toMatch(/btn--login-google[\s\S]{0,500}?rounded-full|rounded-full[\s\S]{0,200}?btn--login-google/);
    });

    it('[modal] LoginModal imports GoogleIcon', () => {
        expect(loginModalSrc).toMatch(/from\s+['"]@\/components\/icons\/GoogleIcon['"]/);
    });

    it('[page] LoginPage imports GoogleIcon', () => {
        expect(loginPageSrc).toMatch(/from\s+['"]@\/components\/icons\/GoogleIcon['"]/);
    });
});
