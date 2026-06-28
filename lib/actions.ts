'use server';

import { signIn } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
});

export async function register(prevState: string | undefined, formData: FormData) {
    const validatedFields = RegisterSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
        name: formData.get('name'),
    });

    if (!validatedFields.success) {
        return 'Invalid fields. Please verify your input.';
    }

    const { email, password, name } = validatedFields.data;

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return 'User already exists.';
        }

        // RISK-1: bcrypt cost raised to 12 (security standard ≥12 rounds).
        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'CAMPER',
            },
        });

    } catch (error) {
        return 'Failed to create user.';
    }

    // Return undefined on success (no redirect)
    return undefined;
}

/**
 * googleSignIn — initiates Google OAuth sign-in (ADR-008).
 *
 * Open-redirect guard (SEC-A, CWE-601):
 *   - redirectTo must start with a single "/"
 *   - rejects "//" (protocol-relative) and "/\" (backslash trick)
 *   - rejects any control char (charCode < 0x20)
 *   - falls back to "/" when invalid or missing
 *
 * Throws a Next.js NEXT_REDIRECT internally on success (signIn redirects);
 * callers must NOT catch this throw — let it propagate so Next.js completes
 * the redirect.
 */
export async function googleSignIn(redirectTo?: string) {
    const isSafeInternalPath =
        typeof redirectTo === "string" &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//") &&
        !redirectTo.startsWith("/\\") &&
        ![...redirectTo].some((ch) => ch.charCodeAt(0) < 0x20);

    await signIn("google", {
        redirectTo: isSafeInternalPath ? redirectTo : "/",
    });
}
