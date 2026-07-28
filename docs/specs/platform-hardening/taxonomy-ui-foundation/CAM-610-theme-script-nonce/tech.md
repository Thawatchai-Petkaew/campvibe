---
linear: CAM-610
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: frontend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Tech — theme anti-flash script now runs under our CSP (CAM-610)

## The fix

`app/layout.tsx` reads the per-request nonce CAM-607 already sets on the request headers
(`headers().get('x-nonce')`) and threads it through `components/Providers.tsx` into
`<ThemeProvider nonce={nonce}>` — a prop `next-themes` supports natively for exactly this case.
`proxy.ts` is untouched (out of bounds; already correct since CAM-607).

```ts
// app/layout.tsx
const nonce = (await headers()).get("x-nonce") ?? undefined;
// ...
<Providers session={session} nonce={nonce}>
```

```tsx
// components/Providers.tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="campvibe_theme" nonce={nonce}>
```

No CSP directive changed. `git diff --stat -- proxy.ts` is empty for this PR.

## Why dynamic rendering was already free (the CAM-218 constraint, addressed explicitly)

CAM-218's lesson: a statically-prerendered route bakes its HTML at build time with no per-request
nonce, so the CSP blocks every script on it. This DOES NOT bite here: `app/layout.tsx` — the ROOT
layout for every route in the app — already calls `await auth()` unconditionally (a dynamic API,
reads cookies), which per Next.js's own rule ("a Dynamic API in a layout opts the entire route into
dynamic rendering") already forces **every route under it** to render dynamically, with no
Partial Prerendering configured (`next.config.ts` has no `experimental.ppr`). Reading `headers()`
in the same layout, right next to the existing `auth()` call, adds **zero incremental
dynamic-rendering cost** — it only reads a value that the already-dynamic render already implies.

Confirmed by re-running `npm run build` after this change and reading the route table Next.js prints:

```
Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ... (every app/api/* and app/ HTML route) ...
└ ƒ /wishlist
○  (Static)   prerendered as static content   ← only /apple-icon.png and /icon.png (binary images, no scripts)
ƒ  (Dynamic)  server-rendered on demand        ← every single HTML route
```

**No route was forced dynamic by this change; none needed to be — the whole HTML surface already was.**
The three special-file routes that separately needed their OWN explicit `export const dynamic =
"force-dynamic"` for this same nonce reason (`app/not-found.tsx`, `app/global-error.tsx`,
`app/coming-soon/page.tsx`, all pre-existing since CAM-218, unrelated to this PR) already carry it,
so they get the fixed, nonced theme script too, with no further change needed.

## Production-build behavioral evidence (measured, not asserted)

`next build` (Turbopack) → route table above, zero errors. `next start` on port 4610 (scratch
`DATABASE_URL` → local `campvibe` Postgres via peer/trust auth, scratch `AUTH_SECRET` +
`AUTH_TRUST_HOST=1`; owner's port 3000 dev server never touched, confirmed still running
throughout and after).

1. **Header vs served-HTML nonce agreement** (curl, `GET /`): response
   `content-security-policy: ...script-src 'nonce-+BCGkE/8wAKfSA+27cOVng==' ...`. Every one of the
   **40** `<script>` tags in the served HTML — including the next-themes init script (matched by its
   `campvibe_theme` storageKey literal in the body) — carries `nonce="+BCGkE/8wAKfSA+27cOVng=="`,
   the identical value. **Zero** un-nonced `<script>` tags remain (pre-fix: 1 of ~28-38, per CAM-607's
   own finding).
2. **Real browser, zero CSP violations, no flash** (Playwright/Chromium against the same production
   server): navigated to `/` with `waitUntil: "domcontentloaded"` (the earliest point after the
   blocking inline script would have run) — `document.documentElement.className` already contains
   `dark`, `document.documentElement.style.colorScheme === "dark"`, and `consoleErrors: []`. Before
   this fix, the identical script was CSP-blocked (an un-thrown, silent failure per the CAM-218/CAM-607
   family shape) and the class would only be set later, client-side, by `next-themes`'s React effect
   after hydration — the flash CAM-544 made newly visible.
3. **Standing regression guard**: `e2e/regression/cam-610-theme-script-nonce.spec.ts`, run for real
   against the production server above via the Playwright `regression` project
   (`DATABASE_URL=... E2E_PORT=4610 PW_REGRESSION=1 npx playwright test
   e2e/regression/cam-610-theme-script-nonce.spec.ts --project=regression`) — **2/2 passed**
   (`regression-setup`'s real `/login` + this spec). Asserts the CSP-violation count at exactly `0`
   on `/` — a strictly tighter bound than CAM-607's own `<= 1` (which had to allow this exact,
   then-unfixed violation). This spec would fail outright on the pre-fix source.

## Out-of-surface / follow-up note (not fixed here, file-surface discipline)

`e2e/regression/cam-607-csp-nonce-agreement.spec.ts`'s AC-3 test still caps CSP violations at `<= 1`
with a comment explaining the (now-fixed) next-themes gap — that cap is stale after this PR merges
(could tighten to `0`) but that file is CAM-607's, not in this story's allowed surface. Recommended as
a one-line follow-up whenever CAM-607's owner next touches that spec; not filed as its own ticket since
it is a one-line comment/assertion tightening with zero risk, not a defect (the `<= 1` cap still passes
either way and still catches a real regression).

## Inline-script sweep (the wider question this story asked)

Grepped the whole app (`app/`, `components/`, `lib/`) for every mechanism that could emit an
un-nonced inline script:

- `dangerouslySetInnerHTML` — 9 call sites found, **all** render `<style>` blocks (CSS), not
  `<script>` (`app/status/map/campsite-canvas.tsx`, `campsite-scene.tsx` (×2), `app/status/page.tsx`
  (×3), `app/status/map/page.tsx` (×2)). CSP `style-src` already carries `'unsafe-inline'` on purpose
  (`proxy.ts`'s own comment: nonce-ing styles would need threading through multiple Server Components
  for minimal benefit — standard Next.js guidance, pre-existing, out of this ticket's scope).
- Raw `<script>` JSX elements — **zero** found anywhere in `app/`/`components/`/`lib/`.
- `next/script` (`<Script>`) — **zero** imports anywhere in the codebase.
- JSON-LD (`application/ld+json`) — **zero** found; no structured-data scripts exist yet in this
  codebase (SEO JSON-LD per `.claude/rules/seo.md` is not yet implemented anywhere, unrelated to CSP).
- Known script-injecting third-party libraries in `package.json` dependencies (analytics/tag-manager/
  captcha/payment SDKs that typically self-inject a `<script>`) — **none present**: no
  `@vercel/analytics`, no Google Analytics/gtag, no reCAPTCHA, no Stripe.js. The dependency list is
  Radix/shadcn UI primitives, `leaflet`/`react-leaflet` (DOM elements, not script injection),
  `three.js` (WebGL canvas, not script injection), `sonner`, `cmdk`, `react-day-picker` — none of
  which inject an inline `<script>`.

**Result: next-themes's FOUC script (fixed by this PR) was the only un-nonced inline script in the
app.** No fourth member of the CAM-218/CAM-607/CAM-610 family was found. Reported per the ticket's
instruction regardless of outcome.

## Links
`../../feature.md` · `story.md` (BR-1..3, AC-1..4) · `design.md` ·
`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/tech.md` (the
request-header nonce mechanism this story consumes) · `.claude/rules/security.md` (CSP lineage:
CAM-203/CAM-218/CAM-607) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-544-dark-default-theme/story.md`
(its now-superseded Out-of-scope assumption that nonce-threading was unnecessary).

## Changelog
- v1 (2026-07-28) — created; fixed by threading the CAM-607 request-header nonce through
  `Providers`/`ThemeProvider`; measured production-build + real-browser evidence (zero violations,
  no flash, nonce agreement); confirmed zero incremental dynamic-rendering cost; swept the app for
  other un-nonced inline scripts — none found.
