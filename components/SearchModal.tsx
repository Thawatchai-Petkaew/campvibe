"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Calendar as CalendarIcon, Users, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSearchProvinces } from "@/app/actions/getSearchLocations";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { CATEGORIES, buildCategoryUrl } from "@/components/CategoryBar";
import { Dialog } from "@/components/ui/dialog";
import { ModalContent, ModalHeader } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { InputField } from "@/components/ui/input-field";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * CAM-494 — pills must drive the query param whose backing field actually
 * exists (`type` for campSiteType, `terrain` for Terrain codes), not always
 * `type`.
 *
 * CAM-532 (S5) — the pill set is no longer hand-copied here. `CATEGORIES` and
 * the pure `buildCategoryUrl` are imported from `components/CategoryBar.tsx`,
 * which CAM-529 exported for exactly this: ONE list, ONE documented URL rule
 * ("a category shortcut REPLACES its owned param, never merges" — CAM-529
 * BR-1/BR-2), so the home bar and this modal can never drift apart again.
 * The markup is `<FilterChip variant="pill">`; this file contributes no chip
 * styling of its own (story.md BR-1).
 */

/**
 * Resolve which pill matches the current URL.
 *
 * Returns `"all"` when no category param is set, the matching pill's key on an
 * exact single-code match, and `null` when the URL holds something NO single
 * pill can represent — a FilterModal multi-value CSV (`terrain=SEA,WATF`), an
 * unknown code, or `type` and `terrain` both set. `null` renders with no pill
 * selected and makes `handleSearch` leave `type`/`terrain` untouched, which is
 * the CAM-532 fix for the old code path, which unconditionally deleted the
 * terrain param and so wiped a camper's multi-value terrain selection on every
 * search (story.md BR-4 / EC-1).
 */
function resolveSelectedExperience(searchParams: URLSearchParams): string | null {
    const typeParam = searchParams.get("type");
    const terrainParam = searchParams.get("terrain");
    if (!typeParam && !terrainParam) return "all";
    // Two dimensions at once is not expressible as one single-select pill.
    if (typeParam && terrainParam) return null;
    const match = CATEGORIES.find((item) => {
        if (item.param === "type") return typeParam === item.value;
        if (item.param === "terrain") return terrainParam === item.value;
        return false;
    });
    return match ? match.labelKey : null;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [keyword, setKeyword] = useState(searchParams.get("keyword") || "");
    const [experienceType, setExperienceType] = useState(() => resolveSelectedExperience(searchParams));
    const [province, setProvince] = useState(searchParams.get("province") || "");
    const [startDate, setStartDate] = useState<Date | undefined>(
        searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined
    );
    const [endDate, setEndDate] = useState<Date | undefined>(
        searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined
    );
    const [guests, setGuests] = useState(searchParams.get("guests") || "1");

    // CAM-531 — real province source. The dropdown used to come from a
    // hardcoded 7-key object literal; it now loads the provinces that
    // actually have a published camp, so every offered option is
    // guaranteed to return >=1 result (see app/actions/getSearchLocations.ts).
    const [provinces, setProvinces] = useState<string[]>([]);
    const [provincesLoading, setProvincesLoading] = useState(true);
    const [provincesError, setProvincesError] = useState(false);

    const loadProvinces = useCallback(async () => {
        setProvincesLoading(true);
        setProvincesError(false);
        const result = await getSearchProvinces();
        if (result.status === "ok") {
            setProvinces(result.provinces);
            setProvincesError(false);
        } else {
            setProvinces([]);
            setProvincesError(true);
        }
        setProvincesLoading(false);
    }, []);

    useEffect(() => {
        if (isOpen) loadProvinces();
    }, [isOpen, loadProvinces]);

    const handleSearch = () => {
        const params = new URLSearchParams(searchParams.toString());

        if (keyword) params.set("keyword", keyword); else params.delete("keyword");
        if (province && province !== " ") params.set("province", province); else params.delete("province");
        if (startDate) params.set("startDate", format(startDate, "yyyy-MM-dd")); else params.delete("startDate");
        if (endDate) params.set("endDate", format(endDate, "yyyy-MM-dd")); else params.delete("endDate");
        if (guests) params.set("guests", guests); else params.delete("guests");

        // CAM-494/CAM-532 — the category dimension is written by CategoryBar's
        // exported `buildCategoryUrl`: a pill owns EXACTLY ONE param (`type` OR
        // `terrain`) and REPLACES it, clearing the other dimension. When no pill
        // represents the current URL (`selected === undefined`), the category
        // params are left exactly as they are, so a FilterModal multi-value
        // `terrain=SEA,WATF` survives a date-only search (story.md BR-3/BR-4).
        const selected = CATEGORIES.find((item) => item.labelKey === experienceType);
        const query = params.toString();
        router.push(selected ? buildCategoryUrl(selected, params) : (query ? `/?${query}` : "/"));
        onClose();
    };

    const handleReset = () => {
        setKeyword("");
        setExperienceType("all");
        setProvince("");
        setStartDate(undefined);
        setEndDate(undefined);
        setGuests("1");
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <ModalContent className="sm:max-w-3xl" aria-describedby={undefined}>
                <div className="flex flex-col h-full max-h-[90vh] relative">
                    <ModalHeader
                        title={t.search.search}
                        closeLabel={t.common?.close ?? "Close"}
                        onClose={onClose}
                    />

                    {/* Standard Rounded Search UI */}
                    {/* CAM-552 — mobile step: 16px inner gutter + a tighter section stack. */}
                    <div className="p-4 md:p-8 flex-grow overflow-y-auto custom-scrollbar space-y-5 md:space-y-8">

                        {/* Experience Type (Pills) */}
                        <div className="space-y-2">
                            <h3 className="type-heading-3 font-bold px-1 text-foreground">{t.searchModal.experienceType}</h3>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((item) => (
                                    <FilterChip
                                        key={item.labelKey}
                                        variant="pill"
                                        selected={experienceType === item.labelKey}
                                        onToggle={() => setExperienceType(item.labelKey)}
                                        icon={item.icon}
                                        label={(t.categories as any)[item.labelKey]}
                                        data-testid={`btn--search-experience-${item.labelKey}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Location Section */}
                        <div className="space-y-1">
                            <h3 className="type-heading-3 font-bold px-1 text-foreground">{t.search.location}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                <InputField
                                    label={t.search.keyword}
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder={t.search.keywordPlaceholder}
                                    leftIcon={<Search className="w-4 h-4" />}
                                    className="rounded-full bg-background border-border"
                                />
                                <div className="space-y-2">
                                    <label className="type-caption font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.search.province}</label>
                                    <Select
                                        value={province}
                                        onValueChange={setProvince}
                                        disabled={provincesLoading || provincesError}
                                    >
                                        <SelectTrigger
                                            className="w-full border border-border hover:border-foreground transition bg-background"
                                            aria-busy={provincesLoading}
                                            data-testid="select--search-province"
                                        >
                                            <div className="flex items-center gap-2">
                                                {provincesLoading && (
                                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />
                                                )}
                                                <SelectValue placeholder={t.search.anyProvince} />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="shadow-2xl">
                                            <SelectItem value=" " className="cursor-pointer">{t.search.anyProvince}</SelectItem>
                                            {provinces.map(p => (
                                                <SelectItem key={p} value={p} className="cursor-pointer">{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div role="status" aria-live="polite" className="sr-only">
                                        {provincesLoading ? t.common.loading_sr : ""}
                                    </div>
                                    {!provincesLoading && !provincesError && provinces.length === 0 && (
                                        <p className="type-caption text-muted-foreground px-1" data-testid="empty--search-province">
                                            {t.search.provinceEmpty}
                                        </p>
                                    )}
                                    {provincesError && (
                                        <div className="flex flex-col items-start gap-2" data-testid="alert--search-province-load-error">
                                            <ErrorBanner message={t.search.provinceLoadFailed} />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={loadProvinces}
                                                disabled={provincesLoading}
                                                data-testid="btn--search-province-retry"
                                            >
                                                {provincesLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : t.common.retry}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Dates & Guests */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="space-y-1">
                                <h3 className="type-heading-3 font-bold px-1 text-foreground">{t.search.date}</h3>
                                <div className="grid grid-cols-2 gap-2 md:gap-3">
                                    <div className="space-y-2">
                                        <label className="type-caption font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.checkIn}</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start font-normal bg-background border-border hover:bg-muted px-4 focus:ring-primary/30 focus:border-primary",
                                                        !startDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {startDate ? format(startDate, "MMM d, yyyy") : t.booking.addDate}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={startDate}
                                                    onSelect={setStartDate}
                                                    autoFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="type-caption font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.checkOut}</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start font-normal bg-background border-border hover:bg-muted px-4 focus:ring-primary/30 focus:border-primary",
                                                        !endDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {endDate ? format(endDate, "MMM d, yyyy") : t.booking.addDate}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={endDate}
                                                    onSelect={setEndDate}
                                                    autoFocus
                                                    disabled={(date) => !!startDate && date < startDate}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="type-heading-3 font-bold px-1 text-foreground">{t.search.who}</h3>
                                <div className="space-y-2">
                                    <label className="type-caption font-regular uppercase tracking-widest text-muted-foreground ml-4">{t.booking.guests}</label>
                                    <Select value={guests} onValueChange={setGuests}>
                                        <SelectTrigger className="w-full border border-border hover:border-foreground transition bg-background">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="shadow-2xl">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((n) => (
                                                <SelectItem key={n} value={n.toString()} className="cursor-pointer">
                                                    {n} {n === 1 ? t.booking.guest : t.booking.guests}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3 md:p-4 bg-card flex items-center justify-between border-t border-border/60">
                        <Button
                            variant="ghost"
                            onClick={handleReset}
                            className="type-label font-bold underline hover:bg-muted p-2 px-4 rounded-full"
                        >
                            {t.searchModal.clearAll}
                        </Button>
                        <Button
                            onClick={handleSearch}
                            size="lg"
                            className="font-bold"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            {t.search.search}
                        </Button>
                    </div>
                </div>
            </ModalContent>
        </Dialog>
    );
}
