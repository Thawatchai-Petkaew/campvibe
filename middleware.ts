import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

/**
 * Edge-safe middleware — imports only auth.config (no prisma, no Node-only deps).
 * Fixing CAM-191: the previous import of @/lib/auth pulled PrismaClient into the
 * Edge bundle, crashing every page route with MIDDLEWARE_INVOCATION_FAILED.
 */
export default NextAuth(authConfig).auth

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
