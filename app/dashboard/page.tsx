"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Tent,
    DollarSign,
    TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
    stats: {
        totalRevenue: number;
        totalBookings: number;
        campgroundCount: number;
    };
    bookings: any[];
    campgrounds: any[];
    operator: any | null;
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
                setData(data);
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
            }
        } catch (error) {
            console.error("Status update error:", error);
        }
    };

    if (loading) return (
        <div className="space-y-8 animate-pulse">
            <div className="flex justify-between items-end">
                <div>
                    <Skeleton className="h-10 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-12 w-48 rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="rounded-2xl shadow-sm border-gray-100">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-1" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <div className="p-8 space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-[250px]" />
                                <Skeleton className="h-4 w-[200px]" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
    if (error) return <div className="p-10 text-red-600 bg-red-50 rounded-2xl border border-red-100 m-10">
        <h3 className="font-bold text-lg mb-2">Error</h3>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4 rounded-full">Retry</Button>
    </div>;
    if (!data) return <div className="p-10">Error loading data.</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{t.dashboard.dashboardOverview}</h2>
                    <p className="text-gray-500 mt-2">
                        {data.operator ? t.dashboard.welcomeBack : "Welcome to your new dashboard!"}
                    </p>
                </div>
                <Link href="/dashboard/campgrounds/new">
                    <Button className="h-12 px-6 rounded-full font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                        <Tent className="w-4 h-4 mr-2" />
                        {t.dashboard.addCampground}
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-2xl shadow-sm border-gray-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            {t.dashboard.totalRevenue}
                        </CardTitle>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{formatCurrency(data?.stats?.totalRevenue || 0)}</div>
                        <p className="text-xs text-gray-500 mt-1">
                            +20.1% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl shadow-sm border-gray-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Total Bookings
                        </CardTitle>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{data?.stats?.totalBookings || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">
                            +15% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl shadow-sm border-gray-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Active Listings
                        </CardTitle>
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Tent className="h-4 w-4 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{data?.stats?.campgroundCount || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">
                            Current active campgrounds
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Bookings Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-900">{t.dashboard.recentBookings}</h3>
                    <Button asChild variant="ghost" className="text-primary hover:text-primary/80 font-semibold hover:bg-primary/5 rounded-full">
                        <Link href="/dashboard/bookings">
                            {t.dashboard.viewAll}
                        </Link>
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-4 font-semibold text-gray-500">{t.dashboard.guest}</th>
                                <th className="px-8 py-4 font-semibold text-gray-500">{t.dashboard.campground}</th>
                                <th className="px-8 py-4 font-semibold text-gray-500">{t.booking.checkIn}</th>
                                <th className="px-8 py-4 font-semibold text-gray-500">{t.dashboard.total}</th>
                                <th className="px-8 py-4 font-semibold text-gray-500">{t.dashboard.status}</th>
                                <th className="px-8 py-4 font-semibold text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* Safer check for bookings array */}
                            {(!data.bookings || data.bookings.length === 0) ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-gray-500">{t.dashboard.noBookings}</td>
                                </tr>
                            ) : (
                                data.bookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50/50 transition duration-200 group">
                                        <td className="px-8 py-5 font-medium text-gray-900">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-white">
                                                    {booking.user.name?.[0] || 'G'}
                                                </div>
                                                {booking.user.name || booking.user.email}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-gray-600">{booking.campground.nameTh}</td>
                                        <td className="px-8 py-5 text-gray-600">{new Date(booking.checkInDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}</td>
                                        <td className="px-8 py-5 text-gray-900 font-bold">{formatCurrency(booking.totalPrice)}</td>
                                        <td className="px-8 py-5">
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
                                        <td className="px-8 py-5 text-right">
                                            {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                                                <div className="flex gap-2 justify-end">
                                                    {booking.status === 'PENDING' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleStatusUpdate(booking.id, 'CONFIRMED')}
                                                            className="rounded-full bg-primary hover:bg-primary/90 h-8 text-xs font-bold px-4"
                                                        >
                                                            Confirm
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleStatusUpdate(booking.id, 'CANCELLED')}
                                                        className="rounded-full text-red-500 hover:bg-red-50 h-8 text-xs font-bold px-4"
                                                    >
                                                        Cancel
                                                    </Button>
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

