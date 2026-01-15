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
    Check,
    Trash2,
    Loader2,
    Search,
    Phone,
    MessageCircle,
    Facebook,
    Video,
    Plus,
    Grid3x3
} from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/ImageUpload";
import { LogoUpload } from "@/components/LogoUpload";
import { LocationPicker } from "@/components/LocationPicker";
import { InputField } from "@/components/ui/input-field";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Label } from "@/components/ui/label";
import { TruncatedLabel } from "@/components/ui/truncated-label";
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
    const [serverError, setServerError] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [logoError, setLogoError] = useState(false);

    const [formData, setFormData] = useState({
        nameTh: "",
        nameEn: "",
        description: "",
        campSiteType: [] as string[], // Changed to array for multi-select
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
        logo: "",
        
        // Contact Information
        phone: "",
        lineId: "",
        facebookUrl: "",
        facebookMessageUrl: "",
        tiktokUrl: "",
        feeInfo: "",
        toiletInfo: "",
        minimumAge: 0 as number | string,
        tags: [] as string[],
        partner: "",
        nationalPark: "",
        
        // Capacity & Ground Type
        maxGuestsPerDay: 0 as number | string,
        maxTentsPerDay: 0 as number | string,
        groundType: {} as Record<string, number>, // {STONE: 5, GRASS: 10, CONCRETE: 3, WOOD: 2}

        latitude: 13.7563 as number | string,
        longitude: 100.5018 as number | string,
        province: "",
        district: "",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        bookingMethod: "ONLI",
        priceLow: 500 as number | string,
        priceHigh: 1200 as number | string,
        images: [] as string[],
        locationId: "",
        thaiLocationId: "",
        
        // Ownership & Pricing
        ownershipType: "" as string,
        isFree: false,
        
        // Pet & Display Settings
        petFriendly: false,
        useSpotView: false,
        
        // Status fields
        isVerified: false,
        isActive: true,
        isPublished: false,
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
                    campSiteType: prev.campSiteType.length > 0 ? prev.campSiteType : [data['Campground type'][0].code]
                }));
            }
        });

        // Initialize Data
        if (initialData) {
            setFormData({
                nameTh: initialData.nameTh || "",
                nameEn: initialData.nameEn || "",
                description: initialData.description || "",
                campSiteType: initialData.campSiteType || initialData.campgroundType ? (Array.isArray(initialData.campSiteType || initialData.campgroundType) ? (initialData.campSiteType || initialData.campgroundType) : (initialData.campSiteType || initialData.campgroundType).split(',').filter(Boolean)) : [],
                accessTypes: initialData.accessTypes ? initialData.accessTypes.split(',').filter(Boolean) : [],
                accommodationTypes: initialData.accommodationTypes ? initialData.accommodationTypes.split(',').filter(Boolean) : [],
                facilities: initialData.facilities ? initialData.facilities.split(',').filter(Boolean) : [],
                externalFacilities: initialData.externalFacilities ? initialData.externalFacilities.split(',').filter(Boolean) : [],
                equipment: initialData.equipment ? initialData.equipment.split(',').filter(Boolean) : [],
                activities: initialData.activities ? initialData.activities.split(',').filter(Boolean) : [],
                terrain: initialData.terrain ? initialData.terrain.split(',').filter(Boolean) : [],
                address: initialData.address || "",
                directions: initialData.directions || "",
                videoUrl: initialData.videoUrl || "",
                logo: initialData.logo || "",
                
                // Contact Information
                phone: initialData.phone || "",
                lineId: initialData.lineId || "",
                facebookUrl: initialData.facebookUrl || "",
                facebookMessageUrl: initialData.facebookMessageUrl || "",
                tiktokUrl: initialData.tiktokUrl || "",
                feeInfo: initialData.feeInfo || "",
                toiletInfo: initialData.toiletInfo || "",
                minimumAge: initialData.minimumAge ?? "",
                tags: initialData.tags ? initialData.tags.split(',').filter(Boolean) : [],
                partner: initialData.partner || "",
                nationalPark: initialData.nationalPark || "",
                latitude: initialData.latitude ?? 13.7563,
                longitude: initialData.longitude ?? 100.5018,
                province: initialData.location?.thaiLocation 
                    ? (language === 'th' ? initialData.location.thaiLocation.provinceName : initialData.location.thaiLocation.provinceNameEn)
                    : initialData.location?.province || "",
                district: initialData.location?.thaiLocation?.districtName
                    ? (language === 'th' ? initialData.location.thaiLocation.districtName : initialData.location.thaiLocation.districtNameEn)
                    : "",
                checkInTime: initialData.checkInTime || "14:00",
                checkOutTime: initialData.checkOutTime || "12:00",
                bookingMethod: initialData.bookingMethod || "ONLI",
                priceLow: initialData.priceLow ?? 0,
                priceHigh: initialData.priceHigh ?? 0,
                images: initialData.images ? initialData.images.split(',').filter(Boolean) : [],
                locationId: initialData.locationId || "",
                thaiLocationId: initialData.location?.thaiLocationId || "",
                isVerified: initialData.isVerified ?? false,
                isActive: initialData.isActive ?? true,
                isPublished: initialData.isPublished ?? false,
                
                // Capacity & Ground Type
                maxGuestsPerDay: initialData.maxGuestsPerDay ?? 0,
                maxTentsPerDay: initialData.maxTentsPerDay ?? 0,
                groundType: initialData.groundType ? (typeof initialData.groundType === 'string' ? JSON.parse(initialData.groundType) : initialData.groundType) : {},
                
                // Ownership & Pricing
                ownershipType: initialData.ownershipType || "",
                isFree: initialData.isFree ?? false,
                
                // Pet & Display Settings
                petFriendly: initialData.petFriendly ?? false,
                useSpotView: initialData.useSpotView ?? false,
            });
            setLogoError(false);
        }

        fetch('/api/operator/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.operator?.id) {
                    setOperator({ id: data.operator.id });
                }
            });
    }, [initialData, isEditing]);

    // Reset logo error when logo changes
    useEffect(() => {
        setLogoError(false);
    }, [formData.logo]);

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
            <div className="space-y-2">
                <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{title}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {options.map((opt) => {
                        const isSelected = (formData[fieldName] as string[])?.includes(opt.code);
                        // @ts-ignore
                        const IconComp = LucideIcons[opt.icon] || LucideIcons.HelpCircle;
                        return (
                            <div
                                key={opt.code}
                                onClick={() => toggleArrayItem(fieldName, opt.code)}
                                className={cn(
                                    "cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all",
                                    isSelected
                                        ? "bg-primary/10 border-primary"
                                        : "bg-card border-border hover:border-primary/50"
                                )}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0", isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                        <IconComp className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={cn("text-sm font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>
                                        {language === 'th' ? opt.nameTh : opt.nameEn}
                                    </span>
                                </div>
                                <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", isSelected ? "bg-primary" : "bg-muted")}>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                </div>
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
                        // Lat/Lon are independent - user enters manually
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
                campSiteType: formData.campSiteType, // Now an array
                accessTypes: formData.accessTypes,
                accommodationTypes: formData.accommodationTypes,
                facilities: formData.facilities,
                externalFacilities: formData.externalFacilities,
                equipment: formData.equipment,
                activities: formData.activities,
                terrain: formData.terrain,
                tags: formData.tags,
                priceLow: formData.priceLow === "" ? undefined : formData.priceLow,
                priceHigh: formData.priceHigh === "" ? undefined : formData.priceHigh,
                minimumAge: formData.minimumAge === "" ? undefined : formData.minimumAge,
                latitude: formData.latitude === "" ? 0 : formData.latitude,
                longitude: formData.longitude === "" ? 0 : formData.longitude,
                locationId: locationId,
                operatorId: operator?.id,
                logo: formData.logo || undefined,
                partner: formData.partner || undefined,
                nationalPark: formData.nationalPark || undefined,
                isVerified: formData.isVerified,
                isActive: formData.isActive,
                isPublished: formData.isPublished,
                
                // Capacity & Ground Type
                maxGuestsPerDay: formData.maxGuestsPerDay === "" ? undefined : formData.maxGuestsPerDay,
                maxTentsPerDay: formData.maxTentsPerDay === "" ? undefined : formData.maxTentsPerDay,
                groundType: Object.keys(formData.groundType).length > 0 ? JSON.stringify(formData.groundType) : undefined,
                
                // Ownership & Pricing
                ownershipType: formData.ownershipType || undefined,
                isFree: formData.isFree,
                
                // Pet & Display Settings
                petFriendly: formData.petFriendly,
                useSpotView: formData.useSpotView,
            };

            if (!isEditing) {
                campPayload.nameThSlug = finalSlug;
                campPayload.nameEnSlug = `${finalSlug}-en`;
            }

            const url = isEditing ? `/api/campsites/${initialData.id}` : '/api/campsites';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campPayload)
            });

            if (res.ok) {
                router.push("/dashboard/campsites");
                router.refresh();
            } else {
                const err = await res.json();
                setServerError(err.error || "Failed to save");
            }
        } catch (error) {
            console.error("Save error:", error);
            setServerError("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Keep handleDelete same logic generally
    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this campground? This action cannot be undone.")) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/campsites/${initialData.id}`, { method: 'DELETE' });
            if (res.ok) { router.push("/dashboard/campgrounds"); router.refresh(); }
            else { alert("Failed to delete"); }
        } catch (e) { alert("Error deleting"); }
        finally { setIsLoading(false); }
    };

    if (optionsLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="pb-20 bg-background">
            {/* Header Section */}
            <div className="border-b border-border bg-background">
                <div className="w-full px-4 md:px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            {formData.logo && (
                                <>
                                    <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-muted shrink-0">
                                        {logoError ? (
                                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <img 
                                                src={formData.logo} 
                                                alt="Campground logo" 
                                                className="w-full h-full object-contain"
                                                onError={() => setLogoError(true)}
                                            />
                                        )}
                                    </div>
                                    <div className="h-6 w-[1px] bg-border mx-2 hidden sm:block"></div>
                                </>
                            )}
                            <div className="min-w-0 flex-1">
                                <h1 className="text-lg font-bold text-foreground leading-tight truncate">
                                    {isEditing ? `Edit: ${formData.nameTh}` : t.dashboard.createListing}
                                </h1>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{t.dashboard.hostPanel}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
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
                </div>
            </div>

            <form noValidate onSubmit={handleSubmit} className="w-full">
                {/* Server Error Banner (after submit) */}
                {hasSubmitted && serverError && (
                    <div className="mb-6">
                        <ErrorBanner message={serverError} />
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Form Area */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Basic Info */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <Info className="w-5 h-5 text-primary" />
                                    {t.newCampground.basicInfo}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField
                                        label={t.newCampground.nameTh}
                                        required
                                        value={formData.nameTh}
                                        onChange={e => setFormData({ ...formData, nameTh: e.target.value })}
                                        className="rounded-full h-12"
                                    />
                                    <InputField
                                        label={t.newCampground.nameEn}
                                        required
                                        value={formData.nameEn}
                                        onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                                        className="rounded-full h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.description}</Label>
                                    <Textarea
                                        rows={4}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="rounded-2xl"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Media Upload */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    {t.newCampground.mediaBranding}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">Logo</Label>
                                    <LogoUpload
                                        value={formData.logo}
                                        onChange={(url) => setFormData({ ...formData, logo: url })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">Photos</Label>
                                    <ImageUpload
                                        value={formData.images}
                                        onChange={urls => setFormData({ ...formData, images: urls })}
                                        onRemove={url => setFormData({ ...formData, images: formData.images.filter(u => u !== url) })}
                                    />
                                </div>
                                <InputField
                                    label="Video URL"
                                    value={formData.videoUrl}
                                    onChange={e => setFormData({ ...formData, videoUrl: e.target.value })}
                                    className="rounded-full h-12"
                                    placeholder="https://youtube.com/..."
                                    error={formData.videoUrl && !/^https?:\/\/.+/.test(formData.videoUrl) ? "Invalid URL format" : undefined}
                                />
                            </CardContent>
                        </Card>

                        {/* Location */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <MapPin className="w-5 h-5 text-primary" />
                                    {t.newCampground.location}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.searchLocation}</Label>
                                    <LocationPicker
                                        onSelect={(loc) => {
                                            if (loc) {
                                                setFormData({
                                                    ...formData,
                                    thaiLocationId: loc.id ? loc.id : "",
                                    province: language === 'th' ? loc.provinceName : loc.provinceNameEn,
                                    district: loc.districtName
                                                        ? (language === 'th' ? (loc.districtName || "") : (loc.districtNameEn || ""))
                                                        : ""
                                                });
                                            }
                                        }}
                                        initialLocationId={formData.thaiLocationId}
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField
                                        label={t.newCampground.province}
                                        value={formData.province}
                                        onChange={e => setFormData({ ...formData, province: e.target.value })}
                                        className="rounded-full h-12"
                                        placeholder={t.newCampground.provincePlaceholder}
                                    />
                                    <InputField
                                        label="District"
                                        value={formData.district}
                                        onChange={e => setFormData({ ...formData, district: e.target.value })}
                                        className="rounded-full h-12"
                                        placeholder="District name (optional)"
                                    />
                                </div>

                                <InputField
                                    label={t.newCampground.address}
                                    value={formData.address} 
                                    onChange={e => setFormData({ ...formData, address: e.target.value })} 
                                    className="rounded-full h-12" 
                                    placeholder={t.newCampground.addressPlaceholder}
                                />

                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.directions}</Label>
                                    <Textarea 
                                        value={formData.directions} 
                                        onChange={e => setFormData({ ...formData, directions: e.target.value })} 
                                        className="rounded-2xl" 
                                        rows={3}
                                        placeholder={t.newCampground.directionsPlaceholder}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField
                                        label={t.newCampground.latitude}
                                        type="number" 
                                        step="any"
                                        className="rounded-full h-12"
                                        value={formData.latitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, latitude: val === "" ? "" : parseFloat(val) });
                                        }}
                                        placeholder="13.7563"
                                        error={formData.latitude && (isNaN(Number(formData.latitude)) || Number(formData.latitude) < -90 || Number(formData.latitude) > 90) ? "Latitude must be between -90 and 90" : undefined}
                                    />
                                    <InputField
                                        label={t.newCampground.longitude}
                                        type="number" 
                                        step="any"
                                        className="rounded-full h-12"
                                        value={formData.longitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, longitude: val === "" ? "" : parseFloat(val) });
                                        }}
                                        placeholder="100.5018"
                                        error={formData.longitude && (isNaN(Number(formData.longitude)) || Number(formData.longitude) < -180 || Number(formData.longitude) > 180) ? "Longitude must be between -180 and 180" : undefined}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contact Information */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <Phone className="w-5 h-5 text-primary" />
                                    {t.newCampground.contactInfo}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField
                                        label={t.newCampground.phoneNumber}
                                        type="tel"
                                        value={formData.phone} 
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                                        className="rounded-full h-12" 
                                        placeholder="081-234-5678"
                                        leftIcon={<Phone className="w-4 h-4" />}
                                    />
                                    <InputField
                                        label={t.newCampground.lineId}
                                        value={formData.lineId} 
                                        onChange={e => setFormData({ ...formData, lineId: e.target.value })} 
                                        className="rounded-full h-12" 
                                        placeholder="@lineid or lineid123"
                                        leftIcon={<MessageCircle className="w-4 h-4" />}
                                    />
                                </div>
                                <InputField
                                    label={t.newCampground.facebookUrl}
                                    type="url"
                                    value={formData.facebookUrl} 
                                    onChange={e => setFormData({ ...formData, facebookUrl: e.target.value })} 
                                    className="rounded-full h-12" 
                                    placeholder="https://facebook.com/yourpage"
                                    leftIcon={<Facebook className="w-4 h-4" />}
                                    error={formData.facebookUrl && !/^https?:\/\/.+/.test(formData.facebookUrl) ? "Invalid URL format" : undefined}
                                />
                                <InputField
                                    label={t.newCampground.facebookMessageUrl}
                                    type="url"
                                    value={formData.facebookMessageUrl} 
                                    onChange={e => setFormData({ ...formData, facebookMessageUrl: e.target.value })} 
                                    className="rounded-full h-12" 
                                    placeholder="https://m.me/yourpage"
                                    leftIcon={<MessageCircle className="w-4 h-4" />}
                                    error={formData.facebookMessageUrl && !/^https?:\/\/.+/.test(formData.facebookMessageUrl) ? "Invalid URL format" : undefined}
                                />
                                <InputField
                                    label={t.newCampground.tiktokUrl}
                                    type="url"
                                    value={formData.tiktokUrl} 
                                    onChange={e => setFormData({ ...formData, tiktokUrl: e.target.value })} 
                                    className="rounded-full h-12" 
                                    placeholder="https://tiktok.com/@username"
                                    leftIcon={<Video className="w-4 h-4" />}
                                    error={formData.tiktokUrl && !/^https?:\/\/.+/.test(formData.tiktokUrl) ? "Invalid URL format" : undefined}
                                />
                            </CardContent>
                        </Card>

                        {/* Additional Info */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <Info className="w-5 h-5 text-primary" />
                                    {t.newCampground.additionalDetails}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <InputField
                                    label={t.campground.minimumAge}
                                    type="number"
                                    value={formData.minimumAge}
                                    onChange={e => setFormData({ ...formData, minimumAge: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                    className="rounded-full h-12"
                                    error={formData.minimumAge && (isNaN(Number(formData.minimumAge)) || Number(formData.minimumAge) < 0) ? "Minimum age must be a positive number" : undefined}
                                />
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.feeInfo}</Label>
                                    <Textarea value={formData.feeInfo} onChange={e => setFormData({ ...formData, feeInfo: e.target.value })} className="rounded-2xl" rows={2} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.campground.restrooms}</Label>
                                    <Textarea value={formData.toiletInfo} onChange={e => setFormData({ ...formData, toiletInfo: e.target.value })} className="rounded-2xl" rows={2} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField
                                        label="Partner"
                                        value={formData.partner}
                                        onChange={e => setFormData({ ...formData, partner: e.target.value })}
                                        className="rounded-full h-12"
                                        placeholder="Partner name"
                                    />
                                    <InputField
                                        label="National Park"
                                        value={formData.nationalPark}
                                        onChange={e => setFormData({ ...formData, nationalPark: e.target.value })}
                                        className="rounded-full h-12"
                                        placeholder="National park name"
                                    />
                                </div>
                                <InputField
                                    label="Tags (comma-separated)"
                                    value={formData.tags.join(', ')} 
                                    onChange={e => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} 
                                    className="rounded-full h-12" 
                                    placeholder="tag1, tag2, tag3"
                                />
                                {formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.tags.map((tag, idx) => (
                                            <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Amenities & Features */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <Tent className="w-5 h-5 text-primary" />
                                    {t.newCampground.amenitiesFeatures}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {renderOptionGroup(t.filter["Internal facility"], "Internal facility", "facilities")}
                                {renderOptionGroup(t.filter["External facility"], "External facility", "externalFacilities")}
                                {renderOptionGroup(t.filter["Equipment for rent"], "Equipment for rent", "equipment")}
                                {renderOptionGroup(t.filter["Access type"], "Access type", "accessTypes")}
                                {renderOptionGroup("Accommodation Types", "Accommodation type", "accommodationTypes")}
                                {renderOptionGroup(t.filter["Activity"], "Activity", "activities")}
                                {renderOptionGroup(t.filter["Terrain"], "Terrain", "terrain")}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        {/* Location */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.settings}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <TruncatedLabel className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4" as="label">
                                        {t.newCampground.type} <span className="text-xs text-muted-foreground">{t.newCampground.multipleSelection}</span>
                                    </TruncatedLabel>
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {masterOptions['Campground type']?.map(opt => {
                                            const isSelected = formData.campSiteType.includes(opt.code);
                                            return (
                                                <div
                                                    key={opt.code}
                                                    onClick={() => toggleArrayItem('campSiteType', opt.code)}
                                                    className={cn(
                                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                                        isSelected
                                                            ? "bg-primary/10 border-primary"
                                                            : "bg-card border-border hover:border-primary/50"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                                            {language === 'th' ? opt.nameTh : opt.nameEn}
                                                        </TruncatedLabel>
                                                    </div>
                                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", isSelected ? "bg-primary" : "bg-muted")}>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Ownership */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.ownershipType}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                {/* Ownership Type - Private */}
                                <div
                                    onClick={() => setFormData({ ...formData, ownershipType: "PRIVATE" })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.ownershipType === "PRIVATE"
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                            {t.newCampground.private}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.privateDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ml-3", 
                                        formData.ownershipType === "PRIVATE" 
                                            ? "bg-primary border-primary" 
                                            : "bg-transparent border-border"
                                    )}>
                                        {formData.ownershipType === "PRIVATE" && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                    </div>
                                </div>
                                
                                {/* Ownership Type - National Park */}
                                <div
                                    onClick={() => setFormData({ ...formData, ownershipType: "NATIONAL_PARK" })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.ownershipType === "NATIONAL_PARK"
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                            {t.newCampground.nationalPark}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.nationalParkDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ml-3", 
                                        formData.ownershipType === "NATIONAL_PARK" 
                                            ? "bg-primary border-primary" 
                                            : "bg-transparent border-border"
                                    )}>
                                        {formData.ownershipType === "NATIONAL_PARK" && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pricing */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.pricing}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                {/* Free Toggle */}
                                <div
                                    onClick={() => setFormData({ ...formData, isFree: !formData.isFree })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.isFree
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                            {t.newCampground.isFree}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.isFreeDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0 ml-3", formData.isFree ? "bg-primary" : "bg-muted")}>
                                        {formData.isFree && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </div>
                                </div>

                                {/* Pricing (only show when not free) */}
                                {!formData.isFree && (
                                    <div className="space-y-4 pt-2">
                                        <InputField
                                            label={t.newCampground.minPrice}
                                            type="number"
                                            value={formData.priceLow}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, priceLow: val === "" ? "" : parseFloat(val) });
                                            }}
                                            leftIcon={<span className="text-muted-foreground text-sm">฿</span>}
                                            className="rounded-full h-12"
                                            placeholder="e.g. 500"
                                            error={formData.priceLow && formData.priceHigh && Number(formData.priceLow) > Number(formData.priceHigh) ? t.newCampground.minPriceError : undefined}
                                        />
                                        <InputField
                                            label={t.newCampground.maxPrice}
                                            type="number"
                                            value={formData.priceHigh}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, priceHigh: val === "" ? "" : parseFloat(val) });
                                            }}
                                            leftIcon={<span className="text-muted-foreground text-sm">฿</span>}
                                            className="rounded-full h-12"
                                            placeholder="e.g. 1200"
                                            error={formData.priceLow && formData.priceHigh && Number(formData.priceLow) > Number(formData.priceHigh) ? t.newCampground.maxPriceError : undefined}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Capacity & Ground Type */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.capacity}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Use Spot View Toggle */}
                                <div
                                    onClick={() => setFormData({ ...formData, useSpotView: !formData.useSpotView })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.useSpotView
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground flex items-center gap-2" as="div">
                                            <Grid3x3 className="w-4 h-4 shrink-0" />
                                            {t.newCampground.useSpotView}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.useSpotViewDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", formData.useSpotView ? "bg-primary" : "bg-muted")}>
                                        {formData.useSpotView && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </div>
                                </div>

                                {/* CTA to Create Spots when useSpotView is enabled */}
                                {formData.useSpotView && (
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-foreground mb-1">{t.newCampground.spotViewEnabled}</p>
                                                <p className="text-xs text-muted-foreground mb-3">{t.newCampground.createSpotsDesc}</p>
                                                <Link href={isEditing ? `/dashboard/campsites/${initialData.id}/spots` : "#"} onClick={(e) => {
                                                    if (!isEditing) {
                                                        e.preventDefault();
                                                        alert("Please save the camp site first before creating spots");
                                                    }
                                                }}>
                                                    <Button
                                                        type="button"
                                                        className="bg-primary hover:bg-primary/90 text-white rounded-full font-medium"
                                                    >
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        {t.newCampground.createSpots}
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Manual Capacity Input (only show when useSpotView is false) */}
                                {!formData.useSpotView && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <InputField
                                                label={t.newCampground.maxGuestsPerDay}
                                                type="number"
                                                min="1"
                                                value={formData.maxGuestsPerDay}
                                                onChange={e => setFormData({ ...formData, maxGuestsPerDay: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                                className="rounded-full h-12"
                                                placeholder="e.g. 50"
                                                error={formData.maxGuestsPerDay && (isNaN(Number(formData.maxGuestsPerDay)) || Number(formData.maxGuestsPerDay) < 1) ? "Must be at least 1" : undefined}
                                            />
                                            <InputField
                                                label={t.newCampground.maxTentsPerDay}
                                                type="number"
                                                min="1"
                                                value={formData.maxTentsPerDay}
                                                onChange={e => setFormData({ ...formData, maxTentsPerDay: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                                className="rounded-full h-12"
                                                placeholder="e.g. 20"
                                                error={formData.maxTentsPerDay && (isNaN(Number(formData.maxTentsPerDay)) || Number(formData.maxTentsPerDay) < 1) ? "Must be at least 1" : undefined}
                                            />
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.groundType}</Label>
                                            <div className="space-y-3">
                                                {[
                                                    { code: 'STONE', key: 'groundTypeStone' },
                                                    { code: 'GRASS', key: 'groundTypeGrass' },
                                                    { code: 'CONCRETE', key: 'groundTypeConcrete' },
                                                    { code: 'WOOD', key: 'groundTypeWood' }
                                                ].map((type) => (
                                                    <div key={type.code} className="flex items-center gap-4">
                                                        <div className="w-32">
                                                            <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground">{t.newCampground[type.key as keyof typeof t.newCampground]}</Label>
                                                        </div>
                                                        <InputField
                                                            type="number"
                                                            min="0"
                                                            value={formData.groundType[type.code] || 0}
                                                            onChange={e => {
                                                                const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                                setFormData({
                                                                    ...formData,
                                                                    groundType: {
                                                                        ...formData.groundType,
                                                                        [type.code]: value
                                                                    }
                                                                });
                                                            }}
                                                            className="rounded-full h-10 flex-1 max-w-32"
                                                            placeholder="0"
                                                            containerClassName="flex-1 max-w-32"
                                                            labelClassName="hidden"
                                                            error={formData.groundType[type.code] && (isNaN(Number(formData.groundType[type.code])) || Number(formData.groundType[type.code]) < 0) ? "Must be 0 or greater" : undefined}
                                                        />
                                                        <span className="text-sm text-muted-foreground">{t.newCampground.spots}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Times */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.operations}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <InputField
                                    label={t.newCampground.checkIn}
                                    type="time"
                                    value={formData.checkInTime}
                                    onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                                    className="rounded-full h-12"
                                />
                                <InputField
                                    label={t.newCampground.checkOut}
                                    type="time"
                                    value={formData.checkOutTime}
                                    onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                                    className="rounded-full h-12"
                                />
                            </CardContent>
                        </Card>

                        {/* Status & Visibility */}
                        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
                            <CardHeader className="bg-muted/40 border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.statusVisibility}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                <div
                                    onClick={() => setFormData({ ...formData, isVerified: !formData.isVerified })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.isVerified
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                            {t.newCampground.verified}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.verifiedDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", formData.isVerified ? "bg-primary" : "bg-muted")}>
                                        {formData.isVerified && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </div>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.isActive
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                            {t.newCampground.active}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.activeDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", formData.isActive ? "bg-primary" : "bg-muted")}>
                                        {formData.isActive && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </div>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.isPublished
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                            {t.newCampground.published}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.publishedDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", formData.isPublished ? "bg-primary" : "bg-muted")}>
                                        {formData.isPublished && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </div>
                                </div>
                                
                                {/* Pet Friendly Toggle */}
                                <div
                                    onClick={() => setFormData({ ...formData, petFriendly: !formData.petFriendly })}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                                        formData.petFriendly
                                            ? "bg-primary/10 border-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                            {t.newCampground.petFriendly}
                                        </TruncatedLabel>
                                        <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                            {t.newCampground.petFriendlyDesc}
                                        </TruncatedLabel>
                                    </div>
                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", formData.petFriendly ? "bg-primary" : "bg-muted")}>
                                        {formData.petFriendly && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </form>
        </div>
    );
}
