"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import {
    LayoutDashboard,
    Tent,
    CalendarDays,
    LogOut,
    Plus,
    Edit,
    Trash2,
    MapPin,
    Search
} from "lucide-react";
import { handleSignOut } from "@/lib/actions";

export default function MyCampgroundsPage() {
    const { t, formatCurrency, language } = useLanguage();
    const [campgrounds, setCampgrounds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetch('/api/operator/dashboard')
            .then(res => res.json())
            .then(data => {
                if (data.campgrounds) {
                    setCampgrounds(data.campgrounds);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load campgrounds", err);
                setLoading(false);
            });
    }, []);

    const filteredCampgrounds = campgrounds.filter(camp =>
        camp.nameTh.toLowerCase().includes(searchTerm.toLowerCase()) ||
        camp.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this campground?")) return;

        try {
            const res = await fetch(`/api/campgrounds/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setCampgrounds(prev => prev.filter(c => c.id !== id));
            } else {
                alert("Failed to delete");
            }
        } catch (error) {
            console.error("Delete error", error);
        }
    };

    if (loading) return (
        <div className="flex min-h-screen bg-gray-50 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-900"></div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar (Reused from Dashboard layout - ideally should be a layout.tsx) */}
            <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col">
                <div className="p-6">
                    <Link href="/">
                        <img src="/logo.png" alt="CampVibe Logo" className="h-10 w-auto" />
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
                        <LayoutDashboard className="w-5 h-5" />
                        {t.dashboard.overview}
                    </Link>
                    <Link href="/dashboard/campgrounds" className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-900 rounded-lg font-medium transition">
                        <Tent className="w-5 h-5" />
                        {t.dashboard.myCampgrounds}
                    </Link>
                    <Link href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
                        <CalendarDays className="w-5 h-5" />
                        {t.dashboard.bookings}
                    </Link>
                </nav>

                <div className="p-4 border-t border-gray-50">
                    <form action={handleSignOut}>
                        <button type="submit" className="flex w-full items-center gap-3 px-4 py-3 text-gray-500 hover:text-black transition">
                            <LogOut className="w-5 h-5" />
                            {t.auth.signOut}
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t.dashboard.myCampgrounds}</h1>
                        <p className="text-gray-500">Manage your listings, update details, and view status.</p>
                    </div>
                    <Link
                        href="/dashboard/campgrounds/new"
                        className="px-6 py-3 bg-green-900 text-white rounded-xl font-semibold hover:bg-green-800 transition shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        {t.dashboard.addCampground}
                    </Link>
                </div>

                {/* Search & Filter */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search campgrounds..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-900/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-50 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-3 font-medium text-gray-500 w-20">Base</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Location</th>
                                <th className="px-6 py-3 font-medium text-gray-500">Price</th>
                                <th className="px-6 py-3 font-medium text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredCampgrounds.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No campgrounds found. <Link href="/dashboard/campgrounds/new" className="text-green-700 font-semibold hover:underline">Create one?</Link>
                                    </td>
                                </tr>
                            ) : (
                                filteredCampgrounds.map((camp) => (
                                    <tr key={camp.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                                                {camp.images ? (
                                                    <img src={camp.images.split(',')[0]} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <Tent className="w-full h-full p-3 text-gray-300" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{language === 'th' ? camp.nameTh : camp.nameEn}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{language === 'th' ? camp.nameEn : camp.nameTh}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                Loading... {/* Ideally verify location data join */}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {formatCurrency(camp.priceLow)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/dashboard/campgrounds/${camp.id}/edit`}
                                                    className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(camp.id)}
                                                    className="p-2 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
