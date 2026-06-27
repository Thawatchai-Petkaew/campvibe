import NextAuth from "next-auth"
import { authConfig, isRouteAllowed } from "@/lib/auth.config"
import { NextResponse } from "next/server"

/**
 * CAM-203 SEC-3 — Strict nonce-based CSP, Step 1 (Report-Only).
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
 * style-src: keeps 'unsafe-inline' — /status and /status/map inject CSS via
 * <style dangerouslySetInnerHTML>. Style XSS risk << script XSS. Nonce-ing
 * styles would require threading the nonce through multiple Server Components
 * for minimal benefit. Standard Next.js recommendation.
 *
 * All other directives are identical to the SEC-2 static CSP.
 */
function buildCsp(nonce: string): string {
    return [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org",
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
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
