"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Tent,
    CalendarDays,
    Settings,
    LogOut,
    Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/DashboardHeader";
import { cn } from "@/lib/utils";

interface DashboardLayoutClientProps {
    children: React.ReactNode;
    user: {
        name: string | null;
        email: string;
        image: string | null;
        role: string;
    };
}

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
    const { t } = useLanguage();
    const pathname = usePathname();
    const [pendingCount, setPendingCount] = useState(0);

    // Fetch pending bookings count
    useEffect(() => {
        console.log("=== FETCHING PENDING BOOKINGS ===");
        fetch('/api/operator/bookings?status=PENDING')
            .then(res => {
                console.log("Response status:", res.status);
                return res.json();
            })
            .then(data => {
                console.log("Response data:", data);
                if (data.success && Array.isArray(data.data)) {
                    console.log("Pending bookings count:", data.data.length);
                    setPendingCount(data.data.length);
                } else {
                    console.log("Invalid response format or no data");
                }
            })
            .catch(err => console.error("Failed to fetch pending bookings:", err));
    }, []);

    const navigation = [
        { name: t.dashboard.overview, href: '/dashboard', icon: LayoutDashboard, badge: null },
        { name: t.dashboard.myCampSites, href: '/dashboard/campsites', icon: Tent, badge: null },
        { name: t.dashboard.bookings, href: '/dashboard/bookings', icon: CalendarDays, badge: pendingCount > 0 ? pendingCount : null },
        { name: t.settings?.title || "Settings", href: '/dashboard/settings', icon: Settings, badge: null },
    ];

    // Debug: Log pending count
    useEffect(() => {
        console.log("Current pendingCount:", pendingCount);
        console.log("Bookings badge value:", pendingCount > 0 ? pendingCount : null);
    }, [pendingCount]);

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-card">
            <div className="p-6">
                <div className="flex items-center gap-2">
                    <Link href="/" className="flex-shrink-0">
                        <img src="/logo.png" alt="CampVibe Logo" className="h-10 w-auto" />
                    </Link>
                    <Link href="/dashboard">
                        <Badge 
                            variant="default" 
                            className="cursor-pointer hover:bg-primary/80 transition-colors text-xs px-2 py-0.5 font-bold uppercase"
                        >
                            HOST
                        </Badge>
                    </Link>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center justify-between gap-3 px-4 py-3 rounded-full font-medium transition",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                                {item.name}
                            </div>
                            {item.badge && (
                                <Badge 
                                    variant="destructive" 
                                    className="h-5 min-w-5 flex items-center justify-center rounded-full text-xs font-bold px-1.5"
                                >
                                    {item.badge}
                                </Badge>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border/60">
                <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition">
                    <LogOut className="w-5 h-5" />
                    {t.dashboard.backToHome}
                </Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar (Fixed) */}
            <aside className="fixed inset-y-0 left-0 z-50 w-64 hidden md:flex flex-col border-r border-border bg-card">
                <SidebarContent />
            </aside>

            {/* Mobile Header (Sticky) */}
            <div className="sticky top-0 z-50 md:hidden bg-card border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/">
                        <img src="/logo.png" alt="CampVibe Logo" className="h-8 w-auto" />
                    </Link>
                    <Link href="/dashboard">
                        <Badge 
                            variant="default" 
                            className="cursor-pointer hover:bg-primary/80 transition-colors text-xs px-2 py-0.5 font-bold uppercase"
                        >
                            HOST
                        </Badge>
                    </Link>
                </div>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="w-6 h-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64">
                        <SidebarContent />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col min-h-screen md:pl-64 transition-all duration-300 ease-in-out">
                {/* Header Navigation */}
                <DashboardHeader user={user} />
                
                {/* Main Content */}
                <main className="flex-1 w-full max-w-none px-4 md:px-6 py-4 md:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
