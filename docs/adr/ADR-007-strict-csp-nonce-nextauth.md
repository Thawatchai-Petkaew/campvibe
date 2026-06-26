# ADR-007: Strict nonce-based CSP composition with NextAuth v5 middleware

Status: PROPOSED (pending G2 sign-off, CAM-203)
Date: 2026-06-27
Supersedes: n/a
Related: CAM-203 (SEC-3), CAM-191 (Edge middleware fix), next.config.ts SEC-2 headers

---

## Context

SEC-2 (CAM-202) shipped a CSP with `script-src 'self' 'unsafe-inline'`. This CSP passes the browser's same-origin check but fails the Lighthouse "CSP effective against XSS" audit because `'unsafe-inline'` allows any inline script injection — the exact attack vector CSP is designed to prevent.

The Next.js recommended upgrade path is a **per-request nonce**: every page response carries a unique `'nonce-{n}'` in `script-src`, and Next.js automatically stamps that nonce onto every `<script>` tag it generates during SSR. Combined with `'strict-dynamic'`, modern browsers ignore `'unsafe-inline'` and only execute scripts that carry the nonce. Old browsers fall back to `'unsafe-inline'` — no regression.

The nonce must be generated **per request** (static values in `next.config.ts` `headers()` offer no XSS protection — a nonce must be unguessable and single-use). This forces the CSP into the **Edge middleware**, where Next.js 15/16 App Router reads the nonce from the `x-nonce` request header to apply it to SSR-generated `<script>` tags.

The current middleware is `export default NextAuth(authConfig).auth` — a single-export NextMiddleware. NextAuth v5's `auth()` can be used in a **callback form** that gives full control over the response, enabling nonce injection while preserving auth protection.

---

## Decision

1. **Generate a per-request nonce in middleware** using `crypto.getRandomValues` (Edge-safe Web Crypto), base64-encoded.

2. **Use `auth()` in callback form** — `export default auth(async (req) => { ... })` — to compose nonce injection with auth protection in a single middleware export. The `authorized` callback logic from `authConfig` is **explicitly replicated** inside the handler (NextAuth v5 callback form does not auto-invoke `authorized`).

3. **Set two headers per request:**
   - Request header `x-nonce: {nonce}` — consumed by Next.js App Router to stamp nonces onto `<script>` tags during SSR.
   - Response header `Content-Security-Policy` — the full CSP string containing `'nonce-{nonce}'`.

4. **CSP `script-src` value:**
   ```
   'nonce-{n}' 'strict-dynamic' 'unsafe-inline' https:
   ```
   Modern browsers: enforce nonce + strict-dynamic, ignore unsafe-inline/https. Old browsers: fall back to unsafe-inline + https. Lighthouse recognises `'strict-dynamic'` as a strict CSP.

5. **Keep `style-src 'unsafe-inline'`** — the `/status` and `/status/map` pages inject CSS via `<style dangerouslySetInnerHTML>`. Style-XSS is a significantly lower risk than script-XSS (no arbitrary code execution). Nonce-ing styles would require threading the nonce through multiple Server Components for minimal security benefit.

6. **Remove CSP from `next.config.ts` `headers()`** — all other SEC-2 headers (nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, HSTS, COOP) remain static in `next.config.ts`. Only CSP moves to middleware.

7. **Ship as `Content-Security-Policy-Report-Only` first** — flip to `Content-Security-Policy` after owner verifies no violations on the Staging URL.

---

## Alternatives

### A. Keep static CSP in `next.config.ts`, add hash-based allow-listing

Generate SHA-256 hashes of all inline scripts at build time; include them in `script-src`. Rejected: Next.js hydration scripts are generated at runtime with content that varies per request (route data, session state). Build-time hashes cannot cover runtime-generated content. Only a nonce (per-request) or `'strict-dynamic'` (trust the nonce propagation chain) can cover them.

### B. Use a middleware chain pattern (two separate middleware functions)

Some frameworks allow chaining middleware. Next.js supports **one** default export from `middleware.ts`. Workarounds exist (manually chain functions in the file), but they complicate the auth flow and are not officially supported. The `auth()` callback form is the correct NextAuth v5 composition pattern. Rejected.

### C. Wrap `NextAuth(authConfig).auth` with a manual post-processing step

Call `auth()` as a standalone function, get its response, then modify the response headers. This does not work: `NextAuth(authConfig).auth` is a `NextMiddleware` handler, not a function that returns a response that can be post-processed. The response is emitted internally. Rejected.

### D. Accept `'unsafe-inline'` (no change from SEC-2)

Maintains current state. Lighthouse XSS audit continues to fail. Leaves the inline-script XSS vector open. Rejected — the purpose of this story is exactly to close this gap.

### E. Ship enforced immediately (no Report-Only step)

Faster to production enforcement. Rejected for this delivery: the orchestrator has no browser; nonce propagation (whether Next.js actually stamps `nonce="..."` on `<script>` tags in Next.js 16.x) must be verified visually on a real browser on the Staging URL before enforcing. A broken nonce with enforced CSP → all scripts blocked → white screen on every page. Report-Only eliminates this risk at negligible cost (one-word change to flip).

---

## Consequences

**Positive:**
- Lighthouse "CSP effective against XSS" check passes in modern browsers.
- Inline script injection attacks blocked in all browsers that support `'nonce-{n}'` + `'strict-dynamic'` (Chrome 61+, Firefox 75+, Safari 15.4+).
- Old browsers fall back gracefully — no regression.
- `'unsafe-inline'` in `style-src` is maintained, so /status pages are unaffected.
- No Prisma or Node-only imports enter the middleware — Edge safety maintained.

**Negative / maintenance costs:**
- The `authorized` callback logic from `authConfig` is now **duplicated** in `middleware.ts`. If a new protected route is added to `authConfig.callbacks.authorized`, `middleware.ts` must also be updated. This coupling is a maintenance cost.
- The nonce mechanism depends on Next.js reading `x-nonce` from the request header and stamping it onto `<script>` tags. This is an internal Next.js behaviour, not a public API contract. A Next.js upgrade that changes this mechanism would silently break the nonce (Risk 2 in `tech.md`).
- Per-request `crypto.getRandomValues` adds a sub-microsecond cost to every page request — not measurable.
- Two-step delivery (Report-Only → enforced) requires owner sign-off between steps.

**Migration:**
No schema change. No database migration. No data backfill.
Files changed: `middleware.ts` (rewrite) + `next.config.ts` (remove CSP from headers array).
Reversible: yes — revert both files to SEC-2 state to go back to `'unsafe-inline'` static CSP.
