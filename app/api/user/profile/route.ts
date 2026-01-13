import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateProfileSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
});

// GET: Fetch current user profile
export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                role: true,
                createdAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Profile fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

// PATCH: Update user profile
export async function PATCH(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validatedFields = UpdateProfileSchema.safeParse(body);

        if (!validatedFields.success) {
            return NextResponse.json(
                { error: "Invalid fields", details: validatedFields.error.flatten() },
                { status: 400 }
            );
        }

        const { name, email, phone, image } = validatedFields.data;

        // Check if email is being changed and if it's already taken
        if (email && email !== session.user.email) {
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });
            if (existingUser) {
                return NextResponse.json({ error: "Email already in use" }, { status: 409 });
            }
        }

        const updatedUser = await prisma.user.update({
            where: { email: session.user.email },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone !== undefined && { phone }),
                ...(image !== undefined && { image }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                role: true,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Profile update error:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
