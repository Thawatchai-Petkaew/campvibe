"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Save,
    Tent,
    MapPin,
    Info,
    DollarSign,
    Clock,
    CheckCircle2,
    Trash2
} from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/ImageUpload";

interface CampgroundFormProps {
    initialData?: any;
    isEditing?: boolean;
}

export function CampgroundForm({ initialData, isEditing = false }: CampgroundFormProps) {
    const router = useRouter();
    const { t } = useLanguage();
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
        latitude: 13.7563 as number | string,
        longitude: 100.5018 as number | string,
        province: "Bangkok",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        bookingMethod: "ONLI",
        priceLow: 500 as number | string,
        priceHigh: 1200 as number | string,
        images: [] as string[],
        locationId: "",     // Used for updates
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                nameTh: initialData.nameTh || "",
                nameEn: initialData.nameEn || "",
                description: initialData.description || "",
                campgroundType: initialData.campgroundType || "CAGD",
                accessTypes: initialData.accessTypes ? initialData.accessTypes.split(',') : ["DRIV"],
                accommodationTypes: initialData.accommodationTypes ? initialData.accommodationTypes.split(',') : ["TENT"],
                facilities: initialData.facilities ? initialData.facilities.split(',') : ["TOIL"],
                latitude: initialData.latitude || 13.7563,
                longitude: initialData.longitude || 100.5018,
                province: initialData.location?.province || "Bangkok",
                checkInTime: initialData.checkInTime || "14:00",
                checkOutTime: initialData.checkOutTime || "12:00",
                bookingMethod: initialData.bookingMethod || "ONLI",
                priceLow: initialData.priceLow || 0,
                priceHigh: initialData.priceHigh || 0,
                images: initialData.images ? initialData.images.split(',') : [],
                locationId: initialData.locationId || "",
            });
        }

        // Fetch current operator if creating new or needing ID
        fetch('/api/operator/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.operator?.id) {
                    setOperator({ id: data.operator.id });
                }
            });
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let locationId = formData.locationId;

            // 1. Create/Update Location
            // Ideally backend handles this transactionally, but keeping existing flow:
            if (!locationId) {
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
                locationId = location.id;
            }

            // 2. Prepare Payload
            const slug = formData.nameEn.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') ||
                formData.nameTh.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            const finalSlug = `${slug}-${Math.floor(Math.random() * 1000)}`;

            const campPayload: any = {
                ...formData,
                locationId: locationId,
                operatorId: operator?.id // Only needed for create, backend handles auth check
            };

            if (!isEditing) {
                campPayload.nameThSlug = finalSlug;
                campPayload.nameEnSlug = `${finalSlug}-en`;
            }

            const url = isEditing ? `/api/campgrounds/${initialData.id}` : '/api/campgrounds';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campPayload)
            });

            if (res.ok) {
                router.push("/dashboard/campgrounds");
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

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this campground? This action cannot be undone.")) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/campgrounds/${initialData.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                router.push("/dashboard/campgrounds");
                router.refresh();
            } else {
                alert("Failed to delete");
            }
        } catch (e) {
            alert("Error deleting");
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
                            <h1 className="text-lg font-bold text-gray-900 leading-tight">
                                {isEditing ? `Edit: ${formData.nameTh}` : t.dashboard.createListing}
                            </h1>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t.dashboard.hostPanel}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isEditing && (
                            <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        )}
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-900 text-white rounded-xl font-semibold hover:bg-green-800 transition disabled:opacity-50 shadow-sm"
                        >
                            {isLoading ? t.newCampground.saving : <><Save className="w-4 h-4" /> {isEditing ? 'Update Listing' : t.newCampground.saveListing}</>}
                        </button>
                    </div>
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
                                <h2 className="text-lg font-bold text-gray-900">{t.newCampground.basicInfo}</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">{t.newCampground.nameTh}</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder={t.newCampground.placeholderNameTh}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 focus:border-transparent outline-none transition"
                                        value={formData.nameTh}
                                        onChange={e => setFormData({ ...formData, nameTh: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">{t.newCampground.nameEn}</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder={t.newCampground.placeholderNameEn}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 focus:border-transparent outline-none transition"
                                        value={formData.nameEn}
                                        onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">{t.newCampground.description}</label>
                                <textarea
                                    rows={4}
                                    placeholder={t.newCampground.descriptionPlaceholder}
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
                                <h2 className="text-lg font-bold text-gray-900">{t.newCampground.photos}</h2>
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
                                <h2 className="text-lg font-bold text-gray-900">{t.newCampground.locationSettings}</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">{t.newCampground.province}</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.province}
                                        onChange={e => setFormData({ ...formData, province: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">{t.newCampground.type}</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.campgroundType}
                                        onChange={e => setFormData({ ...formData, campgroundType: e.target.value })}
                                    >
                                        <option value="CAGD">{t.newCampground.regularCamp}</option>
                                        <option value="CACP">{t.newCampground.carCamping}</option>
                                        <option value="GLAMP">{t.newCampground.glamping}</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">{t.newCampground.lat}</label>
                                    <input
                                        type="number" step="any"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.latitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, latitude: val === "" ? "" : parseFloat(val) });
                                        }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">{t.newCampground.lon}</label>
                                    <input
                                        type="number" step="any"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-900 outline-none"
                                        value={formData.longitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, longitude: val === "" ? "" : parseFloat(val) });
                                        }}
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
                                <h2 className="text-lg font-bold text-gray-900">{t.newCampground.pricing}</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">{t.newCampground.minPrice}</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{t.currency.symbol}</span>
                                        <input
                                            type="number"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 outline-none"
                                            value={formData.priceLow}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, priceLow: val === "" ? "" : parseInt(val) });
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">{t.newCampground.maxPrice}</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{t.currency.symbol}</span>
                                        <input
                                            type="number"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 outline-none"
                                            value={formData.priceHigh}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, priceHigh: val === "" ? "" : parseInt(val) });
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 5. Times */}
                        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-green-900" />
                                <h2 className="text-lg font-bold text-gray-900">{t.newCampground.operations}</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">{t.newCampground.checkIn}</label>
                                    <input
                                        type="time"
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 outline-none"
                                        value={formData.checkInTime}
                                        onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase">{t.newCampground.checkOut}</label>
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
                                <h3 className="font-bold text-green-900">{t.newCampground.hostTipTitle}</h3>
                            </div>
                            <p className="text-sm text-green-800 leading-relaxed">
                                {t.newCampground.hostTipDesc}
                            </p>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
