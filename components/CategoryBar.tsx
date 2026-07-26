"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tent, Mountain, Trees, Waves, Caravan, Palmtree, Sailboat, Droplets, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * CAM-491 — redefine the Home category tabs to real filterable dimensions.
 * CAM-529 (S2) — add ทะเล/น้ำตก/แกลมปิ้ง (SEA/WATF/GLAMP) + fix the
 * OWNED_PARAMS dead-deleter bug: "access" was never SET by any category here
 * but was still cleared on every tab tap, silently wiping a camper's
 * FilterModal Access-type selection (`access=` is now written/hydrated by
 * FilterModal — see `lib/taxonomy-registry.ts`'s "Access type" entry).
 * OWNED_PARAMS now lists only the params this bar actually writes.
 *
 * `param` names the query-string param the tab owns ("type" | "terrain" |
 * null for "All"). Each tab sets its own param and deletes the OTHER
 * category dimension(s) this bar owns (single-select, mutual-exclude —
 * story.md BR-1). A tab tap is a single-value SHORTCUT: it REPLACES
 * whatever terrain/type value currently sits in its owned param, including
 * a FilterModal multi-value CSV (e.g. `terrain=SEA,WATF`) — it never merges
 * (story.md BR-2). A stale `type=CAGD` never sticks under a newly-tapped
 * `terrain=BEAC`, and an unrelated param this bar doesn't own (`access`,
 * `keyword`, `province`, ...) is always preserved untouched.
 */
interface Category {
    labelKey: string;
    icon: any;
    param: "type" | "terrain" | null;
    value: string | null;
}

// Exported so a sibling story (CAM-532, SearchModal pills) can import this
// single source instead of hand-copying it — see story.md "Seams & refs".
export const CATEGORIES: Category[] = [
    { labelKey: "all", icon: Mountain, param: null, value: null },
    { labelKey: "campground", icon: Tent, param: "type", value: "CAGD" },
    { labelKey: "carCamping", icon: Caravan, param: "type", value: "CACP" },
    { labelKey: "glamping", icon: Sparkles, param: "type", value: "GLAMP" },
    { labelKey: "beach", icon: Palmtree, param: "terrain", value: "BEAC" },
    { labelKey: "sea", icon: Sailboat, param: "terrain", value: "SEA" },
    { labelKey: "forest", icon: Trees, param: "terrain", value: "FORE" },
    { labelKey: "mountain", icon: Mountain, param: "terrain", value: "MTNS" },
    { labelKey: "riverside", icon: Waves, param: "terrain", value: "RIVE" },
    { labelKey: "waterfall", icon: Droplets, param: "terrain", value: "WATF" },
];

// The category dimensions this bar owns; a tab clears every one of these
// except the one it sets. CAM-529: "access" is deliberately NOT here — no
// category ever sets it, so it must never be cleared by this bar (story.md
// BR-1, the Prove-It fix in __tests__/cam-529-category-tabs.test.ts).
const OWNED_PARAMS = ["type", "terrain"] as const;

/**
 * Pure URL-builder for a tab tap — extracted from the click handler so the
 * mutual-exclude + single-value-replace behavior (BR-1/BR-2) is directly
 * unit-testable with a real `URLSearchParams`, no DOM/router mock needed.
 */
export function buildCategoryUrl(cat: Category, searchParams: URLSearchParams): string {
    const params = new URLSearchParams(searchParams.toString());
    OWNED_PARAMS.forEach((p) => params.delete(p));
    if (cat.param && cat.value) {
        params.set(cat.param, cat.value);
    }
    const query = params.toString();
    return query ? `/?${query}` : "/";
}

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
        router.push(buildCategoryUrl(cat, searchParams));
    };

    return (
        // CAM-552 — mobile step: a tighter tab gap and page gutter, so more
        // category tabs land inside the first screen-width on a phone.
        <div className="pt-3 pb-0 md:pt-4 flex items-center gap-6 md:gap-8 overflow-x-auto no-scrollbar container mx-auto px-4 md:px-6">
            {CATEGORIES.map((cat) => {
                const active = isActive(cat);
                return (
                    <button
                        key={cat.labelKey}
                        onClick={() => handleCategoryClick(cat)}
                        aria-current={active ? "true" : undefined}
                        className={clsx(
                            // CAM-552 — the tab is a nav tab, not a control, but it
                            // still stays well clear of the 44px floor at the mobile
                            // step (measured 54px tall / 56px wide).
                            "flex flex-col items-center gap-1.5 md:gap-2 min-w-[56px] md:min-w-[64px] pb-2 md:pb-3 border-b-2 transition group",
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
                        <span className="type-caption font-medium whitespace-nowrap">{(t.categories as any)[cat.labelKey]}</span>
                    </button>
                );
            })}
        </div>
    );
}
