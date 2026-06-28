"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    Calendar,
    MapPin,
    Clock,
    User,
    ChevronRight,
    Search,
    Tent,
    Loader2,
} from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import Link from "next/link";
import { toast } from "sonner";
import { BookingListSkeleton } from "@/components/ui/booking-list-skeleton";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import { Badge } from "@/components/ui/badge";
import { getBookingStatusMeta } from "@/lib/booking-status";

export default function MyBookingsPage() {
    const { t, formatCurrency, language } = useLanguage();
    const [bookings, setBookings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

    // Anti-flicker: delay-before-show + min-display via LOAD-2 hook.
    const showSkeleton = useMinimumLoading(isLoading);

    useEffect(() => {
        fetch('/api/bookings')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setBookings(data);
                } else {
                    setHasError(true);
                }
                setIsLoading(false);
            })
            .catch(() => {
                setHasError(true);
                setIsLoading(false);
            });
    }, []);

    const handleCancel = async (bookingId: string) => {
        setCancellingId(bookingId);
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
        } catch {
            toast.error(t.bookings.errorOccurred);
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <main className="min-h-screen bg-background">
            <Navbar />

            <div className="container mx-auto px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    {/* Chrome: hero/header renders instantly — not gated on async data */}
                    <div className="flex justify-between items-center mb-10" data-testid="section--bookings-header">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                                {t.bookings.myBookings}
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                {t.bookings.manageBookings}
                            </p>
                        </div>
                        <Button asChild size="lg" variant="outline" className="px-6 font-semibold border-border bg-card hover:bg-muted transition">
                            <Link href="/">
                                <Search className="w-4 h-4 mr-2" />
                                {t.search.anywhere}
                            </Link>
                        </Button>
                    </div>

                    {/* Async section: skeleton while loading, real content when ready */}
                    {showSkeleton ? (
                        <BookingListSkeleton count={3} />
                    ) : hasError ? (
                        <ErrorBanner message={t.bookings.errorOccurred} />
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
                            <Button asChild size="lg" className="px-8 font-bold shadow-lg shadow-primary/20">
                                <Link href="/">{t.bookings.exploreButton}</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6" data-testid="section--booking-list">
                            {bookings.map((booking) => (
                                <div key={booking.id} className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex flex-col md:flex-row">
                                        {/* Image Section */}
                                        <div className="md:w-64 h-48 md:aspect-[4/3] overflow-hidden relative">
                                            <ImageWithFallback
                                                src={booking.campSite?.images?.[0]?.url || booking.campground?.images?.[0]?.url}
                                                alt={booking.campSite?.nameEn || booking.campground?.nameEn || ""}
                                                className="w-full h-full"
                                                imgClassName="object-cover group-hover:scale-105 transition-transform duration-500"
                                                sizes="(max-width: 768px) 100vw, 256px"
                                            />
                                            <div className="absolute top-4 left-4">
                                                {(() => {
                                                    const { labelKey, variant } = getBookingStatusMeta(booking.status);
                                                    const label = labelKey
                                                        ? t.bookings[labelKey as keyof typeof t.bookings] as string
                                                        : booking.status;
                                                    return (
                                                        <Badge
                                                            variant={variant}
                                                            className="ring-2 ring-card shadow-sm font-bold tracking-wider"
                                                        >
                                                            {label}
                                                        </Badge>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Info Section */}
                                        <div className="flex-1 p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-2">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-foreground">
                                                            {language === 'th' ? (booking.snapshotCampName || booking.campSite?.nameTh || booking.campground?.nameTh) : (booking.snapshotCampNameEn || booking.campSite?.nameEn || booking.campground?.nameEn || booking.snapshotCampName)}
                                                        </h3>
                                                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                                                            <MapPin className="w-3.5 h-3.5" />
                                                            {booking.campSite?.location?.province || booking.campground?.location?.province || 'Thailand'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t.bookings.totalPaid}</div>
                                                        <div className="text-xl font-bold text-primary">{formatCurrency(booking.totalPrice)}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mt-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-muted rounded-xl">
                                                            <Calendar className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">{t.booking.checkIn}</div>
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
                                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">{t.booking.checkOut}</div>
                                                            <div className="text-sm font-semibold text-foreground">
                                                                {new Date(booking.checkOutDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-8 pt-6 border-t border-border/60 gap-4">
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
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                disabled={cancellingId === booking.id}
                                                                aria-label={t.bookings.cancelBookingAriaLabel}
                                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full font-bold px-4 h-11 flex-1 sm:flex-none transition-colors"
                                                                onClick={() => setCancelConfirmId(booking.id)}
                                                            >
                                                                {cancellingId === booking.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    t.bookings.cancelBooking
                                                                )}
                                                            </Button>
                                                            <ConfirmDialog
                                                                open={cancelConfirmId === booking.id}
                                                                onOpenChange={(open) => !open && setCancelConfirmId(null)}
                                                                title={t.bookings.confirmCancelTitle}
                                                                description={t.bookings.confirmCancelDescription}
                                                                confirmLabel={t.bookings.confirmCancelAction}
                                                                cancelLabel={t.bookings.keepBooking}
                                                                onConfirm={() => {
                                                                    setCancelConfirmId(null);
                                                                    handleCancel(booking.id);
                                                                }}
                                                                isLoading={cancellingId === booking.id}
                                                                destructive
                                                            />
                                                        </>
                                                    )}
                                                    <Button asChild variant="ghost" className="text-primary hover:bg-primary/5 rounded-full font-bold px-4 flex-1 sm:flex-none transition-colors">
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
