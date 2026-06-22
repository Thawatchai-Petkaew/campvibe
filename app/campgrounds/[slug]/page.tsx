import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import CampgroundDetailClient from "@/components/CampgroundDetailClient";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTranslations } from "@/locales/translations";
import { serializeDecimals } from "@/lib/serialize";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function CampgroundPage({ params }: { params: Promise<{ slug: string }> }) {
    const session = await auth();
    const { slug } = await params;

    let campSite;
    try {
        campSite = await prisma.campSite.findFirst({
            where: {
                OR: [
                    { nameThSlug: slug },
                    { nameEnSlug: slug }
                ]
            },
            include: {
                location: true,
                operator: true,
                spots: true,
                options: true,
                images: { orderBy: { sortOrder: 'asc' } },
            }
        });
    } catch (error) {
        console.error("Database connection error:", error);
        notFound();
    }

    if (!campSite) {
        notFound();
    }

    const t = getTranslations('th'); // Default to Thai for SSR or detect from cookies

    const isOwner = session?.user?.email === campSite.operator.email;

    // AC-2, BR-3: resolve initial saved state server-side (no flash on load).
    let initialSaved = false;
    if (session?.user?.id) {
        try {
            const w = await prisma.wishlist.findUnique({
                where: { userId_campSiteId: { userId: session.user.id, campSiteId: campSite.id } },
                select: { id: true },
            });
            initialSaved = !!w;
        } catch {
            // Non-fatal — default false keeps the UI functional.
        }
    }

    return (
        <main className="min-h-screen bg-background">
            <Navbar currentUser={session?.user} />
            <CampgroundDetailClient
                campground={serializeDecimals(campSite)}
                isOwner={isOwner}
                initialSaved={initialSaved}
                isLoggedIn={!!session?.user}
            />
        </main>
    );
}
