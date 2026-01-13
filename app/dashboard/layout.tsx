"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Tent,
    CalendarDays,
    LogOut,
    Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { t } = useLanguage();
    const pathname = usePathname();

    const navigation = [
        { name: t.dashboard.overview, href: '/dashboard', icon: LayoutDashboard },
        { name: t.dashboard.myCampgrounds, href: '/dashboard/campgrounds', icon: Tent },
        { name: t.dashboard.bookings, href: '/dashboard/bookings', icon: CalendarDays },
    ];

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white border-r border-gray-100">
            <div className="p-6">
                <Link href="/">
                    <img src="/logo.png" alt="CampVibe Logo" className="h-10 w-auto" />
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-black"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-gray-500")} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-50">
                <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-black transition">
                    <LogOut className="w-5 h-5" />
                    {t.dashboard.backToHome}
                </Link>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Desktop Sidebar */}
            <aside className="w-64 hidden md:block">
                <div className="fixed inset-y-0 w-64">
                    <SidebarContent />
                </div>
            </aside>

            {/* Mobile Sidebar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                <Link href="/">
                    <img src="/logo.png" alt="CampVibe Logo" className="h-8 w-auto" />
                </Link>
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

            {/* Main Content */}
            <main className="flex-1 md:bg-gray-50 pt-16 md:pt-0">
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
