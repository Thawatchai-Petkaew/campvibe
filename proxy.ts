import NextAuth from "next-auth"
import { authConfig, isRouteAllowed } from "@/lib/auth.config"
import { NextResponse } from "next/server"

/**
 * CAM-203 SEC-3 — Strict nonce-based CSP.
 *
 * Next 16: the `middleware` file convention is deprecated and renamed to
 * `proxy` (https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
 * This file was renamed middleware.ts -> proxy.ts; behaviour is byte-identical.
 * The proxy file exports a single function as the default export — the
 * NextAuth v5 `auth()` wrapper returns exactly that, so the export form is
 * unchanged. `export const config = { matcher }` is also unchanged in Next 16.
 *
 * Restructured from the simple `export default NextAuth(authConfig).auth`
 * form to the auth() callback form so we can:
 *   1. Generate a per-request nonce (Edge-safe Web Crypto, btoa — no Buffer)
 *   2. Set the enforced Content-Security-Policy on BOTH the outgoing request
 *      headers and the response headers (CAM-607 — see below for why both)
 *   3. Replicate /dashboard protection explicitly (auth() callback form does
 *      NOT auto-invoke authConfig.callbacks.authorized)
 *
 * CAM-607 — why the CSP header must ALSO go on the request, not just the
 * response: Next.js's OWN render pipeline (app-render.js's
 * parseRequestHeaders) looks for a header literally named
 * `content-security-policy` on the REQUEST it receives, parses the
 * `'nonce-{value}'` token out of its script-src directive
 * (get-script-nonce-from-header.js), and uses that nonce to stamp EVERY
 * inline <script> Next.js itself emits — including the Flight
 * streaming-segment relocation script (use-flight-response.js's
 * createInlinedDataReadableStream) that moves a streamed Suspense boundary's
 * content into place. This file previously set the custom `x-nonce` header
 * on the request (for OUR OWN Server Component code to read manually via
 * headers().get('x-nonce')) but the enforced Content-Security-Policy header
 * itself was set on the RESPONSE only — so Next.js's automatic nonce
 * extraction always failed silently, and every framework-emitted inline
 * script (no `nonce` attribute) was refused by our own enforced CSP. This
 * left a stray, un-relocated streaming container (`<div id="S:1">`) behind
 * on every `/dashboard/**` route under enough load to observe it (found by
 * CAM-604 under CPU-pressure fault injection; root-caused and fixed here —
 * see docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/tech.md).
 * The fix sets the IDENTICAL csp string (same variable) on the request too —
 * zero directive content changes; nothing is re-allowed.
 *
 * Edge-safe: NO Node.js APIs. Uses Web Crypto (crypto.getRandomValues) +
 * btoa — both available in the Edge runtime without any import.
 *
 * CAM-191 note: still imports only auth.config (no prisma, no Node-only deps).
 */

const { auth } = NextAuth(authConfig)

/**
 * Build the full CSP string for a given nonce.
 *
 * script-src: 'nonce-{n}' 'strict-dynamic' 'unsafe-inline' https:
 *   - Modern browsers: honour nonce + strict-dynamic, IGNORE unsafe-inline/https.
 *   - Old browsers: fall back to unsafe-inline + https (no regression).
 *   - Lighthouse recognises 'strict-dynamic' as an effective strict CSP.
 *
 * DEV-ONLY: 'unsafe-eval' is appended in development mode only.
 *   React/Next.js Turbopack requires eval() during development for fast refresh.
 *   Production CSP remains strict — 'unsafe-eval' is NEVER added in prod.
 *
 * style-src: keeps 'unsafe-inline' — /status and /status/map inject CSS via
 * <style dangerouslySetInnerHTML>. Style XSS risk << script XSS. Nonce-ing
 * styles would require threading the nonce through multiple Server Components
 * for minimal benefit. Standard Next.js recommendation.
 *
 * connect-src: 'blob:' (CAM-373 S2 review) — three.js's GLTFLoader decodes
 * each embedded glTF texture (webp, per the CAM-373 S2a WASM-free asset
 * pipeline) via ImageBitmapLoader, which creates a same-origin `blob:` URL
 * for the embedded image bytes and loads it with `fetch()` — governed by
 * THIS directive, not the one covering <img>/background-image loads (that
 * one already allows blob: too, added in CAM-239, but fetch() is separate).
 * Without this, every texture fetch is CSP-refused, the GLB load rejects,
 * and the 3D scene silently falls back to placeholder meshes. This is the
 * app's OWN object URL (never a remote origin) — same low-risk allowance
 * as the pre-existing image-loading blob: entry.
 *
 * All other directives are identical to the SEC-2 static CSP.
 *
 * Exported (CAM-607) so __tests__/cam-607-csp-request-header.test.ts can
 * behaviorally prove — using Next.js's OWN installed nonce-extraction
 * function — that this exact string yields the nonce Next.js's render
 * pipeline expects, once it reaches the request (see the file-level comment
 * above for why the request needs it, not only the response).
 */
export function buildCsp(nonce: string): string {
    // React/Next.js Turbopack needs 'unsafe-eval' in dev (fast refresh). DEV-ONLY.
    // process.env.NODE_ENV is inlined by Next.js at build time — Edge-safe.
    const scriptSrc = `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`
    return [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org https://*.googleusercontent.com",
        "font-src 'self'",
        "connect-src 'self' blob: https://*.tile.openstreetmap.org",
        "media-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ].join("; ")
}

export default auth(async (req) => {
    // ── 0. COMING_SOON gate (CAM-237 LAUNCH-1) ──────────────────────────────
    // Process env read is Edge-safe (process.env is available in the Edge runtime).
    // This block runs BEFORE the nonce/CSP/dashboard logic so the holding page
    // is served with zero auth overhead.
    //
    // Flag OFF behaviour (COMING_SOON !== "1"):
    //   - /api/* routes now reach the matcher (api| was removed), so we must
    //     explicitly pass them through — this is byte-identical to the previous
    //     behaviour where the matcher excluded /api entirely.
    //   - All other routes fall through to the unchanged nonce/CSP/dashboard logic.
    //
    // Flag ON behaviour (COMING_SOON === "1"):
    //   - /api/* → 404 (the site is not open; no API surface exposed).
    //   - /coming-soon and /status-map/sprites/* → fall through so the holding
    //     page still receives its CSP nonce and sprites are served normally.
    //   - Every other route → rewrite to /coming-soon (same origin, same host).
    const { pathname } = req.nextUrl
    // Lowercase once for the /api checks so /API/... is also caught (case-insensitive guard).
    // The /coming-soon and /status-map/sprites allowlist checks below stay on the original
    // pathname — our own paths; a weird-cased variant simply rewrites to the page (still safe).
    const lowerPath = pathname.toLowerCase()
    const comingSoon = process.env.COMING_SOON === "1"

    if (comingSoon) {
        if (lowerPath.startsWith("/api")) {
            return new NextResponse(null, { status: 404 })
        }
        // Allow the holding page and its sprite assets through to normal handling
        // so the page still gets the CSP nonce and sprites render correctly.
        if (!pathname.startsWith("/coming-soon") && !pathname.startsWith("/status-map/sprites")) {
            return NextResponse.rewrite(new URL("/coming-soon", req.url))
        }
        // /coming-soon (HTML) and sprites fall through → existing nonce/CSP logic below.
    } else {
        // FLAG OFF — /api/* was previously unmatched by the old matcher exclusion.
        // Now that the matcher includes /api, pass it through immediately so
        // NextAuth's own /api/auth/* and all other API routes are unaffected.
        if (lowerPath.startsWith("/api")) {
            return NextResponse.next()
        }
    }

    // ── 1. Generate a per-request nonce — Edge-safe Web Crypto ──────────────
    // btoa + String.fromCharCode is used intentionally (NOT Buffer) so this
    // works in all runtimes: Edge, Node, browser. (ADR-007 Risk 4.)
    const nonceBytes = new Uint8Array(16)
    crypto.getRandomValues(nonceBytes)
    const nonce = btoa(String.fromCharCode(...nonceBytes))

    // ── 2. Build the CSP string ──────────────────────────────────────────────
    const csp = buildCsp(nonce)

    // ── 3. Authz + ownership — identity from the session, never the body ─────
    // The auth() callback form does NOT auto-invoke authConfig.callbacks.authorized.
    // We delegate to the same isRouteAllowed() helper that authorized() uses,
    // keeping the protection logic in a single authoritative place.
    const { nextUrl, auth: session } = req
    const isLoggedIn = !!session?.user

    if (!isRouteAllowed(nextUrl.pathname, isLoggedIn)) {
        // Redirect unauthenticated user to login.
        // Also set the enforced CSP on the redirect response for header completeness
        // (browsers do not enforce CSP on 302/307 redirect responses, but including
        // it keeps the header behaviour consistent across all matched routes).
        const loginUrl = new URL('/login', req.url)
        const redirectResponse = NextResponse.redirect(loginUrl)
        redirectResponse.headers.set('Content-Security-Policy', csp)
        return redirectResponse
    }

    // ── 4. Pass through — CSP on BOTH request and response (CAM-607) ─────────
    // `x-nonce` stays for any of OUR OWN Server Component code that wants to
    // manually read headers().get('x-nonce') for a <Script nonce> — harmless,
    // doc-recommended convention, but NOT what makes Next.js's own
    // framework-emitted scripts (including the streaming-relocation script)
    // get a nonce. That requires the enforced Content-Security-Policy header
    // on the REQUEST itself (see the file-level CAM-607 comment for the exact
    // mechanism, read from Next.js's own installed source).
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('Content-Security-Policy', csp)

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    // Enforced CSP (CAM-203 step 2): the strict nonce policy now BLOCKS inline-XSS.
    // Verified on Staging — no app violations (the only report was the Vercel dev
    // toolbar at vercel.live, which is staging-only and intentionally not allow-listed).
    response.headers.set('Content-Security-Policy', csp)

    return response
})

export const config = {
    // https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
    // CAM-237 LAUNCH-1: removed the `api|` exclusion so /api routes now reach
    // the middleware. Flag OFF: /api/* is passed through immediately (byte-identical
    // to the previous matcher-excluded behaviour). Flag ON: /api/* → 404.
    //
    // CAM-240 B1 — /api/auth MUST be excluded from the matcher.
    // Wrapping NextAuth's own routes (/api/auth/session, /api/auth/signout,
    // /api/auth/csrf, /api/auth/callback/*) with the auth() middleware is a
    // known NextAuth v5 anti-pattern: SessionProvider's polling of /api/auth/session
    // becomes slow, signin/signout flows are interfered with, and the session does
    // not end cleanly after logout.
    //
    // The fix adds `api/auth` to the negative-lookahead so those routes bypass
    // the middleware entirely — NextAuth handles them natively.
    //
    // /api/campsites etc. are still matched (no `api|` exclusion reinstated):
    //   Flag ON:  non-auth /api/* → 404 (COMING_SOON gate intact).
    //   Flag OFF: non-auth /api/* → NextResponse.next() pass-through.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|api/auth).*)'],
}
