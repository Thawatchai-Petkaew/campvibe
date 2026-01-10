"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ImageGallery } from "@/components/ImageGallery";
import { AmenitiesModal } from "@/components/AmenitiesModal";

const DynamicMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded-xl" />
});
import {
    Share,
    Heart,
    MapPin,
    Star,
    ShieldCheck,
    Tent,
    Wifi,
    Car,
    ShowerHead,
    Utensils
} from "lucide-react";

interface CampgroundDetailClientProps {
    campground: any;
    t: any;
}

export default function CampgroundDetailClient({ campground, t }: CampgroundDetailClientProps) {
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryStartIndex, setGalleryStartIndex] = useState(0);
    const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);

    // Parse images from CSV
    const images = campground.images
        ? campground.images.split(',')
        : ["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=1200"];

    const displayImages = images.slice(0, 5);

    const openGallery = (index: number = 0) => {
        setGalleryStartIndex(index);
        setIsGalleryOpen(true);
    };

    return (
        <>
            <div className="container mx-auto px-6 pt-6">
                {/* Header - Title & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4 md:gap-0">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900 mb-2">
                            {campground.nameTh}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 underline cursor-pointer">
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 fill-black text-black" />
                                <span className="font-semibold text-black">4.8</span>
                                <span>(12 reviews)</span>
                            </div>
                            <span className="hidden sm:inline">·</span>
                            <span className="font-semibold">{campground.location.province}, Thailand</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                        <button className="flex items-center gap-2 text-sm font-medium hover:bg-gray-100 px-3 py-2 rounded-lg transition underline">
                            <Share className="w-4 h-4" /> <span>Share</span>
                        </button>
                        <button className="flex items-center gap-2 text-sm font-medium hover:bg-gray-100 px-3 py-2 rounded-lg transition underline">
                            <Heart className="w-4 h-4" /> <span>Save</span>
                        </button>
                    </div>
                </div>

                {/* Hero Grid - Responsive Layout */}
                <div className="relative rounded-2xl overflow-hidden mb-10 group">
                    {/* Mobile View: Single Hero Image */}
                    <div className="md:hidden h-[300px] w-full relative">
                        <img
                            src={images[0]}
                            alt="hero-mobile"
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => openGallery(0)}
                        />
                        <div className="absolute top-4 right-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                            1 / {images.length}
                        </div>
                        <button
                            onClick={() => openGallery(0)}
                            className="absolute bottom-4 right-4 bg-white/90 text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-900 shadow-sm"
                        >
                            All photos
                        </button>
                    </div>

                    {/* Desktop View: Airbnb Style Grid */}
                    <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[480px]">
                        <div className="col-span-2 row-span-2 relative">
                            <img
                                src={images[0]}
                                alt="main"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(0)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[1]}
                                alt="sub 1"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(1)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[2]}
                                alt="sub 2"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(2)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[3]}
                                alt="sub 3"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(3)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[4]}
                                alt="sub 4"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(4)}
                            />
                            <button
                                onClick={() => openGallery(0)}
                                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-sm font-semibold px-4 py-1.5 rounded-lg border border-gray-900 shadow-sm transition"
                            >
                                Show all photos
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

                    {/* Left Column: Details */}
                    <div className="md:col-span-2 space-y-8">

                        {/* Host Info */}
                        <div className="flex justify-between items-center pb-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-semibold mb-1">Hosted by {campground.operator.name || 'Owner'}</h2>
                                <p className="text-gray-500 text-sm">Joined Dec 2025 · Verified Host</p>
                            </div>
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-lg">
                                {campground.operator.name?.[0] || 'O'}
                            </div>
                        </div>

                        {/* Highlights */}
                        <div className="space-y-6 pb-6 border-b border-gray-200">
                            <div className="flex gap-4 items-start">
                                <Tent className="w-6 h-6 text-gray-600 mt-1" />
                                <div>
                                    <h3 className="font-semibold">Bring your own tent</h3>
                                    <p className="text-gray-500 text-sm">This campsite is perfect for tent camping.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <Car className="w-6 h-6 text-gray-600 mt-1" />
                                <div>
                                    <h3 className="font-semibold">Drive-in Access</h3>
                                    <p className="text-gray-500 text-sm">Park your vehicle right at the campsite.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <ShieldCheck className="w-6 h-6 text-gray-600 mt-1" />
                                <div>
                                    <h3 className="font-semibold">Verified Listing</h3>
                                    <p className="text-gray-500 text-sm">This campground has been verified by CampVibe.</p>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="pb-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold font-display mb-4">About the mountains</h2>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                {campground.description || `Experience the serenity of ${campground.nameTh}. Nestled in the heart of ${campground.location.province}, this campground offers breathtaking views and a direct connection to nature. Perfect for weekend getaways and star gazing.`}
                            </p>
                        </div>

                        {/* Facilities */}
                        <div className="pb-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold font-display mb-6">What this place offers</h2>
                            <div className="grid grid-cols-2 gap-y-4">
                                <div className="flex items-center gap-3 text-gray-700">
                                    <Wifi className="w-5 h-5" />
                                    <span>Wifi</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-700">
                                    <Utensils className="w-5 h-5" />
                                    <span>Kitchen</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-700">
                                    <ShowerHead className="w-5 h-5" />
                                    <span>Shower</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-700">
                                    <Car className="w-5 h-5" />
                                    <span>Free parking on premises</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAmenitiesOpen(true)}
                                className="mt-6 border border-gray-900 rounded-lg px-6 py-3 font-semibold hover:bg-gray-50 transition"
                            >
                                Show all 12 amenities
                            </button>
                        </div>

                    </div>

                    {/* Right Column: Booking Widget */}
                    <div className="md:col-span-1 relative">
                        <div className="sticky top-28 border border-gray-200 rounded-xl p-6 shadow-xl shadow-gray-100 bg-white">
                            <div className="flex justify-between items-baseline mb-6">
                                <div>
                                    <span className="text-2xl font-bold">${campground.priceLow || 50} </span>
                                    <span className="text-gray-500">night</span>
                                </div>
                                <div className="flex items-center gap-1 text-sm">
                                    <Star className="w-3.5 h-3.5 fill-black" />
                                    <span className="font-semibold">4.8</span>
                                    <span className="text-gray-400">·</span>
                                    <span className="text-gray-500 underline">12 reviews</span>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                                <div className="flex border-b border-gray-200">
                                    <div className="w-1/2 p-3 border-r border-gray-200">
                                        <label className="block text-[10px] font-bold uppercase text-gray-700">Check-in</label>
                                        <div className="text-sm">Add date</div>
                                    </div>
                                    <div className="w-1/2 p-3">
                                        <label className="block text-[10px] font-bold uppercase text-gray-700">Check-out</label>
                                        <div className="text-sm">Add date</div>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <label className="block text-[10px] font-bold uppercase text-gray-700">Guests</label>
                                    <div className="text-sm">1 guest</div>
                                </div>
                            </div>

                            <button className="w-full bg-green-800 hover:bg-green-900 text-white font-bold py-3.5 rounded-lg transition mb-4">
                                Reserve
                            </button>

                            <p className="text-center text-xs text-gray-500 mb-4">You won't be charged yet</p>

                            <div className="space-y-3 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span className="underline">$50 x 5 nights</span>
                                    <span>$250</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="underline">Cleaning fee</span>
                                    <span>$20</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="underline">Service fee</span>
                                    <span>$35</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between font-bold text-gray-900">
                                <span>Total before taxes</span>
                                <span>$305</span>
                            </div>

                        </div>
                    </div>

                </div>

                {/* Map Section */}
                <div className="py-12 border-t border-gray-200 mt-10">
                    <h2 className="text-xl font-bold font-display mb-4">Where you'll be</h2>
                    <div className="flex gap-2 mb-6 text-gray-600">
                        <MapPin className="w-5 h-5 text-gray-900" />
                        <span>{campground.location.province}, Thailand</span>
                    </div>
                    <div className="w-full h-[320px] md:h-[480px]">
                        <DynamicMap
                            latitude={campground.latitude}
                            longitude={campground.longitude}
                            campground={campground}
                        />
                    </div>
                </div>

            </div>

            {/* Image Gallery Modal */}
            <ImageGallery
                images={images}
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                initialIndex={galleryStartIndex}
            />

            {/* Amenities Modal */}
            <AmenitiesModal
                isOpen={isAmenitiesOpen}
                onClose={() => setIsAmenitiesOpen(false)}
            />
        </>
    );
}
