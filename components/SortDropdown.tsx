"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function SortDropdown() {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentSort = searchParams.get("sort") || "related";

    const options = [
        { label: t.sort.mostRelated, value: "related" },
        { label: t.sort.priceLow, value: "price_asc" },
        { label: t.sort.priceHigh, value: "price_desc" },
        { label: t.sort.rating, value: "rating" },
    ];

    const handleSort = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", value);
        router.push(`/?${params.toString()}`);
    };

    return (
        <Select value={currentSort} onValueChange={handleSort}>
            <SelectTrigger className="w-[200px] h-10 border border-border rounded-full hover:border-foreground transition text-sm font-medium focus:ring-0">
                <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                    <SelectValue />
                </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
                <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {t.sort.sortBy}
                </div>
                {options.map((opt) => (
                    <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="rounded-xl focus:bg-muted focus:text-foreground cursor-pointer py-2.5"
                    >
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
