/**
 * components/ai-chat/AiChatDetailCard.tsx — CAM-447, refined by CAM-448, decision-order
 * IA + floating glass card by CAM-450
 *
 * S5: the consolidated camp-detail view that opens when a camper taps a
 * result card. CAM-450 (owner-approved wireframe, after seeing S5 on
 * staging) re-ordered every section by "booking-decision weight"
 * (availability → capacity/price → amenities → trust → travel → about →
 * cancellation).
 *
 * CAM-451 (owner staging feedback, SUPERSEDES CAM-450's floating-card +
 * scrim geometry): this component no longer owns its own floating/absolute
 * position or a dimmed scrim — `AiChatPanel.tsx` now mounts it as one full
 * pane of a two-pane PUSH track (chat | detail), each pane an
 * `absolute inset-0` sibling that slides fully on/off screen via its own
 * `transition-transform`. This component renders as a plain in-flow
 * `h-full w-full` column filling whatever pane it's given — it still stays
 * a plain div layer with `role="dialog"`, never a second Radix Dialog
 * (design brief §0/§1: avoids a double focus-trap). The glass-card surface
 * tokens (`bg-ai-surface`/`shadow-ai-glow`/`border-ai-tint`/
 * `backdrop-blur-xl`) and every section inside are UNCHANGED by this
 * container swap — only the outer wrapper + scrim + floating-inset
 * positioning were removed.
 *
 * Data model: the hero image/name/location/rating paint INSTANTLY from the
 * in-hand `AiChatCardResponse` the camper already saw on the result card
 * (zero fetch flash). The verified badge, terrain/access labels, distance,
 * and every section below the hero enrich the SAME view once
 * `aiChatAPI.getCampDetail` (CAM-446/449) resolves — `isVerified` and
 * `distanceFromBangkokKm` only exist on the async `GetCampDetailResult`,
 * never on the instant card payload, so they fill in progressively rather
 * than gating the hero paint (same async-fills-into-instant-slots doctrine
 * CAM-448 already used for amenities/reviews/availability).
 *
 * Real data only (owner directive): every field below traces to a real
 * `GetCampDetailResult` field — an empty/`null` field HIDES its row/section
 * rather than rendering a blank or a fabricated placeholder.
 *
 * CAM-454 (owner staging feedback, part of the AiChatPanel expanded-card
 * shell story): two small cleanups.
 *  1. `overscroll-contain` on this ScrollArea's viewport (scrolling to the
 *     end of the detail can no longer chain-scroll the page behind the
 *     panel) + `data-scrollbar-hidden` (hides this ScrollArea's own visible
 *     scrollbar affordance, app/globals.css) while scrolling itself keeps
 *     working.
 *  2. `DetailSection`'s divider sat flush against the content ABOVE it
 *     (`border-t` + `pt-6` gave space only BELOW the rule) — added a
 *     matching `pb-6` (`last:pb-0` on the final section) so every divider
 *     now has equal-ish breathing room above and below, using the same `6`
 *     spacing-scale value already in use, no new token.
 */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Compass,
  Info,
  LayoutGrid,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { ErrorState } from "@/components/ErrorState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import { aiChatAPI, type AiChatCardResponse } from "@/lib/api-client";
import { resolveCancellationPolicyCopy } from "@/lib/cancellation-policy";
import { getFacilityIcon } from "@/lib/facility-icon-map";
import { cn } from "@/lib/utils";
import type {
  CampAmenity,
  GetCampDetailResult,
  WeekendAvailabilityEntry,
} from "@/lib/ai/tools/get-camp-detail";
import type { TranslationType } from "@/locales/translations";

/** Hoisted once — a fresh Intl formatter per render is unnecessary allocation. */
const THB_FORMAT = new Intl.NumberFormat("th-TH");

/** design brief §4 (state 2) — skeleton row counts mirroring the real sections. */
const AMENITY_SKELETON_COUNT = 4;
const AVAILABILITY_SKELETON_COUNT = 3;

type CampDetail = Extract<GetCampDetailResult, { ok: true }>;

interface AiChatDetailCardProps {
  card: AiChatCardResponse;
  /** Forks the geometry only — never remounts (mirrors CAM-431). */
  expanded: boolean;
  onClose: () => void;
}

/** A section heading (lucide icon + label) wrapping its own content — CAM-450 readability §. */
function DetailSection({
  icon: Icon,
  heading,
  testId,
  children,
}: {
  icon: LucideIcon;
  heading: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section
      // CAM-454: pb-6 balances pt-6 so the divider between two sections
      // gets equal-ish space above and below the rule (last:pb-0 keeps the
      // final section's trailing edge unchanged, flush with the CTA below).
      className="space-y-3 border-t border-border/60 pt-6 pb-6 first:border-t-0 first:pt-0 last:pb-0"
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-ai-price" aria-hidden="true" />
        {/* CAM-451 (WCAG AA audit): text-muted-foreground on the ai-surface
            glass surface measured ~4.3:1 in light mode (below the 4.5:1
            body-text floor) — bumped to the higher-contrast text-foreground/70
            token already used for secondary captions elsewhere (e.g.
            LocationPicker.tsx), no new token introduced. */}
        <h3 className="text-xs font-semibold tracking-wide text-foreground/70 uppercase">{heading}</h3>
      </div>
      {children}
    </section>
  );
}

/** One glance-row stat tile (ราคา / รับได้ / ว่างวันไหน) — hidden by its caller when the field has no real value. */
function StatTile({
  icon: Icon,
  value,
  label,
  testId,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  testId: string;
}) {
  return (
    <div className="rounded-2xl border border-ai-tint/60 bg-muted/30 px-3 py-2.5 text-center" data-testid={testId}>
      <p className="flex items-center justify-center gap-1 text-sm font-semibold tabular-nums text-foreground">
        <Icon className="size-3.5 shrink-0 text-ai-price" aria-hidden="true" />
        <span className="truncate">{value}</span>
      </p>
      {/* CAM-451 (WCAG AA audit): same text-foreground/70 bump as DetailSection's
          heading — this stat caption sits on the same ai-surface/bg-muted
          combination and measured the same near-floor light-mode contrast. */}
      <p className="mt-1 truncate text-xs text-foreground/70">{label}</p>
    </div>
  );
}

/**
 * CAM-449/450 — one weekend date chip: the date on top, the LIVE
 * remaining-guest state below as a real `Badge` (never a raw colored span,
 * DESIGN.md §3 status-label rule). `remaining===null` (cap not set) shows no
 * number, per BR — never fabricated, never tents-as-remaining.
 */
function WeekendChip({
  entry,
  dateFormatter,
  t,
}: {
  entry: WeekendAvailabilityEntry;
  dateFormatter: Intl.DateTimeFormat;
  t: TranslationType;
}) {
  const isFull = entry.blockedByHost || entry.remaining === 0;
  return (
    <div
      className="min-w-20 rounded-xl border border-ai-tint/60 bg-muted/20 px-3 py-2 text-center"
      data-testid="chip--ai-chat-detail-weekend"
    >
      <p className="text-xs font-semibold tabular-nums text-foreground">
        {dateFormatter.format(new Date(`${entry.date}T00:00:00Z`))}
      </p>
      <Badge variant={isFull ? "destructive" : "success"} className="mt-1">
        {isFull
          ? t.booking.fullyBooked
          : entry.remaining !== null
            ? t.aiChat.card.remaining.replace("{count}", String(entry.remaining))
            : t.aiChat.detail.openNoCap}
      </Badge>
    </div>
  );
}

export function AiChatDetailCard({ card, expanded, onClose }: AiChatDetailCardProps) {
  const { t, language } = useLanguage();
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const [detail, setDetail] = useState<CampDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const showSkeleton = useMinimumLoading(isLoading, { delay: 300, minDisplay: 400 });

  const name = language === "en" ? card.nameEn || card.nameTh : card.nameTh;
  const slug = language === "en" ? card.nameEnSlug || card.nameThSlug : card.nameThSlug;
  const hasProvince = card.location.province.trim().length > 0;

  // design brief §5 — focus lands on the dismiss control on open.
  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  // design brief §5 — Esc must close THIS detail first (see file header for
  // why a window-level capture listener is the mechanism that reliably wins).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onClose]);

  // Amenities/reviews/availability fetch (CAM-446/449). `active` guards a stale
  // response from a superseded request (code.md CAM-359) — retrying bumps
  // `retryToken`, which re-runs this effect for the SAME card id.
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setFailed(false);
    aiChatAPI.getCampDetail(card.id).then((result) => {
      if (!active) return;
      setIsLoading(false);
      if (result.ok) {
        setDetail(result);
      } else {
        setFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [card.id, retryToken]);

  const dateFormatter = new Intl.DateTimeFormat(language === "en" ? "en" : "th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const amenityName = (a: CampAmenity) => (language === "en" ? a.nameEn : a.nameTh);

  // CAM-450 — MasterData groups already carried by `amenities` (CAM-449's
  // unfiltered `campSite.options` select): Terrain/Access type enrich the
  // hero location line; Activity gets its own sub-heading; everything else
  // is "สิ่งอำนวยความสะดวก". Computed unconditionally (cheap, bounded array).
  const terrainAmenity = detail?.amenities.find((a) => a.group === "Terrain");
  const accessAmenity = detail?.amenities.find((a) => a.group === "Access type");
  const facilityAmenities =
    detail?.amenities.filter((a) => a.group !== "Activity" && a.group !== "Terrain" && a.group !== "Access type") ?? [];
  const activityAmenities = detail?.amenities.filter((a) => a.group === "Activity") ?? [];

  const distanceText =
    detail?.distanceFromBangkokKm != null
      ? t.aiChat.detail.distanceApprox.replace("{count}", String(Math.round(detail.distanceFromBangkokKm)))
      : null;
  const locationParts = [
    hasProvince ? card.location.province : null,
    terrainAmenity ? amenityName(terrainAmenity) : null,
    accessAmenity ? amenityName(accessAmenity) : null,
  ].filter((part): part is string => Boolean(part));

  // CAM-450 — quick-glance stat row (ราคา / รับได้ / ว่างวันไหน); each tile is
  // built only when its underlying field is real (owner: hide, never fabricate).
  const nextWeekend = detail?.weekendAvailability[0];
  const priceStatValue = detail
    ? detail.price.isFree
      ? t.aiChat.card.free
      : detail.price.low != null
        ? `฿${THB_FORMAT.format(detail.price.low)}`
        : null
    : null;
  const availabilityStatValue = nextWeekend
    ? nextWeekend.blockedByHost || nextWeekend.remaining === 0
      ? t.booking.fullyBooked
      : nextWeekend.remaining !== null
        ? t.aiChat.card.remaining.replace("{count}", String(nextWeekend.remaining))
        : t.aiChat.detail.openNoCap
    : null;

  const statTiles: { icon: LucideIcon; value: string; label: string; testId: string }[] = [];
  if (priceStatValue) {
    statTiles.push({
      icon: Banknote,
      value: priceStatValue,
      label: t.aiChat.detail.statPriceLabel,
      testId: "text--ai-chat-detail-price",
    });
  }
  if (detail && (detail.capacity.maxGuestsPerDay !== null || detail.capacity.maxTentsPerDay !== null)) {
    const usesGuests = detail.capacity.maxGuestsPerDay !== null;
    statTiles.push({
      icon: Users,
      value: THB_FORMAT.format((usesGuests ? detail.capacity.maxGuestsPerDay : detail.capacity.maxTentsPerDay) ?? 0),
      label: usesGuests ? t.aiChat.detail.statCapacityLabel : t.aiChat.detail.statCapacityTentsLabel,
      testId: "stat--ai-chat-detail-capacity",
    });
  }
  if (availabilityStatValue && nextWeekend) {
    // CAM-451: prefix the caption with "สุดสัปดาห์หน้า"/"Next weekend" — the
    // bare date alone let a camper misread this tile's "เต็มแล้ว" value as
    // the WHOLE camp being full, not just next weekend (this stat is only
    // ever weekendAvailability[0]; the full section below is unaffected).
    statTiles.push({
      icon: CalendarDays,
      value: availabilityStatValue,
      label: `${t.aiChat.detail.statNextWeekendLabel} · ${dateFormatter.format(new Date(`${nextWeekend.date}T00:00:00Z`))}`,
      testId: "stat--ai-chat-detail-next-weekend",
    });
  }

  return (
    // CAM-451: in-flow, fills whatever pane AiChatPanel.tsx's push track
    // gives it — no more absolute/floating positioning, no scrim (the track
    // itself is the ONLY thing that moves this view on/off screen). The
    // glass-card surface tokens are unchanged from CAM-450.
    <div
      role="dialog"
      aria-label={name}
      data-testid="dialog--ai-chat-detail"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-ai-tint bg-ai-surface shadow-ai-glow backdrop-blur-xl"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-3">
        <Button
          ref={backButtonRef}
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full motion-safe:active:scale-95"
          aria-label={t.aiChat.detail.back}
          data-testid="btn--ai-chat-detail-back"
          onClick={onClose}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Button>
        <p className="truncate font-heading text-sm text-foreground">{name}</p>
      </div>

      <ScrollArea
        className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
        data-scrollbar-hidden
      >
        {/* CAM-451: bounded reading column (matches the chat body's own
            `max-w-2xl sm:max-w-3xl` wrapper) — the detail now fills the
            FULL panel width, so this keeps text from reading full-bleed
            on a wide expanded panel; a no-op when collapsed (the panel
            itself is already narrower than the bound). */}
        <div className={cn("space-y-6 p-4 md:p-6", expanded && "mx-auto w-full max-w-2xl sm:max-w-3xl")}>
          {/* HERO — instant (image/name/province/rating), progressively
              enriched with the verified badge + terrain/access + distance
              once the async fetch resolves (never gates the paint). */}
          <div>
            <ImageWithFallback
              src={card.images?.[0]?.url}
              alt={name}
              className="aspect-video w-full rounded-2xl"
              sizes="(max-width: 640px) 90vw, 40rem"
              data-testid="img--ai-chat-detail-hero"
            />
            <div className="mt-4 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="font-heading text-xl font-semibold text-foreground md:text-2xl"
                  data-testid="text--ai-chat-detail-name"
                >
                  {name}
                </p>
                {detail?.isVerified && (
                  <Badge variant="success" className="shrink-0" data-testid="badge--ai-chat-detail-verified">
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    {t.aiChat.detail.verifiedBadge}
                  </Badge>
                )}
              </div>
              {card.reviewCount > 0 && card.avgRating !== null && (
                <div
                  className="flex items-center gap-1 text-sm text-foreground/70"
                  data-testid="text--ai-chat-detail-rating"
                >
                  <Star className="size-4 fill-current text-foreground" aria-hidden="true" />
                  <span className="font-medium text-foreground tabular-nums">{card.avgRating}</span>
                  <span>({t.aiChat.card.reviews.replace("{count}", String(card.reviewCount))})</span>
                </div>
              )}
              {(locationParts.length > 0 || distanceText) && (
                <p
                  className="flex flex-wrap items-center gap-1 text-sm text-foreground/70"
                  data-testid="text--ai-chat-detail-province"
                >
                  {hasProvince && <MapPin className="size-4 shrink-0" aria-hidden="true" />}
                  {locationParts.length > 0 && <span>{locationParts.join(" · ")}</span>}
                  {distanceText && <span className="text-xs text-foreground/70">· {distanceText}</span>}
                </p>
              )}
            </div>
          </div>

          {/* ASYNC block — everything below the hero. */}
          <div aria-busy={showSkeleton}>
            <div role="status" aria-live="polite" data-testid="status--ai-chat-detail-loading" className="sr-only">
              {showSkeleton ? t.aiChat.loading : ""}
            </div>

            {failed ? (
              <div data-testid="error--ai-chat-detail">
                <ErrorState variant="error" compact onRetry={() => setRetryToken((v) => v + 1)} />
              </div>
            ) : showSkeleton ? (
              <div className="space-y-6" aria-hidden="true">
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                  ))}
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: AVAILABILITY_SKELETON_COUNT }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-20 rounded-xl" />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: AMENITY_SKELETON_COUNT }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-20 rounded-xl" />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ) : detail ? (
              <div className="space-y-0">
                {statTiles.length > 0 && (
                  <div
                    className={cn(
                      "grid gap-2 pb-6",
                      statTiles.length === 3 ? "grid-cols-3" : statTiles.length === 2 ? "grid-cols-2" : "grid-cols-1"
                    )}
                    data-testid="section--ai-chat-detail-stats"
                  >
                    {statTiles.map((tile) => (
                      <StatTile key={tile.testId} {...tile} />
                    ))}
                  </div>
                )}

                <DetailSection
                  icon={CalendarDays}
                  heading={t.aiChat.detail.availabilityHeading}
                  testId="section--ai-chat-detail-availability"
                >
                  {detail.weekendAvailability.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {detail.weekendAvailability.map((entry) => (
                        <WeekendChip key={entry.date} entry={entry} dateFormatter={dateFormatter} t={t} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/70">{t.aiChat.detail.noAvailability}</p>
                  )}
                </DetailSection>

                {(detail.price.isFree || detail.price.low != null) && (
                  <DetailSection
                    icon={Banknote}
                    heading={t.aiChat.detail.priceHeading}
                    testId="section--ai-chat-detail-price"
                  >
                    <p className="flex items-baseline gap-1">
                      {detail.price.isFree ? (
                        <span className="text-lg font-semibold text-ai-price">{t.aiChat.card.free}</span>
                      ) : (
                        detail.price.low != null && (
                          <>
                            <span className="text-lg font-semibold tabular-nums text-ai-price">
                              ฿{THB_FORMAT.format(detail.price.low)}
                            </span>
                            <span className="text-xs text-foreground/70">{t.aiChat.detail.perGuestNight}</span>
                          </>
                        )
                      )}
                    </p>
                    {detail.price.extraFeeAmount != null && detail.price.extraFeeAmount > 0 && (
                      <p
                        className="flex flex-wrap items-center gap-1 text-sm text-foreground"
                        data-testid="text--ai-chat-detail-extra-fee"
                      >
                        <span>+ {detail.price.extraFeeLabel || t.aiChat.detail.extraFeeGeneric}</span>
                        <span className="tabular-nums">฿{THB_FORMAT.format(detail.price.extraFeeAmount)}</span>
                        <span className="text-xs text-foreground/70">{t.aiChat.detail.extraFeeOneTime}</span>
                      </p>
                    )}
                    {detail.price.feeInfo && (
                      <p className="text-xs text-foreground/70">{detail.price.feeInfo}</p>
                    )}
                  </DetailSection>
                )}

                <DetailSection
                  icon={LayoutGrid}
                  heading={t.aiChat.detail.amenitiesHeading}
                  testId="section--ai-chat-detail-amenities"
                >
                  {facilityAmenities.length > 0 || activityAmenities.length > 0 ? (
                    <>
                      {facilityAmenities.length > 0 && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                          {facilityAmenities.map((a) => {
                            const Icon = getFacilityIcon(a.code);
                            return (
                              <div
                                key={a.code}
                                className="flex items-center gap-2 text-sm text-foreground"
                                data-testid="text--ai-chat-detail-amenity"
                              >
                                <Icon className="size-4 shrink-0 text-ai-price" aria-hidden="true" />
                                <span className="truncate">{amenityName(a)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {activityAmenities.length > 0 && (
                        <div className={cn("space-y-2", facilityAmenities.length > 0 && "pt-2")}>
                          <p className="text-xs text-foreground/70">{t.aiChat.detail.activitiesHeading}</p>
                          <div className="flex flex-wrap gap-2">
                            {activityAmenities.map((a) => {
                              const Icon = getFacilityIcon(a.code);
                              return (
                                <Badge
                                  key={a.code}
                                  variant="secondary"
                                  className="rounded-xl"
                                  data-testid="badge--ai-chat-detail-tag"
                                >
                                  <Icon className="size-3" aria-hidden="true" />
                                  {amenityName(a)}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-foreground/70">{t.aiChat.detail.noAmenities}</p>
                  )}
                </DetailSection>

                <DetailSection
                  icon={MessageSquareText}
                  heading={t.aiChat.detail.reviewsHeading}
                  testId="section--ai-chat-detail-reviews"
                >
                  {detail.reviewSummary.hasReviews ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-sm tabular-nums">
                        <Star className="size-4 fill-current text-foreground" aria-hidden="true" />
                        <span className="font-medium text-foreground">{detail.reviewSummary.avgRating}</span>
                        <span className="text-foreground/70">
                          ({t.aiChat.card.reviews.replace("{count}", String(detail.reviewSummary.count))})
                        </span>
                      </div>
                      {/* every verified review the server returns (already
                          bounded server-side, CAM-446), full content, no
                          client-side snippet cap or line-clamp. */}
                      {detail.reviews.map((review, i) => (
                        <div key={i} className="space-y-1 rounded-xl bg-muted/50 p-3">
                          <p className="text-xs font-medium text-foreground">{review.name}</p>
                          <div className="flex items-center gap-1 text-xs tabular-nums text-foreground/70">
                            <Star className="size-3.5 fill-current" aria-hidden="true" />
                            {review.rating}
                          </div>
                          {review.content && <p className="text-sm text-foreground/70">{review.content}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/70">{t.aiChat.card.noReviews}</p>
                  )}
                </DetailSection>

                <DetailSection
                  icon={Compass}
                  heading={t.aiChat.detail.travelHeading}
                  testId="section--ai-chat-detail-travel"
                >
                  <div className="space-y-2 text-sm text-foreground">
                    {accessAmenity && (
                      <p className="flex items-center gap-2">
                        <Compass className="size-4 shrink-0 text-ai-price" aria-hidden="true" />
                        <span>{amenityName(accessAmenity)}</span>
                      </p>
                    )}
                    {detail.directions && (
                      <p className="flex items-start gap-2 text-foreground/70">
                        <MapPin className="size-4 shrink-0 text-ai-price" aria-hidden="true" />
                        <span>{detail.directions}</span>
                      </p>
                    )}
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-foreground/70">
                      <span>
                        {t.booking.checkIn} {detail.checkInTime}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.booking.checkOut} {detail.checkOutTime}
                      </span>
                      {detail.minimumAge != null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {t.campground.minimumAge} {detail.minimumAge}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </DetailSection>

                {detail.description && detail.description.trim().length > 0 && (
                  <DetailSection icon={Info} heading={t.campground.aboutPlace} testId="section--ai-chat-detail-about">
                    <p className="text-sm leading-relaxed text-foreground">{detail.description}</p>
                  </DetailSection>
                )}

                <DetailSection
                  icon={ShieldCheck}
                  heading={t.campground.cancellationPolicy.title}
                  testId="section--ai-chat-detail-cancellation"
                >
                  <p className="text-sm text-foreground">
                    {resolveCancellationPolicyCopy(detail.cancellationPolicy, t.campground.cancellationPolicy)}
                  </p>
                </DetailSection>
              </div>
            ) : null}
          </div>
        </div>
      </ScrollArea>

      {/* CTA is a deep-link, enabled through load/error (instant `card`
          price, never gated on the fetch). Same reading-column bound as
          the scroll content above. */}
      <div className={cn("shrink-0 space-y-2 border-t border-border/60 p-4", expanded && "mx-auto w-full max-w-2xl sm:max-w-3xl")}>
        <p className="flex items-baseline gap-1" data-testid="text--ai-chat-detail-cta-price">
          {card.priceLow && card.priceLow > 0 ? (
            <>
              <span className="text-lg font-semibold text-ai-price">฿{THB_FORMAT.format(card.priceLow)}</span>
              <span className="text-xs text-foreground/70">{t.aiChat.card.perNight}</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-ai-price">{t.aiChat.card.free}</span>
          )}
        </p>
        <Button size="lg" asChild className="w-full motion-safe:active:scale-[0.98]" data-testid="btn--ai-chat-detail-cta">
          <Link href={`/campgrounds/${slug}`}>
            {t.aiChat.detail.viewCampPage}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
