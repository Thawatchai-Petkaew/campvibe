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
    Search,
    ArrowUpDown,
    Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { CardGridSkeleton } from "@/components/ui/loading-skeleton";
import { PermissionTooltip } from "@/components/ui/permission-tooltip";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function MyCampSitesPage() {
    const { t, formatCurrency, language } = useLanguage();
    const [campSites, setCampSites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [permissions, setPermissions] = useState<any | null>(null);

    useEffect(() => {
        fetch('/api/operator/dashboard')
            .then(async res => {
                if (!res.ok) {
                    const error = await res.json().catch(() => ({ error: 'Failed to fetch' }));
                    throw new Error(error.error || 'Failed to load camp sites');
                }
                return res.json();
            })
            .then(data => {
                console.log('Dashboard API response:', data);
                // Handle both direct response and wrapped response
                const responseData = data.data || data;
                const campSitesData = responseData.campSites || [];
                setPermissions(responseData.permissions || null);
                if (Array.isArray(campSitesData)) {
                    // Include location with thaiLocation for each camp site
                    setCampSites(campSitesData.map((camp: any) => ({
                        ...camp,
                        location: camp.location ? {
                            ...camp.location,
                            thaiLocation: camp.location.thaiLocation || null
                        } : null
                    })));
                } else {
                    setCampSites([]);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load camp sites", err);
                setCampSites([]);
                setLoading(false);
            });
    }, []);

    const filteredCampSites = campSites.filter(camp =>
        camp.nameTh.toLowerCase().includes(searchTerm.toLowerCase()) ||
        camp.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        if (sortBy === 'price_asc') return a.priceLow - b.priceLow;
        if (sortBy === 'price_desc') return b.priceLow - a.priceLow;
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        // Default: newest
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const handleDelete = async (id: string) => {
        const target = campSites.find((c) => c.id === id);
        if (target && target.canDelete === false) {
            toast.error("You don't have permission to delete this camp site.");
            return;
        }
        if (!confirm(t.dashboard.areYouSureDelete)) return;

        try {
            const res = await fetch(`/api/campsites/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setCampSites(prev => prev.filter(c => c.id !== id));
                toast.success("Deleted successfully");
            } else {
                const payload = await res.json().catch(() => null);
                toast.error(payload?.error || t.dashboard.failedToDelete);
            }
        } catch (error) {
            console.error("Delete error", error);
            toast.error(t.dashboard.failedToDelete);
        }
    };

    if (loading) return <CardGridSkeleton count={6} />;

    const canCreateCampSite = permissions?.canCreateCampSite !== false;

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">{t.dashboard.myCampSites}</h1>
                    <p className="text-muted-foreground">{t.dashboard.manageListings}</p>
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
                            className="h-11 px-6 rounded-full font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {t.dashboard.addCampSite}
                        </Button>
                    </Link>
                </PermissionTooltip>
            </div>

            {/* Toolbar Section - Consistent with Table Style */}
            <div className="bg-card p-2 rounded-full border border-border shadow-sm flex flex-col md:flex-row gap-2 items-center">
                <div className="flex-1 w-full md:w-auto relative">
                    <InputField
                        type="text"
                        placeholder={t.dashboard.searchCampSites}
                        className="h-10 w-full rounded-full border border-border bg-background focus:ring-0 pr-4 placeholder:text-muted-foreground/70"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        leftIcon={<Search className="w-4 h-4 text-foreground/50" />}
                        containerClassName="w-full"
                    />
                </div>
                <div className="hidden md:block w-px h-6 bg-border/60 mx-1" />
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-0 px-1 md:px-0">
                     <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full md:w-[200px] h-10 border border-border bg-background rounded-full hover:bg-muted/50 transition-colors font-medium focus:ring-0">
                            <div className="flex items-center gap-2 text-foreground/80">
                                <ArrowUpDown className="w-4 h-4" />
                                <SelectValue placeholder="Sort by" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border shadow-xl min-w-[180px]">
                            <SelectItem value="newest" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">Newest First</SelectItem>
                            <SelectItem value="oldest" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">Oldest First</SelectItem>
                            <SelectItem value="price_asc" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">Price: Low to High</SelectItem>
                            <SelectItem value="price_desc" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">Price: High to Low</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* List */}
            <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-muted/40 border-b border-border/60">
                                <th className="px-8 py-4 font-semibold text-muted-foreground w-24">{t.dashboard.base}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.dashboard.name}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.dashboard.location}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.dashboard.price}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground text-right">{t.dashboard.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {(!filteredCampSites || filteredCampSites.length === 0) ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-16 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Tent className="w-8 h-8 text-muted-foreground/40" />
                                            <p>{t.dashboard.noCampSitesFound}</p>
                                            {canCreateCampSite && (
                                                <Link href="/dashboard/campsites/new" className="text-primary font-semibold hover:underline">
                                                    {t.dashboard.createFirstListing}
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCampSites.map((camp) => (
                                <tr key={camp.id} className="hover:bg-muted/40 transition duration-200 group">
                                        <td className="px-8 py-4">
                                            <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shadow-sm border border-border/60">
                                                {camp.images ? (
                                                    <img src={camp.images.split(',')[0]} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <Tent className="w-full h-full p-4 text-gray-300" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="font-bold text-foreground text-base">{language === 'th' ? camp.nameTh : camp.nameEn}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">{language === 'th' ? camp.nameEn : camp.nameTh}</div>
                                        </td>
                                        <td className="px-8 py-4 text-muted-foreground">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground/60" />
                                                    {camp.location?.thaiLocation 
                                                        ? (language === 'th' ? camp.location.thaiLocation.provinceName : camp.location.thaiLocation.provinceNameEn)
                                                        : camp.location?.province || t.dashboard.unknown
                                                    }
                                                </div>
                                                {camp.location?.thaiLocation?.districtName && (
                                                    <div className="text-xs text-muted-foreground/70 pl-5">
                                                        {language === 'th' ? camp.location.thaiLocation.districtName : camp.location.thaiLocation.districtNameEn}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 font-bold text-foreground">
                                            {formatCurrency(camp.priceLow)}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <PermissionTooltip
                                                    hasPermission={camp?.canUpdate !== false}
                                                    title="Permission Required"
                                                    description="You don't have permission to edit this camp site."
                                                    suggestion="Ask the camp site owner to grant CAMPSITE_UPDATE access."
                                                >
                                                    <Link
                                                        href={camp?.canUpdate === false ? "#" : `/dashboard/campsites/${camp.id}/edit`}
                                                        aria-disabled={camp?.canUpdate === false}
                                                        tabIndex={camp?.canUpdate === false ? -1 : 0}
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            disabled={camp?.canUpdate === false}
                                                            className="h-9 w-9 rounded-full border-gray-200 hover:text-primary hover:border-primary hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                </PermissionTooltip>
                                                <PermissionTooltip
                                                    hasPermission={camp?.canDelete !== false}
                                                    title="Permission Required"
                                                    description="You don't have permission to delete this camp site."
                                                    suggestion="Ask the camp site owner to grant CAMPSITE_DELETE access."
                                                >
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleDelete(camp.id)}
                                                        disabled={camp?.canDelete === false}
                                                        className="h-9 w-9 rounded-full border-gray-200 hover:text-red-600 hover:border-red-600 hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </PermissionTooltip>
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
