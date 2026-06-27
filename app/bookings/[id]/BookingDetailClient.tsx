"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Clock,
  Users,
  Hash,
  Tent,
  Phone,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { getBookingStatusMeta } from "@/lib/booking-status";
import { formatBookingRef } from "@/lib/booking-ref";

export interface BookingDetailProps {
  booking: {
    id: string;
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    totalPrice: number;
    currency: string;
    status: string;
    campSite: {
      nameTh: string;
      nameEn: string | null;
      phone: string | null;
      lineId: string | null;
      images: { url: string; sortOrder: number }[];
      location: { province: string | null } | null;
    };
    spot: { name: string; zone: string | null } | null;
  };
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function calcNights(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay
  );
}

export function BookingDetailClient({ booking: initialBooking }: BookingDetailProps) {
  const { t, language, formatCurrency } = useLanguage();
  const [booking, setBooking] = useState(initialBooking);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { labelKey, variant } = getBookingStatusMeta(booking.status);
  const statusLabel = labelKey
    ? (t.bookings[labelKey as keyof typeof t.bookings] as string)
    : booking.status;

  const campName =
    language === "en" && booking.campSite.nameEn
      ? booking.campSite.nameEn
      : booking.campSite.nameTh;

  const dateLocale = language === "th" ? "th-TH" : "en-US";
  const nights = calcNights(booking.checkInDate, booking.checkOutDate);
  const coverImage = booking.campSite.images[0]?.url ?? null;
  const isCancellable =
    booking.status === "PENDING" || booking.status === "CONFIRMED";

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (res.ok) {
        setBooking((prev) => ({ ...prev, status: "CANCELLED" }));
        toast.success(t.bookings.bookingCancelledSuccess);
      } else {
        toast.error(t.bookings.errorOccurred);
      }
    } catch {
      toast.error(t.bookings.errorOccurred);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        {t.bookings.detail.backToBookings}
      </Link>

      {/* Hero card */}
      <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm">
        {/* Cover image with status badge overlay */}
        <div className="relative">
          <ImageWithFallback
            src={coverImage}
            alt={campName}
            className="w-full h-48 md:h-64"
            imgClassName="object-cover"
            data-testid="img--booking-cover"
            sizes="100vw"
          />
          <div className="absolute top-4 left-4">
            <Badge
              variant={variant}
              className="ring-2 ring-card shadow-sm font-bold tracking-wider rounded-xl"
              data-testid="badge--booking-status"
            >
              {statusLabel}
            </Badge>
          </div>
        </div>

        {/* Info section */}
        <div className="p-4 md:p-6 space-y-6">
          {/* Heading row: camp name + total price */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{campName}</h1>
              {booking.campSite.location?.province && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  {booking.campSite.location.province}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                {t.bookings.totalPaid}
              </div>
              <div className="text-xl font-bold text-primary tabular-nums">
                {formatCurrency(booking.totalPrice)}
              </div>
            </div>
          </div>

          {/* Booking ref row */}
          <div className="flex items-center gap-2 text-sm">
            <Hash className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{t.bookings.bookingRefLabel}</span>
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {formatBookingRef(booking.id)}
            </span>
          </div>

          <hr className="border-border/60" />

          {/* Date grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-xl shrink-0">
                <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                  {t.booking.checkIn}
                </div>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {formatDate(booking.checkInDate, dateLocale)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-xl shrink-0">
                <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                  {t.booking.checkOut}
                </div>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {formatDate(booking.checkOutDate, dateLocale)}
                </div>
              </div>
            </div>
          </div>

          {/* Guests + Nights row */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" aria-hidden="true" />
              <span className="tabular-nums">{booking.guests}</span>{" "}
              {t.bookings.detail.guests}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span className="tabular-nums">{nights}</span>{" "}
              {t.booking.nights}
            </div>
          </div>

          {/* Spot row — conditional */}
          {booking.spot && (
            <div className="flex items-center gap-2 text-sm">
              <Tent className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">{t.bookings.detail.spot}</span>
              <span className="font-semibold text-foreground">
                {booking.spot.name}
                {booking.spot.zone ? ` ${booking.spot.zone}` : ""}
              </span>
            </div>
          )}

          {/* Contact row — conditional */}
          {(booking.campSite.phone || booking.campSite.lineId) && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                {t.bookings.detail.contact}
              </div>
              {booking.campSite.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-foreground">{booking.campSite.phone}</span>
                </div>
              )}
              {booking.campSite.lineId && (
                <div className="flex items-center gap-2 text-sm">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">Line: </span>
                  <span className="text-foreground">{booking.campSite.lineId}</span>
                </div>
              )}
            </div>
          )}

          {/* Action footer */}
          {isCancellable && (
            <div className="pt-4 border-t border-border/60">
              <Button
                variant="ghost"
                disabled={isCancelling}
                aria-label={t.bookings.cancelBookingAriaLabel}
                data-testid="btn--booking-cancel"
                className="w-full sm:w-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-11 px-6 font-bold active:scale-95 transition-colors"
                onClick={() => setCancelDialogOpen(true)}
              >
                {isCancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  t.bookings.cancelBooking
                )}
              </Button>
              <ConfirmDialog
                open={cancelDialogOpen}
                onOpenChange={setCancelDialogOpen}
                title={t.bookings.confirmCancelTitle}
                description={t.bookings.confirmCancelDescription}
                confirmLabel={t.bookings.confirmCancelAction}
                cancelLabel={t.bookings.keepBooking}
                onConfirm={handleCancel}
                isLoading={isCancelling}
                destructive
                data-testid="booking-cancel-dialog"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
