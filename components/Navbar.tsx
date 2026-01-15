"use client";

import Link from "next/link";
import { Search, Menu, User, Filter, Globe, Bell, Check, X } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { handleSignOut } from "@/lib/actions";
import { useState, useMemo, useEffect } from "react";
import { SearchModal } from "./SearchModal";
import { LoginModal } from "./LoginModal";
import { RegisterModal } from "./RegisterModal";
import { useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/NotificationCenter";
import { HostOnboardingFab } from "@/components/HostOnboardingFab";
import { useSession } from "next-auth/react";

interface NavbarProps {
    currentUser?: {
        name?: string | null;
        image?: string | null;
    } | null;
}

export function Navbar({ currentUser }: NavbarProps) {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { status } = useSession();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [hostEntryHref, setHostEntryHref] = useState<string>("/dashboard");
    const [canAccessDashboard, setCanAccessDashboard] = useState(false);
    
    const isDashboard = pathname?.startsWith('/dashboard');

    useEffect(() => {
        if (!currentUser) return;
        // Safety net: after login succeeds and Navbar re-renders with currentUser, ensure no auth modal overlay remains.
        setIsLoginOpen(false);
        setIsRegisterOpen(false);
    }, [currentUser]);

    useEffect(() => {
        if (status !== "authenticated") return;
        // Extra safety net: session can update without a route change; ensure any overlay modals are closed.
        setIsLoginOpen(false);
        setIsRegisterOpen(false);
        setIsSearchOpen(false);
    }, [status]);

    useEffect(() => {
        if (!currentUser) return;
        const run = async () => {
            try {
                const res = await fetch("/api/access/dashboard");
                if (!res.ok) return;
                const data = await res.json();
                const allowed = !!data?.canAccessDashboard;
                setCanAccessDashboard(allowed);
                setHostEntryHref(allowed ? "/dashboard" : "/host");
            } catch {
                // ignore
            }
        };
        run();
    }, [currentUser]);

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
            <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between gap-4 text-foreground">
                    {/* Logo */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Link href="/" className="flex-shrink-0">
                            <img src="/logo.png" alt="CampVibe Logo" className="h-8 md:h-10 w-auto" />
                        </Link>
                        {currentUser && isDashboard && (
                            <Link href="/dashboard">
                                <Badge 
                                    variant="default" 
                                    className="cursor-pointer hover:bg-primary/80 transition-colors text-xs px-2 py-0.5 font-bold uppercase"
                                >
                                    HOST
                                </Badge>
                            </Link>
                        )}
                    </div>

                    {/* Search Bar - Center (Airbnb style) */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="hidden md:flex flex-grow max-w-[500px] lg:max-w-xl items-center border border-border rounded-full shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card divide-x divide-border mx-4"
                    >
                        <div className="px-6 py-2.5 text-sm font-semibold flex-1 truncate text-foreground">
                            {activeSearchLabel.locationLabel}
                        </div>
                        <div className="px-6 py-2.5 text-sm font-medium flex-1 truncate text-muted-foreground">
                            {activeSearchLabel.dateLabel}
                        </div>
                        <div className="pl-6 pr-2 py-2 flex items-center gap-3 min-w-[140px]">
                            <span className="text-sm text-muted-foreground font-normal truncate flex-1">{activeSearchLabel.guestLabel}</span>
                            <div className="bg-primary p-2 rounded-full text-primary-foreground flex-shrink-0 shadow-sm">
                                <Search className="w-4 h-4 stroke-[3px]" />
                            </div>
                        </div>
                    </button>

                    {/* User Menu */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <LanguageSwitcher />

                        {/* Notifications (Camper context): booking status updates (no required action) + team invites */}
                        {currentUser && (
                            <NotificationCenter
                                showHostBookings={canAccessDashboard}
                                showCamperBookingUpdates
                                showInvites
                            />
                        )}

                        {!currentUser && (
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
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-2 border border-border rounded-full p-1 pl-3 hover:shadow-md transition cursor-pointer relative bg-card">
                                    <Menu className="w-5 h-5 text-muted-foreground" />
                                    <div className={(currentUser?.image && !imageError) ? "rounded-full overflow-hidden" : "bg-muted rounded-full p-1 overflow-hidden"}>
                                        {(currentUser?.image && !imageError) ? (
                                            <img
                                                src={currentUser.image}
                                                alt="User"
                                                className="w-8 h-8 rounded-full object-cover"
                                                onError={() => setImageError(true)}
                                            />
                                        ) : (
                                            <User className="w-6 h-6 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl mt-2 p-2">
                                {currentUser ? (
                                    <>
                                        <DropdownMenuLabel className="font-bold px-3 py-2">
                                            {currentUser.name}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted font-semibold">
                                            <Link href="/profile">My Profile</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted font-semibold">
                                            <Link href="/bookings">My Bookings</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-primary/10 focus:text-foreground">
                                            <Link href={hostEntryHref} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-foreground truncate">
                                                            Host Dashboard
                                                        </div>
                                                        <div className="text-xs text-muted-foreground truncate">
                                                            Switch to host context
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="default" className="rounded-full text-[11px] font-bold">
                                                    HOST
                                                </Badge>
                                            </Link>
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
                        className="flex items-center gap-3 border border-border rounded-full px-4 py-3 shadow-sm active:scale-[0.98] transition-transform bg-card"
                    >
                        <Search className="w-4 h-4" />
                        <span className="text-sm font-medium flex-1">{t.search.anywhere}</span>
                        <div className="border border-border p-1.5 rounded-full">
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

            {/* Camper → Host onboarding CTA (only shows if user cannot access dashboard yet) */}
            <HostOnboardingFab isLoggedIn={!!currentUser} />
        </>
    );
}
