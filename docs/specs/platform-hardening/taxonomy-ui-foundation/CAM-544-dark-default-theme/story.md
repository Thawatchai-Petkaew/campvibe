## Story
As a **Camper** visiting CampVibe for the first time, I want the site to open in dark theme by default,
so that my first impression matches a campfire platform's brand identity instead of a generic bright
screen that could belong to any booking site.
Why: owner decision (2026-07-26, verbatim): "ปรับ Default theme เป็น Dark theme เพราะเราคือ platform
เกี่ยวข้องกับแคมป์ไฟ" — CampVibe is a campfire platform, so dark is what a first-time visitor should see,
regardless of their device's own light/dark setting.

Scope: the `defaultTheme` prop on `components/Providers.tsx`'s `<ThemeProvider>` + proving the three
guarantees that make that one-line change safe (sticky user choice still wins, no flash-of-wrong-theme
before hydration, the CSP-nonce/dynamic-render chain that lets the init script run at all). No token
VALUES change (`app/globals.css` is out of scope, owned by CAM-537), no new component, no copy change.
Depends on: CAM-105 (F0 Theme Infra — introduced `<ThemeProvider>`/`<ThemeToggle>` with the 3-way
light/system/dark choice) · CAM-218 (force-dynamic fix for the nonce-CSP trap) · CAM-195 CACHE-1
(root layout now calls `auth()` unconditionally, which independently forces every route dynamic).

## AC
<!-- No AC row carries new Thai copy: this story changes a resolution DEFAULT, not any string. Every
     copy on these surfaces (ThemeToggle labels) is unchanged and still served from `locales/`. The
     "user sees" column describes the visual result, which is what this default governs. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | First-time visitor: no `campvibe_theme` value in local storage, device set to EITHER light or dark | Visitor opens any page | The page renders in dark theme (dark surfaces, light text) from first paint, regardless of the device's own color-scheme setting | `next-themes` resolves `theme = "dark"` on load; `<html class="dark">` is present before hydration | EC-1 |
| AC-2 | Returning visitor who previously chose light via the theme toggle | Visitor opens any page again | The page renders in light theme, exactly as they left it | `next-themes` reads the stored `campvibe_theme="light"` value; the dark default is not applied — the stored choice always wins | EC-2 |
| AC-3 | Any visitor, first load or a returning navigation | The HTML document streams from the server, before React hydrates | No flash of the wrong theme is visible — the page never shows light-then-dark or dark-then-light | The next-themes blocking init script runs inline before paint and sets the class synchronously (no client round-trip) | EC-1 |
| AC-4 | Returning visitor who previously chose "System" via the toggle, device set to light | Visitor opens any page | The page renders in light theme, following the device setting ("System" still means "follow the device", it is not overridden to dark) | `next-themes` resolves `theme = "system"` → `resolvedTheme` follows `prefers-color-scheme` | AC-2 |

## Rules
- BR-1 `defaultTheme="dark"` (an explicit value, not `"system"`) is the ONLY value a first-time visitor's device setting can never override — this is what satisfies the owner's intent literally. `enableSystem` stays `true` so the existing 3-way toggle (light/system/dark, CAM-105) keeps offering "System" as a real, working user choice once they touch it.
- BR-2 Resolution order (unchanged library behavior, restated so a future editor doesn't "fix" it away): stored `campvibe_theme` value, if any, always wins over `defaultTheme`; only when nothing is stored does `defaultTheme` apply; `defaultTheme` is consulted only as the no-preference-yet fallback, never as an override of a real choice.
- BR-3 The init script that sets the class on `<html>` must run inline, before hydration, on every route — this requires the route to be server-rendered per-request (dynamic), not statically prerendered at build time (CAM-218: a static build bakes no request-time nonce, so the CSP blocks every inline/external script and next-themes silently never runs). The root layout's unconditional `auth()` call (CAM-195 CACHE-1) already forces this for every route under it; `app/not-found.tsx` carries its own explicit `export const dynamic = "force-dynamic"` for the same reason.

## Edge cases
- EC-1 IF a route is (or becomes) statically prerendered under the nonce CSP THEN the init script and all hydration scripts are blocked and the page silently stays unstyled/light with no console error (BR-3) — guarded today by root-layout `auth()` + `not-found.tsx`'s explicit `force-dynamic`; re-verified live on `/` for this story (see `design.md`).
- EC-2 IF local storage is unavailable or throws (e.g. a blocked/private-mode edge case) THEN resolution falls back to `defaultTheme = "dark"`, the same outcome as a genuine first-time visitor (BR-2).
- EC-3 IF a future edit removes `enableSystem` or changes `defaultTheme` away from `"dark"` THEN `__tests__/cam-544-dark-default-theme.test.ts`'s pinning assertions fail, catching the silent regression before merge.

## Data
- No entity, field, or schema is touched. One JSX prop value changes. · migration: none

## Seams & refs
- Reuse: `components/Providers.tsx`'s single `<ThemeProvider>` wiring (CAM-105) is the only place theme defaults are set — no parallel theme-resolution logic exists or is added.
- Refs: CAM-105 (`__tests__/theme-toggle.test.ts`, 3-way ThemeToggle) · CAM-218 (`__tests__/cam-218-err-1-error-state.test.ts`, the force-dynamic/nonce fix precedent) · CAM-195 CACHE-1 (`app/page.tsx` comment, `auth()` at root layout) · `DESIGN.md` §1 (brand POV, where the default is now recorded).

## Out of scope
- Any change to dark/light token VALUES in `app/globals.css` — owned and already shipped by CAM-537 (contrast floor); this story only changes which theme resolves by default, never a color value.
- Time-of-day or geo-based automatic theme switching — not requested; would be a new capability, its own ticket if ever raised.
- Threading an explicit `nonce` prop through `<ThemeProvider>` — not needed: the root layout's `auth()` call already forces per-request dynamic rendering app-wide, which is what makes the CSP nonce chain work (verified live for this story, not assumed).

## Self-verify
- AC-1, AC-2, AC-4 → unit (`__tests__/cam-544-dark-default-theme.test.ts`): server-renders the real `<Providers>` tree with `react-dom/server`, extracts the actual next-themes init script it emits, and EXECUTES that real script against constructed fake `document`/`localStorage`/`window.matchMedia` objects for (a) no stored value, (b) stored `"light"`, (c) stored `"system"` + device light — asserting the real resolved class, not a string match on the prop.
- AC-3 → unit (the same harness proves the script exists in the SSR output and is what actually decides the class, i.e. no client round-trip is needed) + owner-verify (browser-only: a visual cold-load check for flash has no headless equivalent, per `.claude/rules/qa.md`).
- EC-1 → live-verified on `npm run dev` for this story: curl `/` and `/does-not-exist`, confirm the response is per-request (not a cached static shell) and the CSP header's nonce matches the `nonce` attribute Next.js stamps on the page's script tags.
- Story-specific: `enableSystem` pinned by an explicit assertion so a future edit cannot silently flip it back (EC-3).
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
