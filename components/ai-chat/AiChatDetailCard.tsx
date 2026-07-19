/**
 * components/ai-chat/AiChatDetailCard.tsx — CAM-447, refined by CAM-448
 *
 * S5: the floating, consolidated camp-detail card that opens over น้องกองไฟ's
 * chat surface when a camper taps a result card. CAM-448 (owner, after seeing
 * S5 live on staging) evolved the geometry to a CARD-STYLED DRAWER — it
 * slides in from the edge (right on desktop, bottom sheet on mobile) rather
 * than materializing centered in place, but keeps the same glass/rounded card
 * look (`bg-ai-surface`/`shadow-ai-glow`/`border-ai-tint`/rounded corners) the
 * original S5 brief called for — owner preference evolved from "not a plain
 * edge drawer" to "a drawer that still reads as the card". Mounts as an
 * `absolute z-20` layer INSIDE `PanelPrimitive.Content` (a sibling of the
 * panel's own `relative z-10` body, see AiChatPanel.tsx) — NOT a second Radix
 * Dialog (design brief §0/§1: avoids a double focus-trap).
 *
 * Data model (design brief §2): the hero/name/price/province/tags paint
 * INSTANTLY from the in-hand `AiChatCardResponse` the camper already saw on
 * the result card (zero fetch flash). Amenities/reviews/availability then
 * FETCH via `aiChatAPI.getCampDetail` (CAM-446) and fill their own section;
 * that async section alone carries loading/empty/error — the instant block
 * and the CTA never wait on the fetch. CAM-448: reviews/amenities/dates
 * render in FULL (no client-side snippet cap) — the server (CAM-446)
 * already bounds `reviews` at `MAX_REVIEWS_RETURNED`, so there is no
 * unbounded-fetch risk in showing every row it returns.
 *
 * Geometry (CAM-448) is a SINGLE element, className-forked on the panel's
 * `expanded` flag (mirrors CAM-431's no-remount fork) so toggling
 * expand/collapse while the detail is open never remounts this component.
 * Desktop = right-anchored drawer (`right` pinned, `left` auto, capped by
 * `max-w-md`/`max-w-lg` so the chat stays visible to the left); mobile =
 * bottom sheet. Both use a definite top+bottom (or top+`inset-y`) inset pair
 * rather than an auto-height parent capped only by `max-h` — CAM-407's own
 * lesson (see AiChatPanel.tsx) is that a percentage/`h-full` child only
 * resolves against a parent with a DEFINITE height, not an auto one capped
 * by `max-height` alone.
 *
 * Esc handling (design brief §5): Radix's `DismissableLayer` (the panel's
 * own Dialog.Content) registers its Escape listener on `document` with
 * `{capture:true}` (@radix-ui/react-use-escape-keydown) — a listener
 * attached anywhere on OUR side of the tree (even `onKeyDownCapture`) can
 * never run before that, since `document` is visited before any of its
 * descendants during the capture phase regardless of mount/registration
 * order. `window` is visited BEFORE `document` in the capture phase, so a
 * `window`-level capture listener reliably wins the race every time and
 * `stopPropagation()` there keeps the key event from ever reaching Radix's
 * document listener — Esc closes this detail card first, the panel stays
 * open (design brief: "else Radix Content's Esc collapses the whole chat").
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { ErrorState } from "@/components/ErrorState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading";
import { aiChatAPI, type AiChatCardResponse } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { GetCampDetailResult } from "@/lib/ai/tools/get-camp-detail";

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

  // Amenities/reviews/availability fetch (CAM-446). `active` guards a stale
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

  return (
    <div
      role="dialog"
      aria-label={name}
      data-testid="dialog--ai-chat-detail"
      className={
        // CAM-448 — a card-styled DRAWER, right-anchored on desktop (`right`
        // pinned, `left` auto, width capped so the chat stays visible on the
        // left) and a bottom sheet on mobile. `top-16` + `bottom-0` (mobile)
        // and `inset-y-2`/`inset-y-4` (desktop) are a definite top+bottom
        // inset pair — never an auto-height box capped only by `max-h` (see
        // the file header's CAM-407 note).
        expanded
          ? "absolute inset-x-0 bottom-0 top-16 z-20 sm:inset-x-auto sm:inset-y-4 sm:left-auto sm:right-4 sm:w-full sm:max-w-lg lg:max-w-xl"
          : "absolute inset-x-0 bottom-0 top-16 z-20 sm:inset-x-auto sm:inset-y-2 sm:left-auto sm:right-2 sm:w-full sm:max-w-md"
      }
    >
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl border border-ai-tint bg-ai-surface shadow-ai-glow backdrop-blur-xl sm:rounded-3xl",
          // CAM-448 — slide-in entrance (replaces the CAM-447 centered
          // scale-fade materialize): from the bottom on mobile, from the
          // right on desktop (the `sm:slide-in-from-bottom-0` reset cancels
          // the mobile Y-translate so desktop slides purely horizontally,
          // matching the AiChatPanel.tsx bottom-sheet entrance idiom).
          "duration-200 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:slide-in-from-right-8",
          "motion-reduce:animate-none"
        )}
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

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-4 md:p-6">
            {/* INSTANT block — from the in-hand card, never gated on the fetch. */}
            <div>
              <ImageWithFallback
                src={card.images?.[0]?.url}
                alt={name}
                className="aspect-video w-full rounded-2xl"
                sizes="(max-width: 640px) 90vw, 40rem"
                data-testid="img--ai-chat-detail-hero"
              />
              <div className="mt-4 space-y-2">
                <p
                  className="font-heading text-xl font-semibold text-foreground md:text-2xl"
                  data-testid="text--ai-chat-detail-name"
                >
                  {name}
                </p>
                <p className="tabular-nums" data-testid="text--ai-chat-detail-price">
                  {card.priceLow && card.priceLow > 0 ? (
                    <span className="text-lg font-semibold text-ai-price">
                      ฿{THB_FORMAT.format(card.priceLow)}
                      <span className="text-xs font-normal text-muted-foreground">{t.aiChat.card.perNight}</span>
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-ai-price">{t.aiChat.card.free}</span>
                  )}
                </p>
                {hasProvince && (
                  <p
                    className="flex items-center gap-1 text-sm text-muted-foreground"
                    data-testid="text--ai-chat-detail-province"
                  >
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    {card.location.province}
                  </p>
                )}
                {card.options && card.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {card.options.map((tag, i) => (
                      <Badge
                        key={`${tag.nameTh}-${i}`}
                        variant="secondary"
                        className="rounded-xl"
                        data-testid="badge--ai-chat-detail-tag"
                      >
                        {language === "en" ? tag.nameEn : tag.nameTh}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ASYNC block — amenities / reviews / availability only. */}
            <div aria-busy={showSkeleton}>
              <div
                role="status"
                aria-live="polite"
                data-testid="status--ai-chat-detail-loading"
                className="sr-only"
              >
                {showSkeleton ? t.aiChat.loading : ""}
              </div>

              {failed ? (
                <div data-testid="error--ai-chat-detail">
                  <ErrorState variant="error" compact onRetry={() => setRetryToken((v) => v + 1)} />
                </div>
              ) : showSkeleton ? (
                <div className="space-y-6" aria-hidden="true">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: AMENITY_SKELETON_COUNT }).map((_, i) => (
                        <Skeleton key={i} className="h-6 w-16 rounded-xl" />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: AVAILABILITY_SKELETON_COUNT }).map((_, i) => (
                        <Skeleton key={i} className="h-6 w-24 rounded-xl" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : detail ? (
                <div className="space-y-6">
                  <section data-testid="section--ai-chat-detail-amenities">
                    <p className="text-sm font-medium text-foreground">{t.aiChat.detail.amenitiesHeading}</p>
                    {detail.amenities.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detail.amenities.map((amenity) => (
                          <Badge
                            key={amenity.code}
                            variant="secondary"
                            className="rounded-xl"
                            data-testid="badge--ai-chat-detail-amenity"
                          >
                            {language === "en" ? amenity.nameEn : amenity.nameTh}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">{t.aiChat.detail.noAmenities}</p>
                    )}
                  </section>

                  <section data-testid="section--ai-chat-detail-reviews">
                    <p className="text-sm font-medium text-foreground">{t.aiChat.detail.reviewsHeading}</p>
                    {detail.reviewSummary.hasReviews ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-1 text-sm tabular-nums">
                          <Star className="size-4 fill-current text-foreground" aria-hidden="true" />
                          <span className="font-medium text-foreground">{detail.reviewSummary.avgRating}</span>
                          <span className="text-muted-foreground">
                            ({t.aiChat.card.reviews.replace("{count}", String(detail.reviewSummary.count))})
                          </span>
                        </div>
                        {/* CAM-448 — every verified review the server returns
                            (already bounded server-side at
                            MAX_REVIEWS_RETURNED, CAM-446), full content, no
                            client-side snippet cap or line-clamp. */}
                        {detail.reviews.map((review, i) => (
                          <div key={i} className="space-y-1 rounded-xl bg-muted/50 p-3">
                            <p className="text-xs font-medium text-foreground">{review.name}</p>
                            <div className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                              <Star className="size-3.5 fill-current" aria-hidden="true" />
                              {review.rating}
                            </div>
                            {review.content && (
                              <p className="text-sm text-muted-foreground">{review.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">{t.aiChat.card.noReviews}</p>
                    )}
                  </section>

                  <section data-testid="section--ai-chat-detail-availability">
                    <p className="text-sm font-medium text-foreground">{t.aiChat.detail.availabilityHeading}</p>
                    {detail.availableWeekendDates.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detail.availableWeekendDates.map((date) => (
                          <Badge
                            key={date}
                            variant="secondary"
                            className="rounded-xl tabular-nums"
                            data-testid="badge--ai-chat-detail-date"
                          >
                            {dateFormatter.format(new Date(`${date}T00:00:00Z`))}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">{t.aiChat.detail.noAvailability}</p>
                    )}
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </ScrollArea>

        {/* design brief §2 — CTA is a deep-link, enabled through load/error. */}
        <div className="shrink-0 border-t border-border/60 p-4">
          <Button
            size="lg"
            asChild
            className="w-full motion-safe:active:scale-[0.98]"
            data-testid="btn--ai-chat-detail-cta"
          >
            <Link href={`/campgrounds/${slug}`}>
              {t.aiChat.detail.viewCampPage}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
