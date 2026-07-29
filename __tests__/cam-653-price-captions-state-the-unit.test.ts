/**
 * cam-653-price-captions-state-the-unit.test.ts — CAM-653 (epic CAM-648,
 * ADR-014): "Every price on screen says what it is charged per."
 *
 * SUPERSEDES __tests__/cam-643-chat-price-per-night.test.ts (deleted in this
 * same PR). What CAM-643 got right: a private per-surface copy of the
 * per-night suffix is exactly how two captions drift apart (the chat's
 * `aiChat.detail.statPriceLabel`/`perGuestNight` quoted a per-guest unit
 * while pricing was strictly per-night) — consolidating onto ONE shared key
 * is the correct structural fix. What CAM-643 got wrong: it expressed that
 * fix as a repo-wide STRING BAN (`expect(raw).not.toContain("ต่อคน/คืน")`),
 * which blocks the very copy CAM-653 must now add, because the engine really
 * did learn to charge PER_PERSON (CAM-651/652) and a host really will be
 * able to choose it (CAM-654) — the string was never the problem; a PRIVATE
 * DUPLICATE of it was. This file asserts the stronger, correct guard: one
 * shared, unit-keyed copy group under `common`, and every price caption
 * reads through the ONE helper module that indexes it — never a private
 * key, never a hardcoded literal in a component.
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment); the
 * "renders each caption" requirement is proven by calling the actual pure
 * helper functions (`priceUnitSuffix`/`priceUnitWord`) that every call site
 * reads through, over a fixture of all three units — equivalent proof to
 * rendering, without needing a DOM.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";
import { getTranslations } from "../locales/translations";
import { priceUnitSuffix, priceUnitWord } from "../lib/price-unit-display";
import type { PricingUnit } from "../lib/booking-pricing";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const ALL_UNITS: readonly PricingUnit[] = ["PER_PERSON", "PER_TENT", "PER_SITE"];

const componentSources = {
  campgroundCard: read("components/CampgroundCard.tsx"),
  detailClient: read("components/CampgroundDetailClient.tsx"),
  aiCampCard: read("components/ai-chat/AiChatCampCard.tsx"),
  aiDetailCard: read("components/ai-chat/AiChatDetailCard.tsx"),
  // CAM-664 (S2) moved the per-spot price/unit expression (byte-identical,
  // per story.md) out of CampgroundDetailClient.tsx and into the new spot
  // strip card — see components/spot-viewer/SpotStrip.tsx.
  spotStrip: read("components/spot-viewer/SpotStrip.tsx"),
};

// ---------------------------------------------------------------------------
// 1. The shared copy table — exact values, both locales
// ---------------------------------------------------------------------------
describe("common.priceUnitSuffix / common.priceUnitLabel — the ONE shared copy table", () => {
  it("[normal] th values are verbatim, no em-dash", () => {
    const th = translations.th.common;
    expect(th.priceUnitSuffix.PER_PERSON).toBe("/คน/คืน");
    expect(th.priceUnitSuffix.PER_TENT).toBe("/หลัง/คืน");
    expect(th.priceUnitSuffix.PER_SITE).toBe("/คืน");
    expect(th.priceUnitLabel.PER_PERSON).toBe("ต่อคน/คืน");
    expect(th.priceUnitLabel.PER_TENT).toBe("ต่อหลัง/คืน");
    expect(th.priceUnitLabel.PER_SITE).toBe("ต่อคืน");
    for (const group of [th.priceUnitSuffix, th.priceUnitLabel]) {
      for (const value of Object.values(group)) {
        expect(value).not.toContain("—");
        expect(value).not.toContain("ครับ");
        expect(value).not.toContain("ค่ะ");
      }
    }
  });

  it("[normal] en values are verbatim", () => {
    const en = translations.en.common;
    expect(en.priceUnitSuffix.PER_PERSON).toBe("/guest/night");
    expect(en.priceUnitSuffix.PER_TENT).toBe("/tent/night");
    expect(en.priceUnitSuffix.PER_SITE).toBe("/night");
    expect(en.priceUnitLabel.PER_PERSON).toBe("per guest / night");
    expect(en.priceUnitLabel.PER_TENT).toBe("per tent / night");
    expect(en.priceUnitLabel.PER_SITE).toBe("per night");
  });

  it("[the safety property] common.perNight === common.priceUnitSuffix.PER_SITE in both locales — the two can never drift apart again", () => {
    expect(translations.th.common.perNight).toBe(translations.th.common.priceUnitSuffix.PER_SITE);
    expect(translations.en.common.perNight).toBe(translations.en.common.priceUnitSuffix.PER_SITE);
  });
});

// ---------------------------------------------------------------------------
// 2. The shared helper — the ONE place every caption reads the table from
// ---------------------------------------------------------------------------
describe("lib/price-unit-display.ts — priceUnitSuffix / priceUnitWord (proof-by-call, no DOM needed)", () => {
  const th = getTranslations("th");
  const en = getTranslations("en");

  it("[normal] priceUnitSuffix renders the right string for all three units, both locales", () => {
    for (const unit of ALL_UNITS) {
      expect(priceUnitSuffix(th, unit)).toBe(th.common.priceUnitSuffix[unit]);
      expect(priceUnitSuffix(en, unit)).toBe(en.common.priceUnitSuffix[unit]);
    }
    // concrete values, not just table round-trip
    expect(priceUnitSuffix(th, "PER_PERSON")).toBe("/คน/คืน");
    expect(priceUnitSuffix(th, "PER_TENT")).toBe("/หลัง/คืน");
    expect(priceUnitSuffix(th, "PER_SITE")).toBe("/คืน");
  });

  it("[null/empty] priceUnitSuffix defaults null/undefined to PER_SITE (matches the column default + resolveUnitPrice's normalizeUnit)", () => {
    expect(priceUnitSuffix(th, null)).toBe("/คืน");
    expect(priceUnitSuffix(th, undefined)).toBe("/คืน");
  });

  it("[normal] priceUnitWord keeps the exact legacy common.night word for PER_SITE, and the fuller shared label for other units", () => {
    expect(priceUnitWord(th, "PER_SITE")).toBe(th.common.night); // "คืน" — byte-identical to before this story
    expect(priceUnitWord(en, "PER_SITE")).toBe(en.common.night); // "night"
    expect(priceUnitWord(th, "PER_PERSON")).toBe("ต่อคน/คืน");
    expect(priceUnitWord(th, "PER_TENT")).toBe("ต่อหลัง/คืน");
  });

  it("[null/empty] priceUnitWord defaults null/undefined to the PER_SITE word", () => {
    expect(priceUnitWord(th, null)).toBe("คืน");
    expect(priceUnitWord(th, undefined)).toBe("คืน");
  });

  it("[boundary] the two renderings genuinely differ for the same non-default unit (proves this isn't a no-op abstraction)", () => {
    expect(priceUnitSuffix(th, "PER_PERSON")).not.toBe(priceUnitWord(th, "PER_PERSON"));
  });
});

// ---------------------------------------------------------------------------
// 3. Zero visual diff while every row is PER_SITE (the safety property)
// ---------------------------------------------------------------------------
describe("[the safety property] every caption is byte-identical to before this story when every row is PER_SITE", () => {
  const th = getTranslations("th");

  it("[normal] the suffix-style captions (card / ai-chat) render the exact pre-existing '/คืน'", () => {
    expect(priceUnitSuffix(th, "PER_SITE")).toBe("/คืน");
    expect(priceUnitSuffix(th, undefined)).toBe("/คืน"); // ai-chat cards: lib/ai/** doesn't send priceUnit yet
  });

  it("[normal] the word-style captions (detail headline / per-spot list) render the exact pre-existing 'คืน'", () => {
    expect(priceUnitWord(th, "PER_SITE")).toBe("คืน");
  });

  it("[structural] every listed call site reads through the shared helper, not a hardcoded literal", () => {
    expect(componentSources.campgroundCard).toContain("priceUnitSuffix(t, campground.priceUnit)");
    expect(componentSources.detailClient).toContain("priceUnitWord(t, bookingPricingUnit)");
    expect(componentSources.spotStrip).toContain("priceUnitWord(t, spot.priceUnit");
    expect(componentSources.aiCampCard).toContain("priceUnitSuffix(t, card.priceUnit)");
    // AiChatDetailCard: 3 price sites (stat tile label, body price, sticky CTA)
    const detailUses = componentSources.aiDetailCard.match(/priceUnitSuffix\(t, card\.priceUnit\)/g) ?? [];
    expect(detailUses.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 4. Per-spot follows the SPOT's unit; headline follows the CAMP's — they differ
// ---------------------------------------------------------------------------
describe("[boundary] per-spot caption follows the spot's OWN unit, never the camp's — the two can genuinely diverge on one screen", () => {
  it("[structural] the headline reads the camp-level resolved unit (bookingPricingUnit), the per-spot row reads spot.priceUnit — two different sources", () => {
    const headlineIdx = componentSources.detailClient.indexOf("priceUnitWord(t, bookingPricingUnit)");
    const perSpotIdx = componentSources.spotStrip.indexOf("priceUnitWord(t, spot.priceUnit");
    expect(headlineIdx).toBeGreaterThan(-1);
    expect(perSpotIdx).toBeGreaterThan(-1);
    // never the same expression (a copy-paste that repointed both at one source would collapse this)
    expect(componentSources.detailClient.slice(headlineIdx, headlineIdx + 40)).not.toContain("spot.priceUnit");
    expect(componentSources.spotStrip.slice(perSpotIdx, perSpotIdx + 40)).not.toContain("bookingPricingUnit");
  });

  it("[normal] a camp whose CampSite.priceUnit is PER_SITE but a spot's own priceUnit is PER_PERSON renders two DIFFERENT captions on the same screen", () => {
    const th = getTranslations("th");
    const campCaption = priceUnitWord(th, "PER_SITE" as PricingUnit); // headline, camp-level
    const spotCaption = priceUnitWord(th, "PER_PERSON" as PricingUnit); // per-spot list, spot-level
    expect(campCaption).toBe("คืน");
    expect(spotCaption).toBe("ต่อคน/คืน");
    expect(campCaption).not.toBe(spotCaption);
  });
});

// ---------------------------------------------------------------------------
// 5. No private per-surface duplicate (the stronger guard CAM-643 was
//    reaching for) — one key per unit, no bespoke string anywhere else
// ---------------------------------------------------------------------------
describe("[guard] no private per-surface price-unit copy remains anywhere under components/", () => {
  it("[normal] the retired aiChat.card.perNight key no longer exists in either locale", () => {
    const enCard = translations.en.aiChat.card as Record<string, unknown>;
    const thCard = translations.th.aiChat.card as Record<string, unknown>;
    expect(enCard.perNight).toBeUndefined();
    expect(thCard.perNight).toBeUndefined();
  });

  it("[normal] no component file hardcodes a per-guest/per-tent phrase inline (they all read the shared table via the helper)", () => {
    const banned = ["ต่อคน/คืน", "ต่อหลัง/คืน", "/คน/คืน", "/หลัง/คืน", "per guest / night", "per tent / night", "/guest/night", "/tent/night"];
    for (const src of Object.values(componentSources)) {
      for (const phrase of banned) {
        expect(src).not.toContain(phrase);
      }
    }
  });

  it("[normal] no component file re-declares a private perNight-shaped key (the CAM-643 failure mode)", () => {
    for (const src of Object.values(componentSources)) {
      expect(src).not.toMatch(/\bt\.aiChat\.card\.perNight\b/);
      expect(src).not.toMatch(/\bt\.aiChat\.detail\.(statPriceLabel|perGuestNight)\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. PER_TENT exists (enum completeness) even though nothing renders it today
// ---------------------------------------------------------------------------
describe("PER_TENT copy exists for enum completeness (ADR-014 §1 — gated at the zod boundary, not here)", () => {
  it("[boundary] both groups carry all three PricingUnit members in both locales", () => {
    for (const lang of ["en", "th"] as const) {
      const t = getTranslations(lang);
      for (const unit of ALL_UNITS) {
        expect(typeof t.common.priceUnitSuffix[unit]).toBe("string");
        expect(typeof t.common.priceUnitLabel[unit]).toBe("string");
      }
    }
  });
});
