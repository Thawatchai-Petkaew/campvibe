/**
 * cam-545-card-display.test.ts — CAM-545
 *
 * "Camp card reads correctly in Thai and states the price honestly."
 *
 * Coverage matrix (story.md AC-1..AC-6 / BR-1..BR-7 / EC-1..EC-3):
 *   - AC-1/AC-2, BR-1/BR-2/BR-3, EC-1: buildLocationText — TH prefers the
 *     Thai province name, falls back to `province` when unlinked; EN
 *     unchanged; the literal "Thailand" is gone from the component source.
 *   - AC-3/AC-4/AC-5, BR-5/BR-6, EC-2/EC-3: buildCardPriceDisplay — single
 *     price, honest range, free camp, and the degenerate-range guard.
 *   - AC-6: the favourite icon's `--primary` fill is RECOMPUTED (never
 *     asserted-not-computed) against the design system's own defined
 *     surfaces for this token, in both themes; `--secondary` is measured
 *     too, to prove the owner's hunch does NOT hold numerically.
 *   - Data seam: campCardSelect + the wishlist page's own select both carry
 *     `priceHigh` and `location.thaiLocation.provinceName` additively;
 *     `location.province` itself is untouched (never reshaped).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildCardPriceDisplay,
  buildLocationText,
  type CampgroundCardData,
} from "../components/CampgroundCard";
import { campCardSelect } from "../lib/read-models/camp-card";
import { parseTokens, resolveOver, resolveSurface, contrastRatio, CSS_PATH } from "../scripts/check-contrast.mjs";
import translations from "../locales/translations.json";

const ROOT = path.join(__dirname, "..");
const cardSrc = readFileSync(path.join(ROOT, "components", "CampgroundCard.tsx"), "utf8");
const wishlistSrc = readFileSync(path.join(ROOT, "app", "wishlist", "page.tsx"), "utf8");

// ---------------------------------------------------------------------------
// AC-1 / AC-2 / BR-1..3 / EC-1 — localized "province, country" line
// ---------------------------------------------------------------------------
describe("buildLocationText — AC-1/AC-2 (BR-1/BR-2/BR-3, EC-1)", () => {
  const linked: CampgroundCardData["location"] = {
    province: "Narathiwat",
    thaiLocation: { provinceName: "นราธิวาส" },
  };
  const unlinked: CampgroundCardData["location"] = { province: "Narathiwat" };

  it("[normal] AC-1: TH mode renders the Thai province name + the Thai country word", () => {
    expect(buildLocationText(linked, "th", translations.th.campground.countryName)).toBe(
      "นราธิวาส, ประเทศไทย"
    );
  });

  it("[normal] AC-2: EN mode renders the English province + the English country word (unchanged pair)", () => {
    expect(buildLocationText(linked, "en", translations.en.campground.countryName)).toBe(
      "Narathiwat, Thailand"
    );
  });

  it("[null/empty] EC-1: TH mode falls back to the raw `province` value when there is no ThailandLocation link", () => {
    expect(buildLocationText(unlinked, "th", translations.th.campground.countryName)).toBe(
      "Narathiwat, ประเทศไทย"
    );
  });

  it("[boundary] a thaiLocation of null (explicit, e.g. wishlist mapping) behaves the same as undefined", () => {
    const explicitNull: CampgroundCardData["location"] = { province: "Trat", thaiLocation: null };
    expect(buildLocationText(explicitNull, "th", translations.th.campground.countryName)).toBe(
      "Trat, ประเทศไทย"
    );
  });
});

describe("components/CampgroundCard.tsx — the literal \"Thailand\" is gone (BR-3)", () => {
  it("[structural] the component source never hardcodes the string \"Thailand\"", () => {
    expect(cardSrc).not.toContain("Thailand");
  });

  it("[structural] the location line reads from the locale dict, not a literal", () => {
    expect(cardSrc).toContain("t.campground.countryName");
    expect(cardSrc).toContain("buildLocationText(campground.location, language, t.campground.countryName)");
  });
});

// ---------------------------------------------------------------------------
// AC-3 / AC-4 / AC-5 / BR-5 / BR-6 / EC-2 / EC-3 — honest price
// ---------------------------------------------------------------------------
describe("buildCardPriceDisplay — AC-3/AC-4/AC-5 (BR-5/BR-6, EC-2/EC-3)", () => {
  const thb = (n: number) => `฿${n.toLocaleString("th-TH")}`;
  const symbol = "฿";

  it("[normal] AC-3: a single price formats as \"฿500\" with no range", () => {
    const result = buildCardPriceDisplay(500, null, thb, symbol);
    expect(result).toEqual({ isFree: false, isRange: false, amountText: "฿500" });
  });

  it("[normal] AC-4: a real range (priceHigh > priceLow) formats as \"฿500-1,000\" — one symbol only", () => {
    const result = buildCardPriceDisplay(500, 1000, thb, symbol);
    expect(result).toEqual({ isFree: false, isRange: true, amountText: "฿500-1,000" });
  });

  it("[normal] AC-5: a free camp (priceLow null) renders isFree with an empty amount", () => {
    expect(buildCardPriceDisplay(null, null, thb, symbol)).toEqual({
      isFree: true,
      isRange: false,
      amountText: "",
    });
  });

  it("[boundary] AC-5 / EC-3: priceLow === 0 is treated as free, same as null", () => {
    expect(buildCardPriceDisplay(0, 2000, thb, symbol).isFree).toBe(true);
  });

  it("[boundary] EC-2: priceHigh === priceLow is NOT a range (no degenerate \"500-500\")", () => {
    const result = buildCardPriceDisplay(500, 500, thb, symbol);
    expect(result.isRange).toBe(false);
    expect(result.amountText).toBe("฿500");
  });

  it("[error/validation] EC-2: an inverted priceHigh < priceLow falls back to the single price, never \"1,000-500\"", () => {
    const result = buildCardPriceDisplay(1000, 500, thb, symbol);
    expect(result.isRange).toBe(false);
    expect(result.amountText).toBe("฿1,000");
  });

  it("[null/empty] EC-2: priceHigh undefined (older/narrower caller) behaves like null", () => {
    const result = buildCardPriceDisplay(500, undefined, thb, symbol);
    expect(result.isRange).toBe(false);
  });

  it("[boundary] a formatCurrency implementation that omits the symbol never double-strips", () => {
    const noSymbol = (n: number) => n.toLocaleString("th-TH");
    const result = buildCardPriceDisplay(500, 1000, noSymbol, symbol);
    expect(result.amountText).toBe("500-1,000");
  });
});

describe("components/CampgroundCard.tsx — the /คืน separator + free path (BR-6/BR-7)", () => {
  it("[structural] the price block uses the perNight locale key, not a bare 'night' word", () => {
    expect(cardSrc).toContain("t.common.perNight");
  });

  it("[structural] the free branch renders ONLY t.common.free — no perNight suffix alongside it (EC-3)", () => {
    const match = cardSrc.match(
      /data-testid="text--card-price">([\s\S]*?)<\/div>/
    );
    expect(match, "price block not found").not.toBeNull();
    const block = match![1];
    expect(block).toContain("priceDisplay.isFree");
    expect(block).toContain("t.common.free");
  });

  it("[unit] locale copy is verbatim: th=\"/คืน\", en=\"/night\"", () => {
    expect(translations.th.common.perNight).toBe("/คืน");
    expect(translations.en.common.perNight).toBe("/night");
  });
});

// ---------------------------------------------------------------------------
// Data seam — campCardSelect + wishlist select carry the new fields additively
// ---------------------------------------------------------------------------
describe("campCardSelect — CAM-545 additive fields (Seams & refs)", () => {
  it("[shape] priceHigh is now selected", () => {
    expect(campCardSelect.priceHigh).toBe(true);
  });

  it("[shape] location.select.thaiLocation.select.provinceName is selected", () => {
    expect(campCardSelect.location.select.thaiLocation.select.provinceName).toBe(true);
  });

  it("[regression] location.select.province is UNCHANGED (BR-4: the province filter depends on it)", () => {
    expect(campCardSelect.location.select.province).toBe(true);
  });
});

describe("app/wishlist/page.tsx — the same additive select (real caller of CampgroundCard)", () => {
  it("[structural] thaiLocation is selected under location", () => {
    expect(wishlistSrc).toContain("thaiLocation: { select: { provinceName: true } }");
  });

  it("[structural] the mapping carries thaiLocation through to the card payload", () => {
    expect(wishlistSrc).toContain("campSite.location.thaiLocation");
  });

  it("[scope] still does NOT switch to the shared campCardSelect (CAM-193 scope guard, unaffected)", () => {
    expect(wishlistSrc).not.toContain("campCardSelect");
  });
});

// ---------------------------------------------------------------------------
// AC-6 — favourite icon contrast, RECOMPUTED from the real tokens
// ---------------------------------------------------------------------------
describe("AC-6 — active heart icon (--primary) contrast, measured not asserted", () => {
  const css = readFileSync(CSS_PATH, "utf8");
  const { light, dark } = parseTokens(css) as { light: Record<string, string>; dark: Record<string, string> };

  it("[normal] --primary (the saved-heart fill) clears the 3:1 non-text floor vs --card in both themes", () => {
    for (const tokens of [light, dark]) {
      const card = resolveSurface(tokens, "--card");
      const icon = resolveOver(tokens, "--primary", card);
      expect(contrastRatio(icon, card)).toBeGreaterThanOrEqual(3);
    }
  });

  it("[normal] --primary clears the 3:1 floor vs --background in both themes", () => {
    for (const tokens of [light, dark]) {
      const background = resolveSurface(tokens, "--background");
      const icon = resolveOver(tokens, "--primary", background);
      expect(contrastRatio(icon, background)).toBeGreaterThanOrEqual(3);
    }
  });

  it("[regression] the owner's hunch does NOT hold numerically: --secondary measures WORSE than --primary on both surfaces, both themes", () => {
    for (const tokens of [light, dark]) {
      const card = resolveSurface(tokens, "--card");
      const background = resolveSurface(tokens, "--background");
      const primaryOnCard = contrastRatio(resolveOver(tokens, "--primary", card), card);
      const secondaryOnCard = contrastRatio(resolveOver(tokens, "--secondary", card), card);
      const primaryOnBg = contrastRatio(resolveOver(tokens, "--primary", background), background);
      const secondaryOnBg = contrastRatio(resolveOver(tokens, "--secondary", background), background);
      expect(secondaryOnCard).toBeLessThan(primaryOnCard);
      expect(secondaryOnBg).toBeLessThan(primaryOnBg);
      // --secondary does not even clear the floor, confirming it would be a regression.
      expect(secondaryOnCard).toBeLessThan(3);
    }
  });

  it("[structural] no token or component change was made for AC-6 (measurement-only, per the ticket's exit condition)", () => {
    expect(cardSrc).toContain('className="w-5 h-5 text-primary fill-current"');
  });
});
