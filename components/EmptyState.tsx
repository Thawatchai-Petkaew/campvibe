"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    title?: string;
    subtitle?: string;
    showReset?: boolean;
}

export function EmptyState({ title, subtitle, showReset }: EmptyStateProps) {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
            <div className="relative mb-4 group">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <img
                    src="/empty-state.png"
                    alt={t.emptyState.noResults}
                    className="w-64 md:w-80 h-auto relative"
                />
            </div>

            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">
                {title || t.emptyState.noResults}
            </h2>
            <p className="text-muted-foreground max-w-md text-center mb-6 px-6 text-lg">
                {subtitle || t.emptyState.adjustFilters}
            </p>

            {showReset && (
                <Button
                    onClick={() => window.location.href = '/'}
                    className="rounded-full font-bold shadow-lg shadow-primary/20"
                >
                    {t.emptyState.clearFilters}
                </Button>
            )}


        </div>
    );
}
