import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import CampgroundDetailClient from "@/components/CampgroundDetailClient";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTranslations } from "@/locales/translations";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function CampgroundPage({ params }: { params: Promise<{ slug: string }> }) {
    const session = await auth();
    const { slug } = await params;

    let campground;
    try {
        campground = await prisma.campground.findFirst({
            where: {
                OR: [
                    { nameThSlug: slug },
                    { nameEnSlug: slug }
                ]
            },
            include: {
                location: true,
                operator: true,
                sites: true,
            }
        });
    } catch (error) {
        console.error("Database connection error:", error);
        notFound();
    }

    if (!campground) {
        notFound();
    }

    const t = getTranslations('th'); // Default to Thai for SSR or detect from cookies

    const isOwner = session?.user?.email === campground.operator.email;

    return (
        <main className="min-h-screen bg-white">
            <Navbar currentUser={session?.user} />
            <CampgroundDetailClient campground={campground} isOwner={isOwner} />
        </main>
    );
}
