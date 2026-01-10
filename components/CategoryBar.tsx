"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
    Tent,
    Mountain,
    Trees,
    Waves,
    CarFront,
    Sailboat,
    Ghost
} from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/contexts/LanguageContext";

interface Category {
    labelKey: string;
    icon: any;
    type: string;
}

const CATEGORIES: Category[] = [
    { labelKey: "all", icon: Mountain, type: "ALL" },
    { labelKey: "campgrounds", icon: Tent, type: "CAGD" },
    { labelKey: "carCamping", icon: CarFront, type: "CACP" },
    { labelKey: "glamping", icon: Ghost, type: "GLAMP" },
    { labelKey: "lakefront", icon: Waves, type: "LAKE" },
    { labelKey: "forest", icon: Trees, type: "FOREST" },
    { labelKey: "views", icon: Mountain, type: "VIEW" },
    { labelKey: "boatAccess", icon: Sailboat, type: "BAOT" },
];

export function CategoryBar() {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeType = searchParams.get("type") || "ALL";

    const handleCategoryClick = (type: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (type === "ALL") {
            params.delete("type");
        } else {
            params.set("type", type);
        }
        router.push(`/?${params.toString()}`);
    };

    return (
        <div className="pt-4 pb-2 flex items-center gap-8 overflow-x-auto no-scrollbar container mx-auto px-6">
            {CATEGORIES.map((cat) => (
                <button
                    key={cat.labelKey}
                    onClick={() => handleCategoryClick(cat.type)}
                    className={clsx(
                        "flex flex-col items-center gap-2 min-w-[64px] pb-3 border-b-2 transition group",
                        activeType === cat.type
                            ? "border-black text-black"
                            : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-100"
                    )}
                >
                    <cat.icon
                        className={clsx(
                            "w-6 h-6",
                            activeType === cat.type ? "stroke-2" : "stroke-1 group-hover:stroke-2"
                        )}
                    />
                    <span className="text-xs font-medium whitespace-nowrap">{(t.categories as any)[cat.labelKey]}</span>
                </button>
            ))}
        </div>
    );
}
