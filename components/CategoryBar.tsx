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

const CATEGORIES = [
    { label: "All", icon: Mountain, type: "ALL" },
    { label: "Campgrounds", icon: Tent, type: "CAGD" },
    { label: "Car Camping", icon: CarFront, type: "CACP" },
    { label: "Glamping", icon: Ghost, type: "GLAMP" },
    { label: "Lakefront", icon: Waves, type: "LAKE" },
    { label: "Forest", icon: Trees, type: "FOREST" },
    { label: "Views", icon: Mountain, type: "VIEW" },
    { label: "Boat Access", icon: Sailboat, type: "BAOT" },
];

export function CategoryBar() {
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
                    key={cat.label}
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
                    <span className="text-xs font-medium whitespace-nowrap">{cat.label}</span>
                </button>
            ))}
        </div>
    );
}
