---
linear: CAM-203
feature: ai-workflow
epic: campsite-delivery-map-status-map
persona: Admin
artifact: tech
owner: architect
status: In Progress
version: v1
updated: 2026-06-27
---
# Tech — SEC-3 Strict Nonce-based CSP (CAM-203)

> DESIGN + RISK artifact. No implementation written here — hands off to `backend`.

---

## 1. Inline-script inventory (confirmed by grep)

Grep of `app/`, `components/`, `lib/` for `<script`, `ld+json`, `dangerouslySetInnerHTML`, and analytics snippets:

| Category | Finding |
|---|---|
| Executable `<script>` tags | **None found.** One comment in `dashboard-client.tsx` notes that a raw `<script>` inside a React tree is NOT executed — no actual tag present. |
| `application/ld+json` JSON-LD | **None found.** No structured-data scripts anywhere in the codebase. |
| Analytics/tracking (gtag, GA, fbq, Hotjar, Clarity) | **None found.** |
| `dangerouslySetInnerHTML` | Present in `/status` and `/status/map` pages — injecting only **`<style>`** tags (CSS strings) and **`<div>`** HTML content. No `<script>` injection. |
| Logo SVG inject | `campsite-scene.tsx` injects the logo as an SVG string via `dangerouslySetInnerHTML` into a `div` — HTML content, not a script. |

**Conclusion:** There are **zero app-level inline executable scripts**. The only `<script>` tags on any page are the ones Next.js itself injects for hydration — those are what the nonce mechanism is designed to cover. No component needs to be modified to read a nonce.

---

## 2. Nonce generation in middleware (Edge-safe)

Use `crypto.getRandomValues` from the Web Crypto API — available on the Edge runtime without any import.

```typescript
// Generate a cryptographically random nonce — Edge-safe (Web Crypto, no Node.js)
const nonceBytes = new Uint8Array(16);
crypto.getRandomValues(nonceBytes);
const nonce = Buffer.from(nonceBytes).toString('base64');
// Result: 22-char base64 string, e.g. "3cFaN8SmQz7K9pLx2mWv1A=="
```

Next.js 15/16 App Router reads the nonce from the **request header `x-nonce`** and automatically applies it to all `<script>` and `<style>` tags it generates during SSR. This is the official documented pattern. The nonce must also appear in the `Content-Security-Policy` response header sent to the browser.

---

## 3. Auth-compose pattern (the riskiest part)

### Current state
```typescript
export default NextAuth(authConfig).auth
```
`NextAuth(authConfig).auth` is itself a middleware handler (`NextMiddleware`). When `authConfig.callbacks.authorized` returns `false`, NextAuth redirects to `/login`. When it returns `true`, it calls `NextResponse.next()` internally.

### Problem
`NextAuth(authConfig).auth` returns a `NextMiddleware` that **owns** the `NextResponse`. We cannot wrap it after the fact to add headers to the response it has already created — the response is emitted inside `auth()`.

### Solution: use `auth()` as a callback-form wrapper

NextAuth v5 supports a **callback form**: `auth(async (req) => NextResponse)`. In this form, `req.auth` carries the session, and the handler's return value IS the response. This gives full control:

```typescript
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth(async (req) => {
  // 1. Generate nonce — Edge-safe Web Crypto
  const nonceBytes = new Uint8Array(16)
  crypto.getRandomValues(nonceBytes)
  const nonce = Buffer.from(nonceBytes).toString('base64')

  // 2. Build the CSP with the nonce
  const csp = buildCsp(nonce)

  // 3. Auth check — replicate authConfig.callbacks.authorized logic
  //    (auth() in callback form does NOT auto-run authorized; we must handle it)
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user
  const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')

  if (isOnDashboard && !isLoggedIn) {
    // Redirect to login — CSP header still applied to the redirect response
    const loginUrl = new URL('/login', req.url)
    const redirectResponse = NextResponse.redirect(loginUrl)
    redirectResponse.headers.set('Content-Security-Policy', csp)
    return redirectResponse
  }

  // 4. Pass through — inject nonce on request (for Next.js to consume) + CSP on response
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)
  return response
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

**Critical note on `auth()` callback form and `authorized`:** When using the callback form `auth(async (req) => ...)`, the `authorized` callback in `authConfig` is **not automatically invoked**. The protection logic must be explicitly re-implemented in the handler body. The above replicates the exact logic from `authConfig.callbacks.authorized` (only `/dashboard` requires auth; all other routes are public). This must be kept in sync if new protected routes are added.

---

## 4. CSP string

```
script-src 'nonce-{nonce}' 'strict-dynamic' 'unsafe-inline' https:;
```

Full CSP value (with `{nonce}` substituted per request):

```
default-src 'self'; script-src 'nonce-{nonce}' 'strict-dynamic' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org; font-src 'self'; connect-src 'self' https://*.tile.openstreetmap.org; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

### How `script-src` works across browsers

| Browser | Behavior |
|---|---|
| Modern (Chrome 61+, Firefox 75+, Safari 15.4+) | Honors `'nonce-{n}'` + `'strict-dynamic'`. **Ignores** `'unsafe-inline'` and `https:` (strict-dynamic supersedes them). XSS blocked unless script has the matching nonce. |
| Older browsers without strict-dynamic | Falls back to `'unsafe-inline'` + `https:` — same permissiveness as the current SEC-2 CSP. No regression. |

This is exactly the Google/Next.js recommended pattern for progressive strict CSP.

### Why `style-src` stays `'unsafe-inline'` (not nonce'd)

The `/status` and `/status/map` pages inject CSS via `<style dangerouslySetInnerHTML>`. These are inline style blocks, not scripts. Style XSS is a significantly lower-risk vector than script XSS (no arbitrary code execution). Nonce-ing styles would require reading the nonce in multiple Server Components, adding complexity for limited security benefit. `'unsafe-inline'` for `style-src` is the standard Next.js recommendation and does not affect the Lighthouse "CSP effective against XSS" check (which only tests `script-src`).

### Helper function (to be placed in middleware.ts)

```typescript
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org",
    "font-src 'self'",
    "connect-src 'self' https://*.tile.openstreetmap.org",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ")
}
```

---

## 5. Header placement — split between middleware and next.config.ts

| Header | Location after SEC-3 | Reason |
|---|---|---|
| `Content-Security-Policy` | **Middleware only** (dynamic, per-request nonce) | Nonce changes per request — cannot be static |
| `X-Content-Type-Options` | `next.config.ts` (static) | No nonce dependency |
| `Referrer-Policy` | `next.config.ts` (static) | No nonce dependency |
| `X-Frame-Options` | `next.config.ts` (static) | No nonce dependency |
| `Permissions-Policy` | `next.config.ts` (static) | No nonce dependency |
| `Strict-Transport-Security` | `next.config.ts` (static) | No nonce dependency |
| `Cross-Origin-Opener-Policy` | `next.config.ts` (static) | No nonce dependency |

**Action in `next.config.ts`:** Remove the `Content-Security-Policy` entry from the `headers()` array. All other headers remain unchanged. This eliminates the risk of duplicate/conflicting CSP headers (browser uses the first CSP header it sees; if both static config and middleware set CSP, the result is non-deterministic depending on order).

---

## 6. Matcher — confirm page routes covered

Current matcher:
```
'/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'
```

This correctly:
- **Excludes** `api/*` routes (API routes don't render HTML, no nonce needed for them)
- **Excludes** `_next/static/*` and `_next/image/*` (static assets, no HTML)
- **Excludes** `favicon.ico` and `.png` files
- **Includes** all page routes: `/`, `/login`, `/register`, `/campgrounds/[slug]`, `/dashboard/*`, `/bookings/*`, `/status`, `/status/map`, `/profile`, `/wishlist`, `/host`, `/preview`

**No adjustment needed.** Every page route that renders HTML is covered, and static assets are excluded (they don't need a nonce).

One nuance: `api/*` routes are excluded from the middleware matcher, which means they will NOT receive the dynamic CSP header from middleware. This is correct — `api/*` routes return JSON, not HTML, and the static CSP in `next.config.ts` still covers them. After removing CSP from `next.config.ts`, API routes will have **no CSP header** — this is acceptable since the CSP `script-src` directive only applies to HTML documents.

---

## 7. Performance impact

### Current state
Home page (`app/page.tsx`): calls `auth()` on every request → already dynamic. Confirmed by the comment: "force-dynamic removed. The page is still dynamic because auth() and the wishlist lookup are per-request."

Campground detail (`app/campgrounds/[slug]/page.tsx`): calls `auth()` → already dynamic.

All other pages: `/login`, `/register` are client components (no `export const dynamic`); `/status`, `/status/map`, `/host`, `/host/new` already `force-dynamic`.

**Routes with no `export const dynamic` and no `auth()` call:** Login and register pages are `"use client"` — they already opt into client-side rendering, no SSG prerendering occurs.

### Impact of nonce-in-middleware

Middleware runs on **every matched request** regardless. The nonce generation (`crypto.getRandomValues` + base64 encode) is a sub-microsecond operation — not measurable against a Postgres round-trip or network latency.

**No page is static/prerendered today** (verified: no `generateStaticParams`, no `export const revalidate = false` or `export const dynamic = 'force-static'`). The nonce does not force any currently-static page to become dynamic.

**Perf 94 Lighthouse score: no regression expected.** The nonce adds a header but does not change rendering, bundle size, or page weight. The `Content-Security-Policy` header is already present (from SEC-2); replacing its static value with a dynamic one per request has no measurable LCP/CLS/INP effect.

---

## 8. Risk and breakage list

Ranked by blast-radius (Critical → Important → Suggestion):

### Risk 1 — Critical: `authorized` callback not re-implemented correctly

**Scenario:** The callback form `auth(async (req) => ...)` does not auto-invoke `authConfig.callbacks.authorized`. If the `/dashboard` protection logic is not copied exactly, unauthenticated users may access dashboard pages.

**Mitigation:** The implementation in §3 explicitly replicates the logic. It must also be covered by a test that: (a) verifies an unauthenticated request to `/dashboard` gets a redirect to `/login`, and (b) verifies an authenticated request passes through. Backend to add these to the middleware test suite.

**Future risk:** If new protected routes are added to `authConfig.callbacks.authorized` in the future, they must also be updated in middleware.ts. This tight coupling is a maintenance cost (see ADR below).

### Risk 2 — Critical: Next.js version does not read `x-nonce` from request headers

**Scenario:** The `x-nonce` request header mechanism is documented for Next.js 13.4+ App Router. This repo uses Next.js `^16.2.9`. If the mechanism changed between versions, `<script>` tags generated by Next.js would not carry the nonce, causing all scripts to be blocked by `'strict-dynamic'` in modern browsers → white screen.

**Mitigation:** The `'unsafe-inline'` fallback in `script-src` ensures old browsers and potentially mis-configured environments still work. But modern browsers honouring `'strict-dynamic'` would break. Backend must verify on a Vercel Preview deploy that the rendered HTML contains `<script nonce="...">` attributes before merging. If `<script>` tags lack the nonce, revert `'strict-dynamic'` and keep only `'nonce-{n}' 'unsafe-inline'` (valid but less strict).

**Verification step:** `curl -s <preview-url> | grep 'script.*nonce'` on the Preview deploy.

### Risk 3 — Important: Duplicate CSP header if `next.config.ts` CSP is not removed

**Scenario:** If the `Content-Security-Policy` header is not removed from `next.config.ts`, both a static CSP (no nonce) and the dynamic CSP (with nonce) will be set. Browser behaviour with duplicate CSP headers is to use the most restrictive policy — the static one has no nonce, so modern browsers would block all scripts → white screen.

**Mitigation:** The `Content-Security-Policy` entry must be removed from `next.config.ts` as part of this story. This is a single-line deletion, low risk. Verify with `curl -I <url> | grep -i content-security-policy` — only one CSP header should appear.

### Risk 4 — Important: `Buffer` not available in Edge runtime

**Scenario:** `Buffer.from(nonceBytes).toString('base64')` uses Node.js `Buffer`. Edge runtime has `Buffer` available in Next.js (it is polyfilled), but this should be confirmed.

**Mitigation:** If `Buffer` is not available, use the Web-native alternative:
```typescript
const nonce = btoa(String.fromCharCode(...nonceBytes))
```
`btoa` is available in all Edge/browser/Node environments. Backend should use `btoa` as the safer cross-runtime choice.

### Risk 5 — Important: Redirect response missing CSP

**Scenario:** When the auth redirect fires (unauthenticated user → `/login`), the `NextResponse.redirect()` response must also carry the CSP header. A redirect response without CSP is a minor header inconsistency but not a breakage — the browser follows the redirect to the `/login` page, which will have its own CSP set by the next middleware execution.

**Assessment:** Low practical impact. The redirect response is a 307/302 with no HTML body. CSP on a redirect response is not enforced by browsers. Can be included for header completeness (as shown in §3) or omitted. Not a breakage risk.

### Risk 6 — Suggestion: `/api/*` routes excluded from middleware have no CSP

**Scenario:** After removing CSP from `next.config.ts`, `api/*` routes (excluded from the matcher) will have no `Content-Security-Policy` header. API routes return JSON, so this is functionally correct — no scripts are loaded from JSON responses — but may fail an automated header scanner.

**Mitigation option:** Keep the static CSP in `next.config.ts` scoped only to `api/*` routes, or accept that API routes legitimately have no CSP. Recommended: accept. Add a comment in `next.config.ts` explaining why.

---

## 9. `next.config.ts` change

Remove the `Content-Security-Policy` header from the `/(.*)`  block. All other headers stay. Add a comment indicating CSP is now in middleware.

The `source: "/status-map/sprites/:file*"` cache-control block is unaffected.

---

## 10. GO vs Report-Only recommendation

**Recommendation: ship as `Content-Security-Policy-Report-Only` first, then flip to enforced on G4 sign-off.**

Reasoning:

1. **The orchestrator has no browser.** The nonce mechanism is a browser-enforcement feature. The only way to verify it works is to load pages in a real browser and check: (a) no white screen, (b) `<script nonce="...">` in the DOM, (c) browser DevTools shows no CSP violations.

2. **Report-Only allows full staging verification before risk.** With `Content-Security-Policy-Report-Only`, the browser reports violations to the console but does not block scripts. Pages work normally. The owner can verify on the Staging URL that: (a) no white screen with `Report-Only`, (b) DevTools shows what would be blocked (should be nothing for Next.js scripts that carry the nonce), (c) optionally set up a `/api/csp-report` endpoint to collect violation reports.

3. **Flip cost is one word.** Change `Content-Security-Policy-Report-Only` → `Content-Security-Policy` in middleware.ts. This is a one-line change with zero logic risk, triggerable by the owner after staging verification.

4. **White-screen risk is real and non-reversible in the moment.** If the nonce is broken (Risk 2 above — Next.js doesn't inject it), a strict CSP would block all Next.js hydration scripts → every page goes white. On a production URL without a hotfix process, this is a P0 incident. Report-Only completely eliminates this risk while preserving the path to full enforcement.

**Proposed two-step delivery:**
- Step 1 (this story, CAM-203): ship with `Content-Security-Policy-Report-Only`. Owner verifies Staging — confirms no violations in DevTools.
- Step 2 (one-line follow-up, CAM-203b or same PR with owner sign-off): flip to `Content-Security-Policy`. Run `/quality-gate`. Merge.

---

## 11. ADR

**ADR-007: Nonce-based strict CSP composition with NextAuth v5 middleware**

See `docs/adr/ADR-007-strict-csp-nonce-nextauth.md` (to be written with this story).

Key decision for the ADR: whether to use `auth()` callback form (full control, must replicate authorized logic) vs a two-middleware chain approach (more modular, but Next.js only supports one default middleware export). The callback form is the only viable option given Next.js's single-middleware constraint.

---

## Data model

No schema change. No Prisma migration. This story touches only `middleware.ts` and `next.config.ts`.

## API contract

No new API endpoints. The `Content-Security-Policy` header is a response header, not an API contract change.

## ADRs

`docs/adr/ADR-007-strict-csp-nonce-nextauth.md` — to be authored as part of this story (hard-to-reverse: changes the auth middleware composition pattern for the lifetime of the project).

## Links
`middleware.ts` · `next.config.ts` · `lib/auth.config.ts` · `story.md`

## Changelog
- v1 (2026-06-27) — created, DESIGN + RISK only (CAM-203)
