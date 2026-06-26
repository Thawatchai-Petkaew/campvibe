import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import type { UserRole } from "@/types/api"
import { authConfig } from "@/lib/auth.config"

/**
 * Full NextAuth config — Node runtime only.
 * Spreads the Edge-safe authConfig (pages + authorized callback) and adds the
 * Node-only parts: Credentials provider (bcrypt + prisma), jwt callback
 * (prisma refresh on trigger==='update'), and session callback.
 *
 * Exported symbols (handlers, auth, signIn, signOut) are used throughout the
 * app in API routes and server actions; they must never be imported by
 * middleware.ts (use lib/auth.config.ts there instead).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
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
        async jwt({ token, user, trigger }) {
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
