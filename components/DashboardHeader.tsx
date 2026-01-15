"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { handleSignOut } from "@/lib/actions";
import { NotificationCenter } from "@/components/NotificationCenter";

interface DashboardHeaderProps {
    user: {
        name: string | null;
        email: string;
        image: string | null;
        role: string;
    };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const [imageError, setImageError] = useState(false);

    // Debug: Log current user
    useEffect(() => {
        console.log("=== CURRENT USER INFO ===");
        console.log("User:", user);
    }, [user]);

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="w-full max-w-none px-4 md:px-6 h-16 flex items-center justify-between">
                {/* Left: Profile Info */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="flex items-center gap-3 h-auto p-2 hover:bg-muted rounded-full"
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center overflow-hidden",
                                (user.image && !imageError) ? "bg-transparent" : "bg-primary/10"
                            )}>
                                {(user.image && !imageError) ? (
                                    <img
                                        src={user.image}
                                        alt={user.name || "User"}
                                        className="w-full h-full object-cover"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <User className="w-5 h-5 text-primary" />
                                )}
                            </div>
                            <div className="hidden md:block text-left">
                                <div className="text-sm font-semibold text-foreground">
                                    {user.name || "User"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {user.email}
                                </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 rounded-xl border-none shadow-2xl mt-2 p-2">
                        <DropdownMenuLabel className="font-bold px-3 py-2">
                            {user.name || "User"}
                        </DropdownMenuLabel>
                        <div className="px-3 py-1 text-xs text-muted-foreground">
                            {user.email}
                        </div>
                        <div className="px-3 py-1">
                            <Badge variant="outline" className="text-xs">
                                {user.role || "USER"}
                            </Badge>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer py-2.5 px-3 focus:bg-muted font-semibold">
                            <Link href="/profile">My Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleSignOut()}
                            className="rounded-lg cursor-pointer py-2.5 px-3 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Right: Notifications (extensible: bookings + invites + future) */}
                <NotificationCenter showHostBookings showCamperBookingUpdates showInvites />
            </div>
        </header>
    );
}
