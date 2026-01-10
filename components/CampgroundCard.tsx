import Link from "next/link";
import { Star, Heart } from "lucide-react";
import { Campground } from "@prisma/client";

interface CampgroundCardProps {
    campground: Campground & { location: { province: string } };
}

export function CampgroundCard({ campground }: CampgroundCardProps) {
    const imageUrls = campground.images ? campground.images.split(',') : [];
    const coverImage = imageUrls.length > 0
        ? imageUrls[0]
        : "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80&w=800";

    return (
        <Link href={`/campgrounds/${campground.nameThSlug}`} className="group block space-y-3 cursor-pointer">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-200">
                <img
                    src={coverImage}
                    alt={campground.nameTh}
                    className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                />
                <button className="absolute top-3 right-3 p-2 rounded-full hover:bg-black/10 hover:scale-110 transition">
                    <Heart className="w-6 h-6 text-white/80 fill-black/20" />
                </button>
            </div>

            <div className="space-y-1">
                <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-900 truncate pr-4">{campground.nameTh}</h3>
                    <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-black text-black" />
                        <span className="text-sm">4.8</span>
                    </div>
                </div>
                <p className="text-gray-500 text-sm">{campground.location.province}, Thailand</p>
                <p className="text-gray-500 text-sm">
                    Added 2 weeks ago
                </p>
                <div className="flex items-baseline gap-1 pt-1">
                    <span className="font-semibold">{campground.priceLow ? `$${campground.priceLow}` : 'Free'}</span>
                    <span className="text-gray-900">night</span>
                </div>
            </div>
        </Link>
    );
}
