/**
 * cam-239-avatar-session-refresh.test.ts — CAM-239 MEDIA-1 Fix A
 *
 * Layer: source-inspect (static parse of real production file).
 *
 * Why source-inspect and not DOM/hook mocks:
 *   vitest.config.ts sets environment: 'node' (no jsdom) and this project's
 *   established precedent for client components that depend on Next.js runtime
 *   (next-auth/react, useRouter) is static source analysis — see cam-235, cam-197,
 *   cam-197-loading-skeletons, f5-account-misc, etc.  Rendering the component in
 *   a Node environment would require mocking next-auth/react, useRouter,
 *   useLanguage, fetch, and toast — mocking the very layer under test per
 *   .claude/rules/qa.md §6.
 *
 * AC covered:
 *   Fix A — After a successful PATCH to /api/user/profile:
 *     1. useSession is imported from next-auth/react and `update` is destructured
 *        from the hook (so the JWT gets refreshed via trigger==="update").
 *     2. `await update()` is called inside saveProfile on the success path.
 *     3. `router.refresh()` is called inside saveProfile immediately after update().
 *     4. Neither update() nor router.refresh() is called inside the catch block
 *        (must NOT fire on a failed PATCH).
 *     5. update() and router.refresh() are NOT placed in a useEffect (would loop).
 *     6. No changes to Navbar, upload route, proxy, or next.config (Fix B+C scope).
 *
 * Prove-It notes — each assertion names the exact change that would turn it red:
 *   [import-usesession]  FAILS if `useSession` is removed from next-auth/react import.
 *   [destructure-update] FAILS if `update` is not destructured from useSession().
 *   [await-update]       FAILS if `await update()` is removed from saveProfile.
 *   [router-refresh]     FAILS if `router.refresh()` is removed from saveProfile.
 *   [order]              FAILS if router.refresh() appears before await update() in the file.
 *   [no-catch-update]    FAILS if `update()` is mistakenly added inside the catch block.
 *   [no-catch-refresh]   FAILS if `router.refresh()` is mistakenly added inside the catch.
 *   [no-effect-update]   FAILS if update() is placed inside a useEffect.
 *   [navbar-untouched]   FAILS if Fix B/C scope bleeds into Navbar.tsx in this story.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
function src(relPath: string): string {
    return fs.readFileSync(path.join(root, relPath), 'utf-8');
}

const profileSrc = src('app/profile/page.tsx');
// Split the source into the try-block region and the catch-block region so we
// can assert that update/refresh appear in success path only.
// The structure is:   try { ... setProfile(data); await update(); router.refresh(); ... }
//                     catch (error: any) { setServerError... }
//                     finally { setIsSaving(false); }
// We locate the catch block start to split success-path from error-path.
const tryCatchSplit   = profileSrc.indexOf('} catch (error: any) {');
const successRegion   = tryCatchSplit !== -1 ? profileSrc.slice(0, tryCatchSplit) : profileSrc;
const catchRegion     = tryCatchSplit !== -1 ? profileSrc.slice(tryCatchSplit)   : '';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Import: useSession from next-auth/react
// ─────────────────────────────────────────────────────────────────────────────
describe('[import-usesession] useSession imported from next-auth/react', () => {
    it('imports useSession from next-auth/react', () => {
        // Matches: import { useSession } from 'next-auth/react'
        // or:      import { ..., useSession, ... } from 'next-auth/react'
        expect(profileSrc).toMatch(
            /import\s+\{[^}]*useSession[^}]*\}\s+from\s+['"]next-auth\/react['"]/,
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Hook destructure: { update } = useSession()
// ─────────────────────────────────────────────────────────────────────────────
describe('[destructure-update] update destructured from useSession()', () => {
    it('destructures `update` from useSession()', () => {
        // Matches: const { update } = useSession();
        // or:      const { update, ... } = useSession();
        expect(profileSrc).toMatch(/const\s+\{[^}]*update[^}]*\}\s*=\s*useSession\(\)/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Success path: await update() present
// ─────────────────────────────────────────────────────────────────────────────
describe('[await-update] await update() called on success path', () => {
    it('saveProfile calls await update() after setProfile(data)', () => {
        expect(successRegion).toContain('await update()');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Success path: router.refresh() present
// ─────────────────────────────────────────────────────────────────────────────
describe('[router-refresh] router.refresh() called on success path', () => {
    it('saveProfile calls router.refresh() after await update()', () => {
        expect(successRegion).toContain('router.refresh()');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Order: update() appears before router.refresh() in the file
// ─────────────────────────────────────────────────────────────────────────────
describe('[order] await update() precedes router.refresh()', () => {
    it('await update() appears before router.refresh() in saveProfile', () => {
        const updateIdx  = profileSrc.indexOf('await update()');
        const refreshIdx = profileSrc.indexOf('router.refresh()');
        expect(updateIdx).toBeGreaterThan(-1);
        expect(refreshIdx).toBeGreaterThan(-1);
        expect(updateIdx).toBeLessThan(refreshIdx);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Error path: update() NOT in catch block
// ─────────────────────────────────────────────────────────────────────────────
describe('[no-catch-update] update() must NOT fire on failed PATCH', () => {
    it('update() is absent from the catch block', () => {
        expect(catchRegion).not.toContain('update()');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Error path: router.refresh() NOT in catch block
// ─────────────────────────────────────────────────────────────────────────────
describe('[no-catch-refresh] router.refresh() must NOT fire on failed PATCH', () => {
    it('router.refresh() is absent from the catch block', () => {
        expect(catchRegion).not.toContain('router.refresh()');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. No useEffect wrapping update() — would cause a loop
// ─────────────────────────────────────────────────────────────────────────────
describe('[no-effect-update] update() must not be inside a useEffect', () => {
    it('update() does not appear inside a useEffect body', () => {
        // Find all useEffect blocks in the source and assert update() is absent from them.
        // Strategy: find useEffect( positions; scan the following ~200 chars for update().
        let searchFrom = 0;
        while (true) {
            const effectIdx = profileSrc.indexOf('useEffect(', searchFrom);
            if (effectIdx === -1) break;
            // Extract ~250 chars after useEffect( to cover the callback body opener
            const snippet = profileSrc.slice(effectIdx, effectIdx + 250);
            expect(snippet).not.toContain('update()');
            searchFrom = effectIdx + 1;
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Scope guard: Navbar still receives avatar via currentUser prop (Fix A does
//    not convert it to pull image from useSession — that is Fix B+C backend scope)
// ─────────────────────────────────────────────────────────────────────────────
describe('[navbar-untouched] Navbar still uses server-passed currentUser for avatar', () => {
    it('Navbar.tsx still accepts and renders currentUser prop', () => {
        const navbarSrc = src('components/Navbar.tsx');
        // currentUser prop must still exist — Fix A must not remove it
        expect(navbarSrc).toContain('currentUser');
    });

    it('Navbar.tsx avatar <img> src still comes from currentUser.image (server prop)', () => {
        const navbarSrc = src('components/Navbar.tsx');
        // The avatar img src must still be driven by the server-passed currentUser prop
        expect(navbarSrc).toContain('src={currentUser.image}');
        // Fix A must not replace it with a session hook reference for image
        expect(navbarSrc).not.toContain('session?.user?.image');
    });
});
