import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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
                    });

                    if (!user) return null;
                    if (!user.password) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (passwordsMatch) return user;
                }

                return null;
            },
        }),
    ],
    pages: {
        signIn: '/login',
    },
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
        async jwt({ token, user, trigger }) {
            // On sign in, add user data to token
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.image = user.image;
                token.name = user.name;
            }
            // On session update (e.g., after profile change), refresh user data
            if (trigger === "update") {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { image: true, name: true, email: true }
                });
                if (dbUser) {
                    token.image = dbUser.image;
                    token.name = dbUser.name;
                    token.email = dbUser.email;
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
            }
            return session;
        }
    }
})
