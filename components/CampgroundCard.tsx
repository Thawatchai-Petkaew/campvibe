"use client";

import Link from "next/link";
import { useState } from "react";
import { Star, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Campground } from "@prisma/client";

interface CampgroundCardProps {
    campground: Campground & { location: { province: string } };
}

export function CampgroundCard({ campground }: CampgroundCardProps) {
    const { t, formatCurrency, language } = useLanguage();
    const [currentIndex, setCurrentIndex] = useState(0);
    const imageUrls = campground.images ? campground.images.split(',') : [
        "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80&w=800"
    ];

    const nextImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
    };

    const name = language === 'en' ? (campground.nameEn || campground.nameTh) : campground.nameTh;
    const slug = language === 'en' ? (campground.nameEnSlug || campground.nameThSlug) : campground.nameThSlug;

    return (
        <Link href={`/campgrounds/${slug}`} className="group block space-y-3 cursor-pointer">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-200">
                {/* Image Slider */}
                <div className="relative w-full h-full">
                    <img
                        src={imageUrls[currentIndex]}
                        alt={name}
                        className="object-cover w-full h-full group-hover:scale-105 transition duration-500 ease-out"
                    />

                    {/* Navigation Arrows (visible on hover) */}
                    {imageUrls.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-800" />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <ChevronRight className="w-4 h-4 text-gray-800" />
                            </button>
                        </>
                    )}

                    {/* Dot Indicators */}
                    {imageUrls.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {imageUrls.slice(0, 5).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-110' : 'bg-white/60'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <button className="absolute top-3 right-3 p-2 rounded-full hover:bg-black/10 transition z-10">
                    <Heart className="w-6 h-6 text-white/80 stroke-[1.5px] fill-black/20" />
                </button>
            </div>

            <div className="space-y-1">
                <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-900 truncate pr-4">{name}</h3>
                    <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-black text-black" />
                        <span className="text-sm">4.8</span>
                    </div>
                </div>
                <p className="text-gray-500 text-sm">{campground.location.province}, Thailand</p>
                <p className="text-gray-500 text-sm">
                    {t.common.newListing}
                </p>
                <div className="flex items-baseline gap-1 pt-1">
                    <span className="font-semibold">{campground.priceLow ? formatCurrency(campground.priceLow) : t.common.free}</span>
                    <span className="text-gray-900">{t.common.night}</span>
                </div>
            </div>
        </Link>
    );
}
