import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { apiError, apiSuccess } from "@/lib/api-utils";

// GET: List pending invitations for the current user
export async function GET(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const userId = session!.user!.id!;

    const invites = await prisma.campSiteTeamMember.findMany({
      where: {
        userId,
        isActive: true,
        acceptedAt: null,
      },
      include: {
        campSite: {
          select: {
            id: true,
            nameTh: true,
            nameEn: true,
            operator: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { invitedAt: "desc" },
    });

    return apiSuccess(invites);
  } catch (error) {
    return apiError("Failed to fetch invitations", 500, error as object);
  }
}

