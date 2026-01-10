"use client";

import Link from "next/link";
import { Search, Menu, User, Tent } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

export function Navbar() {
    const { t } = useLanguage();

    return (
        <nav className="border-b border-gray-100 sticky top-0 bg-white z-50">
            <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <Tent className="text-green-900 w-8 h-8" />
                    <span className="text-xl font-bold font-display tracking-tight text-green-900">
                        CampVibe
                    </span>
                </Link>

                {/* Search Bar - Center (Airbnb style) */}
                <div className="hidden md:flex items-center border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white divide-x divide-gray-100">
                    <div className="px-6 py-2.5 text-sm font-medium">{t.nav.anywhere}</div>
                    <div className="px-6 py-2.5 text-sm font-medium">{t.nav.anyWeek}</div>
                    <div className="pl-6 pr-2 py-2 flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-normal">{t.nav.addGuests}</span>
                        <div className="bg-green-900 p-2 rounded-full text-white">
                            <Search className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                {/* User Menu */}
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <div className="hidden md:block text-sm font-medium hover:bg-gray-100 px-4 py-2 rounded-full cursor-pointer transition">
                        {t.nav.campYourHome}
                    </div>
                    <div className="flex items-center gap-2 border border-gray-200 rounded-full p-1 pl-3 hover:shadow-md transition cursor-pointer">
                        <Menu className="w-5 h-5 text-gray-600" />
                        <div className="bg-gray-500 rounded-full p-1">
                            <User className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
