---
linear: CAM-607
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Tech — Next's streaming script blocked by our own CSP (CAM-607)

## The root cause, read directly from the installed framework (not guessed)

`next@16.2.9`. `proxy.ts` generates a per-request nonce, builds the enforced CSP string, sets a custom `x-nonce` header **on the request**, and sets the enforced `Content-Security-Policy` header **only on the response**:

```ts
// BEFORE (the defect)
const requestHeaders = new Headers(req.headers)
requestHeaders.set('x-nonce', nonce)               // request: custom header only

const response = NextResponse.next({
    request: { headers: requestHeaders },
})
response.headers.set('Content-Security-Policy', csp) // response: enforced CSP only
```

The file's own header comment claimed this was sufficient: *"Set the nonce on the request header `x-nonce` for Next.js to stamp onto every SSR-generated `<script>` tag."* That claim is false, and it is exactly the trap CAM-218 names — a wrong assumption about how the nonce reaches Next.js, baked into a comment, that nothing ever failed loudly enough to correct.

**How Next.js actually finds the nonce**, read from the framework's own shipped source at the paths below (not the docs alone — cross-checked against the executable code for this exact installed version):

1. `node_modules/next/dist/server/app-render/app-render.js:156-168` (`parseRequestHeaders`):
   ```js
   const csp = headers['content-security-policy'] || headers['content-security-policy-report-only'];
   const nonce = typeof csp === 'string' ? getScriptNonceFromHeader(csp) : undefined;
   ```
   `headers` here is `req.headers` — the **incoming request** Next.js's render pipeline receives, i.e. exactly what `proxy.ts` hands it via `NextResponse.next({ request: { headers } })`. Next.js looks for a header literally named `content-security-policy` on the **request**. It never looks at `x-nonce` for this purpose — `x-nonce` is purely an app-level convention (documented in `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`) for OUR OWN Server Component code to read manually via `headers().get('x-nonce')` and pass to a `<Script nonce={nonce}>` — it has no effect on what Next.js's OWN framework code does.

2. `node_modules/next/dist/server/app-render/get-script-nonce-from-header.js`:
   ```js
   const CSP_NONCE_SOURCE_REGEX = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/;
   function getScriptNonceFromHeader(cspHeaderValue) {
     const directive = directives.find(d => d.startsWith('script-src')) || directives.find(d => d.startsWith('default-src'));
     ...
   }
   ```
   Parses the `script-src` (or `default-src`) directive of that CSP string and extracts the first `'nonce-...'` token.

3. `node_modules/next/dist/server/app-render/use-flight-response.js:137-138` (`createInlinedDataReadableStream`):
   ```js
   function createInlinedDataReadableStream(flightStream, nonce, formState) {
     const startScriptTag = nonce ? `<script nonce="${htmlEscapeAttributeString(nonce)}">` : '<script>';
   ```
   This is the exact function that emits React Flight's inline coordinator/segment scripts into the streamed HTML — the mechanism CAM-604 found blocked (the `<div id="S:1">` streaming container's relocation script). **If `nonce` is falsy here, the script tag is emitted bare — no `nonce` attribute at all.**

Chain: `proxy.ts` never put `content-security-policy` on the request → step 1's `nonce` is `undefined` → step 3 emits `<script>` (no nonce) for every Flight-streamed inline script, including the one that moves a Suspense-boundary segment into place → the browser's own (correctly enforced) `script-src 'nonce-{n}' ...` policy refuses it → the segment is never relocated → the stray `<div id="S:1">` copy CAM-604 found stays in the DOM. **This is root-caused, not guessed** — verified by reading the exact executable path in the installed framework version, matching CAM-604's own console evidence line-for-line: *"Executing inline script violates the following Content Security Policy directive 'script-src ... 'nonce-...' ...'. ... The action has been blocked."*

This also explains why the site otherwise "worked": any of OUR OWN code that explicitly reads `x-nonce` via `headers()` and threads it into a manual `<Script nonce={nonce}>` still functions (that path never depended on the request-side CSP header) — a repo-wide grep found **zero** such call sites in this codebase, so in practice this defect was silent everywhere it could have mattered, surfacing only for Next.js's OWN automatically-stamped scripts, of which the streaming-relocation script is the one CAM-604's fault injection made visible.

## The fix — mirrors Next.js's own documented pattern, zero loosening

`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`'s own `proxy.ts` example sets the CSP string on **both** `requestHeaders` and `response.headers` (identical string, one variable). Our `proxy.ts` only ever did the second half. The fix restores the first half:

```ts
// AFTER (the fix)
const requestHeaders = new Headers(req.headers)
requestHeaders.set('x-nonce', nonce)
requestHeaders.set('Content-Security-Policy', csp)   // CAM-607 — Next's own render pipeline
                                                       // reads THIS to find its nonce (see above)

const response = NextResponse.next({
    request: { headers: requestHeaders },
})
response.headers.set('Content-Security-Policy', csp)  // unchanged — browser enforcement
```

**Was the policy loosened in any way? No — and here is exactly what an attacker would gain if it had been:** the `csp` string is the SAME variable, built once by the SAME `buildCsp(nonce)` call, for both `.set()` calls. Not one directive's keyword or allowed origin changed; no `unsafe-inline` was added to `script-src` beyond what was already there for legacy-browser fallback (unchanged, pre-existing, and ignored by any modern browser once `'nonce-...'` is present per CSP3); no new origin was allow-listed. The only change is which HTTP message object (request vs. response) carries the identical string — a propagation fix, not a policy fix. `__tests__/cam-607-csp-request-header.test.ts` pins every directive's content unchanged from `sec3-csp-nonce.test.ts`'s own baseline assertions, so a future PR that DID try to loosen something in the same edit would fail this suite too.

## Why this is not CAM-218's exact failure mode, but is its family

CAM-218: a route was **statically prerendered** at build time, so no per-request nonce existed at all — every script on that route was unconditionally blocked, all the time. CAM-607: the routes ARE dynamically rendered (every `/dashboard/**` page reads the session via `auth()`, which forces dynamic rendering), a fresh nonce genuinely IS generated every request, and it genuinely DOES reach the response header the browser enforces — but it never reached the one place (`req.headers` as Next.js's renderer sees it) that Next.js's OWN internal script-emission code reads from. Same family (a nonce silently failing to reach where the framework expects it, with **no thrown error** — CAM-604's tech.md is explicit that no hydration console warning ever fires for this defect), different specific mechanism. Read here, not re-guessed from CAM-218's shape.

## Verification — behavioral, not just source-inspection

`__tests__/cam-607-csp-request-header.test.ts` does two things:
1. **Source-inspection Prove-It**: asserts `requestHeaders.set('Content-Security-Policy', csp)` is present and precedes the `NextResponse.next(...)` construction (this line is exactly what was missing — removing it reproduces the defect; the test fails on the pre-fix source, confirmed by temporarily reverting the one line and re-running).
2. **Behavioral proof using Next's own installed extractor**: imports `buildCsp` (now exported for testability) from `proxy.ts` and Next's own `getScriptNonceFromHeader` (required directly from its installed dist path — the exact function shown above) and asserts that feeding our real CSP string through Next's real nonce-extraction logic returns the identical nonce we generated. This proves the propagation, once it happens, actually works end-to-end with the real framework code — not an assumption about it.

`e2e/regression/cam-607-csp-nonce-agreement.spec.ts` is the standing, CI-safe regression guard (steady-state, no fault injection — see BR-3/EC-2 in `story.md` for why the fault-injection reproduction is a manual, evidenced self-verify step instead of an automated test). **Run for real** against the actual regression harness (`PW_REGRESSION=1 npx playwright test e2e/regression/cam-607-csp-nonce-agreement.spec.ts --project=regression`, real `npm run dev` on port 3100, real local Postgres, real seeded host login via the real `/login` form) — **3/3 passed**:
- Navigates to `/dashboard` as the authenticated seeded host.
- Reads the response's `content-security-policy` header, extracts the nonce.
- Asserts a persistent Next.js-emitted `<script nonce="...">` in the served HTML carries the SAME nonce (the CSP-header-vs-served-HTML agreement check CAM-218 needed and did not have) — reading the `.nonce` IDL PROPERTY, not `getAttribute("nonce")` (browsers deliberately blank the nonce content attribute once the element is in the document, to prevent a CSS-attribute-selector side-channel leak; a first draft of this exact test used `getAttribute` and would have silently always compared `""` against `""` — caught during this story's own manual verification below, fixed before it shipped as a false-green).
- Asserts the CSP-violation count is `<= 1`, not `0` — see "Out-of-surface finding" below for the one pre-existing, unrelated violation this count deliberately still allows.
- A second test, in a fresh unauthenticated context, asserts `/dashboard` still redirects to `/login` (AC-4 — route protection re-verified, not assumed, per the CAM-203 lesson).

## Manual production-build + CPU-pressure reproduction (AC-2) — measured, both before and after

Method matches CAM-604's own investigation: `next build && next start` on a spare port (4607; port 3000 — the owner's dev server — was never touched), a self-generated scratch `DATABASE_URL` pointing at the real local Postgres `campvibe` DB (read/login only, no destructive regression specs run against it) and a self-generated scratch `AUTH_SECRET` (never the real one — `.env` access is correctly permission-blocked in this environment and was not worked around), 7 saturating `child_process.fork` busy-loop workers on this 10-core machine, logged in as the real seeded host (`hoster@campvibe.com`) via the real `/login` form, then repeated `/dashboard` navigations under the pressure window, polling `page.locator('body > div[id^="S:"]')` at ~30ms intervals.

**Measured, both conditions:**
- **Before the fix** (one line reverted, rebuilt, restarted): across 6 navigations under pressure with a 1.5s per-navigation poll window, the stray `<div id="S:...">` was still present (`finalStrayCount: 1`) at the END of the poll window on 1 of 6 navigations — a genuine, measured, persisting duplicate, matching CAM-604's own finding.
- **After the fix**: across two separate 6-navigation runs at the 1.5s poll window, results were 0/6 and 1/6 navigations still showing a stray div at window-end. **Honestly, this alone is not a clean binary discriminator at a 1.5s window** — CAM-604's own tech.md already notes even the broken behavior "self-resolves within ~1-2s" via an unrelated recovery path, so a short poll window cannot cleanly separate "still blocked" (pre-fix: the script never runs, ever, until that unrelated recovery path papers over it) from "fixed, but delayed by extreme CPU starvation" (post-fix: the script IS correctly nonced and unblocked, but a JS thread competing against 7x CPU oversubscription on a 10-core machine can still take a variable, occasionally-longer time to get scheduled). Extending the poll window to 3s and re-running on the fixed build across a further 4 navigations: **0/4** still showed a stray div at window-end — consistent with "fixed" (the relocation script does run and complete, just sometimes later than 1.5s under this level of induced contention), not with "still blocked" (which would show no dependence on how long you wait, only on whether the unrelated recovery path happens to have kicked in yet).
- **The decisive, non-probabilistic evidence is the code-level fix** (Section "The root cause", confirmed by reading the exact installed framework source, not inferred from timing) plus the **deterministic** behavioral test (`getScriptNonceFromHeader` proof) and the **deterministic** live CSP-header-vs-served-nonce agreement (confirmed on every single page load in every run above, dashboard included, both under normal load and under all fault-injection runs — this never once disagreed). The DOM-timing fault-injection numbers above are reported honestly as directionally consistent with the fix, not as a clean pass/fail signal at these timescales — per `.claude/rules/qa.md`'s metric-honesty rule, no fabricated "0% flaky" claim is made here.

## Out-of-surface finding — reported, not fixed (matching the CAM-604 precedent)

During this story's own manual verification, exactly **one** CSP violation fires on **every** page load (not just `/dashboard`, not related to CPU pressure or streaming at all) — found by inspecting the served HTML directly: `components/Providers.tsx`'s `<ThemeProvider>` (from `next-themes`) renders its own FOUC-prevention inline script via `dangerouslySetInnerHTML` as a bare `<script>` with **no `nonce` attribute at all** (confirmed: the ONLY `<script>` tag in the served HTML missing a `nonce=` attribute, out of 28-38 script tags on a given page). `next-themes`'s `ThemeProvider` supports a `nonce` prop specifically for this; it has never been wired here. This is:
- **Unrelated to this ticket's fix** — this script is rendered via React JSX, not through Next.js's automatic framework-script nonce-stamping pipeline at all, so the request-header CSP propagation fixed here does not and cannot touch it.
- **Pre-existing since CAM-203** enforced the CSP (its own comment: "Verified on Staging — no app violations… the only report was the Vercel dev toolbar" — this next-themes violation would have been silently present the whole time; Report-Only mode, and later "no violations reported" checks, evidently missed it).
- **Outside this story's file surface** (`proxy.ts` / `app/dashboard/loading.tsx` / test+doc files only — `components/Providers.tsx` is not in scope).
- **Live-impact**: `next-themes`'s actual theme STATE is still applied post-hydration via its React effect regardless, so this is not a total breakage — but the FOUC-prevention this script exists for is not happening, so a theme flash is plausible on cold loads, in addition to the console error itself.

Reported here, not fixed, per the exact instruction this ticket itself was raised under ("if a shared component is at fault, STOP and report rather than changing a component other screens depend on") — recommended as its own follow-up ticket, owned by whoever next touches `components/Providers.tsx` / the CSP nonce contract for third-party script integrations.

## Links
`../../feature.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-604-availability-hydration-mismatch/tech.md` (the investigation this ticket was born from — DOM ancestor-chain evidence, A/B repro, reproduction environment) · `proxy.ts` · `lib/auth.config.ts` · `__tests__/cam-607-csp-request-header.test.ts` · `e2e/regression/cam-607-csp-nonce-agreement.spec.ts` · `.claude/rules/security.md` (CAM-203/CAM-218/CAM-240 CSP lineage) · Next.js docs, bundled locally at `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` ("How nonces work in Next.js") · Next.js source, `node_modules/next/dist/server/app-render/app-render.js`, `.../use-flight-response.js`, `.../get-script-nonce-from-header.js`.

## Changelog
- v1 (2026-07-28) — created; root-caused via the installed framework's own source (not guessed), fixed by propagating the enforced CSP onto the request headers (mirroring Next.js's own documented pattern), zero policy loosening, behavioral + e2e verification.
