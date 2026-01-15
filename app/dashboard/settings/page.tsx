"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, Bell, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";

type SettingsTab = "team" | "notifications" | "billing";

interface CampSite {
    id: string;
    nameTh: string;
    nameEn: string | null;
}

export default function SettingsPage() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>("team");
    const [campSites, setCampSites] = useState<CampSite[]>([]);
    const [selectedCampSiteId, setSelectedCampSiteId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCampSites();
    }, []);

    const fetchCampSites = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/operator/dashboard');
            const data = await res.json();
            if (res.ok && data.campSites) {
                setCampSites(data.campSites);
                if (data.campSites.length > 0) {
                    setSelectedCampSiteId(data.campSites[0].id); // Auto-select first camp site
                }
            } else {
                toast.error("Failed to load camp sites");
            }
        } catch (error) {
            console.error("Failed to fetch camp sites:", error);
            toast.error("Failed to load camp sites");
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: "team" as SettingsTab, label: t.settings?.team || "Team & Members", icon: Users },
        { id: "notifications" as SettingsTab, label: t.settings?.notifications || "Notifications", icon: Bell, disabled: true },
        { id: "billing" as SettingsTab, label: t.settings?.billing || "Billing", icon: CreditCard, disabled: true },
    ];

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    {t.settings?.title || "Settings"}
                </h1>
                <p className="text-muted-foreground">
                    {t.settings?.description || "Manage your account and team settings"}
                </p>
            </div>

            {/* Camp Site Selector - Only show if multiple camp sites */}
            {campSites.length > 1 && (
                <div className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4">
                    <label className="text-sm font-medium text-foreground whitespace-nowrap">
                        {t.settings?.selectCampSite || "Select camp site"}:
                    </label>
                    <Select value={selectedCampSiteId || undefined} onValueChange={setSelectedCampSiteId}>
                        <SelectTrigger className="w-full md:w-[400px] rounded-full">
                            <SelectValue placeholder={"Select a camp site"} />
                        </SelectTrigger>
                        <SelectContent>
                            {campSites.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                    {site.nameEn || site.nameTh}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {campSites.length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-2xl">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t.dashboard?.noCampSitesFound || "No camp sites found. Please create one first."}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-border">
                <nav className="flex gap-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => !tab.disabled && setActiveTab(tab.id)}
                            disabled={tab.disabled}
                            className={cn(
                                "flex items-center gap-2 px-1 py-4 border-b-2 transition-colors",
                                activeTab === tab.id
                                    ? "border-primary text-primary font-medium"
                                    : "border-transparent text-muted-foreground hover:text-foreground",
                                tab.disabled && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                            {tab.disabled && (
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                    {t.settings?.comingSoon || "Coming Soon"}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="py-6">
                {activeTab === "team" && selectedCampSiteId && <TeamManagement campSiteId={selectedCampSiteId} />}
                {activeTab === "team" && !selectedCampSiteId && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t.settings?.selectCampSite || "Please select a camp site to manage team members"}</p>
                    </div>
                )}
                {activeTab === "notifications" && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t.settings?.notificationsComingSoon || "Notification settings coming soon"}</p>
                    </div>
                )}
                {activeTab === "billing" && (
                    <div className="text-center py-12 text-muted-foreground">
                        <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t.settings?.billingComingSoon || "Billing settings coming soon"}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
