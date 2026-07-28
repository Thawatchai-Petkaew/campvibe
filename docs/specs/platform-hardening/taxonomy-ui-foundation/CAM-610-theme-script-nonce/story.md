## Story
As a **Camper** loading any page of CampVibe, I want the theme's anti-flash script to actually run before
first paint, so that a cold load never shows a pale, wrong-theme frame before the platform's real (dark by
default, CAM-544) look lands.
Why: found by CAM-607 while fixing an unrelated CSP gap, and reported rather than fixed there because
`components/Providers.tsx` was outside that story's file surface. Pre-existing since CAM-203 enforced the
CSP: `next-themes`'s FOUC-prevention script has never carried a `nonce`, so our own CSP has silently
blocked it on every page load, app-wide, the whole time. CAM-544 stated in its own Out-of-scope section
that threading a nonce through `<ThemeProvider>` was unnecessary because the root layout's `auth()` call
already forces dynamic rendering app-wide — true for the *rendering mode*, but irrelevant to *this* script:
it is emitted via React JSX (`dangerouslySetInnerHTML`), never through Next.js's own request-header-driven
auto-nonce-stamping pipeline (CAM-607's mechanism), so dynamic rendering alone was never enough to give it
a nonce. `next-themes` supports a `nonce` prop specifically for this; it was simply never wired.
Scope: give the next-themes script the nonce that CAM-607 now makes available on the request headers, via
`<ThemeProvider nonce={...}>`. No CSP directive changes. No new screen/flow/token. Also: sweep the app for
any other un-nonced inline script (this is the third member of the same defect family in one day per
CAM-218/CAM-607) and report findings, fixing only what is inside this story's own file surface.
Depends on: CAM-607 (makes the nonce reach the request; read here from `headers()`) · CAM-218 (same defect
family: a nonce that silently fails to reach where it's needed, no thrown error) · CAM-544 (dark-by-default
makes this flash visible as a first-impression defect, not just a technicality) · CAM-105 (introduced
`<ThemeProvider>`).

## AC
<!-- Shared root-layout wiring with no end-user-visible copy of its own (a blocked FOUC script is a defect,
     not a feature) — the "Then" column is what a developer/QA/CI observes on a real production build,
     matching the CAM-607 precedent for this kind of hardening ticket. -->
| # | Given | When | Then (developer/CI observes) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Any route is requested (root layout always calls `auth()`, forcing dynamic rendering app-wide) | The server renders `app/layout.tsx` | The per-request nonce (already on the request headers via CAM-607) is read via `headers().get('x-nonce')` and passed as `<Providers nonce={nonce}>` → `<ThemeProvider nonce={nonce}>` | `next-themes`'s inline FOUC-prevention script is emitted with `nonce="{n}"` instead of bare | EC-1 |
| AC-2 | A real production build (`next build && next start`), cold load, dark theme resolved (no stored preference, CAM-544 default) | The HTML document streams and the browser parses it | No CSP violation is reported for the next-themes script in the console, and no flash of the wrong (light) theme is visible before the dark theme lands | The nonce on the served `<script>` tag matches the CSP header's `'nonce-{n}'` token — the exact agreement check CAM-218 needed and did not have | EC-2 |
| AC-3 | The same production build, any route | Theme switching via the existing 3-way toggle (CAM-105) | Switching still works, and the choice still persists across a reload (unchanged behavior) | `next-themes`'s runtime read/write of `campvibe_theme` in local storage is unaffected by the nonce prop | EC-3 |
| AC-4 | The codebase as a whole | A grep for inline `<script>`/`dangerouslySetInnerHTML` script emission and known script-injecting libraries is run | Every other inline script found is either already nonced by Next's own pipeline, not a `<script>` element at all (e.g. `<style>` blocks, JSON-LD-free), or explicitly listed as a follow-up if found un-nonced | Findings recorded in `tech.md` whether or not fixed here | — |

## Rules
- BR-1 `app/layout.tsx` reads the nonce via `headers().get('x-nonce')` (the same convention CAM-607's own comment documents for "OUR OWN Server Component code") and passes it to `<Providers nonce={nonce}>`; `components/Providers.tsx` forwards it unchanged to `<ThemeProvider nonce={nonce}>`. (proves AC-1)
- BR-2 No CSP directive's content changes anywhere in this diff — `proxy.ts` is not touched at all (out of bounds, already fixed by CAM-607). This story only threads an already-available value one layer deeper. (proves no loosening, matches AC-2)
- BR-3 If `headers().get('x-nonce')` returns `null` (e.g. a route somehow bypasses the proxy matcher), `<ThemeProvider nonce={undefined}>` is the safe fallback — next-themes renders its script with no `nonce` attribute, identical to today's pre-fix behavior for that one route, never a thrown error. (clarifies AC-1; not a new failure mode)

## Edge cases
- EC-1 IF `app/layout.tsx`'s added `headers()` call forced a route that was NOT already dynamic to become dynamic THEN that would be a real, callable-out cost — guarded by the fact that the SAME layout already calls `auth()` unconditionally (CAM-195 CACHE-1), which already forces every route under it dynamic; `headers()` adds no incremental rendering-mode cost. The three special-file routes that need their OWN explicit `force-dynamic` for CSP-nonce reasons (`app/not-found.tsx`, `app/global-error.tsx`, `app/coming-soon/page.tsx`, all pre-existing since CAM-218) already carry it, so they get the nonce too.
- EC-2 IF the AC-2 production-build check asserted zero CSP violations as a standing automated CI assertion THEN it risks being brittle against unrelated future violations — this story verifies AC-2 as an owner/self-verify manual production-build step (matching the CAM-607 BR-3 precedent for this exact family of check), not a new flaky CI gate.
- EC-3 IF passing `nonce` changed next-themes's storage-key/read-write behavior THEN the existing theme-toggle persistence tests would fail — guarded by re-running the existing theme/toggle test suite unmodified.

## Data
- No entity, field, or schema is touched. Two files change a JSX prop chain (`app/layout.tsx` → `components/Providers.tsx` → `next-themes`'s `<ThemeProvider>`). · migration: none

## Seams & refs
- Reuse: `components/Providers.tsx`'s single `<ThemeProvider>` wiring (CAM-105, CAM-544) remains the only place theme setup happens — no parallel theme logic added. The nonce-read convention (`headers().get('x-nonce')`) is the one CAM-607's own `proxy.ts` comment documents as the intended app-code path; this story is its first real caller.
- Refs: CAM-607 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/tech.md` — makes the nonce reach the request) · CAM-218 (`.claude/rules/security.md` — the same family: a nonce silently not reaching where it's needed) · CAM-544 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-544-dark-default-theme/story.md` — its Out-of-scope section's now-superseded assumption that nonce-threading was unnecessary) · `.claude/rules/security.md` (CSP lineage).

## Out of scope
- Any CSP directive content change → not needed; `proxy.ts` already carries the correct nonce onto the request (CAM-607), this story only consumes it.
- Automating the AC-2 production-build flash/violation check into standing CI → deliberately a manual, evidenced self-verify step (EC-2), matching the CAM-607 precedent for this class of check.
- Fixing any OTHER un-nonced inline script found by the AC-4 sweep, if one is found outside `components/Providers.tsx`/`app/layout.tsx` → reported in `tech.md` as a follow-up ticket, not fixed here (file-surface discipline).

## Self-verify
- AC-1 → unit (`__tests__/cam-610-theme-script-nonce.test.ts`, 5/5 passed): server-renders the real `<Providers>` tree with `react-dom/server`, extracts the actual next-themes script tag it emits, and asserts it carries a `nonce="…"` attribute equal to the nonce passed in — not a string match on the prop declaration.
- AC-2 → real production build (`next build && next start`, port 4610, owner's port 3000 confirmed untouched throughout): curl showed all 40 served `<script>` tags (incl. the next-themes one) nonce-matched the response CSP header, 0 unnonced; a real Chromium session (Playwright) at `domcontentloaded` showed `document.documentElement.className` already contains `dark` with zero console errors (no flash); the standing regression spec `e2e/regression/cam-610-theme-script-nonce.spec.ts` run for real via `PW_REGRESSION=1 --project=regression` against that same production server — 2/2 passed, asserting 0 CSP violations (tighter than CAM-607's own `<= 1`). Full evidence in `tech.md`.
- AC-3 → the existing theme-toggle test suite (`__tests__/theme-toggle.test.ts`) re-run unmodified — all green (no regression from the added `nonce` prop).
- AC-4 → the inline-script sweep itself, recorded in `tech.md` with its result (found/not found, fixed/reported).
- Story-specific: `proxy.ts` diff is empty (out of bounds, confirmed by `git diff --stat`).
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created
