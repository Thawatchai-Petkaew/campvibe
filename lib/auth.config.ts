import type { NextAuthConfig } from "next-auth"

/**
 * Edge-safe NextAuth config — NO prisma, NO bcrypt, NO Node-only imports.
 *
 * This file is intentionally kept free of any transitive import of lib/prisma
 * so it can be safely bundled into the Next.js Edge middleware runtime.
 *
 * Node-only parts (Credentials provider, jwt + session callbacks that touch
 * prisma) live exclusively in lib/auth.ts and are never imported by middleware.
 */

/**
 * Pure, Edge-safe route protection helper.
 *
 * Captures the exact protection rule from authConfig.callbacks.authorized:
 *   - /dashboard/* requires a logged-in user
 *   - all other routes are public
 *
 * Used by both the middleware callback form (SEC-3 nonce middleware) and
 * authConfig.callbacks.authorized so the rule stays in one place.
 *
 * CAM-203 SEC-3: extracted here so middleware can call it directly when using
 * the auth() callback form (which does NOT auto-invoke authorized).
 */
export function isRouteAllowed(pathname: string, isLoggedIn: boolean): boolean {
    const isOnDashboard = pathname.startsWith('/dashboard');
    if (isOnDashboard) {
        return isLoggedIn;
    }
    return true;
}

export const authConfig = {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: '/login',
    },
    providers: [],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            return isRouteAllowed(nextUrl.pathname, isLoggedIn);
        },
    },
} satisfies NextAuthConfig
