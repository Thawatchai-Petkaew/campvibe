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
 *   - first tag: `options[0]` (CAM-427's Terrain-group "first tag").
 *   - rating: `hasReviews` (G7 canonical signal) falls back to
 *     `reviewCount > 0 && avgRating != null` for an older/unaware payload.
 *   - province: `location.province` is `''` when the source `Location.province`
 *     was null (server-side coercion, ai-camp-card.ts) -> hide the row (G8).
 *   - availability: `remaining` is a plain number only when a dated search
 *     supplied it -> render the chip only then, never fabricate (G3).
 */
"use client";

import { MapPin, Star, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AiChatCardResponse } from "@/lib/api-client";

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
  const tag = card.options?.[0];
  const tagName = tag ? (language === "en" ? tag.nameEn : tag.nameTh) : null;
  const hasProvince = card.location.province.trim().length > 0;
  const hasReviews = card.hasReviews ?? (card.reviewCount > 0 && card.avgRating != null);
  const hasRemaining = typeof card.remaining === "number";

  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      aria-label={`${name} ${t.aiChat.card.viewDetail}`}
      data-testid="btn--ai-chat-card-select"
      className="block w-full overflow-hidden rounded-2xl border border-ai-tint bg-card p-0 text-left shadow-ai-glow transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      <ImageWithFallback
        src={card.images?.[0]?.url}
        alt={name}
        className="aspect-video w-full rounded-t-2xl"
        sizes="(max-width: 640px) 90vw, 256px"
        data-testid="img--ai-chat-card-hero"
      />

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
            <span className="line-clamp-1">{card.location.province}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
          {hasReviews && card.avgRating != null ? (
            <span className="flex items-center gap-1" data-testid="rating--ai-chat-card">
              <Star className="size-3.5 fill-current" aria-hidden="true" />
              {card.avgRating} ({t.aiChat.card.reviews.replace("{count}", String(card.reviewCount))})
            </span>
          ) : (
            <span data-testid="empty--ai-chat-card-rating">{t.aiChat.card.noReviews}</span>
          )}

          {hasRemaining && (
            <span data-testid="chip--ai-chat-card-remaining">
              {t.aiChat.card.remaining.replace("{count}", String(card.remaining))}
            </span>
          )}
        </div>

        {tagName && (
          <Badge variant="secondary" className="rounded-xl" data-testid="badge--ai-chat-card-tag">
            {tagName}
          </Badge>
        )}

        <p className="flex items-center gap-1 text-xs font-medium text-primary-ink">
          {t.aiChat.card.viewDetail}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </p>
      </div>
    </button>
  );
}
