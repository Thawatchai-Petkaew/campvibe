import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import type { UserRole } from "@/types/api"
import { authConfig } from "@/lib/auth.config"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * Full NextAuth config — Node runtime only.
 * Spreads the Edge-safe authConfig (pages + authorized callback) and adds the
 * Node-only parts: Credentials provider (bcrypt + prisma), jwt callback
 * (prisma refresh on trigger==='update'), and session callback.
 *
 * Exported symbols (handlers, auth, signIn, signOut) are used throughout the
 * app in API routes and server actions; they must never be imported by
 * middleware.ts (use lib/auth.config.ts there instead).
 *
 * ADR-008: GoogleProvider is included conditionally — only when both
 * AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set — so `npm run build` passes in
 * CI/local where the secrets are absent. Once the env vars are configured in
 * Vercel the provider activates automatically.
 */
const hasGoogle =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        ...(hasGoogle
            ? [
                  Google({
                      clientId: process.env.AUTH_GOOGLE_ID,
                      clientSecret: process.env.AUTH_GOOGLE_SECRET,
                      // ADR-008: link-by-email — an existing Credentials account at the
                      // same email is linked transparently. Google verifies email
                      // ownership before issuing the token; this is the accepted trust
                      // boundary for this product.
                      allowDangerousEmailAccountLinking: true,
                  }),
              ]
            : []),
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials, request) => {
                // RISK-1: Rate-limit login attempts by IP (10 req / 15 min).
                // NextAuth authorize cannot return an HTTP 429 directly; returning null
                // surfaces as a CredentialsSignin error on the sign-in page, which is the
                // safest contract-preserving option (does not break NextAuth callbacks).
                const ip =
                    (request as Request | undefined)?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
                    "unknown";
                const rl = checkRateLimit(`auth:login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
                if (!rl.allowed) {
                    return null;
                }

                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;

                    const user = await prisma.user.findUnique({
                        where: { email },
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            image: true,
                            password: true,
                            role: true,
                        },
                    });

                    if (!user) return null;
                    if (!user.password) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (passwordsMatch) {
                        return {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            image: user.image,
                            role: user.role as UserRole,
                        };
                    }
                }

                return null;
            },
        }),
    ],
    callbacks: {
        // Keep the authorized callback from authConfig (dashboard gate)
        ...authConfig.callbacks,
        async jwt({ token, user, account, profile, trigger }) {
            // ── Google sign-in path (ADR-008 Approach A — JWT-only upsert) ──────────
            // On a Google sign-in, upsert the User by email.  This runs on the first
            // sign-in and on every subsequent Google sign-in (idempotent).
            // PII note: email/name/image come from a verified Google token; they are
            // used only for the DB upsert and the in-memory token — never logged.
            //
            // email_verified guard: only proceed when Google has verified ownership of
            // the email address (defense-in-depth for allowDangerousEmailAccountLinking).
            // Google's OIDC reliably sets email_verified=true for standard accounts; an
            // unverified email falls through to return the unmodified token (no upsert).
            if (
                account?.provider === "google" &&
                profile?.email &&
                profile?.email_verified === true
            ) {
                // Determine whether this is a new user (for the audit log) by checking
                // if a row already exists before the upsert runs.
                const existingUser = await prisma.user.findUnique({
                    where: { email: profile.email },
                    select: { id: true },
                });
                const isNew = existingUser === null;

                const dbUser = await prisma.user.upsert({
                    where: { email: profile.email },
                    create: {
                        email: profile.email,
                        name: (profile.name as string | null | undefined) ?? null,
                        image: (profile.picture as string | null | undefined) ?? null,
                        role: "CAMPER",
                        // password stays null — Google users can't password-login (correct)
                    },
                    update: {
                        // Existing Credentials users keep their data on link;
                        // Google-only users get name/image refreshed on each sign-in.
                        name: (profile.name as string | null | undefined) ?? undefined,
                        image: (profile.picture as string | null | undefined) ?? undefined,
                    },
                    select: { id: true, email: true, name: true, image: true, role: true },
                });

                // Audit log — structured, server-side only, no PII.
                // userId is an opaque DB id (not PII); email/name/image are NOT logged.
                console.info({
                    event: "google_user_linked",
                    userId: dbUser.id,
                    isNew,
                });

                token.id = dbUser.id;
                token.sub = dbUser.id;
                token.email = dbUser.email;
                token.name = dbUser.name;
                token.image = dbUser.image;
                token.role = dbUser.role as UserRole;
                return token;
            }

            // ── Credentials sign-in path (unchanged) ─────────────────────────────────
            // On sign in, add user data to token
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.image = user.image;
                token.name = user.name;
                token.role = user.role;
            }
            // On session update (e.g., after profile change), refresh user data
            if (trigger === "update") {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { image: true, name: true, email: true, role: true }
                });
                if (dbUser) {
                    token.image = dbUser.image;
                    token.name = dbUser.name;
                    token.email = dbUser.email;
                    token.role = dbUser.role as UserRole;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                session.user.email = token.email as string;
                session.user.image = token.image as string | null;
                session.user.name = token.name as string | null;
                session.user.role = token.role as UserRole;
            }
            return session;
        }
    }
})
