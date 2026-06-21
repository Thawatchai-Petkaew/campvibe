"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export function ActiveFilters() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { t } = useLanguage();
    const activeFilters: { key: string, label: string, value: string }[] = [];

    // Helper to add filters
    const addFilter = (key: string, labelPrefix: string, isArray: boolean = false) => {
        const val = searchParams.get(key);
        if (val) {
            if (isArray) {
                val.split(',').forEach(v => {
                    activeFilters.push({ key: key, label: `${labelPrefix}: ${v}`, value: v });
                });
            } else {
                activeFilters.push({ key: key, label: `${labelPrefix}: ${val}`, value: val });
            }
        }
    };

    const type = searchParams.get('type');
    if (type && type !== 'ALL') activeFilters.push({ key: 'type', label: `Type: ${type}`, value: type });

    const min = searchParams.get('min');
    if (min) activeFilters.push({ key: 'min', label: `Min Price: ${min}`, value: min });
    const max = searchParams.get('max');
    if (max) activeFilters.push({ key: 'max', label: `Max Price: ${max}`, value: max });

    addFilter('activities', 'Activity', true);
    addFilter('terrain', 'Terrain', true);
    addFilter('access', 'Access', true);
    addFilter('facilities', 'Facility', true);

    if (activeFilters.length === 0) return null;

    const removeFilter = (filter: { key: string, value: string }) => {
        const params = new URLSearchParams(searchParams.toString());

        // Check if array param
        const currentVal = params.get(filter.key);
        if (currentVal && (filter.key === 'activities' || filter.key === 'terrain' || filter.key === 'access' || filter.key === 'facilities')) {
            const values = currentVal.split(',');
            const newValues = values.filter(v => v !== filter.value);
            if (newValues.length > 0) {
                params.set(filter.key, newValues.join(','));
            } else {
                params.delete(filter.key);
            }
        } else {
            params.delete(filter.key);
        }

        router.push(`/?${params.toString()}`);
    };

    const clearAll = () => {
        router.push('/');
    };

    return (
        <div className="flex flex-wrap gap-2 items-center mt-2 px-1">
            {activeFilters.map((filter, idx) => (
                <Badge
                    key={`${filter.key}-${filter.value}-${idx}`}
                    variant="secondary"
                    className="pl-3 pr-1 py-1 h-7 rounded-full gap-1 flex items-center bg-muted text-foreground hover:bg-muted/80"
                >
                    {filter.label}
                    <button
                        onClick={() => removeFilter(filter)}
                        aria-label={(t.activeFilters?.removeFilter || "Remove {{label}} filter").replace('{{label}}', filter.label)}
                        className="w-7 h-7 min-w-[28px] flex items-center justify-center rounded-full hover:bg-muted-foreground/20 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <IconX className="w-3 h-3" />
                    </button>
                </Badge>
            ))}
            {activeFilters.length > 0 && (
                <button
                    onClick={clearAll}
                    aria-label={t.activeFilters?.clearAll || "Clear all filters"}
                    className="text-xs text-muted-foreground hover:text-primary font-medium ml-2 underline decoration-border underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                >
                    {t.activeFilters?.clearAll || "Clear all filters"}
                </button>
            )}
        </div>
    );
}
