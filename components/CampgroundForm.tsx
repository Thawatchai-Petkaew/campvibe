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
    Trash2,
    Loader2,
    Search
} from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/ImageUpload";
import { LocationPicker } from "@/components/LocationPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getFilterOptions } from "@/app/actions/getFilterOptions";
import * as LucideIcons from "lucide-react";

interface CampgroundFormProps {
    initialData?: any;
    isEditing?: boolean;
}

export function CampgroundForm({ initialData, isEditing = false }: CampgroundFormProps) {
    const router = useRouter();
    const { t, language } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [operator, setOperator] = useState<any>(null);
    const [masterOptions, setMasterOptions] = useState<Record<string, any[]>>({});
    const [optionsLoading, setOptionsLoading] = useState(true);

    const [formData, setFormData] = useState({
        nameTh: "",
        nameEn: "",
        description: "",
        campgroundType: "",
        accessTypes: [] as string[],
        accommodationTypes: [] as string[],
        facilities: [] as string[],
        externalFacilities: [] as string[],
        equipment: [] as string[],
        activities: [] as string[],
        terrain: [] as string[],

        address: "",
        directions: "",
        videoUrl: "",
        contacts: "",
        feeInfo: "",
        toiletInfo: "",
        minimumAge: 0 as number | string,

        latitude: 13.7563 as number | string,
        longitude: 100.5018 as number | string,
        province: "Bangkok",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        bookingMethod: "ONLI",
        priceLow: 500 as number | string,
        priceHigh: 1200 as number | string,
        images: [] as string[],
        locationId: "",
        thaiLocationId: "",
    });

    useEffect(() => {
        // Fetch Master Options
        getFilterOptions().then(data => {
            setMasterOptions(data || {});
            setOptionsLoading(false);

            // Only set default if NO initial data and NOT editing
            if (!initialData && !isEditing && data['Campground type']?.[0]) {
                setFormData(prev => ({
                    ...prev,
                    campgroundType: prev.campgroundType || data['Campground type'][0].code
                }));
            }
        });

        // Initialize Data
        if (initialData) {
            setFormData({
                nameTh: initialData.nameTh || "",
                nameEn: initialData.nameEn || "",
                description: initialData.description || "",
                campgroundType: initialData.campgroundType || "",
                accessTypes: initialData.accessTypes ? initialData.accessTypes.split(',') : [],
                accommodationTypes: initialData.accommodationTypes ? initialData.accommodationTypes.split(',') : [],
                facilities: initialData.facilities ? initialData.facilities.split(',') : [],
                externalFacilities: initialData.externalFacilities ? initialData.externalFacilities.split(',') : [],
                equipment: initialData.equipment ? initialData.equipment.split(',') : [],
                activities: initialData.activities ? initialData.activities.split(',') : [],
                terrain: initialData.terrain ? initialData.terrain.split(',') : [],
                address: initialData.address || "",
                directions: initialData.directions || "",
                videoUrl: initialData.videoUrl || "",
                contacts: initialData.contacts || "",
                feeInfo: initialData.feeInfo || "",
                toiletInfo: initialData.toiletInfo || "",
                minimumAge: initialData.minimumAge ?? "",
                latitude: initialData.latitude ?? 13.7563,
                longitude: initialData.longitude ?? 100.5018,
                province: initialData.location?.province || "Bangkok",
                checkInTime: initialData.checkInTime || "14:00",
                checkOutTime: initialData.checkOutTime || "12:00",
                bookingMethod: initialData.bookingMethod || "ONLI",
                priceLow: initialData.priceLow ?? 0,
                priceHigh: initialData.priceHigh ?? 0,
                images: initialData.images ? initialData.images.split(',') : [],
                locationId: initialData.locationId || "",
                thaiLocationId: initialData.location?.thaiLocationId || "",
            });
        }

        fetch('/api/operator/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.operator?.id) {
                    setOperator({ id: data.operator.id });
                }
            });
    }, [initialData, isEditing]);

    const toggleArrayItem = (field: keyof typeof formData, value: string) => {
        setFormData((prev: any) => {
            const current = prev[field] as string[];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [field]: updated };
        });
    };

    // Helper to get Icon
    const getIcon = (iconName: string) => {
        // @ts-ignore
        const Icon = LucideIcons[iconName] || LucideIcons.HelpCircle;
        return <Icon className="w-5 h-5 mb-2 group-hover:text-primary transition-colors" />;
    };

    const renderOptionGroup = (title: string, groupKey: string, fieldName: keyof typeof formData) => {
        const options = masterOptions[groupKey] || [];
        if (options.length === 0) return null;

        return (
            <div className="space-y-4">
                <Label className="text-base font-bold text-gray-800">{title}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {options.map((opt) => {
                        const isSelected = (formData[fieldName] as string[])?.includes(opt.code);
                        return (
                            <div
                                key={opt.code}
                                onClick={() => toggleArrayItem(fieldName, opt.code)}
                                className={cn(
                                    "cursor-pointer flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all h-28 group relative",
                                    isSelected
                                        ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary"
                                        : "bg-white border-gray-200 hover:border-primary/50 hover:bg-gray-50 hover:shadow-sm"
                                )}
                            >
                                {isSelected && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />}
                                <div className={cn("mb-2 p-2 rounded-full transition-colors", isSelected ? "bg-primary text-white" : "bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-primary")}>
                                    {/* Re-using logic for icon specifically */}
                                    {(() => {
                                        // @ts-ignore
                                        const IconComp = LucideIcons[opt.icon] || LucideIcons.HelpCircle;
                                        return <IconComp className="w-5 h-5" />;
                                    })()}
                                </div>
                                <span className={cn("text-xs font-semibold leading-tight text-balance px-1", isSelected ? "text-primary" : "text-gray-600 group-hover:text-gray-900")}>
                                    {language === 'th' ? opt.nameTh : opt.nameEn}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let locationId = formData.locationId;
            if (!locationId) {
                const locRes = await fetch('/api/location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        country: "Thailand",
                        province: formData.province,
                        lat: formData.latitude,
                        lon: formData.longitude,
                        thaiLocationId: formData.thaiLocationId
                    })
                });
                const location = await locRes.json();
                locationId = location.id;
            }

            const slug = formData.nameEn.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') ||
                formData.nameTh.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            const finalSlug = `${slug}-${Math.floor(Math.random() * 1000)}`;

            const campPayload: any = {
                ...formData,
                accessTypes: formData.accessTypes,
                accommodationTypes: formData.accommodationTypes,
                facilities: formData.facilities,
                externalFacilities: formData.externalFacilities,
                equipment: formData.equipment,
                priceLow: formData.priceLow === "" ? undefined : formData.priceLow,
                priceHigh: formData.priceHigh === "" ? undefined : formData.priceHigh,
                minimumAge: formData.minimumAge === "" ? undefined : formData.minimumAge,
                latitude: formData.latitude === "" ? 0 : formData.latitude,
                longitude: formData.longitude === "" ? 0 : formData.longitude,
                locationId: locationId,
                operatorId: operator?.id
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
            alert("Something went wrong.");
        } finally {
            setIsLoading(false);
        }
    };

    // Keep handleDelete same logic generally
    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this campground? This action cannot be undone.")) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/campgrounds/${initialData.id}`, { method: 'DELETE' });
            if (res.ok) { router.push("/dashboard/campgrounds"); router.refresh(); }
            else { alert("Failed to delete"); }
        } catch (e) { alert("Error deleting"); }
        finally { setIsLoading(false); }
    };

    if (optionsLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
    }

    return (
        <div className="min-h-screen pb-20">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
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
                            <Button variant="destructive" onClick={handleDelete} disabled={isLoading} className="rounded-full shadow-none w-10 h-10 p-0 sm:w-auto sm:px-4 sm:h-10">
                                <Trash2 className="w-4 h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Delete</span>
                            </Button>
                        )}
                        <Button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="px-6 rounded-full font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 h-10"
                        >
                            {isLoading ? t.newCampground.saving : <><Save className="w-4 h-4 mr-2" /> {isEditing ? 'Update' : t.newCampground.saveListing}</>}
                        </Button>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="container mx-auto px-6 py-10 max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Form Area */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Basic Info */}
                        <Card className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900">
                                    <Info className="w-5 h-5 text-primary" />
                                    {t.newCampground.basicInfo}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>{t.newCampground.nameTh}</Label>
                                        <Input
                                            required
                                            value={formData.nameTh}
                                            onChange={e => setFormData({ ...formData, nameTh: e.target.value })}
                                            className="rounded-full h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t.newCampground.nameEn}</Label>
                                        <Input
                                            required
                                            value={formData.nameEn}
                                            onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                                            className="rounded-full h-12"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t.newCampground.description}</Label>
                                    <Textarea
                                        rows={4}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="rounded-2xl"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dynamic Options Sections */}
                        <Card className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900">
                                    <Tent className="w-5 h-5 text-primary" />
                                    Amenities & Features
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                {renderOptionGroup("Internal Facilities", "Internal facility", "facilities")}
                                {renderOptionGroup("External Facilities", "External facility", "externalFacilities")}
                                {renderOptionGroup("Equipment for Rent", "Equipment for rent", "equipment")}
                                {renderOptionGroup("Access Types", "Access type", "accessTypes")}
                                {renderOptionGroup("Activities", "Activity", "activities")}
                            </CardContent>
                        </Card>

                        {/* Media Upload */}
                        <Card className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900">
                                    Photos
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                <ImageUpload
                                    value={formData.images}
                                    onChange={urls => setFormData({ ...formData, images: urls })}
                                    onRemove={url => setFormData({ ...formData, images: formData.images.filter(u => u !== url) })}
                                />
                                <div className="mt-4 space-y-2">
                                    <Label>Video URL</Label>
                                    <Input
                                        value={formData.videoUrl}
                                        onChange={e => setFormData({ ...formData, videoUrl: e.target.value })}
                                        className="rounded-full h-12"
                                        placeholder="https://youtube.com/..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Additional Info */}
                        <Card className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900">
                                    <Info className="w-5 h-5 text-primary" />
                                    Additional Details (Contacts & Policies)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <Label>Address</Label>
                                    <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="rounded-full h-12" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Directions</Label>
                                    <Textarea value={formData.directions} onChange={e => setFormData({ ...formData, directions: e.target.value })} className="rounded-2xl" rows={3} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Contacts (Phone/Line/FB)</Label>
                                        <Input value={formData.contacts} onChange={e => setFormData({ ...formData, contacts: e.target.value })} className="rounded-full h-12" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Minimum Age</Label>
                                        <Input type="number" value={formData.minimumAge} onChange={e => setFormData({ ...formData, minimumAge: e.target.value === "" ? "" : parseInt(e.target.value) })} className="rounded-full h-12" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Fee Info / Pricing Details</Label>
                                    <Textarea value={formData.feeInfo} onChange={e => setFormData({ ...formData, feeInfo: e.target.value })} className="rounded-2xl" rows={2} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Toilet / Shower Info</Label>
                                    <Textarea value={formData.toiletInfo} onChange={e => setFormData({ ...formData, toiletInfo: e.target.value })} className="rounded-2xl" rows={2} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        {/* Location */}
                        <Card className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                                <CardTitle className="text-lg font-bold text-gray-900">Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <Label>{t.newCampground.type}</Label>
                                    <Select
                                        value={formData.campgroundType}
                                        onValueChange={val => setFormData({ ...formData, campgroundType: val })}
                                    >
                                        <SelectTrigger className="rounded-full h-12">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {masterOptions['Campground type']?.map(opt => (
                                                <SelectItem key={opt.code} value={opt.code}>
                                                    {language === 'th' ? opt.nameTh : opt.nameEn}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t.newCampground.province}</Label>
                                    <LocationPicker
                                        onSelect={(loc) => {
                                            if (loc) {
                                                setFormData({
                                                    ...formData,
                                                    thaiLocationId: loc.id,
                                                    province: loc.provinceNameEn
                                                });
                                            } else {
                                                setFormData({
                                                    ...formData,
                                                    thaiLocationId: "",
                                                    province: ""
                                                });
                                            }
                                        }}
                                        initialLocationId={formData.thaiLocationId}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t.newCampground.lat}</Label>
                                    <Input
                                        type="number" step="any"
                                        className="rounded-full h-12"
                                        value={formData.latitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, latitude: val === "" ? "" : parseFloat(val) });
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t.newCampground.lon}</Label>
                                    <Input
                                        type="number" step="any"
                                        className="rounded-full h-12"
                                        value={formData.longitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, longitude: val === "" ? "" : parseFloat(val) });
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pricing */}
                        <Card className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                                <CardTitle className="text-lg font-bold text-gray-900">{t.newCampground.pricing}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>Min Price</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">฿</span>
                                        <Input type="number"
                                            value={formData.priceLow}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, priceLow: val === "" ? "" : parseFloat(val) });
                                            }}
                                            className="pl-7 rounded-full h-12"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Price</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">฿</span>
                                        <Input type="number"
                                            value={formData.priceHigh}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, priceHigh: val === "" ? "" : parseFloat(val) });
                                            }}
                                            className="pl-7 rounded-full h-12"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Times */}
                        <Card className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                                <CardTitle className="text-lg font-bold text-gray-900">{t.newCampground.operations}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>{t.newCampground.checkIn}</Label>
                                    <Input type="time"
                                        value={formData.checkInTime}
                                        onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                                        className="rounded-full h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t.newCampground.checkOut}</Label>
                                    <Input type="time"
                                        value={formData.checkOutTime}
                                        onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                                        className="rounded-full h-12"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </form>
        </div>
    );
}
