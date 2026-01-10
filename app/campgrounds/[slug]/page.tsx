import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import CampgroundDetailClient from "@/components/CampgroundDetailClient";
import { notFound } from "next/navigation";
import { getTranslations } from "@/locales/translations";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function CampgroundDetailPage({ params }: PageProps) {
    const { slug } = await params;

    const campground = await prisma.campground.findUnique({
        where: { nameThSlug: slug },
        include: {
            location: true,
            operator: true,
            sites: true,
        }
    });

    if (!campground) {
        notFound();
    }

    const t = getTranslations('th'); // Default to Thai for SSR or detect from cookies

    return (
        <main className="min-h-screen pb-20">
            <Navbar />
            <CampgroundDetailClient campground={campground} t={t} />
        </main>
    );
}
