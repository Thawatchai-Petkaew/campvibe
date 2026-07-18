/**
 * components/ai-chat/AiChatCampCard.tsx — CAM-272
 *
 * BR-4 (Critical): reuses `CampgroundCard` (compact variant — no wishlist
 * heart, no carousel) as the ONLY visual for an in-chat campsite card; no
 * parallel card style (CAM-249). Maps the CAM-271 wire card
 * (`AiChatCardResponse`) onto `CampgroundCardData` at this one boundary —
 * both are already the same JSON-serialised shape (lib/api-client.ts), so
 * no synthetic/placeholder fields are needed (design.md §Seams).
 *
 * CAM-272 QA fix (Important): passes `avgRating`/`reviewCount` through so
 * the card shows the same rating badge every other CampgroundCard renders
 * (design.md "keeps the same visual language").
 */
"use client";

import { CampgroundCard } from "@/components/CampgroundCard";
import type { AiChatCardResponse } from "@/lib/api-client";

export function AiChatCampCard({ card }: { card: AiChatCardResponse }) {
  return (
    <CampgroundCard
      campground={{
        id: card.id,
        nameTh: card.nameTh,
        nameEn: card.nameEn,
        nameThSlug: card.nameThSlug,
        nameEnSlug: card.nameEnSlug,
        priceLow: card.priceLow,
        createdAt: card.createdAt,
        location: card.location,
        images: card.images,
      }}
      avgRating={card.avgRating}
      reviewCount={card.reviewCount}
      variant="compact"
      priority={false}
    />
  );
}
