"use client";

import Link from "next/link";
import { Search, Menu, User } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { handleSignOut } from "@/lib/actions";

interface NavbarProps {
    currentUser?: {
        name?: string | null;
        image?: string | null;
    } | null;
}

export function Navbar({ currentUser }: NavbarProps) {
    const { t } = useLanguage();

    return (
        <nav className="border-b border-gray-100 sticky top-0 bg-white z-50">
            <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <img src="/logo.png" alt="CampVibe Logo" className="h-8 md:h-10 w-auto" />
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

                    {!currentUser ? (
                        <>
                            <Link href="/login" className="hidden md:block text-sm font-medium hover:bg-gray-100 px-4 py-2 rounded-full cursor-pointer transition">
                                Log in
                            </Link>
                            <Link href="/register" className="hidden md:block text-sm font-medium bg-green-900 text-white hover:bg-green-800 px-4 py-2 rounded-full cursor-pointer transition">
                                Sign up
                            </Link>
                        </>
                    ) : (
                        <Link href="/dashboard" className="hidden md:block text-sm font-medium hover:bg-gray-100 px-4 py-2 rounded-full cursor-pointer transition">
                            Switch to Hosting
                        </Link>
                    )}

                    <div className="flex items-center gap-2 border border-gray-200 rounded-full p-1 pl-3 hover:shadow-md transition cursor-pointer relative group">
                        <Menu className="w-5 h-5 text-gray-600" />
                        <div className="bg-gray-500 rounded-full p-1 overflow-hidden">
                            {currentUser?.image ? (
                                <img src={currentUser.image} alt="User" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                                <User className="w-6 h-6 text-white" />
                            )}
                        </div>

                        {/* Dropdown Menu */}
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 hidden group-hover:block">
                            {currentUser ? (
                                <>
                                    <div className="px-4 py-2 border-b border-gray-100">
                                        <p className="text-sm font-semibold">{currentUser.name}</p>
                                    </div>
                                    <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        Host Dashboard
                                    </Link>
                                    <form action={handleSignOut}>
                                        <button type="submit" className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                            Sign out
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <Link href="/login" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Log in</Link>
                                    <Link href="/register" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Sign up</Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
