/**
 * components/ai-chat/AiChatCampCard.tsx — CAM-428
 *
 * BR-4 exception (design.md §4, owner-sanctioned): a DEDICATED, readable
 * framed card for the chat surface — no longer a thin wrapper around the
 * catalog card component (that was CAM-272's interim reuse). The chat
 * surface has its own tap model (an `onSelect` callback, not a baked
 * navigation link) so a later story (S5) can repoint the tap target at an
 * in-chat floating detail card without touching the catalog card's own
 * catalog/wishlist-grid behaviour.
 *
 * REAL fields only (CAM-427 `AiChatCardResponse`, lib/api-client.ts):
 *   - price: `priceLow` null/0 -> `ฟรี` (same "no price = free" convention
 *     the catalog card already uses; priceLow is null precisely when the
 *     schema's `isFree` is true, per lib/catalog-cursor.ts).
 *   - tag: `matchedTag` (CAM-564 — see below), NOT `options[0]`.
 *   - rating: `hasReviews` (G7 canonical signal) falls back to
 *     `reviewCount > 0 && avgRating != null` for an older/unaware payload.
 *   - province: `location.province` is `''` when the source `Location.province`
 *     was null (server-side coercion, ai-camp-card.ts) -> hide the row (G8).
 *     CAM-597: the row's TEXT is now the localized "district(s), province"
 *     string (`buildLocationText`, imported via `location-text.ts` so this
 *     file stays decoupled from the catalog card component per BR-4 above),
 *     never the raw English `location.province` value.
 *   - availability: `remaining` is a plain number only when a dated search
 *     supplied it -> render the chip only then, never fabricate (G3).
 *
 * CAM-564 (the seam CAM-547 AC-6 documented and left unbuilt) — the tag
 * badge now reads `card.matchedTag`: the ONE taxonomy tag that explains WHY
 * this card is in these results, derived server-side
 * (`lib/ai/tools/search-campsites.ts` `deriveMatchedTags`) from the filters
 * the camper's own search actually supplied AND verified against this camp's
 * real MasterData rows. `undefined`/`null` = no supplied filter matched this
 * card (a free-text/location-only search, or the search used no taxonomy
 * filter at all) -> render NO badge — never fall back to `card.options[0]`
 * (the camp's own fixed default tag); that fixed fallback is the exact
 * "describes the camp, not the search" behavior CAM-547 investigated and
 * refused to fake.
 *
 * CAM-547 (owner defect fixes, 2026-07-26):
 *   - AC-3: the redundant "ดูรายละเอียด" line is REMOVED from the visible
 *     card body (the whole card is already a `<button>`) — the SAME copy
 *     key stays wired into the button's own `aria-label` below, so the
 *     accessible name a screen-reader user depends on is unchanged.
 *   - AC-5: the rating moves off the details column and onto the image as
 *     a top-left overlay badge, reusing the exact `Badge variant="overlay"`
 *     idiom the catalog's own listing card already uses for its own image
 *     badges (New Listing / availability status) — no new component, no new
 *     token (BR-4 above still holds: no import of, or coupling to, that
 *     component itself, just the same already-shipped Badge variant). The
 *     `noReviews` empty state is unmoved (stays inline, below the image, in
 *     its pre-existing spot) — only the POSITIVE rating case relocates.
 */
"use client";

import { MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AiChatCardResponse } from "@/lib/api-client";
import { buildLocationText } from "@/components/ai-chat/location-text";

/** Hoisted once — a fresh Intl formatter per render is unnecessary allocation. */
const THB_FORMAT = new Intl.NumberFormat("th-TH");

interface AiChatCampCardProps {
  card: AiChatCardResponse;
  /** Chat-surface tap model (BR-4 exception): the caller decides what "select" means. */
  onSelect: (card: AiChatCardResponse) => void;
}

export function AiChatCampCard({ card, onSelect }: AiChatCampCardProps) {
  const { t, language } = useLanguage();

  const name = language === "en" ? card.nameEn || card.nameTh : card.nameTh;
  // CAM-564 — the badge's data source is the search's own matched tag, never
  // the camp's fixed default (`card.options[0]`, now unused here). `null`/
  // absent -> no badge at all (honest silence beats a plausible-looking
  // invented value) — see the file's top doc comment for the full seam.
  const matchedTag = card.matchedTag;
  const tagName = matchedTag ? (language === "en" ? matchedTag.nameEn : matchedTag.nameTh) : null;
  const hasProvince = card.location.province.trim().length > 0;
  // CAM-597 — localized "district(s), province" text, never the raw
  // English `location.province` beside a Thai session (reuses the SAME
  // buildLocationText the catalog card uses, CAM-545/CAM-573).
  const locationText = buildLocationText(card.location, language);
  const hasReviews = card.hasReviews ?? (card.reviewCount > 0 && card.avgRating != null);
  // CAM-547 AC-5 — the single condition that decides whether the rating badge
  // renders on the image; also drives the inline noReviews fallback below
  // (its negation), so the two states can never both/neither render.
  const showRatingBadge = hasReviews && card.avgRating != null;
  const hasRemaining = typeof card.remaining === "number";

  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      aria-label={`${name} ${t.aiChat.card.viewDetail}`}
      data-testid="btn--ai-chat-card-select"
      className="block w-full overflow-hidden rounded-2xl border border-ai-tint bg-card p-0 text-left shadow-ai-glow transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      {/* CAM-547 AC-5 — rating moved onto the image as a top-left overlay
          badge (reuses the catalog listing card's own image-badge idiom: an
          `absolute` sibling inside a shared `relative` wrapper, `Badge
          variant="overlay"`, no new component/token). */}
      <div className="relative">
        {showRatingBadge && (
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="overlay" data-testid="rating--ai-chat-card">
              <Star className="fill-current" aria-hidden="true" />
              {card.avgRating} ({t.aiChat.card.reviews.replace("{count}", String(card.reviewCount))})
            </Badge>
          </div>
        )}
        <ImageWithFallback
          src={card.images?.[0]?.url}
          alt={name}
          className="aspect-video w-full rounded-t-2xl"
          sizes="(max-width: 640px) 90vw, 256px"
          data-testid="img--ai-chat-card-hero"
        />
      </div>

      <div className="space-y-2 p-4">
        <p className="line-clamp-1 text-sm font-medium text-foreground" data-testid="text--ai-chat-card-name">
          {name}
        </p>

        {/* Price hero — own line, largest/boldest/accent element (reading order: name -> price). */}
        <p className="flex items-baseline gap-1 tabular-nums" data-testid="text--ai-chat-card-price">
          {card.priceLow && card.priceLow > 0 ? (
            <>
              <span className="text-lg font-semibold text-ai-price">฿{THB_FORMAT.format(card.priceLow)}</span>
              <span className="text-xs font-normal text-muted-foreground">{t.aiChat.card.perNight}</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-ai-price">{t.aiChat.card.free}</span>
          )}
        </p>

        {hasProvince && (
          <p
            className="flex items-center gap-1 text-xs text-muted-foreground"
            data-testid="text--ai-chat-card-province"
          >
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{locationText}</span>
          </p>
        )}

        {/* CAM-547 AC-5 — the positive rating case moved onto the image
            badge above; this row now carries only its negation (noReviews)
            plus the unrelated availability chip, so it never doubles up
            with the badge and is never empty for no reason. */}
        {(!showRatingBadge || hasRemaining) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
            {!showRatingBadge && (
              <span data-testid="empty--ai-chat-card-rating">{t.aiChat.card.noReviews}</span>
            )}

            {hasRemaining && (
              <span data-testid="chip--ai-chat-card-remaining">
                {t.aiChat.card.remaining.replace("{count}", String(card.remaining))}
              </span>
            )}
          </div>
        )}

        {tagName && (
          <Badge variant="secondary" className="rounded-xl" data-testid="badge--ai-chat-card-tag">
            {tagName}
          </Badge>
        )}
      </div>
    </button>
  );
}
