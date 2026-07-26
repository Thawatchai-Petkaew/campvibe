"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Dialog,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ModalContent, ModalHeader } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputField } from "@/components/ui/input-field";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { FilterChip } from "@/components/ui/filter-chip";
import { getFilterOptions } from "@/app/actions/getFilterOptions";
import { getCampSiteCount } from "@/app/actions/getCampSiteCount";
import type { CampSiteFilterParams } from "@/lib/campsite-filters";
import {
  TAXONOMY_GROUPS,
  FILTERABLE_GROUPS,
  FACILITY_SECTION_GROUP_NAMES,
  FILTERABLE_URL_PARAMS,
} from "@/lib/taxonomy-registry";
import type { MasterData } from "@prisma/client";
// DB-driven icon resolver — named imports only for the 44 icons that MasterData.icon
// can ever hold (sourced from prisma/seed.ts). HelpCircle is the fallback for any
// future DB icon not yet in the map. This replaces the previous wildcard import that
// bundled all 1414 lucide icons. (CAM-200 PERF-BUNDLE Action A)
import {
  Accessibility, Anchor, Armchair, Bath, Bed, Binoculars, Box, CalendarCheck, Car, Coffee,
  Droplet, Droplets, Dumbbell, Eye, Fan, Fish, Flame, Flower2, Footprints, GlassWater,
  Lamp, Layers, Lightbulb, Logs, Mountain, Music, Palmtree, PawPrint, Plug,
  Sailboat, ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead, Snowflake, Sparkles,
  Store, Table2, Tent, ThermometerSun, Trash, Trash2, Trees, TrendingUp, Umbrella, Users, Utensils,
  UtensilsCrossed, Waves, Wheat, Wifi, Wine, Zap, HelpCircle,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Accessibility, Anchor, Armchair, Bath, Bed, Binoculars, Box, CalendarCheck, Car, Coffee,
  Droplet, Droplets, Dumbbell, Eye, Fan, Fish, Flame, Flower2, Footprints, GlassWater,
  Lamp, Layers, Lightbulb, Logs, Mountain, Music, Palmtree, PawPrint, Plug,
  Sailboat, ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead, Snowflake, Sparkles,
  Store, Table2, Tent, ThermometerSun, Trash, Trash2, Trees, TrendingUp, Umbrella, Users, Utensils,
  UtensilsCrossed, Waves, Wheat, Wifi, Wine, Zap, HelpCircle,
};

// CAM-523 (S7) — the group<->URL-param<->zod-field map used below (the
// facility fold set, the taxonomy iteration order, the arrayParams count
// list) now comes from lib/taxonomy-registry.ts's single TAXONOMY_GROUPS
// source instead of being hand-copied per effect. See that file's header
// for the "adding a new group" checklist.
//
// CAM-496 — FACILITY_SECTION_GROUP_NAMES (registry-derived) names the
// section ids that share the single `facilities` URL param (see
// handleShowCampgrounds below, which merges all three into one CSV on
// write).

// CAM-521 (S8, BR-4) — the final taxonomy slice's 3 groups are deliberately
// HOST-INPUT + CAMPER-DETAIL-DISPLAY ONLY, never a filter/search dimension
// (metadata, not a search demand — see the story's "Why"). Excluded here so
// getFilterOptions()'s full MasterData group list never renders them as an
// inert FilterModal section (no chips, no query param, no catalog wiring).
// NOTE (CAM-523): kept as a hand-written literal (not imported from the
// registry's NON_FILTERABLE_GROUP_NAMES) because __tests__/cam-521-metadata-
// groups.test.ts source-inspects this exact literal array; guarded in sync
// with the registry by __tests__/cam-523-taxonomy-registry.test.ts.
const NON_FILTERABLE_GROUPS = ['Stay connected', 'Marking method', 'Driveway'];

interface FilterOption {
  id: string;
  icon: LucideIcon | null;
  label: string;
}

interface FilterSection {
  id: string;
  title: string;
  options: FilterOption[];
}

export function FilterModal() {
    const { t, language } = useLanguage();
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
    const [priceRange, setPriceRange] = useState<{ min: string, max: string }>({ min: "", max: "" });
    const [isOpen, setIsOpen] = useState(false);
    const [filterSections, setFilterSections] = useState<FilterSection[]>([]);
    const [matchCount, setMatchCount] = useState<number | null>(null);
    const [isCountLoading, setIsCountLoading] = useState(false);

    // Debounced count update
    useEffect(() => {
        if (!isOpen) return;
        setIsCountLoading(true);
        const timer = setTimeout(async () => {
            // Construct filters object similar to handleShowCampgrounds.
            // CAM-523: typed via CampSiteFilterParams (was `any`) + the CSV
            // taxonomy groups below are derived from FILTERABLE_GROUPS
            // instead of one hand-written `if` per group.
            const filters: CampSiteFilterParams = {};

            // Type
            const selectedType = selectedFilters['Campground type'];
            if (selectedType && selectedType.length > 0) filters.type = selectedType[0];

            // Taxonomy groups (CSV) — Internal/External facility + Equipment
            // for rent are excluded here and merged into `facilities` below.
            for (const g of FILTERABLE_GROUPS) {
                if (FACILITY_SECTION_GROUP_NAMES.includes(g.group)) continue;
                const codes = selectedFilters[g.group];
                if (codes && codes.length > 0) filters[g.zodField] = codes.join(',');
            }

            // Facilities (Internal, External, Equipment) -> all fold into 'facilities'
            const allFacilities = FACILITY_SECTION_GROUP_NAMES.flatMap((name) => selectedFilters[name] || []);
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
        getFilterOptions().then((rawGrouped) => {
            // getFilterOptions() returns Record<string, MasterData[]> (or {}
            // on a caught DB error) — narrowed here at the boundary (CAM-523:
            // was `[string, any[]]`) instead of an `any`-typed loop below.
            const grouped = rawGrouped as Record<string, MasterData[]>;
            const sections: FilterSection[] = Object.entries(grouped)
                .filter(([groupName]) => !NON_FILTERABLE_GROUPS.includes(groupName))
                .map(([groupName, options]) => ({
                    id: groupName,
                    title: groupName,
                    options: options.map((opt) => ({
                        id: opt.code,
                        icon: getIconComponent(opt.icon),
                        label: language === 'th' ? opt.nameTh : opt.nameEn,
                    })),
                }));

            // Custom sort order for sections — 'Campground type' is special-
            // cased first (not in the registry, see taxonomy-registry.ts's
            // header), then the registry's own display-order declaration.
            const sortOrder = ['Campground type', ...TAXONOMY_GROUPS.map((g) => g.group)];

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

    // CAM-496 — Initialize selectedFilters/priceRange from the CURRENT URL on
    // every modal open (and if the URL changes while open), so reopening the
    // modal shows the active selections instead of starting empty. Mirrors
    // exactly the param<->section mapping handleShowCampgrounds writes, so an
    // apply -> reopen -> apply round-trip is loss-less. Guarded on `isOpen`
    // (never on selectedFilters/priceRange) to avoid an infinite loop and to
    // avoid clobbering the URL update handleShowCampgrounds triggers on close.
    useEffect(() => {
        if (!isOpen) return;

        const newFilters: Record<string, string[]> = {};

        const type = searchParams.get('type');
        if (type && type !== 'ALL') {
            newFilters['Campground type'] = [type];
        }

        // Taxonomy groups (CSV) — Internal/External facility + Equipment for
        // rent are excluded here; their shared `facilities` param is
        // distributed to its owning section below instead.
        for (const g of FILTERABLE_GROUPS) {
            if (FACILITY_SECTION_GROUP_NAMES.includes(g.group)) continue;
            const val = searchParams.get(g.urlParam);
            if (val) newFilters[g.group] = val.split(',').filter(Boolean);
        }

        const facilities = searchParams.get('facilities');
        if (facilities) {
            facilities.split(',').filter(Boolean).forEach((code) => {
                const owningSection = filterSections.find(
                    (s) => FACILITY_SECTION_GROUP_NAMES.includes(s.id) && s.options.some((o) => o.id === code)
                );
                const sectionId = owningSection?.id ?? FACILITY_SECTION_GROUP_NAMES[0];
                newFilters[sectionId] = [...(newFilters[sectionId] || []), code];
            });
        }

        setSelectedFilters(newFilters);
        setPriceRange({
            min: searchParams.get('min') || '',
            max: searchParams.get('max') || '',
        });
    }, [isOpen, searchParams, filterSections]);

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

        // Taxonomy groups (CSV) — Internal/External facility + Equipment for
        // rent are excluded here; they merge into 'facilities' below instead.
        for (const g of FILTERABLE_GROUPS) {
            if (FACILITY_SECTION_GROUP_NAMES.includes(g.group)) continue;
            setArrayParam(g.urlParam, g.group);
        }

        // Facilities (Internal, External, Equipment) -> All to 'facilities'
        const allFacilities = FACILITY_SECTION_GROUP_NAMES.flatMap((name) => selectedFilters[name] || []);
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

    const renderSectionContent = (section: FilterSection) => {
        // 1. Large Visual Cards for 'Campground type' and 'Terrain'
        if (['Campground type', 'Terrain'].includes(section.id)) {
            return (
                <div className="grid grid-cols-2 gap-4">
                    {section.options.map((opt: FilterOption) => (
                        <FilterChip
                            key={opt.id}
                            variant="card"
                            selected={!!selectedFilters[section.id]?.includes(opt.id)}
                            onToggle={() => toggleFilter(section.id, opt.id)}
                            label={opt.label}
                            icon={opt.icon ?? undefined}
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
                    {section.options.map((opt: FilterOption) => (
                        <FilterChip
                            key={opt.id}
                            variant="pill"
                            selected={!!selectedFilters[section.id]?.includes(opt.id)}
                            onToggle={() => toggleFilter(section.id, opt.id)}
                            label={opt.label}
                            icon={opt.icon ?? undefined}
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
                    {section.options.map((opt: FilterOption) => (
                        <FilterChip
                            key={opt.id}
                            variant="icon-card"
                            selected={!!selectedFilters[section.id]?.includes(opt.id)}
                            onToggle={() => toggleFilter(section.id, opt.id)}
                            label={opt.label}
                            icon={opt.icon ?? undefined}
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
                {section.options.map((opt: FilterOption) => {
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

        // 3. Arrays — every filterable group's own URL param (registry-
        // derived; CAM-523 kept 'external'/'equipment' reachable here since
        // the catalog pass-through now honors them end-to-end, see
        // CatalogResults/InfiniteScrollGrid/page.tsx).
        const arrayParams = FILTERABLE_URL_PARAMS;
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
                className="rounded-full border-border h-11 px-4 font-medium hover:border-foreground transition-colors relative"
            >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    {t.filter?.title || "Filters"}
                    {activeFilterCount > 0 && (
                        <Badge
                            aria-hidden="true"
                            variant="default"
                            shape="pill"
                            className="absolute -top-1 -right-1 px-1.5 animate-in zoom-in duration-200"
                        >
                            {activeFilterCount}
                        </Badge>
                    )}
                </Button>
            </DialogTrigger>
            <ModalContent className="sm:max-w-3xl gap-0 flex flex-col max-h-[85vh]" aria-describedby={undefined}>
                <ModalHeader
                    title={t.filter?.title ?? "Filters"}
                    closeLabel={t.common?.close}
                />

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
                                    inputSize="lg"
                                    className="rounded-full text-base border-border bg-background"
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
                                    inputSize="lg"
                                    className="rounded-full text-base border-border bg-background"
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
            </ModalContent>
        </Dialog>
    );
}

function getIconComponent(iconName: string | null): LucideIcon | null {
    if (!iconName) return null;
    return ICON_MAP[iconName] ?? HelpCircle;
}
