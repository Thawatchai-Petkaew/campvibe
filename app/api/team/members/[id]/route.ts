import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

const UpdateMemberSchema = z.object({
  role: z.enum(['VIEWER', 'STAFF', 'MANAGER', 'ADMIN']).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// PATCH: Update member role/permissions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await request.json();
    const validation = UpdateMemberSchema.safeParse(body);

    if (!validation.success) {
      return apiError('Invalid input', 400, validation.error);
    }

    const data = validation.data;

    // Get member to check permissions
    const member = await prisma.campSiteTeamMember.findUnique({
      where: { id },
      include: {
        campSite: {
          select: { operatorId: true }
        }
      }
    });

    if (!member) {
      return apiError('Team member not found', 404);
    }

    // Check permission (only owner can update for now)
    if (member.campSite.operatorId !== session!.user!.id) {
      return apiError('Forbidden: You don\'t have permission to update team members', 403);
    }

    // Cannot change owner's role
    if (member.role === 'OWNER') {
      return apiError('Cannot change owner\'s role', 400);
    }

    // Update member
    const updated = await prisma.campSiteTeamMember.update({
      where: { id },
      data: {
        ...(data.role && { role: data.role }),
        ...(data.permissions && { permissions: data.permissions }), // Store as string array
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true
          }
        }
      }
    });

    return apiSuccess(updated);
  } catch (error) {
    return apiError('Failed to update team member', 500, error);
  }
}

// DELETE: Remove member from team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { id } = await params;

  try {
    // Get member to check permissions
    const member = await prisma.campSiteTeamMember.findUnique({
      where: { id },
      include: {
        campSite: {
          select: { operatorId: true }
        }
      }
    });

    if (!member) {
      return apiError('Team member not found', 404);
    }

    // Check permission (only owner can remove for now)
    if (member.campSite.operatorId !== session!.user!.id) {
      return apiError('Forbidden: You don\'t have permission to remove team members', 403);
    }

    // Cannot remove owner
    if (member.role === 'OWNER') {
      return apiError('Cannot remove owner', 400);
    }

    // Soft delete (set isActive to false)
    await prisma.campSiteTeamMember.update({
      where: { id },
      data: { isActive: false }
    });

    // Or hard delete:
    // await prisma.campSiteTeamMember.delete({ where: { id } });

    return apiSuccess({ message: 'Team member removed successfully' });
  } catch (error) {
    return apiError('Failed to remove team member', 500, error);
  }
}
