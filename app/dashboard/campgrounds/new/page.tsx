"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Save,
    Tent,
    MapPin,
    Info,
    DollarSign,
    Clock,
    CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/ImageUpload";
import clsx from "clsx";

export default function NewCampgroundPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [operator, setOperator] = useState<any>(null);

    const [formData, setFormData] = useState({
        nameTh: "",
        nameEn: "",
        description: "",
        campgroundType: "CAGD",
        accessTypes: ["DRIV"],
        accommodationTypes: ["TENT"],
        facilities: ["TOIL", "SHOW"],
        latitude: 13.7563,
        longitude: 100.5018,
        province: "Bangkok",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        bookingMethod: "ONLI",
        priceLow: 500,
        priceHigh: 1200,
        images: [] as string[],
    });

    useEffect(() => {
        // Fetch current operator
        fetch('/api/operator/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.campgrounds?.[0]?.operatorId) {
                    setOperator({ id: data.campgrounds[0].operatorId });
                } else if (data.operator?.id) {
                    setOperator({ id: data.operator.id });
                }
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Create Location First
            const locRes = await fetch('/api/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    country: "Thailand",
                    province: formData.province,
                    lat: formData.latitude,
                    lon: formData.longitude
                })
            });
            const location = await locRes.json();

            // 2. Create Campground
            const slug = formData.nameEn.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') ||
                formData.nameTh.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            const finalSlug = `${slug}-${Math.floor(Math.random() * 1000)}`;

            const campPayload = {
                ...formData,
                nameThSlug: finalSlug,
                nameEnSlug: `${finalSlug}-en`,
                locationId: location.id,
                operatorId: operator?.id || "49f60cdf-c94d-46fa-9cec-79062863b454"
            };

            const res = await fetch('/api/campgrounds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campPayload)
            });

            if (res.ok) {
                router.push("/dashboard");
                router.refresh();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || "Failed to save"}`);
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="px-2">
                            <img src="/logo.png" alt="CampVibe Logo" className="h-8 w-auto" />
                        </Link>
                        <div className="h-6 w-[1px] bg-gray-200 mx-2 hidden sm:block"></div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-tight">Create Listing</h1>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Host Dashboard</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-green-900 text-white rounded-xl font-semibold hover:bg-green-800 transition disabled:opacity-50 shadow-sm"
                    >
                        {isLoading ? "Saving..." : <><Save className="w-4 h-4" /> Save Listing</>}
                    </button>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="container mx-auto px-6 py-10 max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Form Area */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* 1. Basic Info */}
                        <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Info className="w-5 h-5 text-green-900" />
                                <h2 className="text-lg font-bold text-gray-900">Basic Information</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Campground Name (Thai)</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="เช่น ขอบชลแคมป์"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 focus:border-transparent outline-none transition"
                                        value={formData.nameTh}
                                        onChange={e => setFormData({ ...formData, nameTh: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Campground Name (English)</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Khob Chon Camp"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 focus:border-transparent outline-none transition"
                                        value={formData.nameEn}
                                        onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Description</label>
                                <textarea
                                    rows={4}
                                    placeholder="Tell campers what's special about your place..."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 focus:border-transparent outline-none transition resize-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </section>

                        {/* 2. Media Upload */}
                        <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Tent className="w-5 h-5 text-green-900" />
                                <h2 className="text-lg font-bold text-gray-900">Photos</h2>
                            </div>
                            <ImageUpload
                                value={formData.images}
                                onChange={urls => setFormData({ ...formData, images: urls })}
                                onRemove={url => setFormData({ ...formData, images: formData.images.filter(u => u !== url) })}
                            />
                        </section>

                        {/* 3. Location */}
                        <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <MapPin className="w-5 h-5 text-green-900" />
                                <h2 className="text-lg font-bold text-gray-900">Location Settings</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Province</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.province}
                                        onChange={e => setFormData({ ...formData, province: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Campground Type</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.campgroundType}
                                        onChange={e => setFormData({ ...formData, campgroundType: e.target.value })}
                                    >
                                        <option value="CAGD">Regular Campground</option>
                                        <option value="CACP">Car Camping</option>
                                        <option value="GLAMP">Glamping</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Latitude</label>
                                    <input
                                        type="number" step="any"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.latitude}
                                        onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Longitude</label>
                                    <input
                                        type="number" step="any"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.longitude}
                                        onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-8">
                        {/* 4. Pricing */}
                        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3">
                                <DollarSign className="w-5 h-5 text-green-900" />
                                <h2 className="text-lg font-bold text-gray-900">Pricing</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Min Price / Night</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 outline-none"
                                            value={formData.priceLow}
                                            onChange={e => setFormData({ ...formData, priceLow: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Max Price / Night</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 outline-none"
                                            value={formData.priceHigh}
                                            onChange={e => setFormData({ ...formData, priceHigh: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 5. Times */}
                        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-green-900" />
                                <h2 className="text-lg font-bold text-gray-900">Operations</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Check-in</label>
                                    <input
                                        type="time"
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 outline-none"
                                        value={formData.checkInTime}
                                        onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Check-out</label>
                                    <input
                                        type="time"
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 outline-none"
                                        value={formData.checkOutTime}
                                        onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Tip Box */}
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-5 h-5 text-green-700" />
                                <h3 className="font-bold text-green-900">Host Tip</h3>
                            </div>
                            <p className="text-sm text-green-800 leading-relaxed">
                                Uploading high-quality photos of your terrain and facilities can increase your booking rate by up to 40%.
                            </p>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
