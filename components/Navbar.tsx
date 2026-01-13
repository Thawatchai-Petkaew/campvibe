"use client";

import Link from "next/link";
import { Search, Menu, User, Filter, Globe } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { handleSignOut } from "@/lib/actions";
import { useState, useMemo } from "react";
import { SearchModal } from "./SearchModal";
import { LoginModal } from "./LoginModal";
import { RegisterModal } from "./RegisterModal";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
    currentUser?: {
        name?: string | null;
        image?: string | null;
    } | null;
}

export function Navbar({ currentUser }: NavbarProps) {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);

    const activeSearchLabel = useMemo(() => {
        const keyword = searchParams.get("keyword");
        const province = searchParams.get("province");
        const district = searchParams.get("district");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const guests = searchParams.get("guests");

        const locationParts = [district, province].filter(Boolean);
        const locationLabel = locationParts.length > 0 ? locationParts.join(", ") : (keyword || t.search.anywhere);
        const dateLabel = (startDate && endDate) ? `${startDate} - ${endDate}` : t.search.anyWeek;
        const guestLabel = guests ? `${guests} ${guests === "1" ? t.booking.guest : t.search.guests}` : t.search.addGuests;

        return { locationLabel, dateLabel, guestLabel };
    }, [searchParams, t]);

    return (
        <>
            <nav className="border-b border-gray-100 sticky top-0 bg-white z-50">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between gap-4">
                    {/* Logo */}
                    <Link href="/" className="flex-shrink-0">
                        <img src="/logo.png" alt="CampVibe Logo" className="h-8 md:h-10 w-auto" />
                    </Link>

                    {/* Search Bar - Center (Airbnb style) */}
                    <div
                        onClick={() => setIsSearchOpen(true)}
                        className="hidden md:flex flex-grow max-w-[500px] lg:max-w-xl items-center border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white divide-x divide-gray-100 mx-4"
                    >
                        <div className="px-6 py-2.5 text-sm font-bold flex-1 truncate text-gray-900">
                            {activeSearchLabel.locationLabel}
                        </div>
                        <div className="px-6 py-2.5 text-sm font-medium flex-1 truncate text-gray-500">
                            {activeSearchLabel.dateLabel}
                        </div>
                        <div className="pl-6 pr-2 py-2 flex items-center gap-3 min-w-[140px]">
                            <span className="text-sm text-gray-400 font-normal truncate flex-1">{activeSearchLabel.guestLabel}</span>
                            <div className="bg-primary p-2 rounded-full text-primary-foreground flex-shrink-0">
                                <Search className="w-4 h-4 stroke-[3px]" />
                            </div>
                        </div>
                    </div>

                    {/* User Menu */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <LanguageSwitcher />

                        {!currentUser ? (
                            <div className="hidden lg:flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    className="rounded-full font-medium"
                                    onClick={() => setIsLoginOpen(true)}
                                >
                                    Log in
                                </Button>
                                <Button
                                    variant="default"
                                    className="rounded-full font-medium bg-primary hover:bg-primary/90"
                                    onClick={() => setIsRegisterOpen(true)}
                                >
                                    Sign up
                                </Button>
                            </div>
                        ) : (
                            <Button variant="ghost" asChild className="hidden lg:flex rounded-full font-medium">
                                <Link href="/dashboard">Switch to Hosting</Link>
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <div className="flex items-center gap-2 border border-gray-200 rounded-full p-1 pl-3 hover:shadow-md transition cursor-pointer relative">
                                    <Menu className="w-5 h-5 text-gray-600" />
                                    <div className="bg-gray-500 rounded-full p-1 overflow-hidden">
                                        {currentUser?.image ? (
                                            <img src={currentUser.image} alt="User" className="w-6 h-6 rounded-full object-cover" />
                                        ) : (
                                            <User className="w-6 h-6 text-white" />
                                        )}
                                    </div>
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl mt-2 p-2">
                                {currentUser ? (
                                    <>
                                        <DropdownMenuLabel className="font-bold px-3 py-2">
                                            {currentUser.name}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted">
                                            <Link href="/dashboard">Host Dashboard</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleSignOut()}
                                            className="rounded-lg cursor-pointer py-2.5 px-3 text-destructive focus:bg-destructive/10 focus:text-destructive"
                                        >
                                            Sign out
                                        </DropdownMenuItem>
                                    </>
                                ) : (
                                    <>
                                        <DropdownMenuItem
                                            className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted font-bold"
                                            onClick={() => setIsLoginOpen(true)}
                                        >
                                            Log in
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted"
                                            onClick={() => setIsRegisterOpen(true)}
                                        >
                                            Sign up
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted">
                                            Host your home
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted">
                                            Help Center
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Mobile Search - Single bar on mobile */}
                <div className="md:hidden px-6 pb-4">
                    <div
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-3 border border-gray-200 rounded-full px-4 py-3 shadow-sm active:scale-[0.98] transition-transform"
                    >
                        <Search className="w-4 h-4" />
                        <span className="text-sm font-medium flex-1">{t.search.anywhere}</span>
                        <div className="border border-gray-200 p-1.5 rounded-full">
                            <Filter className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>
            </nav>

            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />

            <LoginModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
            />

            <RegisterModal
                isOpen={isRegisterOpen}
                onClose={() => setIsRegisterOpen(false)}
                onSuccess={() => {
                    setIsRegisterOpen(false);
                    setIsLoginOpen(true);
                }}
            />
        </>
    );
}
