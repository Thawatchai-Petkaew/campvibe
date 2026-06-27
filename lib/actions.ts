'use server';

import { signIn, signOut } from '@/lib/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { redirect } from 'next/navigation';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }

    // SEC-A: open-redirect fix (CWE-601).
    // Accept only a same-origin path: must start with a single "/", must NOT
    // start with "//" (protocol-relative) or "/\" (backslash trick), and must
    // contain no control chars (e.g. a "/\t//evil.com" prefix some parsers could
    // authority-resolve). Anything else falls back to "/".
    const rawRedirect = formData.get("redirectTo");
    const isSafeInternalPath =
        typeof rawRedirect === "string" &&
        rawRedirect.startsWith("/") &&
        !rawRedirect.startsWith("//") &&
        !rawRedirect.startsWith("/\\") &&
        ![...rawRedirect].some((ch) => ch.charCodeAt(0) < 0x20);
    redirect(isSafeInternalPath ? (rawRedirect as string) : "/");
}

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

export async function handleSignOut() {
    await signOut();
}
