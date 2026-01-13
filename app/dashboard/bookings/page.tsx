"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Calendar,
    MapPin,
    Search,
    Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Booking {
    id: string;
    createdAt: string;
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    totalPrice: number;
    status: string;
    user: {
        name: string;
        email: string;
        image: string | null;
    };
    campground: {
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

    const fetchBookings = (status: string) => {
        setLoading(true);
        const url = new URL('/api/operator/bookings', window.location.origin);
        if (status !== 'ALL') {
            url.searchParams.append('status', status);
        }

        fetch(url.toString())
            .then(res => res.json())
            .then(data => {
                setBookings(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch bookings", err);
                toast.error("Failed to load bookings");
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchBookings(filterStatus);
    }, [filterStatus]);

    const handleStatusUpdate = async (bookingId: string, status: string) => {
        try {
            const res = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
                toast.success(`Booking ${status.toLowerCase()} successfully`);
            } else {
                toast.error("Failed to update status");
            }
        } catch (error) {
            console.error("Status update error:", error);
            toast.error("An error occurred");
        }
    };

    const filteredBookings = bookings.filter(booking => {
        const query = searchQuery.toLowerCase();
        const guestName = booking.user.name?.toLowerCase() || '';
        const campgroundNameTh = booking.campground.nameTh?.toLowerCase() || '';
        const campgroundNameEn = booking.campground.nameEn?.toLowerCase() || '';

        return guestName.includes(query) ||
            campgroundNameTh.includes(query) ||
            campgroundNameEn.includes(query);
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t.dashboard.bookings}</h1>
                    <p className="text-gray-500 mt-2">Manage all your campground reservations</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search guest or campground..."
                            className="pl-9 h-10 w-full sm:w-64 rounded-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full sm:w-40 rounded-full h-10">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                <SelectValue placeholder="Status" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
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
                            {loading ? (
                                // Skeleton Loading State
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-8 py-5"><Skeleton className="h-10 w-40" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-4 w-32" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-4 w-24" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-6 w-16" /></td>
                                        <td className="px-8 py-5"><Skeleton className="h-6 w-20 rounded-full" /></td>
                                        <td className="px-8 py-5"><div className="flex justify-end gap-2"><Skeleton className="h-8 w-20 rounded-full" /><Skeleton className="h-8 w-20 rounded-full" /></div></td>
                                    </tr>
                                ))
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                                            <p className="font-medium text-lg text-gray-900">No bookings found</p>
                                            <p className="text-sm">Try adjusting your filters or search terms.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50/50 transition duration-200">
                                        <td className="px-8 py-5 font-medium text-gray-900">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-white">
                                                    {booking.user.name?.[0] || booking.user.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold">{booking.user.name || 'Guest'}</div>
                                                    <div className="text-xs text-gray-400 font-normal">{booking.user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                {language === 'th' ? booking.campground.nameTh : booking.campground.nameEn}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-gray-600">
                                            <div className="font-medium">{new Date(booking.checkInDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                            <div className="text-xs text-gray-400">{booking.guests} {t.booking.guests}</div>
                                        </td>
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
                                                            className="rounded-full bg-primary hover:bg-primary/90 h-8 text-xs font-bold px-4 shadow-sm"
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
