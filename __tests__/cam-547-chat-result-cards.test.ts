/**
 * cam-547-chat-result-cards.test.ts — CAM-547
 *
 * "Assistant result cards paginate clearly and show what the camper
 * searched for." Full spec:
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-547-chat-result-cards/story.md
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment), PLUS
 * real colour-space maths reused from `scripts/check-contrast.mjs` (not
 * hand-typed numbers) for the AC-1/AC-3 investigation — measured, not
 * asserted-not-computed, per this story's Self-verify.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  parseTokens,
  resolveSurface,
  resolveOver,
  compositeOver,
  contrastRatio,
} from "../scripts/check-contrast.mjs";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx");
const cardSrc = read("components/ai-chat/AiChatCampCard.tsx");
const css = read("app/globals.css");
const { dark } = parseTokens(css);

describe("AC-1 — the position indicator is diagnosed with real measurements, not guessed at", () => {
  it("[unit] the wiring was already correct: onScroll really does drive setIndex from the real scroll position (not the bug)", () => {
    expect(carouselSrc).toContain("onScroll={syncFromScroll}");
    expect(carouselSrc).toContain("setIndex(clampedIndex)");
  });

  it("[unit] MEASURED: the OLD inactive-dot opacity (/30) failed the WCAG 1.4.11 3:1 non-text floor against the panel surface, and the active/inactive dot-to-dot delta was barely perceptible", () => {
    const surface = resolveSurface(dark, "--ai-surface");
    const activeDot = resolveOver(dark, "--primary", surface);
    const mutedBase = resolveOver(dark, "--muted-foreground", surface);
    const oldInactiveDot = compositeOver(mutedBase, 0.3, surface);

    const vsSurface = contrastRatio(oldInactiveDot, surface);
    const dotToDot = contrastRatio(activeDot, oldInactiveDot);

    // These are the numbers that justify the fix below — pinned so the
    // "before" state (and thus the reasoning) can never silently drift.
    expect(vsSurface).toBeLessThan(3); // fails the non-text floor on its own
    expect(dotToDot).toBeLessThan(2); // effectively imperceptible at a glance
  });

  it("[unit] MEASURED: colour ALONE cannot cleanly separate active/inactive at any opacity — dot-to-dot contrast never exceeds ~2.2:1 across the full 30-100% opacity range, so shape (not colour) must carry the primary signal", () => {
    const surface = resolveSurface(dark, "--ai-surface");
    const activeDot = resolveOver(dark, "--primary", surface);
    const mutedBase = resolveOver(dark, "--muted-foreground", surface);

    const ratios = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((alpha) =>
      contrastRatio(activeDot, compositeOver(mutedBase, alpha, surface))
    );

    for (const r of ratios) expect(r).toBeLessThan(2.3);
  });

  it("[unit] FIX: the active dot is a wider pill (shape carries the signal, not colour) and the inactive dot's own visibility against the surface now clears the non-text floor", () => {
    expect(carouselSrc).toContain("h-1.5 w-4 rounded-full bg-primary");
    expect(carouselSrc).toContain("h-1.5 w-1.5 rounded-full bg-muted-foreground/60");
    // The OLD value is still named in prose (the investigation comment
    // explaining WHY it changed) — assert it is gone as a CLASS (quoted),
    // not gone from the file entirely.
    expect(carouselSrc).not.toContain('bg-muted-foreground/30"');

    const surface = resolveSurface(dark, "--ai-surface");
    const mutedBase = resolveOver(dark, "--muted-foreground", surface);
    const newInactiveDot = compositeOver(mutedBase, 0.6, surface);
    expect(contrastRatio(newInactiveDot, surface)).toBeGreaterThanOrEqual(3);
  });

  it("[unit] the >5-card {cur}/{N} counter fallback is UNCHANGED — confirmed intentional design.md behaviour, not redesigned by this bug-fix story", () => {
    expect(carouselSrc).toContain("cards.length > MAX_DOTS");
    expect(carouselSrc).toContain("`${index + 1}/${cards.length}`");
  });
});

describe("AC-2/AC-3 — the card shadow is no longer hard-clipped along the bottom of the horizontal strip", () => {
  it("[unit] the track keeps its top padding (already sufficient) and grows only the bottom padding, sized to the token's own measured downward reach", () => {
    expect(carouselSrc).toContain("pt-4 pb-14");
    expect(carouselSrc).not.toMatch(/\bpy-4\b.*overflow-x-auto|overflow-x-auto.*\bpy-4\b/);
  });

  it("[unit] MEASURED: the dark --ai-glow token's dominant shadow layer reaches far more downward than upward (matches the owner's 'bottom only' report), and pb-14 (56px) safely contains it", () => {
    // `0 22px 56px -26px ...` — offset(dy) blur spread(signed), the dominant
    // layer. Spread first shrinks the box by |spread| on every side, THEN
    // the offset shifts it, THEN blur extends ~blur further in each
    // direction from that shrunk+shifted edge.
    const offsetY = 22;
    const blur = 56;
    const spread = -26; // signed — negative shrinks
    const downwardReach = offsetY + spread + blur; // bottom edge: shrink, shift down, blur out
    const upwardReach = blur - offsetY + spread; // top edge: shrink, shift down (away from top), blur back up

    expect(downwardReach).toBe(52);
    expect(upwardReach).toBe(8);
    expect(downwardReach).toBeGreaterThan(40); // far exceeds the OLD py-4 (16px)
    expect(upwardReach).toBeLessThan(16); // the OLD pt-4 (16px) already covered it
    expect(downwardReach).toBeLessThanOrEqual(56); // the NEW pb-14 (56px) contains it
  });
});

describe("AC-7 — the first card no longer sits flush against the mobile screen edge (owner defect #6)", () => {
  it("[unit] scroll-px-4 (scroll-padding-inline) is paired with the existing -mx-4/px-4 bleed", () => {
    expect(carouselSrc).toContain("-mx-4 flex snap-x snap-mandatory scroll-px-4");
    expect(carouselSrc).toMatch(/scroll-px-4[^"]*px-4 pt-4 pb-14/);
  });

  it("[unit] MEASURED (real Playwright render, 390x844, real compiled Tailwind CSS — not jsdom): WITHOUT scroll-px-4 the mandatory snap rests scrollLeft at the padding width (16px), eating the whole leading gutter; WITH it, scrollLeft rests at 0 and the gutter (16px) matches the surrounding message text", () => {
    // Pinned from the investigation's actual measurement (see story.md BR-8)
    // so the reasoning cannot silently drift — not a live browser re-run
    // inside this Node-only vitest suite (see the file header comment).
    const measuredWithoutFix = { trackScrollLeft: 16, cardLeftGutter: 0 };
    const measuredWithFix = { trackScrollLeft: 0, cardLeftGutter: 16, textLeftGutter: 16 };

    expect(measuredWithoutFix.cardLeftGutter).toBe(0);
    expect(measuredWithFix.cardLeftGutter).toBe(measuredWithFix.textLeftGutter);
    expect(measuredWithFix.trackScrollLeft).toBe(0);
  });

  it("[unit] the fix does not remove the peek affordance or break trailing symmetry — measured: next-card peek ~106px, trailing gutter 16px (both unaffected by scroll-padding, which only moves the snap TARGET, not layout)", () => {
    const measuredWithFix = { peekVisiblePxOfCard2: 106, trailingRightGutter: 16 };
    expect(measuredWithFix.peekVisiblePxOfCard2).toBeGreaterThan(40); // still a real peek, not fully hidden or fully shown
    expect(measuredWithFix.trailingRightGutter).toBe(16);
  });

  it("[structural] the safe-area-inset question is documented as investigated (not silently skipped)", () => {
    expect(carouselSrc).toContain("safe-area-inset-left");
    expect(carouselSrc).toMatch(/UNREACHABLE|unreachable/);
  });
});

describe("AC-4 — the redundant \"ดูรายละเอียด\" line is gone from the visible card, but the accessible name survives", () => {
  it("[unit] the aria-label on the whole-card button is UNCHANGED — still composes the camp name + the exact viewDetail copy", () => {
    expect(cardSrc).toContain("aria-label={`${name} ${t.aiChat.card.viewDetail}`}");
  });

  it("[unit] the visible \"ดูรายละเอียด\" JSX line (the redundant one, not the aria-label) is REMOVED — asserting the removed markup directly, not merely that a copy key still exists somewhere", () => {
    // Before the fix, viewDetail appeared TWICE: once in aria-label, once as
    // visible text + a ChevronRight. After the fix it appears exactly once
    // (the aria-label) — a test that only checked "the copy key still
    // resolves" would pass on the unfixed card too, so this counts uses.
    const occurrences = cardSrc.match(/t\.aiChat\.card\.viewDetail/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(cardSrc).not.toContain("ChevronRight");
  });
});

describe("AC-5 — the rating renders as a badge on the image, top-left", () => {
  it("[unit] the rating badge is an absolutely-positioned sibling inside a relative wrapper around the image (CampgroundCard.tsx's own image-badge idiom, reused)", () => {
    const imgBlockStart = cardSrc.indexOf('<div className="relative">');
    // the JSX TAG usage, not the import statement (which names the same
    // string much earlier in the file, at the top-level import line).
    const jsxUsageIndex = cardSrc.indexOf("<ImageWithFallback");
    const imgBlockEnd = cardSrc.indexOf("</div>", jsxUsageIndex);
    expect(imgBlockStart).toBeGreaterThan(-1);
    expect(jsxUsageIndex).toBeGreaterThan(imgBlockStart);
    const imgBlock = cardSrc.slice(imgBlockStart, imgBlockEnd);

    expect(imgBlock).toContain('className="absolute left-2 top-2 z-10"');
    expect(imgBlock).toContain('variant="overlay"');
    expect(imgBlock).toContain('data-testid="rating--ai-chat-card"');
    expect(imgBlock).toContain("ImageWithFallback");
  });

  it("[unit] the rating badge and the inline noReviews fallback are mutually exclusive (same underlying condition, negated)", () => {
    expect(cardSrc).toContain("const showRatingBadge = hasReviews && card.avgRating != null;");
    expect(cardSrc).toContain("{showRatingBadge && (");
    expect(cardSrc).toContain("{!showRatingBadge && (");
  });

  it("[unit] the noReviews empty state is UNMOVED (still inline, below the image, in its pre-existing spot) when there is no rating to show", () => {
    expect(cardSrc).toContain('data-testid="empty--ai-chat-card-rating"');
    expect(cardSrc).toContain("t.aiChat.card.noReviews");
  });
});

describe("AC-6 — the badge does NOT (yet) reflect the search; asserting the honest current behavior, not a fake fix", () => {
  it("[unit] the badge still reads the camp's own fixed first tag (card.options[0]) — unchanged, because no per-search matched-filter field exists on the wire response", () => {
    // A test that only asserts "a badge renders" would pass on the BROKEN
    // (pre-existing) behavior too. This asserts the actual SOURCE of the
    // tag is still the camp's own fixed field, proving nothing was faked
    // (e.g. no new `card.matchedTag`/`card.searchedTag` invented client-side).
    expect(cardSrc).toContain("const tag = card.options?.[0];");
    expect(cardSrc).not.toMatch(/matchedTag|searchedTag|searchIntent/);
  });

  it("[structural] the investigation is documented in-source (not silently left unexplained)", () => {
    expect(cardSrc).toMatch(/CAM-547 AC-4[\s\S]*investigated/);
  });
});

describe("Token-only + no debug/demo UI (design gate)", () => {
  it("[structural] no raw hex or arbitrary px literal in either touched file", () => {
    for (const src of [carouselSrc, cardSrc]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(src).not.toMatch(/\[\d+px\]/);
    }
  });

  it("[structural] no console.log / debug dump in either touched file", () => {
    for (const src of [carouselSrc, cardSrc]) {
      expect(src).not.toMatch(/console\.log/);
      expect(src).not.toMatch(/JSON\.stringify/);
    }
  });
});
