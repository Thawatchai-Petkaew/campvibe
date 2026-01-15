import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  image: z.string().url().optional().nullable().or(z.literal('')),
});

// GET: Fetch current user profile
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    
    const session = authResult.session;
    
    if (!session?.user?.email) {
      return apiError('User email not found', 400);
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
      return apiError("User not found", 404);
    }

    return apiSuccess(user);
  } catch (error) {
    return apiError("Failed to fetch profile", 500, error);
  }
}

// PATCH: Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    
    const session = authResult.session;
    
    if (!session?.user?.email) {
      return apiError('User email not found', 400);
    }

    const body = await request.json();
    const validatedFields = UpdateProfileSchema.safeParse(body);

    if (!validatedFields.success) {
      return apiError("Invalid fields", 400, validatedFields.error.flatten());
    }

    const { name, email, phone, image } = validatedFields.data;

    // Check if email is being changed and if it's already taken
    if (email && email !== session.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        return apiError("Email already in use", 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(image !== undefined && { image: image || null }),
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

    return apiSuccess(updatedUser);
  } catch (error) {
    return apiError("Failed to update profile", 500, error);
  }
}
