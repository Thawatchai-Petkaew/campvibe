"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSession } from "next-auth/react";
import {
    Calendar,
    MapPin,
    Clock,
    User,
    ChevronRight,
    Search,
    Tent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function MyBookingsPage() {
    const { t, formatCurrency, language } = useLanguage();
    const { data: session } = useSession();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/bookings')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setBookings(data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load bookings", err);
                setLoading(false);
            });
    }, []);

    const handleCancel = async (bookingId: string) => {
        if (!confirm(t.bookings.areYouSureCancel)) return;

        try {
            const res = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CANCELLED' })
            });

            if (res.ok) {
                setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'CANCELLED' } : b));
                toast.success(t.bookings.bookingCancelledSuccess);
            } else {
                toast.error(t.bookings.failedToCancel);
            }
        } catch (error) {
            console.error("Cancel error:", error);
            toast.error(t.bookings.errorOccurred);
        }
    };

    return (
        <main className="min-h-screen bg-background">
            <Navbar currentUser={session?.user} />

            <div className="container mx-auto px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                                {t.bookings.myBookings}
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                {t.bookings.manageBookings}
                            </p>
                        </div>
                        <Button asChild variant="outline" className="rounded-full h-12 px-6 font-semibold border-border bg-card hover:bg-muted transition">
                            <Link href="/">
                                <Search className="w-4 h-4 mr-2" />
                                {t.search.anywhere}
                            </Link>
                        </Button>
                    </div>

                    {loading ? (
                        <LoadingSpinner text={t.bookings.loadingTrips} />
                    ) : bookings.length === 0 ? (
                        <div className="bg-card rounded-3xl p-16 text-center border border-dashed border-border shadow-sm">
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                                <Tent className="w-10 h-10 text-muted-foreground/50" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground mb-2">
                                {t.bookings.noBookingsYet}
                            </h2>
                            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                                {t.bookings.startSearching}
                            </p>
                            <Button asChild className="rounded-full h-12 px-8 font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                                <Link href="/">{language === 'th' ? "ไปค้นหาเลย" : "Explore Campgrounds"}</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {bookings.map((booking) => (
                                <div key={booking.id} className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex flex-col md:flex-row">
                                        {/* Image Section */}
                                        <div className="md:w-64 h-48 md:h-auto overflow-hidden relative">
                                            <img
                                                src={booking.campSite?.images?.split(',')[0] || booking.campground?.images?.split(',')[0]}
                                                alt={booking.campSite?.nameEn || booking.campground?.nameEn}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute top-4 left-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ring-2 ring-white shadow-sm ${booking.status === 'CONFIRMED' ? 'bg-green-500 text-white' :
                                                        booking.status === 'PENDING' ? 'bg-yellow-500 text-white' :
                                                            'bg-gray-500 text-white'
                                                    }`}>
                                                    {booking.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Info Section */}
                                        <div className="flex-1 p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-foreground">
                                                            {language === 'th' ? (booking.campSite?.nameTh || booking.campground?.nameTh) : (booking.campSite?.nameEn || booking.campground?.nameEn)}
                                                        </h3>
                                                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                                                            <MapPin className="w-3.5 h-3.5" />
                                                            {booking.campSite?.location?.province || booking.campground?.location?.province || 'Thailand'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Paid</div>
                                                        <div className="text-xl font-bold text-primary">{formatCurrency(booking.totalPrice)}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mt-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-muted rounded-xl">
                                                            <Calendar className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Check-in</div>
                                                            <div className="text-sm font-semibold text-foreground">
                                                                {new Date(booking.checkInDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-muted rounded-xl">
                                                            <Calendar className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Check-out</div>
                                                            <div className="text-sm font-semibold text-foreground">
                                                                {new Date(booking.checkOutDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/60">
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                                                        <div className="flex items-center gap-1.5 border-r border-border pr-3">
                                                        <User className="w-4 h-4" />
                                                        {booking.guests} {booking.guests === 1 ? t.booking.guest : t.search.guests}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-4 h-4" />
                                                        {Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24))} {t.booking.nights}
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    {booking.status !== 'CANCELLED' && (
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => handleCancel(booking.id)}
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full font-bold px-4 h-10 transition-colors"
                                                        >
                                                            {t.bookings.cancelBooking}
                                                        </Button>
                                                    )}
                                                    <Button asChild variant="ghost" className="text-primary hover:bg-primary/5 rounded-full font-bold px-4 h-10 transition-colors">
                                                        <Link href={`/campgrounds/${booking.campSite?.nameThSlug || booking.campground?.nameThSlug}`}>
                                                            {t.bookings.viewDetails} <ChevronRight className="w-4 h-4 ml-1" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
