"use client";

import { ReactNode } from "react";

export function FilterSortBar({ children }: { children: ReactNode }) {
    return (
        <div className="container mx-auto px-6 py-2 mb-2">
            <div className="flex items-center justify-between p-1">
                {children}
            </div>
        </div>
    );
}
