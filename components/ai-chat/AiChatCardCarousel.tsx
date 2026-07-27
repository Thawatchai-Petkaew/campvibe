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
 *
 * CAM-547 (owner defect fixes, 2026-07-26):
 *   - AC-1: the wiring was already correct (`onScroll` -> `syncFromScroll`
 *     -> `setIndex` really does track the snapped card — confirmed by
 *     reading the effect, not assumed). The real defect is CONTRAST, not
 *     wiring: measured with `scripts/check-contrast.mjs`'s own colour maths
 *     against the real dark-theme tokens (the shipped default theme,
 *     CAM-544), the inactive dot (`bg-muted-foreground/30`) is 1.78:1
 *     against the panel surface (`--ai-surface`) — under the WCAG 1.4.11
 *     3:1 non-text floor on its own — and the active-vs-inactive DOT-TO-DOT
 *     delta is only 1.84:1, effectively imperceptible at a glance. Sweeping
 *     the inactive dot's opacity up does not fix the dot-to-dot delta
 *     either (measured 1.04-2.17:1 across 30-100% alpha) because
 *     `--primary` and `--muted-foreground` simply sit too close in
 *     perceptual lightness in dark mode for colour ALONE to carry the
 *     "which one is active" signal — exactly the failure mode design.md's
 *     own a11y section already warns against ("never colour alone"). Fix
 *     is therefore two real, additive, token-only changes: (a) the active
 *     dot becomes a wider pill (`w-4` vs `w-1.5`) — a SHAPE difference that
 *     needs no colour perception at all, which is what actually reads as
 *     "the indicator moved"; (b) the inactive dot's opacity moves 30 -> 60,
 *     which clears the 3:1 floor against the surface on its own (measured
 *     3.40:1) as a genuine secondary improvement. The two-style dots/{n}/{N}
 *     switch above MAX_DOTS is UNCHANGED — that is documented, intentional
 *     design.md behaviour (not a defect) and redesigning it is a Designer
 *     decision, out of this bug-fix's scope.
 *   - AC-2: the track's `overflow-x-auto` forces the browser to compute
 *     `overflow-y` as `auto` too — a card's `shadow-ai-glow` is drawn OUTSIDE
 *     its own border box, so anything beyond the track's own padding-box
 *     gets hard-clipped, and there is no CSS way to keep x-scroll while
 *     leaving y truly `visible` on the same box. Computed from the real dark
 *     `--ai-glow` value (`app/globals.css`): the dominant layer
 *     (`0 22px 56px -26px`) reaches ~8px above the card and ~52px below it
 *     (offset+blur-spread, asymmetric because the offset is downward) — so
 *     the OLD `py-4` (16px both sides) covered the top fine and hard-cropped
 *     the bottom hugely, matching the exact "cropped along the bottom, not
 *     the top" symptom reported. Fix: keep `pt-4` (already enough) and grow
 *     only `pb-14` (56px) to contain the measured downward reach.
 *   - AC-7 (owner defect #6, added mid-story by the coordinator, same
 *     surface): the first card sat flush against the mobile screen edge
 *     with no gutter. Measured with a real Playwright render (390x844,
 *     against the actual compiled Tailwind CSS, not jsdom): `snap-mandatory`
 *     + `snap-start` children on a PADDED scroll container forces the
 *     browser to rest at `scrollLeft = 16` (the padding width) on load, not
 *     0 — visually consuming the entire `-mx-4`/`px-4` gutter (card measured
 *     flush at 0px). This is NOT the same cause as the shadow clip above
 *     (that one is `overflow-x-auto` forcing `overflow-y:auto`; this one is
 *     the scroll-snap engine's own target math) — fixed on the same element
 *     because they happen to live there, not because they share a
 *     mechanism. Fix: `scroll-px-4` (Tailwind's `scroll-padding-inline`
 *     utility, matching the existing `px-4`) shifts the snap target back by
 *     the same 16px; measured after the fix: card gutter 16px (matches the
 *     message text), next-card peek ~106px (unaffected), trailing gutter
 *     after the last card 16px (symmetric). `env(safe-area-inset-left/
 *     right)` was investigated and found UNREACHABLE today: this mobile
 *     edge-bleed only renders inside CAM-550's `max-sm:` (<640px) branch,
 *     and every real phone's landscape width already exceeds 640px, so a
 *     notch's left/right safe-area-inset (landscape-only) can never be
 *     nonzero here — see story.md BR-8 for the full reasoning.
 *
 * CAM-569 (owner defect fix, 2026-07-26): the `{cur}/{N}` pagination counter
 *   (`cards.length > MAX_DOTS`) rendered `text-muted-foreground`, which
 *   CAM-541 measured at 4.40:1 on `--ai-surface` in light mode — under the
 *   4.5:1 body-text floor (the same defect CAM-541 fixed on this panel's
 *   other secondary text; it could not fix it here because this file
 *   belonged to CAM-547). Fix: `text-foreground/70`, CAM-541's own established
 *   remedy (measured 7.41:1 light / 8.69:1 dark on `--ai-surface`) — no new
 *   token. CAM-547's dot indicator (the `cards.length <= MAX_DOTS` branch
 *   below) is untouched: its active-pill/inactive-dot classes set their own
 *   `bg-*` fill and never read this container's text colour, and colour was
 *   already proven insufficient there (CAM-547) — a shape fix, not this
 *   text-contrast fix, is what that case needed.
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
        // CAM-547 AC-2 — pb-14 (was py-4) reserves enough room for the
        // card's own shadow-ai-glow's measured downward reach (~52px) so the
        // track's forced overflow-y:auto no longer hard-clips it; pt-4 is
        // unchanged (the same shadow's upward reach is only ~8px).
        // CAM-547 (owner defect #6) — scroll-px-4 (`scroll-padding-inline`)
        // matches this track's own px-4. Measured with a real Playwright
        // render (390x844): with `snap-mandatory` + snap-start children on a
        // padded scroll container, the browser's mandatory snap forces the
        // RESTING scrollLeft to equal the padding width (16px) on load — not
        // 0 — which visually consumes the whole -mx-4/px-4 gutter (card 1
        // measured flush at the true edge, 0px, matching the owner's
        // report). `scroll-px-4` shifts the snap TARGET back by the same
        // 16px, so the resting scrollLeft returns to 0 and the gutter (16px,
        // measured, matching the surrounding message text) is restored. This
        // is a SEPARATE mechanism from the shadow clip above (that one is
        // `overflow-x-auto` forcing `overflow-y:auto`, unrelated to the
        // horizontal margin/padding at all) — fixed together here only
        // because they live on the same element, not because they share a
        // cause.
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-4 pb-14 no-scrollbar motion-safe:scroll-smooth"
      >
        {cards.map((card) => (
          <div key={card.id} data-testid="card--ai-chat-campsite" className="w-64 shrink-0 snap-start sm:w-60">
            <AiChatCampCard card={card} onSelect={onSelectCamp} />
          </div>
        ))}
      </div>

      {/* CAM-584 — the indicator's own margin is DECOUPLED from the track's
          shadow-clearance padding (pb-14, untouched above). Before this
          fix, the indicator sat `pb-14` (56px) + `mt-2` (8px) = 64px below
          the card's own bottom edge — 40px more than the 24px gap that
          shipped before CAM-547 grew that padding, because pb-14 is a
          reserved SPACE inside the track's own box (needed so its forced
          `overflow-y:auto` never clips the shadow), not a visual position
          for this sibling row. A negative top margin here pulls the row
          back up into that reserved space WITHOUT touching pb-14 at all —
          the track's padding-box (and therefore its overflow-clip
          boundary) is exactly the same size as before this story, so the
          shadow-clearance fix is provably unaffected; only where this
          transparent, non-clipping sibling paints changes. Measured
          (real Chromium, both 390px and 1440px, this story's
          investigation): gap 64px -> 24px, shadow still fully contained
          (52px reach inside the unchanged 56px reserve) — see story.md. */}
      <div className="-mt-8 flex items-center justify-center gap-2">
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
          // CAM-569: the {cur}/{N} counter (rendered only when cards.length >
          // MAX_DOTS) sat on `text-muted-foreground`, the same sub-4.5:1
          // light-mode pair CAM-541 measured and fixed on this panel's other
          // secondary text (`--muted-foreground` on `--ai-surface` = 4.40:1,
          // under the 4.5 floor) — CAM-541 couldn't fix it here because this
          // file belonged to CAM-547. Reusing CAM-541's exact remedy:
          // text-foreground/70 (measured 7.41:1 light / 8.69:1 dark on
          // --ai-surface via scripts/check-contrast.mjs's fgAlpha mechanism).
          // This class colours the counter's text node only — the dots below
          // set their own bg-* classes and are unaffected (CAM-547's shape
          // fix stays exactly as shipped).
          className="flex items-center gap-1.5 text-xs tabular-nums text-foreground/70"
        >
          {cards.length > MAX_DOTS
            ? `${index + 1}/${cards.length}`
            : cards.map((card, i) => (
                // CAM-547 AC-1 — the active dot is a wider PILL (w-4, not
                // just a bigger/differently-coloured dot) so "which one is
                // active" reads from shape alone; the inactive dot's opacity
                // moves 30->60 (measured 3.40:1 vs the panel surface, was
                // 1.78:1) as a real, but secondary, contrast improvement.
                <span
                  key={card.id}
                  className={
                    i === index
                      ? "h-1.5 w-4 rounded-full bg-primary"
                      : "h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
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
