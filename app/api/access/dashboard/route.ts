import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const userId = session?.user?.id;
  if (!userId) return apiError("Unauthorized", 401);

  try {
    const [ownedCount, teamCount, user] = await Promise.all([
      prisma.campSite.count({ where: { operatorId: userId } }),
      prisma.campSiteTeamMember.count({ where: { userId, isActive: true } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
    ]);

    const isAdmin = user?.role === "ADMIN";
    const canAccessDashboard = isAdmin || ownedCount > 0 || teamCount > 0;

    const reason = canAccessDashboard
      ? "ALLOWED"
      : "NO_HOST_ACCESS"; // no camp site & no team role yet

    return apiSuccess({
      canAccessDashboard,
      reason,
      ownedCampSites: ownedCount,
      teamMemberships: teamCount,
      role: user?.role || "CAMPER",
    });
  } catch (error) {
    return apiError("Failed to check dashboard access", 500, error as object);
  }
}

