"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconX, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { FilterChip } from "@/components/ui/filter-chip";
import { getFilterOptions } from "@/app/actions/getFilterOptions";
import { getCampSiteCount } from "@/app/actions/getCampSiteCount";
// DB-driven icon resolver — keeps lucide for campground attribute icons fetched from DB.
// This is intentional: the iconName string (e.g. "Tent", "Mountain") comes from the DB
// and maps to lucide icons. We keep this resolver as-is and only swap the two static UI
// icons (X and SlidersHorizontal) to tabler equivalents above.
import * as LucideIcons from "lucide-react";

export function FilterModal() {
    const { t, language } = useLanguage();
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
    const [priceRange, setPriceRange] = useState<{ min: string, max: string }>({ min: "", max: "" });
    const [isOpen, setIsOpen] = useState(false);
    const [filterSections, setFilterSections] = useState<any[]>([]);
    const [matchCount, setMatchCount] = useState<number | null>(null);
    const [isCountLoading, setIsCountLoading] = useState(false);

    // Debounced count update
    useEffect(() => {
        if (!isOpen) return;
        setIsCountLoading(true);
        const timer = setTimeout(async () => {
            // Construct filters object similar to handleShowCampgrounds
            const filters: any = {};

            // Type
            if (selectedFilters['Campground type']?.length > 0) filters.type = selectedFilters['Campground type'][0];

            // Arrays
            if (selectedFilters['Terrain']?.length > 0) filters.terrain = selectedFilters['Terrain'].join(',');
            if (selectedFilters['Activity']?.length > 0) filters.activities = selectedFilters['Activity'].join(',');
            if (selectedFilters['Access type']?.length > 0) filters.access = selectedFilters['Access type'].join(',');

            // Facilities
            const allFacilities = [
                ...(selectedFilters['Internal facility'] || []),
                ...(selectedFilters['External facility'] || []),
                ...(selectedFilters['Equipment for rent'] || [])
            ];
            if (allFacilities.length > 0) filters.facilities = allFacilities.join(',');

            // Price
            if (priceRange.min) filters.min = priceRange.min;
            if (priceRange.max) filters.max = priceRange.max;

            const count = await getCampSiteCount(filters);
            setMatchCount(count);
            setIsCountLoading(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [selectedFilters, priceRange, isOpen]);

    useEffect(() => {
        getFilterOptions().then(grouped => {
            const sections = Object.entries(grouped || {}).map(([groupName, options]: [string, any[]]) => ({
                id: groupName,
                title: groupName,
                options: options.map(opt => ({
                    id: opt.code,
                    icon: getIconComponent(opt.icon),
                    label: language === 'th' ? opt.nameTh : opt.nameEn
                }))
            }));

            // Custom sort order for sections
            const sortOrder = [
                'Campground type',
                'Terrain',
                'Activity',
                'Access type',
                'Internal facility',
                'External facility',
                'Equipment for rent'
            ];

            sections.sort((a, b) => {
                const indexA = sortOrder.indexOf(a.id);
                const indexB = sortOrder.indexOf(b.id);
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
            });

            setFilterSections(sections);
        });
    }, [language]);

    const toggleFilter = (sectionId: string, optionId: string) => {
        setSelectedFilters(prev => {
            const current = prev[sectionId] || [];
            const isSelected = current.includes(optionId);
            const updated = isSelected
                ? current.filter(id => id !== optionId)
                : [...current, optionId];
            return { ...prev, [sectionId]: updated };
        });
    };

    const clearAll = () => {
        setSelectedFilters({});
        setPriceRange({ min: "", max: "" });
    };

    const router = useRouter();
    const searchParams = useSearchParams();

    // Initialize from URL
    useEffect(() => {
        const newFilters: Record<string, string[]> = {};

        // Parse CSV params
        const parseArray = (key: string) => {
            const val = searchParams.get(key);
            if (val) newFilters[key] = val.split(',');
        };

        const type = searchParams.get('type');
        if (type && type !== 'ALL') {
            // Mapping UI section 'Campground type' to param 'type' is tricky without reverse map
            // But checking our section IDs: "Campground type", "Terrain", etc.
            // Actually, better to just map generic params back to sections
        }

        // Simpler approach: Just reset state if closed? Or keep sync?
        // For now, let's just ensure we start clean or preserve if strictly needed.
        // But user might expect filters to persist.
        // Let's implement reading from URL for "Edit" mode later if requested.
    }, []);

    const handleShowCampgrounds = () => {
        setIsOpen(false);
        const params = new URLSearchParams(searchParams.toString());

        // Helper to set/delete array params
        const setArrayParam = (paramName: string, sectionKey: string) => {
            const values = selectedFilters[sectionKey];
            if (values && values.length > 0) {
                params.set(paramName, values.join(','));
            } else {
                params.delete(paramName);
            }
        };

        const type = selectedFilters['Campground type'];
        if (type && type.length > 0) params.set('type', type[0]);

        setArrayParam('terrain', 'Terrain');
        setArrayParam('activities', 'Activity');
        setArrayParam('access', 'Access type');

        // Facilities (Internal, External, Equipment) -> All to 'facilities'
        const allFacilities = [
            ...(selectedFilters['Internal facility'] || []),
            ...(selectedFilters['External facility'] || []),
            ...(selectedFilters['Equipment for rent'] || [])
        ];
        if (allFacilities.length > 0) {
            params.set('facilities', allFacilities.join(','));
        } else {
            params.delete('facilities');
        }

        // Price
        if (priceRange.min) params.set('min', priceRange.min);
        else params.delete('min');

        if (priceRange.max) params.set('max', priceRange.max);
        else params.delete('max');

        router.push(`/?${params.toString()}`);
    };

    const renderSectionContent = (section: any) => {
        // 1. Large Visual Cards for 'Campground type' and 'Terrain'
        if (['Campground type', 'Terrain'].includes(section.id)) {
            return (
                <div className="grid grid-cols-2 gap-4">
                    {section.options.map((opt: any) => (
                        <FilterChip
                            key={opt.id}
                            variant="card"
                            selected={!!selectedFilters[section.id]?.includes(opt.id)}
                            onToggle={() => toggleFilter(section.id, opt.id)}
                            label={opt.label}
                            icon={opt.icon}
                            data-testid={`filter-chip--card-${opt.id}`}
                        />
                    ))}
                </div>
            );
        }

        // 2. Icon Pills for 'Activity'
        if (section.id === 'Activity') {
            return (
                <div className="flex flex-wrap gap-3">
                    {section.options.map((opt: any) => (
                        <FilterChip
                            key={opt.id}
                            variant="pill"
                            selected={!!selectedFilters[section.id]?.includes(opt.id)}
                            onToggle={() => toggleFilter(section.id, opt.id)}
                            label={opt.label}
                            icon={opt.icon}
                            data-testid={`filter-chip--pill-${opt.id}`}
                        />
                    ))}
                </div>
            );
        }

        // 3. Compact Icon Cards for 'Access type'
        if (section.id === 'Access type') {
            return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {section.options.map((opt: any) => (
                        <FilterChip
                            key={opt.id}
                            variant="icon-card"
                            selected={!!selectedFilters[section.id]?.includes(opt.id)}
                            onToggle={() => toggleFilter(section.id, opt.id)}
                            label={opt.label}
                            icon={opt.icon}
                            aria-label={opt.label}
                            data-testid={`filter-chip--icon-card-${opt.id}`}
                        />
                    ))}
                </div>
            );
        }

        // 4. Default Checkbox Grid for everything else (Facilities, etc.)
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                {section.options.map((opt: any) => {
                    const isSelected = selectedFilters[section.id]?.includes(opt.id);
                    return (
                        <div key={opt.id} className="flex items-center space-x-3 group cursor-pointer" onClick={() => toggleFilter(section.id, opt.id)}>
                            <Checkbox
                                id={opt.id}
                                checked={isSelected}
                                onCheckedChange={() => toggleFilter(section.id, opt.id)}
                            />
                            <Label
                                htmlFor={opt.id}
                                className={cn(
                                    "text-sm font-normal cursor-pointer",
                                    isSelected ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"
                                )}
                            >
                                {opt.label}
                            </Label>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Calculate active filter count for the trigger button
    const activeFilterCount = useMemo(() => {
        let count = 0;
        const params = new URLSearchParams(searchParams.toString());

        // 1. Type
        const type = params.get('type');
        if (type && type !== 'ALL') count += 1;

        // 2. Price (Range counts as 1)
        if (params.get('min') || params.get('max')) count += 1;

        // 3. Arrays
        const arrayParams = ['activities', 'terrain', 'access', 'facilities', 'external', 'equipment'];
        arrayParams.forEach(key => {
            const val = params.get(key);
            if (val) {
                count += val.split(',').filter(Boolean).length;
            }
        });

        return count;
    }, [searchParams]);

    const triggerAriaLabel = activeFilterCount > 0
        ? (t.filter?.titleWithCount || "Filters ({{count}})").replace('{{count}}', activeFilterCount.toString())
        : (t.filter?.title || "Filters");

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
            <Button
                variant="outline"
                aria-label={triggerAriaLabel}
                className="rounded-full border-border h-11 px-4 font-medium hover:border-foreground transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                    <IconAdjustmentsHorizontal className="w-4 h-4 mr-2" />
                    {t.filter?.title || "Filters"}
                    {activeFilterCount > 0 && (
                        <span aria-hidden="true" className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-primary-foreground bg-primary rounded-full animate-in zoom-in duration-200 border-2 border-background">
                            {activeFilterCount}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false} className="sm:max-w-3xl border-none shadow-2xl p-0 gap-0 rounded-[24px] overflow-hidden flex flex-col max-h-[85vh] bg-card">

                {/* Header - Aligned with Search Modal */}
                <div className="flex items-center justify-center p-6 pb-2 border-b border-border/60 relative shrink-0">
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 top-4 rounded-full hover:bg-muted transition-colors w-11 h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <IconX className="w-5 h-5 text-foreground" />
                        </Button>
                    </DialogClose>
                    <DialogTitle className="text-lg font-bold text-foreground">
                        {t.filter?.title || "Filters"}
                    </DialogTitle>
                </div>

                {/* Scrollable Content - Compacted */}
                <div className="overflow-y-auto p-6 md:p-8 space-y-6 flex-1 custom-scrollbar">

                    {/* Price Range Section - Static */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-foreground">{t.filter?.priceRange}</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <InputField
                                    label={t.filterModal.minPrice}
                                    type="number"
                                    placeholder={t.filterModal.minPricePlaceholder}
                                    value={priceRange.min}
                                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                                    leftIcon={<span className="text-muted-foreground">฿</span>}
                                    labelClassName="text-xs text-muted-foreground font-normal ml-1"
                                    className="rounded-full h-12 text-base border-border bg-background"
                                />
                            </div>
                            <div className="pt-6 text-muted-foreground/60">-</div>
                            <div className="flex-1">
                                <InputField
                                    label={t.filterModal.maxPrice}
                                    type="number"
                                    placeholder={t.filterModal.maxPricePlaceholder}
                                    value={priceRange.max}
                                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                                    leftIcon={<span className="text-muted-foreground">฿</span>}
                                    labelClassName="text-xs text-muted-foreground font-normal ml-1"
                                    className="rounded-full h-12 text-base border-border bg-background"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border/60" />

                    {filterSections.map((section, idx) => (
                        <div key={section.id} className={cn("space-y-3", idx !== filterSections.length - 1 && "pb-6 border-b border-border/60")}>
                            <h3 className="text-lg font-bold text-foreground">
                                {t.filter?.[section.id as keyof typeof t.filter] || section.title}
                            </h3>
                            {renderSectionContent(section)}
                        </div>
                    ))}
                </div>

                {/* Footer - Aligned with Search Modal */}
                <div className="p-4 bg-card flex items-center justify-between border-t border-border/60 shrink-0">
                    <Button
                        variant="ghost"
                        onClick={clearAll}
                        className="text-sm font-bold underline hover:bg-muted p-2 px-4 rounded-full"
                    >
                        {t.filter?.clearAll}
                    </Button>
                    <Button
                        onClick={handleShowCampgrounds}
                        size="lg"
                        disabled={isCountLoading || matchCount === 0}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 rounded-full font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCountLoading
                            ? "Calculating..."
                            : matchCount === 0
                                ? (t.filter?.no_results || "No Campgrounds found")
                                : (t.filter?.show_results_count || "Show {{count}} Campgrounds").replace('{{count}}', matchCount?.toString() || '0')
                        }
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function getIconComponent(iconName: string | null) {
    if (!iconName) return null;
    // @ts-ignore
    return LucideIcons[iconName] || LucideIcons.HelpCircle;
}
