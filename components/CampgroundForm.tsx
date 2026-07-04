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
    Grid3x3,
    TriangleAlert
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { LogoUpload } from "@/components/LogoUpload";
import { LocationPicker } from "@/components/LocationPicker";
import { InputField } from "@/components/ui/input-field";
import { Badge } from "@/components/ui/badge";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { getFilterOptions } from "@/app/actions/getFilterOptions";
import { CANCELLATION_POLICY_VALUES } from "@/lib/cancellation-policy";
import { campSiteSchema } from "@/lib/validations/campsite";
import type { TranslationType } from "@/locales/translations";
import * as LucideIcons from "lucide-react";

// CAM-341: Radix Select forbids an empty-string item value, so the "not set"
// cancellation-policy option uses this sentinel; onValueChange maps it back to "".
const CANCELLATION_POLICY_NOT_SET = "NOT_SET";

interface CampgroundFormProps {
    initialData?: any;
    isEditing?: boolean;
}

// CAM-348: GET /api/campsites/[id] returns `images` as an Image[] relation
// (S4b) while the pre-S4b payload carried a CSV string — normalize both to
// the url-string list the form state and the PUT contract expect. Exported
// for behavioral tests (no jsdom in this repo).
export function toImageUrlList(images: unknown): string[] {
    if (Array.isArray(images)) {
        return images
            .map((img) => (typeof img === "string" ? img : (img as { url?: string } | null)?.url ?? ""))
            .filter(Boolean);
    }
    if (typeof images === "string") {
        return images.split(",").filter(Boolean);
    }
    return [];
}

// CAM-356: the PUT/POST routes forward the zod field details from
// `validation.error.format()` on a 400 (see lib/api-utils.ts apiError) but the
// old submit handler only read `err.error` (the flat "Validation Error"
// string) and discarded `err.details`. This walks the format() tree (any
// depth) and groups every message under its TOP-LEVEL field key so any field
// - current or future - can be mapped to its input/label generically, not
// just the ones known today. Exported for unit tests.
export function flattenZodFieldErrors(formatted: unknown): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    function walk(node: unknown, rootKey: string | null) {
        if (!node || typeof node !== "object") return;
        const obj = node as Record<string, unknown>;
        const errors = (obj as { _errors?: unknown })._errors;
        if (Array.isArray(errors) && errors.length > 0 && rootKey) {
            result[rootKey] = [...(result[rootKey] ?? []), ...(errors as string[])];
        }
        for (const key of Object.keys(obj)) {
            if (key === "_errors") continue;
            walk(obj[key], rootKey ?? key);
        }
    }

    walk(formatted, null);
    return result;
}

// Maps a campSiteSchema field name to the Thai/EN label already shown next to
// its input, pulled from the SAME locale keys the form renders (never a new
// hardcoded string). EC (CAM-356): a field with no mapping (future schema
// drift) falls back to the raw field name rather than crashing.
const FIELD_LABEL_RESOLVERS: Record<string, (t: TranslationType) => string> = {
    nameTh: (t) => t.newCampground.nameTh,
    nameEn: (t) => t.newCampground.nameEn,
    description: (t) => t.newCampground.description,
    campSiteType: (t) => t.filter["Campground type"],
    accessTypes: (t) => t.filter["Access type"],
    accommodationTypes: (t) => t.filter["Accommodation type"],
    facilities: (t) => t.filter["Internal facility"],
    externalFacilities: (t) => t.filter["External facility"],
    equipment: (t) => t.filter["Equipment for rent"],
    activities: (t) => t.filter["Activity"],
    terrain: (t) => t.filter["Terrain"],
    latitude: (t) => t.newCampground.latitude,
    longitude: (t) => t.newCampground.longitude,
    checkInTime: (t) => t.newCampground.checkIn,
    checkOutTime: (t) => t.newCampground.checkOut,
    priceLow: (t) => t.newCampground.minPrice,
    priceHigh: (t) => t.newCampground.maxPrice,
    locationId: (t) => t.newCampground.location,
    address: (t) => t.newCampground.address,
    directions: (t) => t.newCampground.directions,
    videoUrl: (t) => t.newCampground.videoUrl,
    phone: (t) => t.newCampground.phoneNumber,
    lineId: (t) => t.newCampground.lineId,
    facebookUrl: (t) => t.newCampground.facebookUrl,
    facebookMessageUrl: (t) => t.newCampground.facebookMessageUrl,
    tiktokUrl: (t) => t.newCampground.tiktokUrl,
    feeInfo: (t) => t.newCampground.feeInfo,
    toiletInfo: (t) => t.campground.restrooms,
    minimumAge: (t) => t.campground.minimumAge,
    extraFeeAmount: (t) => t.newCampground.extraFeeAmountLabel,
    extraFeeLabel: (t) => t.newCampground.extraFeeLabelField,
    cancellationPolicy: (t) => t.campground.cancellationPolicy.title,
    partner: (t) => t.newCampground.partner,
    nationalPark: (t) => t.newCampground.nationalPark,
    logo: (t) => t.newCampground.uploadLogo,
    images: (t) => t.newCampground.photos,
    tags: (t) => t.newCampground.tags,
    isVerified: (t) => t.newCampground.verified,
    isActive: (t) => t.newCampground.active,
    isPublished: (t) => t.newCampground.published,
    maxGuestsPerDay: (t) => t.newCampground.maxGuestsPerDay,
    maxTentsPerDay: (t) => t.newCampground.maxTentsPerDay,
    groundType: (t) => t.newCampground.groundType,
    ownershipType: (t) => t.newCampground.ownershipType,
    isFree: (t) => t.newCampground.isFree,
    petFriendly: (t) => t.newCampground.petFriendly,
    // CAM-351: useSpotView is now the explicit capacity-mode chooser; label
    // the validation-banner mapping with the mode question copy (the field's
    // own visible label), not the retired "Use Spot View" jargon key.
    useSpotView: (t) => t.newCampground.capacityModeQuestion,
};

// EC (CAM-356): an unmapped/future field name lists the raw path once instead
// of crashing or silently dropping the field from the banner.
export function getFieldLabel(t: TranslationType, field: string): string {
    return FIELD_LABEL_RESOLVERS[field]?.(t) ?? field;
}

// Maps a field name to the Card section id it's rendered in, so submit-fail
// can scroll/focus the section containing the first failing field.
const FIELD_SECTION_ID: Record<string, string> = {
    nameTh: "basic-info", nameEn: "basic-info", description: "basic-info",
    videoUrl: "photos", logo: "photos", images: "photos",
    address: "location", directions: "location", latitude: "location",
    longitude: "location", locationId: "location",
    phone: "contact-info", lineId: "contact-info", facebookUrl: "contact-info",
    facebookMessageUrl: "contact-info", tiktokUrl: "contact-info",
    minimumAge: "additional-info", feeInfo: "additional-info", toiletInfo: "additional-info",
    partner: "additional-info", nationalPark: "additional-info", tags: "additional-info",
    facilities: "amenities", externalFacilities: "amenities", equipment: "amenities",
    accessTypes: "amenities", accommodationTypes: "amenities", activities: "amenities", terrain: "amenities",
    campSiteType: "campground-type",
    ownershipType: "ownership",
    priceLow: "price", priceHigh: "price", isFree: "price",
    extraFeeAmount: "extra-fee", extraFeeLabel: "extra-fee",
    cancellationPolicy: "cancellation-policy",
    maxGuestsPerDay: "zones", maxTentsPerDay: "zones", groundType: "zones", useSpotView: "zones",
    checkInTime: "operations", checkOutTime: "operations",
    isVerified: "status-visibility", isActive: "status-visibility",
    isPublished: "status-visibility", petFriendly: "status-visibility",
};

// Composes the banner copy from locale labels only (no raw field key / jargon
// in the normal path - EC fallback is the raw path, see getFieldLabel).
export function buildValidationBannerMessage(t: TranslationType, fieldKeys: string[]): string {
    if (fieldKeys.length === 0) return t.newCampground.validationErrorGeneric;
    const labels = fieldKeys.map((key) => getFieldLabel(t, key));
    return t.newCampground.validationErrorBanner.replace("{fields}", labels.join(", "));
}

export function CampgroundForm({ initialData, isEditing = false }: CampgroundFormProps) {
    const router = useRouter();
    const { t, language } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [operator, setOperator] = useState<any>(null);
    const [masterOptions, setMasterOptions] = useState<Record<string, any[]>>({});
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [serverError, setServerError] = useState<string | null>(null);
    // CAM-356: per-field zod messages (client pre-check or the server's 400
    // `details`), keyed by the top-level campSiteSchema field name.
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [logoError, setLogoError] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

        // Extra fee + cancellation policy (CAM-341). New listing defaults to no fee
        // and no policy (AC-7) — never pre-filled/implied.
        extraFeeAmount: "" as number | string,
        extraFeeLabel: "",
        cancellationPolicy: "" as string,

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
            // S4a: taxonomy comes back as the `options` MasterData relation; rebuild the
            // per-group code arrays the form's multi-selects expect.
            const _opts: { code: string; group: string }[] = initialData.options || [];
            const _byGroup = (g: string) => _opts.filter((o) => o.group === g).map((o) => o.code);
            setFormData({
                nameTh: initialData.nameTh || "",
                nameEn: initialData.nameEn || "",
                description: initialData.description || "",
                campSiteType: initialData.campSiteType || initialData.campgroundType ? (Array.isArray(initialData.campSiteType || initialData.campgroundType) ? (initialData.campSiteType || initialData.campgroundType) : (initialData.campSiteType || initialData.campgroundType).split(',').filter(Boolean)) : [],
                accessTypes: _byGroup('Access type'),
                accommodationTypes: initialData.accommodationTypes ? initialData.accommodationTypes.split(',').filter(Boolean) : [],
                facilities: _byGroup('Internal facility'),
                externalFacilities: _byGroup('External facility'),
                equipment: _byGroup('Equipment for rent'),
                activities: _byGroup('Activity'),
                terrain: _byGroup('Terrain'),
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

                // Extra fee + cancellation policy (CAM-341): the Decimal arrives
                // serialized over JSON — coerce with Number() (mirrors priceLow).
                // Unset stays "" so the select/input render empty, not a false 0.
                extraFeeAmount:
                    initialData.extraFeeAmount !== undefined && initialData.extraFeeAmount !== null
                        ? Number(initialData.extraFeeAmount)
                        : "",
                extraFeeLabel: initialData.extraFeeLabel || "",
                cancellationPolicy: initialData.cancellationPolicy || "",

                images: toImageUrlList(initialData.images),
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

    // EC-6 (CAM-341/CAM-305 BR-2): a completeness-card deep-link (#extra-fee,
    // #cancellation-policy, ...) opens before the form has rendered its sections
    // (optionsLoading gates the whole return). Resolve the hash once the real
    // form mounts so the link lands on the section instead of staying inert.
    useEffect(() => {
        if (optionsLoading) return;
        const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
        if (!hash) return;
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [optionsLoading]);

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
                            <button
                                key={opt.code}
                                type="button"
                                onClick={() => toggleArrayItem(fieldName, opt.code)}
                                aria-pressed={isSelected}
                                className={cn(
                                    "cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    isSelected
                                        ? "bg-primary/10 border-primary"
                                        : "bg-card border-border hover:border-primary/50"
                                )}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center transition-colors shrink-0", isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                        <IconComp className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={cn("text-sm font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>
                                        {language === 'th' ? opt.nameTh : opt.nameEn}
                                    </span>
                                </div>
                                <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", isSelected ? "bg-primary" : "bg-muted")}>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // First message for a field, if any (client pre-check or server 400 details).
    const zErr = (field: string): string | undefined => fieldErrors[field]?.[0];

    // Scrolls + moves a11y focus to the Card section holding the first failing
    // field (Cards carry tabIndex={-1} so they're programmatically focusable).
    const scrollToFirstErrorField = (topLevelFields: string[]) => {
        const firstField = topLevelFields[0];
        const sectionId = firstField ? FIELD_SECTION_ID[firstField] : undefined;
        if (!sectionId || typeof document === "undefined") return;
        const section = document.getElementById(sectionId);
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
        section?.focus({ preventScroll: true });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setHasSubmitted(true);
        setIsLoading(true);
        setFieldErrors({});

        try {
            // CAM-351 BR-2/AC-11: WHOLE-CAMP mode requires maxGuestsPerDay >= 1
            // to save. The shared campSiteSchema keeps this field optional (a
            // PER-SPOT save omits it) — this business rule is enforced here
            // instead of widening that schema, reusing the same
            // fieldErrors/banner/scroll wiring the server-side 400 path uses.
            if (!formData.useSpotView) {
                const guests = formData.maxGuestsPerDay;
                const guestsInvalid = guests === "" || isNaN(Number(guests)) || Number(guests) < 1;
                if (guestsInvalid) {
                    setFieldErrors({ maxGuestsPerDay: [t.newCampground.maxGuestsPerDayError] });
                    setServerError(buildValidationBannerMessage(t, ["maxGuestsPerDay"]));
                    scrollToFirstErrorField(["maxGuestsPerDay"]);
                    return;
                }
            }

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
                // Extra fee + cancellation policy (CAM-341, BR-6 v1.1): blank sends
                // an EXPLICIT null (not undefined) - undefined is dropped by
                // JSON.stringify and the PUT then skips the field (partial-update
                // semantics), which can never clear an existing value. null is
                // sent over the wire and the PUT/zod now accept it as "clear".
                extraFeeAmount: formData.extraFeeAmount === "" ? null : Number(formData.extraFeeAmount),
                extraFeeLabel: formData.extraFeeLabel === "" ? null : formData.extraFeeLabel,
                cancellationPolicy: formData.cancellationPolicy === "" ? null : formData.cancellationPolicy,
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
                // CAM-356: campSiteSchema.groundType is z.record(string, number) - an
                // OBJECT, not a JSON string. Sending JSON.stringify(...) here always
                // failed that shape check once a camp had any ground type set (the
                // repro camp's WOOD:6, set before this form ever validated it),
                // surfacing only as the bare "Validation Error" banner. Send the
                // object as-is; the PUT/POST routes already stringify it for storage
                // (`typeof data.groundType === 'string' ? ... : JSON.stringify(...)`).
                groundType: Object.keys(formData.groundType).length > 0 ? formData.groundType : undefined,

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

            // AC-2 (CAM-356): client-side pre-check with the SAME shared schema the
            // server enforces - UX only (saves a round trip); the server stays
            // authoritative and re-validates on every request regardless.
            const clientCheck = campSiteSchema.partial().safeParse(campPayload);
            if (!clientCheck.success) {
                const errors = flattenZodFieldErrors(clientCheck.error.format());
                const topFields = Object.keys(errors);
                setFieldErrors(errors);
                setServerError(buildValidationBannerMessage(t, topFields));
                scrollToFirstErrorField(topFields);
                return;
            }

            const url = isEditing ? `/api/campsites/${initialData.id}` : '/api/campsites';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campPayload)
            });

            if (res.ok) {
                setHasSubmitted(false);
                setServerError(null);
                setFieldErrors({});
                router.push("/dashboard/campsites");
                router.refresh();
            } else {
                const err = await res.json();
                // AC-1 (CAM-356): surface the zod field details from the 400 body
                // (see lib/api-utils.ts apiError) instead of the bare "Validation
                // Error" string - inline per-field text + a banner naming the
                // failing fields by their real label, generic for ANY field.
                const errors = flattenZodFieldErrors(err.details);
                const topFields = Object.keys(errors);
                setFieldErrors(errors);
                setServerError(topFields.length > 0 ? buildValidationBannerMessage(t, topFields) : (err.error || t.newCampground.errorOccurred));
                scrollToFirstErrorField(topFields);
            }
        } catch (error) {
            console.error("Save error:", error);
            setServerError(t.newCampground.errorOccurred);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/campsites/${initialData.id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push("/dashboard/campsites");
                router.refresh();
            } else {
                toast.error(t.newCampground.deleteError);
            }
        } catch (e) {
            toast.error(t.newCampground.deleteError);
        } finally {
            setIsLoading(false);
            setDeleteDialogOpen(false);
        }
    };

    // Extra fee validation + transparency nudge (CAM-341 BR-1/BR-2/BR-4).
    const extraFeeAmountFilled = formData.extraFeeAmount !== "";
    const extraFeeLabelFilled = formData.extraFeeLabel.trim().length > 0;
    // BR-4: hint only on a PARTIAL fill (one side set, the other empty) — both
    // filled or both empty are valid "complete" states and show no hint (EC-3).
    const showExtraFeeHint = extraFeeAmountFilled !== extraFeeLabelFilled;
    const extraFeeAmountError =
        extraFeeAmountFilled &&
        (isNaN(Number(formData.extraFeeAmount)) ||
            Number(formData.extraFeeAmount) < 0 ||
            Number(formData.extraFeeAmount) > 100000)
            ? t.newCampground.extraFeeAmountError
            : undefined;
    const extraFeeLabelError =
        formData.extraFeeLabel.length > 100 ? t.newCampground.extraFeeLabelError : undefined;

    // CAM-351 — capacity-mode derived state for the Capacity card.
    // BR-1/BR-6: the mode as it was when the form LOADED (not reactive to the
    // in-session toggle), captured once via a lazy initializer, so a switch
    // this session can show its own transient copy (AC-5/AC-6) distinct from
    // the persisted-state copy (AC-3/AC-4). No initialData (create) -> the
    // WHOLE-CAMP default (AC-1).
    const [initialModeWasPerSpot] = useState<boolean>(() => initialData?.useSpotView ?? false);
    // BR-3/BR-7: non-deleted spot count. getCampSiteWithCapacity only
    // populates spotStats for a PER-SPOT camp (lib/spot-aggregation.ts).
    const spotCount: number = initialData?.spotStats?.totalSpots ?? 0;
    // BR-3: the derived guest-capacity SUM (not the spot count) - the GET
    // payload already overrides maxGuestsPerDay with this sum for a
    // PER-SPOT camp (lib/spot-aggregation.ts getCampSiteWithCapacity).
    const derivedGuestTotal: number = initialData?.useSpotView ? (initialData?.maxGuestsPerDay ?? 0) : 0;
    const justSwitchedToPerSpot = formData.useSpotView && !initialModeWasPerSpot;
    const justSwitchedToWholeCamp = !formData.useSpotView && initialModeWasPerSpot;

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
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center bg-muted shrink-0">
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
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t.dashboard.hostPanel}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {isEditing && (
                                <Button
                                    variant="destructive"
                                    onClick={() => setDeleteDialogOpen(true)}
                                    disabled={isLoading}
                                    aria-label={t.newCampground.deleteAria}
                                    className="rounded-full shadow-none w-11 h-11 p-0 sm:w-auto sm:px-4 sm:h-11"
                                >
                                    <Trash2 className="w-4 h-4 sm:mr-2" />
                                    <span className="hidden sm:inline">{t.common.delete}</span>
                                </Button>
                            )}
                            <Button
                                onClick={handleSubmit}
                                size="lg"
                                disabled={isLoading}
                                aria-busy={isLoading}
                                className="px-6 rounded-full font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90"
                            >
                                {isLoading ? t.newCampground.saving : <><Save className="w-4 h-4 mr-2" /> {isEditing ? t.newCampground.update : t.newCampground.saveListing}</>}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <form noValidate onSubmit={handleSubmit} className="w-full px-4 md:px-6 py-8">
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
                        <Card id="basic-info" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <Info className="w-5 h-5 text-primary" />
                                    {t.newCampground.basicInfo}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField
                                        label={t.newCampground.nameTh}
                                        required
                                        value={formData.nameTh}
                                        onChange={e => setFormData({ ...formData, nameTh: e.target.value })}
                                        inputSize="lg"
                                        error={zErr('nameTh')}
                                    />
                                    <InputField
                                        label={t.newCampground.nameEn}
                                        required
                                        value={formData.nameEn}
                                        onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                                        inputSize="lg"
                                        error={zErr('nameEn')}
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
                        <Card id="photos" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    {t.newCampground.mediaBranding}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-8 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.uploadLogo}</Label>
                                    <LogoUpload
                                        value={formData.logo}
                                        onChange={(url) => setFormData({ ...formData, logo: url })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.common.photos}</Label>
                                    <ImageUpload
                                        value={formData.images}
                                        onChange={urls => setFormData({ ...formData, images: urls })}
                                        onRemove={url => setFormData({ ...formData, images: formData.images.filter(u => u !== url) })}
                                    />
                                </div>
                                <InputField
                                    label={t.newCampground.videoUrl}
                                    value={formData.videoUrl}
                                    onChange={e => setFormData({ ...formData, videoUrl: e.target.value })}
                                    inputSize="lg"
                                    placeholder={t.newCampground.videoUrlPlaceholder}
                                    error={(formData.videoUrl && !/^https?:\/\/.+/.test(formData.videoUrl) ? "Invalid URL format" : undefined) || zErr('videoUrl')}
                                />
                            </CardContent>
                        </Card>

                        {/* Location */}
                        <Card id="location" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <MapPin className="w-5 h-5 text-primary" />
                                    {t.newCampground.location}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-8 space-y-6">
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
                                        inputSize="lg"
                                        placeholder={t.newCampground.provincePlaceholder}
                                    />
                                    <InputField
                                        label={t.newCampground.district}
                                        value={formData.district}
                                        onChange={e => setFormData({ ...formData, district: e.target.value })}
                                        inputSize="lg"
                                        placeholder={t.newCampground.districtLabelPlaceholder}
                                    />
                                </div>

                                <InputField
                                    label={t.newCampground.address}
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    inputSize="lg"
                                    placeholder={t.newCampground.addressPlaceholder}
                                    error={zErr('address')}
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
                                        inputSize="lg"
                                        value={formData.latitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, latitude: val === "" ? "" : parseFloat(val) });
                                        }}
                                        placeholder="13.7563"
                                        error={(formData.latitude && (isNaN(Number(formData.latitude)) || Number(formData.latitude) < -90 || Number(formData.latitude) > 90) ? "Latitude must be between -90 and 90" : undefined) || zErr('latitude')}
                                    />
                                    <InputField
                                        label={t.newCampground.longitude}
                                        type="number" 
                                        step="any"
                                        inputSize="lg"
                                        value={formData.longitude}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, longitude: val === "" ? "" : parseFloat(val) });
                                        }}
                                        placeholder="100.5018"
                                        error={(formData.longitude && (isNaN(Number(formData.longitude)) || Number(formData.longitude) < -180 || Number(formData.longitude) > 180) ? "Longitude must be between -180 and 180" : undefined) || zErr('longitude')}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contact Information */}
                        <Card id="contact-info" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <Phone className="w-5 h-5 text-primary" />
                                    {t.newCampground.contactInfo}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InputField
                                        label={t.newCampground.phoneNumber}
                                        type="tel"
                                        value={formData.phone} 
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                                        inputSize="lg" 
                                        placeholder="081-234-5678"
                                        leftIcon={<Phone className="w-4 h-4" />}
                                        error={zErr('phone')}
                                    />
                                    <InputField
                                        label={t.newCampground.lineId}
                                        value={formData.lineId}
                                        onChange={e => setFormData({ ...formData, lineId: e.target.value })}
                                        inputSize="lg"
                                        placeholder="@lineid or lineid123"
                                        leftIcon={<MessageCircle className="w-4 h-4" />}
                                        error={zErr('lineId')}
                                    />
                                </div>
                                <InputField
                                    label={t.newCampground.facebookUrl}
                                    type="url"
                                    value={formData.facebookUrl}
                                    onChange={e => setFormData({ ...formData, facebookUrl: e.target.value })}
                                    inputSize="lg"
                                    placeholder="https://facebook.com/yourpage"
                                    leftIcon={<Facebook className="w-4 h-4" />}
                                    error={(formData.facebookUrl && !/^https?:\/\/.+/.test(formData.facebookUrl) ? "Invalid URL format" : undefined) || zErr('facebookUrl')}
                                />
                                <InputField
                                    label={t.newCampground.facebookMessageUrl}
                                    type="url"
                                    value={formData.facebookMessageUrl}
                                    onChange={e => setFormData({ ...formData, facebookMessageUrl: e.target.value })}
                                    inputSize="lg"
                                    placeholder="https://m.me/yourpage"
                                    leftIcon={<MessageCircle className="w-4 h-4" />}
                                    error={(formData.facebookMessageUrl && !/^https?:\/\/.+/.test(formData.facebookMessageUrl) ? "Invalid URL format" : undefined) || zErr('facebookMessageUrl')}
                                />
                                <InputField
                                    label={t.newCampground.tiktokUrl}
                                    type="url"
                                    value={formData.tiktokUrl}
                                    onChange={e => setFormData({ ...formData, tiktokUrl: e.target.value })}
                                    inputSize="lg"
                                    placeholder="https://tiktok.com/@username"
                                    leftIcon={<Video className="w-4 h-4" />}
                                    error={(formData.tiktokUrl && !/^https?:\/\/.+/.test(formData.tiktokUrl) ? "Invalid URL format" : undefined) || zErr('tiktokUrl')}
                                />
                            </CardContent>
                        </Card>

                        {/* Additional Info */}
                        <Card id="additional-info" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                    <Info className="w-5 h-5 text-primary" />
                                    {t.newCampground.additionalDetails}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-8 space-y-6">
                                <InputField
                                    label={t.campground.minimumAge}
                                    type="number"
                                    value={formData.minimumAge}
                                    onChange={e => setFormData({ ...formData, minimumAge: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                    inputSize="lg"
                                    error={(formData.minimumAge && (isNaN(Number(formData.minimumAge)) || Number(formData.minimumAge) < 0) ? "Minimum age must be a positive number" : undefined) || zErr('minimumAge')}
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
                                        label={t.newCampground.partner}
                                        value={formData.partner}
                                        onChange={e => setFormData({ ...formData, partner: e.target.value })}
                                        inputSize="lg"
                                        placeholder={t.newCampground.partnerPlaceholder}
                                        error={zErr('partner')}
                                    />
                                    <InputField
                                        label={t.newCampground.nationalPark}
                                        value={formData.nationalPark}
                                        onChange={e => setFormData({ ...formData, nationalPark: e.target.value })}
                                        inputSize="lg"
                                        placeholder={t.newCampground.nationalParkPlaceholder}
                                        error={zErr('nationalPark')}
                                    />
                                </div>
                                <InputField
                                    label={t.newCampground.tags}
                                    value={formData.tags.join(', ')}
                                    onChange={e => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })}
                                    inputSize="lg"
                                    placeholder={t.newCampground.tagsPlaceholder}
                                    error={zErr('tags')}
                                />
                                {formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.tags.map((tag, idx) => (
                                            <Badge key={idx} variant="secondary">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Amenities & Features */}
                        <Card id="amenities" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
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
                                {renderOptionGroup(t.filter["Accommodation type"], "Accommodation type", "accommodationTypes")}
                                {renderOptionGroup(t.filter["Activity"], "Activity", "activities")}
                                {renderOptionGroup(t.filter["Terrain"], "Terrain", "terrain")}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        {/* Location */}
                        <Card id="campground-type" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.settings}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <TruncatedLabel className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4" as="label">
                                        {t.newCampground.type} <span className="text-xs text-muted-foreground">{t.newCampground.multipleSelection}</span>
                                    </TruncatedLabel>
                                    {zErr('campSiteType') && (
                                        <p className="text-sm px-4 text-destructive">{zErr('campSiteType')}</p>
                                    )}
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {masterOptions['Campground type']?.map(opt => {
                                            const isSelected = formData.campSiteType.includes(opt.code);
                                            return (
                                                <button
                                                    key={opt.code}
                                                    type="button"
                                                    onClick={() => toggleArrayItem('campSiteType', opt.code)}
                                                    aria-pressed={isSelected}
                                                    className={cn(
                                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Ownership */}
                        <Card id="ownership" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.ownershipType}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                {zErr('ownershipType') && (
                                    <p className="text-sm px-4 text-destructive">{zErr('ownershipType')}</p>
                                )}
                                {/* Ownership Type - Private */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, ownershipType: "PRIVATE" })}
                                    aria-pressed={formData.ownershipType === "PRIVATE"}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                </button>

                                {/* Ownership Type - National Park */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, ownershipType: "NATIONAL_PARK" })}
                                    aria-pressed={formData.ownershipType === "NATIONAL_PARK"}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                </button>
                            </CardContent>
                        </Card>

                        {/* Pricing */}
                        <Card id="price" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.pricing}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                {/* Free Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isFree: !formData.isFree })}
                                    aria-pressed={formData.isFree}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                </button>

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
                                            inputSize="lg"
                                            placeholder="e.g. 500"
                                            error={(formData.priceLow && formData.priceHigh && Number(formData.priceLow) > Number(formData.priceHigh) ? t.newCampground.minPriceError : undefined) || zErr('priceLow')}
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
                                            inputSize="lg"
                                            placeholder="e.g. 1200"
                                            error={(formData.priceLow && formData.priceHigh && Number(formData.priceLow) > Number(formData.priceHigh) ? t.newCampground.maxPriceError : undefined) || zErr('priceHigh')}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Extra Fee (CAM-341) */}
                        <Card id="extra-fee" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.extraFee}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <InputField
                                    label={t.newCampground.extraFeeAmountLabel}
                                    type="number"
                                    value={formData.extraFeeAmount}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setFormData({ ...formData, extraFeeAmount: val === "" ? "" : parseFloat(val) });
                                    }}
                                    leftIcon={<span className="text-muted-foreground text-sm">฿</span>}
                                    inputSize="lg"
                                    placeholder={t.newCampground.extraFeeAmountPlaceholder}
                                    helperText={t.newCampground.extraFeeAmountHelper}
                                    error={extraFeeAmountError || zErr('extraFeeAmount')}
                                />
                                <InputField
                                    label={t.newCampground.extraFeeLabelField}
                                    value={formData.extraFeeLabel}
                                    onChange={e => setFormData({ ...formData, extraFeeLabel: e.target.value })}
                                    inputSize="lg"
                                    placeholder={t.newCampground.extraFeeLabelPlaceholder}
                                    error={extraFeeLabelError || zErr('extraFeeLabel')}
                                />
                                {showExtraFeeHint && (
                                    <p className="text-sm px-4 text-muted-foreground">{t.newCampground.extraFeeHint}</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Cancellation Policy (CAM-341) */}
                        <Card id="cancellation-policy" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.campground.cancellationPolicy.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <Select
                                    value={formData.cancellationPolicy || CANCELLATION_POLICY_NOT_SET}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            cancellationPolicy: value === CANCELLATION_POLICY_NOT_SET ? "" : value,
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        aria-label={t.campground.cancellationPolicy.title}
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={CANCELLATION_POLICY_NOT_SET}>
                                            {t.campground.cancellationPolicy.notSet}
                                        </SelectItem>
                                        {CANCELLATION_POLICY_VALUES.map((value) => (
                                            <SelectItem key={value} value={value}>
                                                {t.campground.cancellationPolicy[value]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {zErr('cancellationPolicy') && (
                                    <p className="text-sm px-4 text-destructive mt-2">{zErr('cancellationPolicy')}</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Capacity & Ground Type (CAM-351: explicit mode chooser replaces the buried useSpotView toggle) */}
                        <Card id="zones" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.capacity}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* AC-1: explicit upfront capacity-mode chooser — ทั้งลาน is pre-selected by default */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.capacityModeQuestion}</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, useSpotView: false })}
                                            aria-pressed={!formData.useSpotView}
                                            data-testid="btn--capacity-mode-whole-camp"
                                            className={cn(
                                                "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                !formData.useSpotView
                                                    ? "bg-primary/10 border-primary"
                                                    : "bg-card border-border hover:border-primary/50"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <TruncatedLabel className="text-base font-semibold text-foreground" as="div">
                                                    {t.newCampground.capacityModeWholeCamp}
                                                </TruncatedLabel>
                                                <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                                    {t.newCampground.capacityModeWholeCampDesc}
                                                </TruncatedLabel>
                                            </div>
                                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ml-3",
                                                !formData.useSpotView
                                                    ? "bg-primary border-primary"
                                                    : "bg-transparent border-border"
                                            )}>
                                                {!formData.useSpotView && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, useSpotView: true })}
                                            aria-pressed={formData.useSpotView}
                                            data-testid="btn--capacity-mode-per-spot"
                                            className={cn(
                                                "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                formData.useSpotView
                                                    ? "bg-primary/10 border-primary"
                                                    : "bg-card border-border hover:border-primary/50"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <TruncatedLabel className="text-base font-semibold text-foreground flex items-center gap-2" as="div">
                                                    <Grid3x3 className="w-4 h-4 shrink-0" />
                                                    {t.newCampground.capacityModePerSpot}
                                                </TruncatedLabel>
                                                <TruncatedLabel className="text-xs text-muted-foreground mt-0.5" as="div">
                                                    {t.newCampground.capacityModePerSpotDesc}
                                                </TruncatedLabel>
                                            </div>
                                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ml-3",
                                                formData.useSpotView
                                                    ? "bg-primary border-primary"
                                                    : "bg-transparent border-border"
                                            )}>
                                                {formData.useSpotView && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* PER-SPOT mode: AC-3/AC-4/AC-6/BR-3/BR-4/BR-8 - derived read-only total, empty state, switch hint, link to spot management */}
                                {formData.useSpotView && (
                                    <div className="p-4 rounded-xl bg-info/5 border border-info/20" data-testid="section--capacity-per-spot">
                                        <div className="flex items-start gap-3">
                                            <Info className="w-4 h-4 shrink-0 text-info mt-0.5" aria-hidden="true" />
                                            <div className="flex-1">
                                                {justSwitchedToPerSpot ? (
                                                    <p className="text-sm font-semibold text-foreground mb-1" data-testid="text--capacity-switch-to-per-spot-hint">
                                                        {t.newCampground.capacitySwitchToPerSpotHint}
                                                    </p>
                                                ) : derivedGuestTotal > 0 ? (
                                                    <>
                                                        <p className="text-sm font-semibold text-foreground mb-1" data-testid="text--capacity-derived-total">
                                                            {t.newCampground.capacityDerivedTotal.replace("{N}", String(derivedGuestTotal))}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mb-3">{t.newCampground.capacityDerivedNote}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm font-semibold text-foreground mb-3" data-testid="text--capacity-derived-empty">
                                                        {t.newCampground.capacityDerivedEmpty}
                                                    </p>
                                                )}
                                                <Link href={isEditing ? `/dashboard/campsites/${initialData.id}/spots` : "#"} onClick={(e) => {
                                                    if (!isEditing) {
                                                        e.preventDefault();
                                                        toast.error(t.newCampground.saveBeforeSpots);
                                                    }
                                                }}>
                                                    <Button
                                                        type="button"
                                                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-medium"
                                                        data-testid="btn--capacity-manage-spots"
                                                    >
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        {t.newCampground.manageSpotsButton}
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* WHOLE-CAMP mode: AC-2/AC-5/AC-11/BR-2/BR-4 - manual inputs + switch-back warning */}
                                {!formData.useSpotView && (
                                    <>
                                        {justSwitchedToWholeCamp && spotCount > 0 && (
                                            <div className="p-4 rounded-xl bg-warning/5 border border-warning/20" data-testid="banner--capacity-switch-to-whole-warning">
                                                <div className="flex items-start gap-3">
                                                    <TriangleAlert className="w-4 h-4 shrink-0 text-warning mt-0.5" aria-hidden="true" />
                                                    <p className="text-sm text-foreground">
                                                        {t.newCampground.capacitySwitchToWholeWarning.replace("{N}", String(spotCount))}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <InputField
                                                label={t.newCampground.maxGuestsPerDay}
                                                type="number"
                                                min="1"
                                                value={formData.maxGuestsPerDay}
                                                onChange={e => setFormData({ ...formData, maxGuestsPerDay: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                                inputSize="lg"
                                                placeholder="e.g. 50"
                                                error={zErr('maxGuestsPerDay')}
                                            />
                                            <InputField
                                                label={t.newCampground.maxTentsPerDay}
                                                type="number"
                                                min="1"
                                                value={formData.maxTentsPerDay}
                                                onChange={e => setFormData({ ...formData, maxTentsPerDay: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                                inputSize="lg"
                                                placeholder="e.g. 20"
                                                error={(formData.maxTentsPerDay && (isNaN(Number(formData.maxTentsPerDay)) || Number(formData.maxTentsPerDay) < 1) ? "Must be at least 1" : undefined) || zErr('maxTentsPerDay')}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.newCampground.groundType}</Label>
                                            {zErr('groundType') && (
                                                <p className="text-sm px-4 text-destructive">{zErr('groundType')}</p>
                                            )}
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
                                                            className="flex-1 max-w-32"
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
                        <Card id="operations" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.operations}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <InputField
                                    label={t.newCampground.checkIn}
                                    type="time"
                                    value={formData.checkInTime}
                                    onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                                    inputSize="lg"
                                    error={zErr('checkInTime')}
                                />
                                <InputField
                                    label={t.newCampground.checkOut}
                                    type="time"
                                    value={formData.checkOutTime}
                                    onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                                    inputSize="lg"
                                    error={zErr('checkOutTime')}
                                />
                            </CardContent>
                        </Card>

                        {/* Status & Visibility */}
                        <Card id="status-visibility" tabIndex={-1} className="border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardHeader className="border-b border-border pb-4">
                                <CardTitle className="text-lg font-bold text-foreground">{t.newCampground.statusVisibility}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isVerified: !formData.isVerified })}
                                    aria-pressed={formData.isVerified}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    aria-pressed={formData.isActive}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
                                    aria-pressed={formData.isPublished}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                </button>

                                {/* Pet Friendly Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, petFriendly: !formData.petFriendly })}
                                    aria-pressed={formData.petFriendly}
                                    className={cn(
                                        "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                </button>
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </form>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title={t.newCampground.confirmDelete}
                description={t.newCampground.confirmDeleteDesc}
                confirmLabel={t.common.delete}
                cancelLabel={t.dashboard.cancel}
                onConfirm={handleDelete}
                destructive
            />
        </div>
    );
}
