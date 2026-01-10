"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    LayoutDashboard,
    Tent,
    CalendarDays,
    LogOut,
    DollarSign,
    TrendingUp,
    Users
} from "lucide-react";

interface DashboardData {
    stats: {
        totalRevenue: number;
        totalBookings: number;
        campgroundCount: number;
    };
    bookings: any[];
    campgrounds: any[];
}

export default function OperatorDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/operator/dashboard')
            .then(res => res.json())
            .then(data => {
                setData(data);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-10">Loading Dashboard...</div>;
    if (!data) return <div className="p-10">Error loading data.</div>;

    return (
        <div className="flex min-h-screen bg-gray-50">

            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold font-display text-green-900 flex items-center gap-2">
                        <Tent className="w-6 h-6" />
                        Host Panel
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-900 rounded-lg font-medium">
                        <LayoutDashboard className="w-5 h-5" />
                        Overview
                    </Link>
                    <Link href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
                        <Tent className="w-5 h-5" />
                        My Campgrounds
                    </Link>
                    <Link href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
                        <CalendarDays className="w-5 h-5" />
                        Bookings
                    </Link>
                </nav>

                <div className="p-4 border-t border-gray-50">
                    <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-black transition">
                        <LogOut className="w-5 h-5" />
                        Back to Home
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                        <p className="text-gray-500">Welcome back, Operator.</p>
                    </div>
                    <Link
                        href="/dashboard/campgrounds/new"
                        className="px-6 py-3 bg-green-900 text-white rounded-xl font-semibold hover:bg-green-800 transition shadow-sm flex items-center gap-2"
                    >
                        <Tent className="w-4 h-4" />
                        Add New Campground
                    </Link>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-50">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                                <h3 className="text-2xl font-bold mt-1">${data.stats.totalRevenue.toLocaleString()}</h3>
                            </div>
                            <div className="p-2 bg-green-100 rounded-lg">
                                <DollarSign className="w-5 h-5 text-green-800" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-50">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                                <h3 className="text-2xl font-bold mt-1">{data.stats.totalBookings}</h3>
                            </div>
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-50">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Active Listings</p>
                                <h3 className="text-2xl font-bold mt-1">{data.stats.campgroundCount}</h3>
                            </div>
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Tent className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Bookings Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-50 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Recent Bookings</h3>
                        <button className="text-sm text-green-900 font-medium hover:underline">View All</button>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-3 font-medium text-gray-500">Guest</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Campground</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Check-in</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Total</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.bookings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No bookings found.</td>
                                </tr>
                            ) : (
                                data.bookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                                                    {booking.user.name?.[0] || 'G'}
                                                </div>
                                                {booking.user.name || booking.user.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{booking.campground.nameTh}</td>
                                        <td className="px-6 py-4 text-gray-600">{new Date(booking.checkInDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-gray-900 font-medium">${booking.totalPrice}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-900' : 'bg-yellow-100 text-yellow-800'}
                                    `}>
                                                {booking.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </main>
        </div>
    );
}
