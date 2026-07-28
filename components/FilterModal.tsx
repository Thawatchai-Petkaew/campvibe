"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, AlertCircle, RotateCcw } from "lucide-react";
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

/**
 * CAM-524 — the ONE builder both the debounced match-count effect and the
 * apply handler (handleShowCampgrounds) call, so "Show N Campgrounds" is
 * guaranteed BY CONSTRUCTION (not by two hand-synced code paths) to equal
 * the query the button actually applies.
 *
 * Starts from the CURRENT URL (`currentParams` = useSearchParams()),
 * preserving every param this modal does not own (keyword/province/
 * district/startDate/endDate/guests/sort — previously dropped by the count
 * path only, the live bug this story fixes), then layers the camper's
 * pending taxonomy/type/price selections on top exactly as the apply path
 * always did. Returns BOTH the next URLSearchParams (what the apply handler
 * pushes to the router) and the equivalent CampSiteFilterParams (what the
 * count effect sends to getCampSiteCount) — read back from that SAME params
 * object, so the two can never diverge.
 */
export function buildPendingQuery(
  currentParams: URLSearchParams,
  selectedFilters: Record<string, string[]>,
  priceRange: { min: string; max: string }
): { nextParams: URLSearchParams; filters: CampSiteFilterParams } {
  const params = new URLSearchParams(currentParams.toString());

  // Helper to set/delete array params.
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

  // Taxonomy groups (CSV) — Internal/External facility + Equipment for rent
  // are excluded here; they merge into 'facilities' below instead.
  for (const g of FILTERABLE_GROUPS) {
    if (FACILITY_SECTION_GROUP_NAMES.includes(g.group)) continue;
    setArrayParam(g.urlParam, g.group);
  }

  // Facilities (Internal, External, Equipment) -> All to 'facilities'.
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

  // The count filters are read back from the SAME `params` object above —
  // the fix. Every param the modal does not own (keyword/province/district/
  // startDate/endDate/guests) survives the clone and lands here identically
  // to what the apply handler is about to push, so count and apply can never
  // compute a different query.
  const filters: CampSiteFilterParams = {};
  const keyword = params.get('keyword');
  if (keyword) filters.keyword = keyword;
  const province = params.get('province');
  if (province) filters.province = province;
  const district = params.get('district');
  if (district) filters.district = district;
  const startDate = params.get('startDate');
  if (startDate) filters.startDate = startDate;
  const endDate = params.get('endDate');
  if (endDate) filters.endDate = endDate;
  const guests = params.get('guests');
  if (guests) filters.guests = guests;
  const min = params.get('min');
  if (min) filters.min = min;
  const max = params.get('max');
  if (max) filters.max = max;
  const nextType = params.get('type');
  if (nextType) filters.type = nextType;
  for (const g of FILTERABLE_GROUPS) {
    const val = params.get(g.urlParam);
    if (val) filters[g.zodField] = val;
  }

  return { nextParams: params, filters };
}

export function FilterModal() {
    const { t, language } = useLanguage();
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
    const [priceRange, setPriceRange] = useState<{ min: string, max: string }>({ min: "", max: "" });
    const [isOpen, setIsOpen] = useState(false);
    const [filterSections, setFilterSections] = useState<FilterSection[]>([]);
    const [matchCount, setMatchCount] = useState<number | null>(null);
    const [isCountLoading, setIsCountLoading] = useState(false);
    // CAM-616: getCampSiteCount now THROWS on a DB failure instead of
    // fabricating 0 — but throwing alone only helps if this, the sole
    // consumer, does something with it. Before this fix the rejection was
    // unhandled, so isCountLoading never reset and "Show N Campgrounds"
    // read "Calculating..." forever — indistinguishable from a working
    // system, same defect shape as the other seven surfaces, just dressed
    // as a spinner instead of a false zero. Tracked separately from
    // matchCount so a stale-but-real previous count is never confused with
    // a fresh failure.
    const [countError, setCountError] = useState(false);
    // CAM-616: getFilterOptions also now throws instead of returning {} —
    // this flag is what actually makes that visible; without it, a
    // rejected promise here never reaches setFilterSections and the modal
    // silently shows zero filter groups (the ORIGINAL "we don't support
    // filtering" defect, just moved one level down).
    const [filterOptionsError, setFilterOptionsError] = useState(false);

    // CAM-524 — declared before the debounced count effect below (it reads
    // searchParams via buildPendingQuery).
    const router = useRouter();
    const searchParams = useSearchParams();

    // CAM-616: extracted so the retry banner can re-issue the SAME count
    // request on demand, without waiting for the 500ms debounce.
    const runCount = useCallback(async () => {
        // CAM-524 — built from the SAME shared query as the apply handler
        // (buildPendingQuery), so "Show N Campgrounds" can never diverge
        // from the query the button actually applies.
        const { filters } = buildPendingQuery(searchParams, selectedFilters, priceRange);
        setIsCountLoading(true);
        setCountError(false);
        try {
            const count = await getCampSiteCount(filters);
            setMatchCount(count);
        } catch (error) {
            console.error("Failed to load campground count:", error);
            setCountError(true);
        } finally {
            setIsCountLoading(false);
        }
    }, [searchParams, selectedFilters, priceRange]);

    // Debounced count update
    useEffect(() => {
        if (!isOpen) return;
        setIsCountLoading(true);
        setCountError(false);
        const timer = setTimeout(() => {
            runCount();
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFilters, priceRange, isOpen, searchParams]);

    // CAM-616: extracted so the retry banner can re-issue this request.
    const loadFilterOptions = useCallback(() => {
        setFilterOptionsError(false);
        getFilterOptions()
            .then((rawGrouped) => {
                // getFilterOptions() returns Record<string, MasterData[]> —
                // narrowed here at the boundary (CAM-523: was `[string, any[]]`)
                // instead of an `any`-typed loop below.
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
            })
            .catch((error) => {
                // CAM-616: a failed load must not silently leave
                // filterSections at its initial [] — that renders as "this
                // catalog has no filterable options" with no indication
                // anything went wrong.
                console.error("Failed to load filter options:", error);
                setFilterOptionsError(true);
            });
    }, [language]);

    useEffect(() => {
        loadFilterOptions();
    }, [loadFilterOptions]);

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
        // CAM-524 — the SAME shared builder the match-count effect uses, so
        // the URL this pushes is guaranteed to be the exact query that
        // produced the "Show N Campgrounds" number the camper just saw.
        const { nextParams } = buildPendingQuery(searchParams, selectedFilters, priceRange);
        router.push(`/?${nextParams.toString()}`);
    };

    const renderSectionContent = (section: FilterSection) => {
        // 1. Large Visual Cards for 'Campground type' and 'Terrain'
        if (['Campground type', 'Terrain'].includes(section.id)) {
            return (
                <div className="grid grid-cols-2 gap-3 md:gap-4">
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
                <div className="flex flex-wrap gap-2 md:gap-3">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 md:gap-x-6">
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
                                    "type-label font-normal cursor-pointer",
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
                {/* CAM-552 — mobile step: 16px inner gutter + a tighter section
                    stack, so a phone shows more chips per screen. */}
                <div className="overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 flex-1 custom-scrollbar">

                    {/* Price Range Section - Static */}
                    <div className="space-y-3">
                        <h3 className="type-heading-3 font-bold text-foreground">{t.filter?.priceRange}</h3>
                        <div className="flex items-center gap-3 md:gap-4">
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

                    {/* CAM-616: a failed options load must not silently render as
                        zero filter groups (the original "we don't support
                        filtering" defect) — show a distinguishable error+retry
                        instead of quietly falling through to an empty map(). */}
                    {filterOptionsError ? (
                        <div
                            role="alert"
                            data-testid="banner--filter-options-error"
                            className="flex flex-col items-center gap-3 py-8 text-center"
                        >
                            <p className="text-sm text-muted-foreground">{t.filter?.optionsError}</p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={loadFilterOptions}
                                data-testid="btn--filter-options-retry"
                                className="rounded-full"
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                                {t.common.retry}
                            </Button>
                        </div>
                    ) : (
                        filterSections.map((section, idx) => (
                            <div key={section.id} className={cn("space-y-3", idx !== filterSections.length - 1 && "pb-4 md:pb-6 border-b border-border/60")}>
                                <h3 className="type-heading-3 font-bold text-foreground">
                                    {t.filter?.[section.id as keyof typeof t.filter] || section.title}
                                </h3>
                                {renderSectionContent(section)}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer - Aligned with Search Modal */}
                <div className="p-3 md:p-4 bg-card border-t border-border/60 shrink-0">
                    {/* CAM-616: a failed count must not leave the primary button
                        stuck on "Calculating..." forever (indistinguishable from
                        a working system, same defect shape as a false "0") —
                        show a distinguishable error+retry above the buttons. */}
                    {countError && (
                        <div
                            role="alert"
                            data-testid="banner--filter-count-error"
                            className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span>{t.filter?.countError}</span>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={runCount}
                                data-testid="btn--filter-count-retry"
                                className="rounded-full shrink-0"
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                                {t.common.retry}
                            </Button>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={clearAll}
                            className="type-label font-bold underline hover:bg-muted p-2 px-4 rounded-full"
                        >
                            {t.filter?.clearAll}
                        </Button>
                        {/* CAM-552 — the px-8 override is gone: size="lg" now owns
                            BOTH the height and the horizontal padding at each step
                            (px-4 -> md:px-5), which is the one-padding-per-role
                            rule CAM-542 asked for. */}
                        <Button
                            onClick={handleShowCampgrounds}
                            size="lg"
                            disabled={isCountLoading}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCountLoading
                                ? "Calculating..."
                                : countError
                                    ? (t.filter?.countErrorLabel || "Couldn't get count")
                                    : matchCount === 0
                                        ? (t.filter?.no_results || "No Campgrounds found")
                                        : (t.filter?.show_results_count || "Show {{count}} Campgrounds").replace('{{count}}', matchCount?.toString() || '0')
                            }
                        </Button>
                    </div>
                </div>
            </ModalContent>
        </Dialog>
    );
}

function getIconComponent(iconName: string | null): LucideIcon | null {
    if (!iconName) return null;
    return ICON_MAP[iconName] ?? HelpCircle;
}
