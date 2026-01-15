"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Calendar,
    MapPin,
    Search,
    Filter,
    Check,
    X,
    ChevronLeft,
    ChevronRight,
    Users,
    RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { PermissionTooltip } from "@/components/ui/permission-tooltip";

interface Booking {
    id: string;
    createdAt: string;
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    totalPrice: number;
    status: string;
    canUpdate?: boolean;
    user: {
        name: string;
        email: string;
        image: string | null;
    };
    campSite: {
        nameTh: string;
        nameEn: string;
        images: string;
        operatorId?: string;
    };
    campground?: {
        nameTh: string;
        nameEn: string;
        images: string;
    };
}

export default function BookingsPage() {
    const { t, formatCurrency, language } = useLanguage();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [guestCount, setGuestCount] = useState<string>("");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const fetchBookings = (status: string) => {
        setLoading(true);
        const url = new URL('/api/operator/bookings', window.location.origin);
        if (status !== 'ALL') {
            url.searchParams.append('status', status);
        }

        fetch(url.toString())
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!res.ok) {
                    throw new Error(data?.error || data?.message || `Error ${res.status}: ${res.statusText}`);
                }
                setBookings(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch bookings", err);
                toast.error(err?.message || t.dashboardBookings.failedToLoad);
                setLoading(false);
            });
    };

    // Fetch current user session
    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data?.user?.id) {
                    setCurrentUserId(data.user.id);
                }
            })
            .catch(err => console.error("Failed to fetch session:", err));
    }, []);

    useEffect(() => {
        fetchBookings(filterStatus);
        setCurrentPage(1); // Reset to page 1 when filter changes
    }, [filterStatus]);

    // Calculate pagination
    const filteredBookings = bookings.filter(booking => {
        const query = searchQuery.toLowerCase();
        const guestName = booking.user.name?.toLowerCase() || '';
        const campSiteNameTh = booking.campSite?.nameTh?.toLowerCase() || booking.campground?.nameTh?.toLowerCase() || '';
        const campSiteNameEn = booking.campSite?.nameEn?.toLowerCase() || booking.campground?.nameEn?.toLowerCase() || '';

        // Search Query
        const matchesSearch = guestName.includes(query) ||
            campSiteNameTh.includes(query) ||
            campSiteNameEn.includes(query);

        // Status Filter (Handled by API usually, but if client-side filtering needed for combined filters)
        // Since API handles status, we might be double filtering if we fetch by status 'ALL' and filter locally?
        // But the current implementation fetches by status. So if status is ALL, we have all.
        // If we want to support complex filtering client side with the 'ALL' data:
        const matchesStatus = filterStatus === 'ALL' || booking.status === filterStatus;

        // Guest Count Filter
        const matchesGuests = !guestCount || booking.guests >= parseInt(guestCount);

        // Date Range Filter (Check In Date)
        let matchesDate = true;
        if (dateRange?.from) {
            const checkIn = new Date(booking.checkInDate);
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            
            if (dateRange.to) {
                const to = new Date(dateRange.to);
                to.setHours(23, 59, 59, 999);
                matchesDate = checkIn >= from && checkIn <= to;
            } else {
                matchesDate = checkIn >= from;
            }
        }

        return matchesSearch && matchesStatus && matchesGuests && matchesDate;
    });

    const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentBookings = filteredBookings.slice(startIndex, endIndex);

    // Check if any filter is active
    const hasActiveFilters = searchQuery || dateRange?.from || guestCount || filterStatus !== 'ALL';

    // Clear all filters
    const clearAllFilters = () => {
        setSearchQuery('');
        setDateRange(undefined);
        setGuestCount('');
        setFilterStatus('ALL');
        setCurrentPage(1);
    };

    // Check if current user can manage this booking
    const canManageBooking = (booking: any) => {
        if (!currentUserId) return false;
        if (typeof booking?.canUpdate === "boolean") return booking.canUpdate;
        const operatorId = booking.campSite?.operatorId || booking.campground?.operatorId;
        return operatorId === currentUserId;
    };

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus, dateRange, guestCount]);

    const handleStatusUpdate = async (bookingId: string, status: string) => {
        try {
            console.log("Updating booking:", bookingId, "to status:", status);
            
            const res = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            console.log("Response status:", res.status, res.statusText);

            let data;
            try {
                data = await res.json();
                console.log("Response data:", data);
            } catch (parseError) {
                console.error("Failed to parse JSON response:", parseError);
                toast.error("Invalid response from server");
                return;
            }

            if (res.ok) {
                setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
                toast.success(t.dashboardBookings.bookingUpdatedSuccess || "Booking updated successfully");
            } else {
                const errorMessage = data.error || data.message || `Error ${res.status}: ${res.statusText}`;
                toast.error(errorMessage);
                console.error("API Error Response:", {
                    status: res.status,
                    statusText: res.statusText,
                    data: data
                });
            }
        } catch (error) {
            console.error("Status update error:", error);
            toast.error(t.dashboardBookings.errorOccurred || "An error occurred");
        }
    };

    // Debug: Log bookings data
    useEffect(() => {
        if (bookings.length > 0) {
            console.log("=== BOOKING DEBUG INFO ===");
            console.log("Total bookings:", bookings.length);
            bookings.forEach((booking, index) => {
                console.log(`\nBooking ${index + 1}:`, {
                    id: booking.id,
                    status: booking.status,
                    campSiteName: booking.campSite?.nameTh,
                    guestName: booking.user.name
                });
            });
        }
    }, [bookings]);

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">{t.dashboard.bookings}</h1>
                <p className="text-muted-foreground">{t.dashboardBookings.manageReservations}</p>
            </div>

            {/* Toolbar Section - Consistent with Table Style */}
            <div className="flex flex-col gap-3">
                <div className="bg-card p-2 rounded-full border border-border shadow-sm flex flex-col md:flex-row gap-2 items-center">
                    <div className="flex-1 w-full md:w-auto relative">
                        <InputField
                            placeholder={t.dashboardBookings.searchPlaceholder}
                            className="h-10 w-full rounded-full border border-border bg-background focus:ring-0 pr-4 placeholder:text-muted-foreground/70"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={<Search className="w-4 h-4 text-foreground/50" />}
                            containerClassName="w-full"
                        />
                    </div>
                    <div className="hidden md:block w-px h-6 bg-border/60 mx-1" />
                    
                    {/* Date Range Picker */}
                    <div className="w-full md:w-auto">
                        <DatePickerWithRange 
                            date={dateRange} 
                            setDate={setDateRange} 
                            placeholder={t.search?.date || "Check-in Date"}
                            className="w-full md:w-auto"
                        />
                    </div>

                    <div className="hidden md:block w-px h-6 bg-border/60 mx-1" />

                    {/* Guest Filter */}
                    <div className="w-full md:w-[140px] relative">
                        <InputField
                            type="number"
                            min="1"
                            placeholder={t.search?.guests || "Guests"}
                            className="h-10 w-full rounded-full border border-border bg-background focus:ring-0 pr-4 placeholder:text-muted-foreground/70"
                            value={guestCount}
                            onChange={(e) => setGuestCount(e.target.value)}
                            leftIcon={<Users className="w-4 h-4 text-foreground/50" />}
                            containerClassName="w-full"
                        />
                    </div>

                    <div className="hidden md:block w-px h-6 bg-border/60 mx-1" />

                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-0 px-1 md:px-0">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-full md:w-[200px] h-10 border border-border bg-background rounded-full hover:bg-muted/50 transition-colors font-medium focus:ring-0">
                                <div className="flex items-center gap-2 text-foreground/80">
                                    <Filter className="w-4 h-4" />
                                    <SelectValue placeholder={t.dashboardBookings.status} />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border shadow-xl min-w-[180px]">
                                <SelectItem value="ALL" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">{t.dashboardBookings.allStatus}</SelectItem>
                                <SelectItem value="PENDING" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">{t.dashboardBookings.pending}</SelectItem>
                                <SelectItem value="CONFIRMED" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">{t.dashboardBookings.confirmed}</SelectItem>
                                <SelectItem value="CANCELLED" className="rounded-lg cursor-pointer py-2.5 px-3 m-1">{t.dashboardBookings.cancelled}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {/* Clear Filters Button - Only show when filters are active */}
                    {hasActiveFilters && (
                        <div className="pr-1 hidden md:block">
                            <Button
                                variant="default"
                                size="icon"
                                onClick={clearAllFilters}
                                className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm"
                                title="Clear all filters"
                            >
                                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Clear Filters Button - Mobile */}
                {hasActiveFilters && (
                    <Button
                        variant="default"
                        onClick={clearAllFilters}
                        className="md:hidden w-full h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm font-medium"
                    >
                        <RotateCcw className="w-4 h-4 mr-2 stroke-[2.5]" />
                        Clear all filters
                    </Button>
                )}
            </div>

            {/* Data Table */}
            <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-muted/40 border-b border-border/60">
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.dashboard.guest}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.dashboard.campground}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.booking.checkIn}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.dashboard.total}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground">{t.dashboard.status}</th>
                                <th className="px-8 py-4 font-semibold text-muted-foreground text-right">{t.dashboardBookings.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {loading ? (
                                // Skeleton Loading State
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-8 py-5"><Skeleton className="h-10 w-40" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-4 w-32" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-4 w-24" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-6 w-16" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-6 w-20 rounded-full" /></td>
                                        <td className="px-8 py-5"><div className="flex justify-end gap-2"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" /></div></td>
                                    </tr>
                                ))
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <Calendar className="w-12 h-12 text-muted-foreground/40 mb-4" />
                                            <p className="font-medium text-lg text-foreground">{t.dashboardBookings.noBookingsFound}</p>
                                            <p className="text-sm">{t.dashboardBookings.tryAdjustingFilters}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentBookings.map((booking) => (
                                <tr key={booking.id} className="hover:bg-muted/40 transition duration-200">
                                    <td className="px-8 py-5 font-medium text-foreground">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-white">
                                                    {booking.user.name?.[0] || booking.user.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold">{booking.user.name || 'Guest'}</div>
                                                    <div className="text-xs text-muted-foreground font-normal">{booking.user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-muted-foreground/60" />
                                                {language === 'th' ? (booking.campSite?.nameTh || booking.campground?.nameTh) : (booking.campSite?.nameEn || booking.campground?.nameEn)}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-muted-foreground">
                                            <div className="font-medium">{new Date(booking.checkInDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                            <div className="text-xs text-muted-foreground">{booking.guests} {t.booking.guests}</div>
                                        </td>
                                        <td className="px-8 py-5 text-foreground font-bold">{formatCurrency(booking.totalPrice)}</td>
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
                                                <div className="flex items-center justify-end gap-2">
                                                    {booking.status === 'PENDING' && (
                                                        <PermissionTooltip
                                                            hasPermission={canManageBooking(booking)}
                                                            title="Permission Required"
                                                            description="You don't have permission to manage this booking because you're not the operator of this campsite."
                                                            suggestion="Contact the campsite operator to manage this booking."
                                                        >
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() => handleStatusUpdate(booking.id, 'CONFIRMED')}
                                                                disabled={!canManageBooking(booking)}
                                                                className="h-9 px-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Check className="w-4 h-4 mr-1.5" />
                                                                Confirm
                                                            </Button>
                                                        </PermissionTooltip>
                                                    )}
                                                    <PermissionTooltip
                                                        hasPermission={canManageBooking(booking)}
                                                        title="Permission Required"
                                                        description="You don't have permission to manage this booking because you're not the operator of this campsite."
                                                        suggestion="Contact the campsite operator to manage this booking."
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleStatusUpdate(booking.id, 'CANCELLED')}
                                                            disabled={!canManageBooking(booking)}
                                                            className="h-9 px-3 rounded-full border-border text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/10 transition shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <X className="w-4 h-4 mr-1.5" />
                                                            Cancel
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
                
                {/* Pagination Controls */}
                {!loading && filteredBookings.length > 0 && (
                    <div className="px-6 py-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Show</span>
                            <Select 
                                value={itemsPerPage.toString()} 
                                onValueChange={(val) => {
                                    setItemsPerPage(Number(val));
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="h-8 w-[70px] rounded-lg border-border bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {[10, 20, 30, 40, 50].map(val => (
                                        <SelectItem key={val} value={val.toString()} className="rounded-lg cursor-pointer">{val}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span>of {filteredBookings.length} entries</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-border"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>

                            {/* Page Numbers */}
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Logic for showing pages: always show current window of pages
                                    // Simple version: Show sliding window or just 1..5 if small
                                    // Better version:
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "default" : "outline"}
                                            size="sm"
                                            className={`h-8 w-8 rounded-lg p-0 font-normal ${currentPage === pageNum ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-transparent bg-transparent hover:bg-muted"}`}
                                            onClick={() => setCurrentPage(pageNum)}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-border"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
