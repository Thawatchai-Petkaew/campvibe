"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export function EmptyState() {
    const { t } = useLanguage();

    return (
        <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2">{t.dashboard.noBookings.replace('bookings', 'campgrounds')}</h2>
            <p className="text-gray-500 mb-6">{t.newCampground.subtitle}</p>
            <a href="/api/seed" target="_blank" className="font-medium text-green-900 hover:underline">
                Seed Database (Click me)
            </a>
        </div>
    );
}
