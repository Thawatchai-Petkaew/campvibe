"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import {
    Tent,
    Plus,
    Edit,
    Trash2,
    MapPin,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        <div className="flex h-64 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t.dashboard.myCampgrounds}</h1>
                    <p className="text-gray-500 mt-2">Manage your listings, update details, and view status.</p>
                </div>
                <Link href="/dashboard/campgrounds/new">
                    <Button className="h-12 px-6 rounded-full font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                        <Plus className="w-4 h-4 mr-2" />
                        {t.dashboard.addCampground}
                    </Button>
                </Link>
            </div>

            {/* Search & Filter */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4 max-w-2xl">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        type="text"
                        placeholder="Search campgrounds..."
                        className="pl-10 h-10 w-full rounded-lg border-gray-200 focus-visible:ring-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-4 font-semibold text-gray-500 w-24">Base</th>
                                <th className="px-8 py-4 font-semibold text-gray-500">Name</th>
                                <th className="px-8 py-4 font-semibold text-gray-500">Location</th>
                                <th className="px-8 py-4 font-semibold text-gray-500">Price</th>
                                <th className="px-8 py-4 font-semibold text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(!filteredCampgrounds || filteredCampgrounds.length === 0) ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-16 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Tent className="w-8 h-8 text-gray-300" />
                                            <p>No campgrounds found.</p>
                                            <Link href="/dashboard/campgrounds/new" className="text-primary font-semibold hover:underline">Create your first listing</Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCampgrounds.map((camp) => (
                                    <tr key={camp.id} className="hover:bg-gray-50/50 transition duration-200 group">
                                        <td className="px-8 py-4">
                                            <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shadow-sm border border-gray-100">
                                                {camp.images ? (
                                                    <img src={camp.images.split(',')[0]} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <Tent className="w-full h-full p-4 text-gray-300" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="font-bold text-gray-900 text-base">{language === 'th' ? camp.nameTh : camp.nameEn}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5">{language === 'th' ? camp.nameEn : camp.nameTh}</div>
                                        </td>
                                        <td className="px-8 py-4 text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                {camp.location?.province || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 font-bold text-gray-900">
                                            {formatCurrency(camp.priceLow)}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <Link href={`/dashboard/campgrounds/${camp.id}/edit`}>
                                                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-gray-200 hover:text-primary hover:border-primary hover:bg-primary/5 transition">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleDelete(camp.id)}
                                                    className="h-9 w-9 rounded-full border-gray-200 hover:text-red-600 hover:border-red-600 hover:bg-red-50 transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
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

