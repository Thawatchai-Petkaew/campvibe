"use client";

// CAM-55 — Host month calendar (bookings, blocks, remaining capacity per day).
//
// Read-only overview grid embedded on the CAM-56 availability page. BR-1: the
// per-day numbers come from the SAME math as the rest of the app — this
// component fetches GET /api/campsites/[id]/availability, which wraps
// getCampSiteDailyAvailability (lib/campsite-availability.ts) — no parallel
// calculation is implemented here.
//
// Out of scope (ticket `## Out of scope`): InternalHold display (CAM-302, on
// hold — no placeholder code for it), spot-level per-day drill-down, and any
// write/click-to-block action (the CAM-56 form above remains the write path).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";

// BR-2: month navigation bounded 12 months back / 18 months forward from today.
const MONTHS_BACK = 12;
const MONTHS_FORWARD = 18;

// Shape of one entry in GET /api/campsites/[id]/availability's `availability`
// array (app/api/campsites/[id]/availability/route.ts) — read only, never
// re-derived here (BR-1).
interface DailyAvailabilityEntry {
  date: string;
  bookedGuests: number;
  bookedTents: number;
  maxGuests: number | null;
  maxTents: number | null;
  available: boolean;
  remainingGuests: number | null;
  remainingTents: number | null;
  blockedByHost: boolean;
}

interface AvailabilityApiResponse {
  availability?: DailyAvailabilityEntry[];
}

interface AvailabilityCalendarProps {
  campSiteId: string;
}

export function AvailabilityCalendar({ campSiteId }: AvailabilityCalendarProps) {
  const { t, language } = useLanguage();
  const copy = t.availabilityCalendar;
  const locale = language === "th" ? "th-TH" : "en-US";

  const today = useMemo(() => new Date(), []);
  const minMonth = useMemo(() => startOfMonth(subMonths(today, MONTHS_BACK)), [today]);
  const maxMonth = useMemo(() => startOfMonth(addMonths(today, MONTHS_FORWARD)), [today]);

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [dailyMap, setDailyMap] = useState<Record<string, DailyAvailabilityEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const showSkeleton = useMinimumLoading(loading, { delay: 300, minDisplay: 400 });

  const loadMonth = useCallback(
    async (targetMonth: Date) => {
      if (!campSiteId) return;
      setLoading(true);
      setLoadError(false);
      try {
        const monthStart = startOfMonth(targetMonth);
        const monthEnd = endOfMonth(targetMonth);
        const res = await fetch(
          `/api/campsites/${campSiteId}/availability?startDate=${format(monthStart, "yyyy-MM-dd")}&endDate=${format(monthEnd, "yyyy-MM-dd")}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load availability calendar");
        const payload = (await res.json()) as AvailabilityApiResponse;
        const list = Array.isArray(payload.availability) ? payload.availability : [];
        const map: Record<string, DailyAvailabilityEntry> = {};
        for (const entry of list) {
          map[entry.date] = entry;
        }
        setDailyMap(map);
      } catch (err) {
        console.error("Failed to load availability calendar", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [campSiteId]
  );

  useEffect(() => {
    loadMonth(month);
  }, [month, loadMonth]);

  const atMinBound = !isAfter(month, minMonth);
  const atMaxBound = !isBefore(month, maxMonth);

  const goToPrevMonth = () => {
    if (atMinBound) return;
    setMonth((current) => {
      const prev = startOfMonth(subMonths(current, 1));
      return isBefore(prev, minMonth) ? minMonth : prev;
    });
  };

  const goToNextMonth = () => {
    if (atMaxBound) return;
    setMonth((current) => {
      const next = startOfMonth(addMonths(current, 1));
      return isAfter(next, maxMonth) ? maxMonth : next;
    });
  };

  const monthLabel = month.toLocaleDateString(locale, { month: "long", year: "numeric" });

  // Sun..Sat weekday abbreviations, generated via Intl (never hardcoded) so the
  // labels stay in sync with the active language without a new copy key.
  const weekdayLabels = useMemo(() => {
    const refSunday = new Date(Date.UTC(2024, 0, 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refSunday);
      d.setUTCDate(refSunday.getUTCDate() + i);
      return d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
    });
  }, [locale]);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);
  const trailingBlanks = (7 - ((leadingBlanks + daysInMonth.length) % 7)) % 7;

  return (
    <div
      className="bg-card rounded-3xl shadow-sm border border-border p-4 md:p-6 space-y-4"
      data-testid="section--availability-calendar"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground">{copy.calendarTitle}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevMonth}
            disabled={atMinBound}
            aria-label={copy.prevMonthAriaLabel}
            data-testid="btn--calendar-prev"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold text-foreground tabular-nums">
            {monthLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            disabled={atMaxBound}
            aria-label={copy.nextMonthAriaLabel}
            data-testid="btn--calendar-next"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div aria-busy={showSkeleton} data-testid="section--availability-calendar-grid">
        <div role="status" aria-live="polite" className="sr-only">
          {showSkeleton ? t.common.loading_sr : ""}
        </div>

        {showSkeleton ? (
          <div
            className="grid grid-cols-7 gap-2"
            aria-hidden="true"
            data-testid="skeleton--availability-calendar-grid"
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`wd-${i}`} className="h-4 w-8 justify-self-center" />
            ))}
            {Array.from({ length: 42 }).map((_, i) => (
              <Skeleton key={`cell-${i}`} className="min-h-24 rounded-2xl" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <ErrorBanner
              message={copy.loadFailed}
              data-testid="alert--availability-calendar-load-error"
            />
            <Button
              variant="outline"
              onClick={() => loadMonth(month)}
              data-testid="btn--availability-calendar-retry"
            >
              {t.common.retry}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekdayLabels.map((label, i) => (
              <div
                key={`weekday-${i}`}
                aria-hidden="true"
                className="text-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}

            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`lead-${i}`} aria-hidden="true" />
            ))}

            {daysInMonth.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const entry = dailyMap?.[dateKey];
              const blocked = entry?.blockedByHost ?? false;
              const bookedGuests = entry?.bookedGuests ?? 0;
              const remaining = entry?.remainingGuests ?? null;
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={dateKey}
                  data-testid={`cell--calendar-day-${dateKey}`}
                  className={cn(
                    "min-h-24 rounded-2xl border border-border p-2 flex flex-col gap-1",
                    blocked ? "bg-destructive/5 border-destructive/20" : "bg-background",
                    isToday && "ring-1 ring-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      isToday ? "font-bold text-primary" : "font-medium text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  <span className="text-xs text-muted-foreground">
                    {copy.bookedCount.replace("{n}", String(bookedGuests))}
                  </span>

                  {blocked ? (
                    <Badge variant="destructive" className="w-fit gap-1">
                      <Lock className="size-3" aria-hidden="true" />
                      {copy.blockedMarker}
                    </Badge>
                  ) : (
                    remaining !== null && (
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {t.booking.remainingSpots.replace("{n}", String(Math.max(0, remaining)))}
                      </span>
                    )
                  )}
                </div>
              );
            })}

            {Array.from({ length: trailingBlanks }).map((_, i) => (
              <div key={`trail-${i}`} aria-hidden="true" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
