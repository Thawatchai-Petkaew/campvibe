"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tent, Mountain, Trees, Waves, Caravan, Palmtree } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * CAM-491 — redefine the Home category tabs to real filterable dimensions.
 *
 * `param` names the query-string param the tab owns ("type" | "terrain" |
 * null for "All"). Each tab sets its own param and deletes the OTHER
 * category dimension(s) this bar owns (single-select, mutual-exclude —
 * design.md §2), so a stale `type=CAGD` never sticks under a newly-tapped
 * `terrain=BEAC`.
 */
interface Category {
    labelKey: string;
    icon: any;
    param: "type" | "terrain" | null;
    value: string | null;
}

const CATEGORIES: Category[] = [
    { labelKey: "all", icon: Mountain, param: null, value: null },
    { labelKey: "campground", icon: Tent, param: "type", value: "CAGD" },
    { labelKey: "carCamping", icon: Caravan, param: "type", value: "CACP" },
    { labelKey: "beach", icon: Palmtree, param: "terrain", value: "BEAC" },
    { labelKey: "forest", icon: Trees, param: "terrain", value: "FORE" },
    { labelKey: "mountain", icon: Mountain, param: "terrain", value: "MTNS" },
    { labelKey: "riverside", icon: Waves, param: "terrain", value: "RIVE" },
];

// The category dimensions this bar owns; a tab clears every one of these
// except the one it sets (design.md §2 "mutual-exclude the other category
// params").
const OWNED_PARAMS = ["type", "terrain", "access"] as const;

export function CategoryBar() {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();

    const typeParam = searchParams.get("type");
    const terrainParam = searchParams.get("terrain");

    const isActive = (cat: Category) => {
        if (cat.param === null) {
            return !typeParam && !terrainParam;
        }
        if (cat.param === "type") {
            return typeParam === cat.value;
        }
        // terrain tab — active only on an exact single-code match, never a
        // FilterModal multi-value CSV (design.md §2 active-tab detection).
        return terrainParam === cat.value;
    };

    const handleCategoryClick = (cat: Category) => {
        const params = new URLSearchParams(searchParams.toString());
        OWNED_PARAMS.forEach((p) => params.delete(p));
        if (cat.param && cat.value) {
            params.set(cat.param, cat.value);
        }
        const query = params.toString();
        router.push(query ? `/?${query}` : "/");
    };

    return (
        <div className="pt-4 pb-0 flex items-center gap-8 overflow-x-auto no-scrollbar container mx-auto px-6">
            {CATEGORIES.map((cat) => {
                const active = isActive(cat);
                return (
                    <button
                        key={cat.labelKey}
                        onClick={() => handleCategoryClick(cat)}
                        aria-current={active ? "true" : undefined}
                        className={clsx(
                            "flex flex-col items-center gap-2 min-w-[64px] pb-3 border-b-2 transition group",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            active
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                        )}
                    >
                        <cat.icon
                            className={clsx(
                                "w-6 h-6",
                                active ? "stroke-2" : "stroke-1 group-hover:stroke-2"
                            )}
                        />
                        <span className="text-xs font-medium whitespace-nowrap">{(t.categories as any)[cat.labelKey]}</span>
                    </button>
                );
            })}
        </div>
    );
}
