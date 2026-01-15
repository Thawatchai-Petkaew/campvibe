import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { z } from "zod";

const InvitationActionSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = InvitationActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.format() as unknown as object);
    }

    const invite = await prisma.campSiteTeamMember.findUnique({
      where: { id },
      include: {
        campSite: {
          select: { id: true, operatorId: true, nameTh: true, nameEn: true },
        },
      },
    });

    if (!invite) return apiError("Invitation not found", 404);

    const userId = session!.user!.id!;
    if (invite.userId !== userId) {
      return apiError("Forbidden", 403);
    }

    if (!invite.isActive) {
      return apiError("Invitation is no longer active", 400);
    }

    if (parsed.data.action === "ACCEPT") {
      const updated = await prisma.campSiteTeamMember.update({
        where: { id },
        data: { acceptedAt: new Date(), isActive: true },
      });
      return apiSuccess(updated);
    }

    // DECLINE (soft delete)
    const updated = await prisma.campSiteTeamMember.update({
      where: { id },
      data: { isActive: false },
    });
    return apiSuccess(updated);
  } catch (error) {
    return apiError("Failed to update invitation", 500, error as object);
  }
}

