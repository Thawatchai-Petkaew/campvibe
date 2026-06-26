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
export const authConfig = {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: '/login',
    },
    providers: [],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            }
            return true;
        },
    },
} satisfies NextAuthConfig
