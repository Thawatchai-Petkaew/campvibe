"use client";

import Link from "next/link";
import { CheckCircle2, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { getBookingStatusMeta } from "@/lib/booking-status";
import { formatBookingRef } from "@/lib/booking-ref";

interface BookingConfirmationClientProps {
  booking: {
    id: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    totalPrice: number;
    campSite: {
      nameTh: string;
      nameEn: string | null;
      nameThSlug: string;
    };
  };
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BookingConfirmationClient({ booking }: BookingConfirmationClientProps) {
  const { t, language, formatCurrency } = useLanguage();
  const { labelKey, variant } = getBookingStatusMeta(booking.status);
  const statusLabel = labelKey
    ? (t.bookings[labelKey as keyof typeof t.bookings] as string)
    : booking.status;

  const campName =
    language === "en" && booking.campSite.nameEn
      ? booking.campSite.nameEn
      : booking.campSite.nameTh;

  const dateLocale = language === "th" ? "th-TH" : "en-US";
  const ref = formatBookingRef(booking.id);

  return (
    <div className="max-w-xl mx-auto space-y-8">
      {/* [1] Success header */}
      <div className="text-center space-y-3">
        <CheckCircle2
          className="w-16 h-16 text-success mx-auto"
          aria-hidden="true"
        />
        <h1 className="text-3xl font-bold text-foreground">
          {t.bookings.confirmationTitle}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t.bookings.bookingRefLabel}
        </p>
      </div>

      {/* [2] Booking reference chip */}
      <div className="flex justify-center">
        <div className="bg-muted rounded-xl px-6 py-4 inline-block">
          <span
            className="font-mono text-2xl font-bold text-foreground tracking-widest tabular-nums"
            data-testid="text--booking-ref"
          >
            {ref}
          </span>
        </div>
      </div>

      {/* [3] Status badge */}
      <div className="flex justify-center">
        <Badge
          variant={variant}
          aria-label={t.bookings.statusBadgeAriaLabel}
          data-testid="badge--booking-status"
        >
          {statusLabel}
        </Badge>
      </div>

      {/* [4] Booking details card */}
      <Card className="bg-card rounded-3xl p-6 border border-border shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-4">{campName}</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.booking.checkIn}
              </div>
              <div className="text-sm font-semibold text-foreground tabular-nums">
                {formatDate(booking.checkInDate, dateLocale)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.booking.checkOut}
              </div>
              <div className="text-sm font-semibold text-foreground tabular-nums">
                {formatDate(booking.checkOutDate, dateLocale)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {t.booking.guests}
              </div>
              <div className="text-sm font-semibold text-foreground tabular-nums">
                {booking.guests} {booking.guests === 1 ? t.booking.guest : t.search.guests}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {t.bookings.totalPaid}
            </div>
            <div className="text-2xl font-bold text-primary tabular-nums">
              {formatCurrency(booking.totalPrice)}
            </div>
          </div>
        </div>
      </Card>

      {/* [5] CTA buttons */}
      <div
        className="flex flex-col gap-3 md:flex-row"
        data-testid="group--confirmation-ctas"
      >
        <Button
          asChild
          size="lg"
          variant="default"
          className="w-full md:w-auto"
          data-testid="btn--view-all-bookings"
        >
          <Link href="/bookings">{t.bookings.viewAllBookings}</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="w-full md:w-auto"
          data-testid="btn--back-to-campsite"
        >
          <Link href={`/campgrounds/${booking.campSite.nameThSlug}`}>
            {t.bookings.backToCampsite}
          </Link>
        </Button>
      </div>
    </div>
  );
}
