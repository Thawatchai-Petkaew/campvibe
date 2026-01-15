import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { apiError } from './api-utils';
import type { Session } from 'next-auth';
import type { PermissionCode, TeamRole } from '@/lib/team-permissions';
import { getEffectivePermissions, hasPermission } from '@/lib/team-permissions';

type AuthResult = 
  | { error: NextResponse; session: null }
  | { error: null; session: Session };

type CampSiteOwnershipResult = 
  | { error: NextResponse; campSite: null; session: null }
  | { error: null; campSite: NonNullable<Awaited<ReturnType<typeof import('@/lib/prisma').prisma.campSite.findUnique>>>; session: Session };

/**
 * Get authenticated session or return error response
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { error: apiError('Unauthorized', 401), session: null };
  }
  
  return { error: null, session };
}

/**
 * Check if user is operator of a camp site
 */
export async function requireCampSiteOwnership(campSiteId: string): Promise<CampSiteOwnershipResult> {
  const { prisma } = await import('@/lib/prisma');
  const authResult = await requireAuth();
  
  if (authResult.error) {
    return { error: authResult.error, campSite: null, session: null };
  }
  
  const campSite = await prisma.campSite.findUnique({
    where: { id: campSiteId },
    include: { operator: true }
  });
  
  if (!campSite) {
    return { error: apiError('Camp site not found', 404), campSite: null, session: null };
  }
  
  if (campSite.operator.email !== authResult.session.user!.email) {
    return { error: apiError('Forbidden', 403), campSite: null, session: null };
  }
  
  return { error: null, campSite, session: authResult.session };
}

/**
 * Check if user has a specific permission for a camp site:
 * - Platform ADMIN always allowed
 * - Camp site operator (owner) always allowed
 * - Camp site team member with effective permissions containing the required permission
 */
export async function requireCampSitePermission(
  campSiteId: string,
  required: PermissionCode
): Promise<CampSiteOwnershipResult> {
  const { prisma } = await import('@/lib/prisma');
  const authResult = await requireAuth();

  if (authResult.error) {
    return { error: authResult.error, campSite: null, session: null };
  }

  const session = authResult.session;
  const userId = session.user?.id;
  if (!userId) {
    return { error: apiError('Unauthorized', 401), campSite: null, session: null };
  }

  const campSite = await prisma.campSite.findUnique({
    where: { id: campSiteId },
    include: { operator: true },
  });

  if (!campSite) {
    return { error: apiError('Camp site not found', 404), campSite: null, session: null };
  }

  const isPlatformAdmin = (session.user as any)?.role === 'ADMIN';
  if (isPlatformAdmin) {
    return { error: null, campSite, session };
  }

  if (campSite.operatorId === userId) {
    return { error: null, campSite, session };
  }

  const member = await prisma.campSiteTeamMember.findFirst({
    where: { userId, campSiteId, isActive: true },
    select: { role: true, permissions: true },
  });

  if (!member) {
    return { error: apiError('Forbidden', 403), campSite: null, session: null };
  }

  const eff = getEffectivePermissions({
    role: member.role as TeamRole,
    permissions: member.permissions,
  });

  if (!hasPermission(eff, required)) {
    return { error: apiError('Forbidden', 403), campSite: null, session: null };
  }

  return { error: null, campSite, session };
}
