import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

// Validation schema
const AddMemberSchema = z.object({
  campSiteId: z.string().uuid(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['VIEWER', 'STAFF', 'MANAGER', 'ADMIN']),
  permissions: z.array(z.string()).optional().default([]),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone must be provided"
});

// GET: List team members for a camp site
export async function GET(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const campSiteId = searchParams.get('campSiteId');

  if (!campSiteId) {
    return apiError('campSiteId is required', 400);
  }

  try {
    console.log('🔍 [GET /api/team/members]');
    console.log('   campSiteId:', campSiteId);
    console.log('   user:', session!.user!.email);

    // Check if user has permission to view team
    const campSite = await prisma.campSite.findUnique({
      where: { id: campSiteId },
      select: { operatorId: true }
    });

    if (!campSite) {
      console.log('❌ Camp site not found');
      return apiError('Camp site not found', 404);
    }

    console.log('   campSite.operatorId:', campSite.operatorId);

    // Only owner can view team for now (will add permission check later)
    if (campSite.operatorId !== session!.user!.id) {
      console.log('❌ Permission denied');
      return apiError('Forbidden: You don\'t have permission to view team members', 403);
    }

    console.log('✅ Fetching team members...');

    // Get team members (including OWNER)
    const members = await prisma.campSiteTeamMember.findMany({
      where: {
        campSiteId,
        isActive: true
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
      },
      orderBy: [
        { role: 'asc' }, // OWNER first (alphabetically)
        { createdAt: 'desc' }
      ]
    });

    // Parse permissions from string[] to avoid JSON parse issues
    const formattedMembers = members.map(member => ({
      ...member,
      // permissions is already a string[] from Prisma, no need to parse
    }));

    console.log(`✅ Found ${members.length} members`);

    return apiSuccess(formattedMembers);
  } catch (error) {
    console.error('❌ [GET /api/team/members] Error:', error);
    return apiError('Failed to fetch team members', 500, error);
  }
}

// POST: Add team member
export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const validation = AddMemberSchema.safeParse(body);

    if (!validation.success) {
      return apiError('Invalid input', 400, validation.error);
    }

    const { campSiteId, email, phone, role, permissions } = validation.data;

    // Check if user has permission to add members
    const campSite = await prisma.campSite.findUnique({
      where: { id: campSiteId },
      select: { operatorId: true }
    });

    if (!campSite) {
      return apiError('Camp site not found', 404);
    }

    // Only owner can add members for now
    if (campSite.operatorId !== session!.user!.id) {
      return apiError('Forbidden: You don\'t have permission to add team members', 403);
    }

    // Find user by email or phone
    const targetUser = await prisma.user.findFirst({
      where: email ? { email } : { phone }
    });

    if (!targetUser) {
      return apiError('User not found. Please ask them to register first.', 404);
    }

    // Check if already a member
    const existing = await prisma.campSiteTeamMember.findUnique({
      where: {
        userId_campSiteId: {
          userId: targetUser.id,
          campSiteId
        }
      }
    });

    if (existing) {
      return apiError('User is already a team member', 400);
    }

    // Add member
    const member = await prisma.campSiteTeamMember.create({
      data: {
        userId: targetUser.id,
        campSiteId,
        role,
        permissions: permissions, // Store as string array directly
        invitedBy: session!.user!.id
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

    return apiSuccess(member, 201);
  } catch (error) {
    return apiError('Failed to add team member', 500, error);
  }
}
