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
 *   2. Set the nonce on the request header `x-nonce` for Next.js to stamp
 *      onto every SSR-generated <script> tag
 *   3. Set the enforced Content-Security-Policy on the response (CAM-203 step 2 —
 *      browser reports violations but does NOT block scripts; Step 2 flips
 *      to Content-Security-Policy after owner confirms no violations)
 *   4. Replicate /dashboard protection explicitly (auth() callback form does
 *      NOT auto-invoke authConfig.callbacks.authorized)
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
 * All other directives are identical to the SEC-2 static CSP.
 */
function buildCsp(nonce: string): string {
    // React/Next.js Turbopack needs 'unsafe-eval' in dev (fast refresh). DEV-ONLY.
    // process.env.NODE_ENV is inlined by Next.js at build time — Edge-safe.
    const scriptSrc = `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`
    return [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org https://*.googleusercontent.com",
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

    // ── 4. Pass through — inject nonce on request + CSP-RO on response ───────
    // `x-nonce` on the request is consumed by Next.js App Router (15/16) to
    // stamp nonce="..." onto all SSR-generated <script> tags during rendering.
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-nonce', nonce)

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
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
