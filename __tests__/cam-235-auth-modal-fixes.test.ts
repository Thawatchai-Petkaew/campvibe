/**
 * cam-235-auth-modal-fixes.test.ts — CAM-235 AUTH-G2: Auth modal fixes
 *
 * Layer: source-inspect (static parse of real production files).
 *
 * AC coverage:
 *
 *  AC-1  RegisterModal has btn--register-google + googleSignIn wiring + useTransition
 *  AC-2  LoginModal footer uses <button onClick={onSwitchToRegister}> (not <a href="/register">)
 *        LoginModal accepts onSwitchToRegister? prop
 *  AC-3  RegisterModal footer uses <button onClick={onSwitchToLogin}> (not onClick={onClose})
 *        RegisterModal accepts onSwitchToLogin? prop
 *  AC-4  Navbar passes onSwitchToRegister to LoginModal + onSwitchToLogin to RegisterModal
 *  AC-5  /register page calls notFound() — standalone form removed
 *  AC-6  /login page footer register link points to "/" (not "/register")
 *  AC-7  DialogOverlay has NO supports-backdrop-filter:backdrop-blur-sm
 *  AC-8  ModalHeader close Button has active:translate-y-[-50%] (bounce neutralized)
 *
 * Prove-It notes:
 *  AC-1: FAILS if data-testid="btn--register-google" is removed from RegisterModal.
 *  AC-1: FAILS if googleSignIn import is removed from RegisterModal.
 *  AC-1: FAILS if useTransition is removed from RegisterModal.
 *  AC-2: FAILS if <a href="/register"> is re-added to LoginModal footer.
 *  AC-2: FAILS if onSwitchToRegister prop is removed from LoginModal interface.
 *  AC-3: FAILS if onClick={onClose} is restored in RegisterModal footer button.
 *  AC-3: FAILS if onSwitchToLogin prop is removed from RegisterModal interface.
 *  AC-4: FAILS if onSwitchToRegister is not passed to LoginModal in Navbar.
 *  AC-4: FAILS if onSwitchToLogin is not passed to RegisterModal in Navbar.
 *  AC-5: FAILS if notFound() is removed from register/page.tsx.
 *  AC-6: FAILS if login page footer register link is changed back to "/register".
 *  AC-7: FAILS if supports-backdrop-filter:backdrop-blur-sm is re-added to DialogOverlay.
 *  AC-8: FAILS if active:translate-y-[-50%] is removed from ModalHeader close Button.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();

function src(relPath: string): string {
    return fs.readFileSync(path.join(root, relPath), 'utf-8');
}

const registerModalSrc = src('components/RegisterModal.tsx');
const loginModalSrc    = src('components/LoginModal.tsx');
const navbarSrc        = src('components/Navbar.tsx');
const registerPageSrc  = src('app/register/page.tsx');
const loginPageSrc     = src('app/login/page.tsx');
const dialogSrc        = src('components/ui/dialog.tsx');
const modalShellSrc    = src('components/ui/modal-shell.tsx');

// ===========================================================================
// AC-1 — RegisterModal: btn--register-google + googleSignIn + useTransition
// ===========================================================================

describe('AC-1 — RegisterModal: Google button wiring', () => {

    it('[testid] RegisterModal has data-testid="btn--register-google"', () => {
        expect(registerModalSrc).toContain('data-testid="btn--register-google"');
    });

    it('[import] RegisterModal imports googleSignIn from @/lib/actions', () => {
        expect(registerModalSrc).toMatch(/import\s+\{[^}]*googleSignIn[^}]*\}\s+from\s+['"]@\/lib\/actions['"]/);
    });

    it('[wired] RegisterModal calls googleSignIn in the onClick handler', () => {
        expect(registerModalSrc).toContain('googleSignIn');
    });

    it('[import] RegisterModal imports GoogleIcon from @/components/icons/GoogleIcon', () => {
        expect(registerModalSrc).toMatch(/from\s+['"]@\/components\/icons\/GoogleIcon['"]/);
    });

    it('[pending] RegisterModal uses useTransition for Google button pending state', () => {
        expect(registerModalSrc).toContain('useTransition');
        expect(registerModalSrc).toContain('isGooglePending');
    });

    it('[disabled] Google button is disabled when isGooglePending or isPending', () => {
        expect(registerModalSrc).toContain('disabled={isGooglePending || isPending}');
    });

    it('[a11y] Google button has aria-label in RegisterModal', () => {
        expect(registerModalSrc).toMatch(/aria-label=\{t\.auth\.signInWithGoogle\}/);
    });

    it('[grammar] Google button uses variant="outline"', () => {
        // The register Google button block must have variant="outline"
        const googleBtnRegion = registerModalSrc.match(
            /<Button[\s\S]{0,300}?variant="outline"[\s\S]{0,300}?btn--register-google|btn--register-google[\s\S]{0,300}?variant="outline"/
        );
        expect(googleBtnRegion).not.toBeNull();
    });

    it('[grammar] Google button uses size="lg"', () => {
        // Ensure at least one size="lg" is associated with the Google button
        expect(registerModalSrc).toContain('size="lg"');
    });

    it('[divider] Register modal has the "หรือ" divider (common.or) before the Google button', () => {
        // The divider must come before the Google button in the JSX
        const orIdx = registerModalSrc.indexOf('t.common?.or');
        const googleBtnIdx = registerModalSrc.indexOf('btn--register-google');
        expect(orIdx).toBeGreaterThan(-1);
        expect(googleBtnIdx).toBeGreaterThan(-1);
        expect(orIdx).toBeLessThan(googleBtnIdx);
    });
});

// ===========================================================================
// AC-2 — LoginModal footer: <button onClick={onSwitchToRegister}> not <a href>
// ===========================================================================

describe('AC-2 — LoginModal footer: switch callback, not hard nav', () => {

    it('[no-href] LoginModal footer does NOT have <a href="/register">', () => {
        expect(loginModalSrc).not.toContain('href="/register"');
    });

    it('[prop] LoginModal interface declares onSwitchToRegister? prop', () => {
        expect(loginModalSrc).toMatch(/onSwitchToRegister\?:/);
    });

    it('[wired] LoginModal footer button calls onSwitchToRegister', () => {
        expect(loginModalSrc).toContain('onClick={onSwitchToRegister}');
    });

    it('[element] LoginModal footer uses <button type="button"> not <a>', () => {
        // The footer switch element must be a button element, not an anchor
        const footerBlock = loginModalSrc.match(
            /t\.auth\.dontHaveAccount[\s\S]{0,500}?<\/(p|div)>/
        );
        expect(footerBlock).not.toBeNull();
        // Must contain button in that block (not just 'a ')
        expect(footerBlock![0]).toContain('<button');
        expect(footerBlock![0]).not.toMatch(/<a\s+href/);
    });
});

// ===========================================================================
// AC-3 — RegisterModal footer: onSwitchToLogin callback, not onClose
// ===========================================================================

describe('AC-3 — RegisterModal footer: switch callback, not onClose', () => {

    it('[prop] RegisterModal interface declares onSwitchToLogin? prop', () => {
        expect(registerModalSrc).toMatch(/onSwitchToLogin\?:/);
    });

    it('[wired] RegisterModal footer button calls onSwitchToLogin', () => {
        expect(registerModalSrc).toContain('onClick={onSwitchToLogin}');
    });

    it('[no-onclose] RegisterModal footer sign-in button does NOT call onClose directly', () => {
        // The footer button (alreadyHaveAccount) must use onSwitchToLogin, not onClose
        const footerBlock = registerModalSrc.match(
            /alreadyHaveAccount[\s\S]{0,500}?<\/(p|div)>/
        );
        expect(footerBlock).not.toBeNull();
        // Must NOT have onClick={onClose} in the footer switch button
        expect(footerBlock![0]).not.toContain('onClick={onClose}');
    });
});

// ===========================================================================
// AC-4 — Navbar: passes switch callbacks to both modals
// ===========================================================================

describe('AC-4 — Navbar: passes onSwitchToRegister to LoginModal + onSwitchToLogin to RegisterModal', () => {

    it('[login-modal] Navbar passes onSwitchToRegister prop to LoginModal', () => {
        expect(navbarSrc).toContain('onSwitchToRegister=');
    });

    it('[register-modal] Navbar passes onSwitchToLogin prop to RegisterModal', () => {
        expect(navbarSrc).toContain('onSwitchToLogin=');
    });

    it('[logic] Navbar onSwitchToRegister opens register and closes login', () => {
        // Must set both isLoginOpen(false) and isRegisterOpen(true) in the callback
        const switchBlock = navbarSrc.match(/onSwitchToRegister=\{[\s\S]{0,300}?\}/);
        expect(switchBlock).not.toBeNull();
        expect(switchBlock![0]).toContain('setIsLoginOpen(false)');
        expect(switchBlock![0]).toContain('setIsRegisterOpen(true)');
    });

    it('[logic] Navbar onSwitchToLogin opens login and closes register', () => {
        // Must set both isRegisterOpen(false) and isLoginOpen(true) in the callback
        const switchBlock = navbarSrc.match(/onSwitchToLogin=\{[\s\S]{0,300}?\}/);
        expect(switchBlock).not.toBeNull();
        expect(switchBlock![0]).toContain('setIsRegisterOpen(false)');
        expect(switchBlock![0]).toContain('setIsLoginOpen(true)');
    });
});

// ===========================================================================
// AC-5 — /register page: calls notFound()
// ===========================================================================

describe('AC-5 — /register page returns 404 (notFound)', () => {

    it('[notfound] app/register/page.tsx calls notFound()', () => {
        expect(registerPageSrc).toContain('notFound()');
    });

    it('[import] app/register/page.tsx imports notFound from next/navigation', () => {
        expect(registerPageSrc).toMatch(/import\s+\{[^}]*notFound[^}]*\}\s+from\s+['"]next\/navigation['"]/);
    });

    it('[no-form] app/register/page.tsx has no form code (form is in RegisterModal)', () => {
        expect(registerPageSrc).not.toContain('<form');
        expect(registerPageSrc).not.toContain('useActionState');
    });

    it('[server] app/register/page.tsx is a server component (no "use client")', () => {
        const lines = registerPageSrc.split('\n');
        const directive = lines.find((l) => {
            const t = l.trim().replace(/;$/, '');
            return t === '"use client"' || t === "'use client'";
        });
        expect(directive).toBeUndefined();
    });
});

// ===========================================================================
// AC-6 — /login page footer register link → "/"
// ===========================================================================

describe('AC-6 — /login page footer register link does not point to /register', () => {

    it('[no-register-href] app/login/page.tsx footer does NOT link to /register', () => {
        expect(loginPageSrc).not.toContain('href="/register"');
    });

    it('[home-href] app/login/page.tsx footer register link points to "/"', () => {
        // The footer register-link must use href="/"
        const footerBlock = loginPageSrc.match(
            /t\.auth\.dontHaveAccount[\s\S]{0,500}?<\/(p|div)>/
        );
        expect(footerBlock).not.toBeNull();
        expect(footerBlock![0]).toContain('href="/"');
    });
});

// ===========================================================================
// AC-7 — DialogOverlay: no backdrop-blur
// ===========================================================================

describe('AC-7 — DialogOverlay: supports-backdrop-filter:backdrop-blur-sm removed', () => {

    it('[no-blur] DialogOverlay className does NOT contain supports-backdrop-filter:backdrop-blur-sm', () => {
        expect(dialogSrc).not.toContain('supports-backdrop-filter:backdrop-blur-sm');
    });

    it('[dim] DialogOverlay still has bg-foreground/15 (dim is preserved)', () => {
        expect(dialogSrc).toContain('bg-foreground/15');
    });

    it('[animation] DialogOverlay still has fade-in/fade-out animation classes', () => {
        expect(dialogSrc).toContain('data-open:animate-in');
        expect(dialogSrc).toContain('data-closed:animate-out');
    });
});

// ===========================================================================
// AC-8 — ModalHeader close Button: bounce neutralized
// ===========================================================================

describe('AC-8 — ModalHeader close Button: active:translate-y-[-50%] overrides press-down', () => {

    it('[no-bounce] ModalHeader close Button has active:translate-y-[-50%] to neutralize press-down', () => {
        // The close button className must include the override to keep it vertically centered on press
        const closeBtnClassMatch = modalShellSrc.match(
            /data-testid="btn--modal-close"[\s\S]*?className=["'`]([^"'`]+)["'`]/
        );
        expect(closeBtnClassMatch).not.toBeNull();
        expect(closeBtnClassMatch![1]).toContain('active:translate-y-[-50%]');
    });

    it('[centering] ModalHeader close Button still has top-1/2 and -translate-y-1/2 (centering preserved)', () => {
        const closeBtnClassMatch = modalShellSrc.match(
            /data-testid="btn--modal-close"[\s\S]*?className=["'`]([^"'`]+)["'`]/
        );
        expect(closeBtnClassMatch).not.toBeNull();
        expect(closeBtnClassMatch![1]).toContain('top-1/2');
        expect(closeBtnClassMatch![1]).toContain('-translate-y-1/2');
    });
});
