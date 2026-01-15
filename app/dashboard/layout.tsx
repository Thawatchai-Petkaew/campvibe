import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardLayoutClient } from "./layout-client";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    
    if (!session?.user?.id) {
        // If user tries to access dashboard, require login.
        redirect("/login?callbackUrl=/dashboard");
    }

    // Fetch user with role
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            isHostRegistered: true,
        },
    });

    if (!user) {
        redirect("/");
    }

    // Access rule:
    // - Admin always allowed
    // - Allowed if user OWNS at least 1 camp site OR has a team role for any camp site (invited/accepted)
    // - Otherwise keep user in Camper journey and show Host onboarding CTA
    const isAdmin = user.role === "ADMIN";
    const [ownedCount, hasTeamAccess] = await Promise.all([
        prisma.campSite.count({ where: { operatorId: user.id } }),
        prisma.campSiteTeamMember.findFirst({
        where: { userId: user.id, isActive: true },
        select: { id: true },
        }),
    ]);

    if (!isAdmin && ownedCount === 0 && !hasTeamAccess) {
        redirect("/host");
    }

    return (
        <DashboardLayoutClient 
            user={{
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
            }}
        >
            {children}
        </DashboardLayoutClient>
    );
}
