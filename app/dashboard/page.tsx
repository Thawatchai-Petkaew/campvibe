"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Tent,
    DollarSign,
    TrendingUp,
    Check,
    X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardOverviewSkeleton } from "@/components/ui/loading-skeleton";
import { PermissionTooltip } from "@/components/ui/permission-tooltip";
import { toast } from "sonner";

interface DashboardData {
    stats: {
        totalRevenue: number | null;
        totalBookings: number;
        campSiteCount: number;
        campgroundCount?: number; // Legacy support
    };
    bookings: any[];
    campSites: any[];
    campgrounds?: any[]; // Legacy support
    operator: any | null;
    permissions?: {
        canCreateCampSite?: boolean;
        canViewFinancial?: boolean;
        canViewBookings?: boolean;
        canUpdateAnyBooking?: boolean;
    };
}

export default function OperatorDashboard() {
    const { t, formatCurrency, language } = useLanguage();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/operator/dashboard')
            .then(async res => {
                if (!res.ok) {
                    let errorMessage = 'Failed to fetch dashboard data';
                    try {
                        const err = await res.json();
                        errorMessage = err.error || errorMessage;
                    } catch (e) {
                        console.warn("Non-JSON error response from dashboard API");
                        // Fallback to status text
                        errorMessage = `Error ${res.status}: ${res.statusText}`;
                    }
                    throw new Error(errorMessage);
                }
                return res.json();
            })
            .then(data => {
                console.log('Dashboard API response:', data);
                // Handle both direct response and wrapped response
                const responseData = data.data || data;
                setData({
                    stats: responseData.stats || { totalRevenue: 0, totalBookings: 0, campSiteCount: 0, campgroundCount: 0 },
                    bookings: responseData.bookings || [],
                    campSites: responseData.campSites || responseData.campgrounds || [],
                    campgrounds: responseData.campgrounds || [],
                    operator: responseData.operator || null
                });
                setLoading(false);
            })
            .catch(err => {
                console.error("Dashboard load error:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    const handleStatusUpdate = async (bookingId: string, status: string) => {
        try {
            const res = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                setData(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        bookings: prev.bookings.map(b => b.id === bookingId ? { ...b, status } : b)
                    };
                });
                toast.success(t.dashboardBookings?.bookingUpdatedSuccess || "Booking updated successfully");
            } else {
                let payload: any = null;
                try {
                    payload = await res.json();
                } catch {
                    // ignore
                }
                toast.error(payload?.error || payload?.message || `Error ${res.status}: ${res.statusText}`);
            }
        } catch (error) {
            console.error("Status update error:", error);
            toast.error("Failed to update booking");
        }
    };

    if (loading) return <DashboardOverviewSkeleton />;
    if (error) return (
        <div className="p-10 text-destructive bg-destructive/10 rounded-2xl border border-destructive/30 m-10">
            <h3 className="font-bold text-lg mb-2">Error</h3>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4 rounded-full">
                Retry
            </Button>
        </div>
    );
    if (!data) return <div className="p-10">Error loading data.</div>;

    const canCreateCampSite = !!data.permissions?.canCreateCampSite;
    const recentBookings = Array.isArray(data.bookings) ? data.bookings.slice(0, 5) : [];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-foreground tracking-tight">{t.dashboard.dashboardOverview}</h2>
                    <p className="text-muted-foreground mt-2">
                        {data.operator ? t.dashboard.welcomeBack : t.dashboard.welcomeNewDashboard}
                    </p>
                </div>
                <PermissionTooltip
                    hasPermission={canCreateCampSite}
                    title="Permission Required"
                    description="You don't have permission to create a camp site."
                    suggestion="Ask the camp site owner to grant you access."
                >
                    <Link href={canCreateCampSite ? "/dashboard/campsites/new" : "#"} aria-disabled={!canCreateCampSite} tabIndex={canCreateCampSite ? 0 : -1}>
                        <Button
                            disabled={!canCreateCampSite}
                            className="h-12 px-6 rounded-full font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Tent className="w-4 h-4 mr-2" />
                            {t.dashboard.addCampSite}
                        </Button>
                    </Link>
                </PermissionTooltip>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-2xl shadow-sm border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t.dashboard.totalRevenue}
                        </CardTitle>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {data?.stats?.totalRevenue == null ? "—" : formatCurrency(data.stats.totalRevenue)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            +20.1% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl shadow-sm border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t.dashboard.totalBookings}
                        </CardTitle>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{data?.stats?.totalBookings || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t.dashboard.fromLastMonthBookings}
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl shadow-sm border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t.dashboard.activeListings}
                        </CardTitle>
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Tent className="h-4 w-4 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{data?.stats?.campSiteCount || data?.stats?.campgroundCount || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t.dashboard.currentActiveCampSites}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Bookings Table */}
            <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-6 border-b border-border/60 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-foreground">{t.dashboard.recentBookings}</h3>
                    {data.permissions?.canViewBookings !== false && (
                        <Button asChild variant="ghost" className="text-primary hover:text-primary/80 font-semibold hover:bg-primary/5 rounded-full">
                            <Link href="/dashboard/bookings">
                                {t.dashboard.viewAll}
                            </Link>
                        </Button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-muted/40 border-b border-border/60">
                                <th className="px-6 py-4 font-semibold text-muted-foreground">{t.dashboard.guest}</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground">{t.dashboard.campground}</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground">{t.booking.checkIn}</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground">{t.dashboard.total}</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground">{t.dashboard.status}</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {/* Safer check for bookings array */}
                            {data.permissions?.canViewBookings === false ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-muted-foreground">
                                        You don't have permission to view bookings.
                                    </td>
                                </tr>
                            ) : (!recentBookings || recentBookings.length === 0) ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-muted-foreground">{t.dashboard.noBookings}</td>
                                </tr>
                            ) : (
                                recentBookings.map((booking) => (
                                <tr key={booking.id} className="hover:bg-muted/40 transition duration-200 group">
                                    <td className="px-6 py-5 font-medium text-foreground">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-white">
                                                    {booking.user.name?.[0] || 'G'}
                                                </div>
                                                {booking.user.name || booking.user.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-muted-foreground">{booking.campSite?.nameTh || booking.campground?.nameTh}</td>
                                        <td className="px-6 py-5 text-muted-foreground">{new Date(booking.checkInDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}</td>
                                        <td className="px-6 py-5 text-foreground font-bold">{formatCurrency(booking.totalPrice)}</td>
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider
                                        ${booking.status === 'CONFIRMED'
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : booking.status === 'CANCELLED'
                                                        ? 'bg-red-50 text-red-700 border-red-200'
                                                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'}
                                    `}>
                                                {booking.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                                                <div className="flex gap-2 justify-end">
                                                    {booking.status === 'PENDING' && (
                                                        <PermissionTooltip
                                                            hasPermission={booking?.canUpdate !== false}
                                                            title="Permission Required"
                                                            description="You don't have permission to manage this booking."
                                                            suggestion="Ask the camp site owner to grant BOOKING_UPDATE access."
                                                        >
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleStatusUpdate(booking.id, 'CONFIRMED')}
                                                                disabled={booking?.canUpdate === false}
                                                                className="h-9 px-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Check className="w-4 h-4 mr-1.5" />
                                                                {t.dashboard.confirm}
                                                            </Button>
                                                        </PermissionTooltip>
                                                    )}
                                                    <PermissionTooltip
                                                        hasPermission={booking?.canUpdate !== false}
                                                        title="Permission Required"
                                                        description="You don't have permission to manage this booking."
                                                        suggestion="Ask the camp site owner to grant BOOKING_UPDATE access."
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleStatusUpdate(booking.id, 'CANCELLED')}
                                                            disabled={booking?.canUpdate === false}
                                                            className="h-9 px-3 rounded-full border-border text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/10 transition shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <X className="w-4 h-4 mr-1.5" />
                                                            {t.dashboard.cancel}
                                                        </Button>
                                                    </PermissionTooltip>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

