/**
 * components/ai-chat/AiChatCardCarousel.tsx — CAM-409
 *
 * Replaces CAM-272's vertical `space-y-3` card stack with a horizontal
 * snap-scroll strip (~1.5 cards visible, next card peeking). Renders the
 * CAM-428 dedicated `AiChatCampCard` — the layout container itself is
 * unchanged (design.md addendum to CAM-272, SUPERSEDES its single-column
 * layout rule).
 *
 * CAM-428: `AiChatCampCard` no longer bakes in a navigation link (it takes
 * an `onSelect` prop, BR-4 exception) — this carousel is the one call site
 * that owns "what selecting a card does" for THIS story.
 *
 * CAM-447 (SUPERSEDES the CAM-428/CAM-409 navigate-on-select behavior): the
 * carousel no longer navigates itself — selecting a card forwards the full
 * card object to the caller-supplied `onSelectCamp` prop, which
 * `AiChatPanel` uses to open the in-chat floating detail card
 * (`AiChatDetailCard`). The slug/navigation logic now lives on that card's
 * own CTA (`/campgrounds/{slug}` deep-link), not here.
 *
 * BR-1/EC-1: chrome (chevrons + indicator) renders only when cards.length > 1;
 * exactly 1 card renders with no carousel chrome at all.
 * BR-3/EC-2/EC-3: Prev/Next disable at the scroll ends; programmatic scroll
 * is motion-safe only (prefers-reduced-motion -> instant, no smooth-scroll).
 * BR-4: copy from the `aiChat` i18n namespace; the {cur}/{N} counter is a
 * language-neutral numeral pair, aria-hidden (meaning carried by the group
 * aria-label).
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { AiChatCampCard } from "@/components/ai-chat/AiChatCampCard";
import type { AiChatCardResponse } from "@/lib/api-client";

/** >5 cards switches the indicator from dots to a "{cur}/{N}" counter (design.md §Indicator). */
const MAX_DOTS = 5;

interface AiChatCardCarouselProps {
  cards: AiChatCardResponse[];
  /** CAM-447 — opens the floating detail card for the tapped campsite. */
  onSelectCamp: (card: AiChatCardResponse) => void;
}

export function AiChatCardCarousel({ cards, onSelectCamp }: AiChatCardCarouselProps) {
  const { t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /**
   * Derives the snapped card index + start/end (for chevron disabled state)
   * from the real scroll position. Compares by CARD INDEX, not a raw
   * scrollLeft/0 threshold — the track's own `px-4` edge padding (BR-2) means
   * the "resting" scrollLeft at card 1 is the padding width, not 0.
   */
  const syncFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const items = Array.from(track.children) as HTMLElement[];
    if (items.length === 0) return;
    const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : items[0].offsetWidth;
    const rawIndex = step > 0 ? Math.round((track.scrollLeft - items[0].offsetLeft) / step) : 0;
    const clampedIndex = Math.min(Math.max(rawIndex, 0), items.length - 1);
    setIndex(clampedIndex);
    setAtStart(clampedIndex <= 0);
    setAtEnd(clampedIndex >= items.length - 1);
  }, []);

  useEffect(() => {
    syncFromScroll();
  }, [cards.length, syncFromScroll]);

  const scrollByOneCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const items = Array.from(track.children) as HTMLElement[];
    const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth;
    // EC-3: no explicit `behavior` — "auto" defers to the track's own CSS
    // `scroll-behavior` (motion-safe:scroll-smooth), so prefers-reduced-motion
    // gives an instant jump instead of a forced JS-smooth scroll.
    track.scrollBy({ left: direction * step });
  };

  if (cards.length === 0) return null;

  // EC-1/BR-1: exactly 1 card -> the single card, no carousel chrome at all.
  if (cards.length === 1) {
    return (
      <div data-testid="card--ai-chat-campsite" className="w-full max-w-full">
        <AiChatCampCard card={cards[0]} onSelect={onSelectCamp} />
      </div>
    );
  }

  const groupLabel = t.aiChat.cardsLabel.replace("{count}", String(cards.length));

  return (
    // grid-cols-1 (Tailwind's minmax(0,1fr)) — not a plain block/flex — so
    // this item's own width is capped to the answer row's column instead of
    // growing to the track's un-shrinkable min-content (all cards, un-clipped).
    <div className="grid w-full max-w-full min-w-0 grid-cols-1">
      <div
        ref={trackRef}
        role="group"
        aria-roledescription={t.aiChat.cardsRoleDescription}
        aria-label={groupLabel}
        data-testid="carousel--ai-chat-cards"
        onScroll={syncFromScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-4 no-scrollbar motion-safe:scroll-smooth"
      >
        {cards.map((card) => (
          <div key={card.id} data-testid="card--ai-chat-campsite" className="w-64 shrink-0 snap-start sm:w-60">
            <AiChatCampCard card={card} onSelect={onSelectCamp} />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full"
          aria-label={t.aiChat.cardsPrev}
          data-testid="btn--ai-chat-cards-prev"
          disabled={atStart}
          onClick={() => scrollByOneCard(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>

        <div
          aria-hidden="true"
          data-testid="status--ai-chat-cards-position"
          className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground"
        >
          {cards.length > MAX_DOTS
            ? `${index + 1}/${cards.length}`
            : cards.map((card, i) => (
                <span
                  key={card.id}
                  className={
                    i === index
                      ? "h-1.5 w-1.5 rounded-full bg-primary"
                      : "h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
                  }
                />
              ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full"
          aria-label={t.aiChat.cardsNext}
          data-testid="btn--ai-chat-cards-next"
          disabled={atEnd}
          onClick={() => scrollByOneCard(1)}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
