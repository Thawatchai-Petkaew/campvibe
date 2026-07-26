/**
 * cam-545-card-display.test.ts — CAM-545
 *
 * "Camp card reads correctly in Thai and states the price honestly."
 *
 * Coverage matrix (story.md AC-1..AC-6 / BR-1..BR-7 / EC-1..EC-4):
 *   - AC-1/AC-2, BR-1/BR-2/BR-3, EC-1/EC-4: buildLocationText — TH prefers the
 *     Thai province name, falls back to `province` when unmatched; EN
 *     unchanged; district prefixes when present; the country is NEVER shown
 *     (owner requirement 2026-07-26) and the literal "Thailand" is gone.
 *   - AC-3/AC-4/AC-5, BR-5/BR-6, EC-2/EC-3: buildCardPriceDisplay — single
 *     price, honest range, free camp, and the degenerate-range guard.
 *   - AC-6: the favourite icon's `--primary` fill is RECOMPUTED (never
 *     asserted-not-computed) against the design system's own defined
 *     surfaces for this token, in both themes; `--secondary` is measured
 *     too, to prove the owner's hunch does NOT hold numerically.
 *   - Rework (coordinator finding): the Thai-name seam is now NAME-based
 *     (`Location.province` <-> `ThailandLocation.provinceNameEn`), not the
 *     `Location.thaiLocationId` FK (measured: only 12 of 652 `Location` rows
 *     have that FK set). The coverage test below replays the REAL 78 distinct
 *     `Location.province` values captured from the dev DB on 2026-07-26
 *     against the REAL 77-province dataset (`prisma/data/thailand-locations.json`)
 *     and asserts 77-of-78 resolve — not just one happy row — so a future
 *     regression back to the FK/12-row path is caught.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import thailandLocations from "@/prisma/data/thailand-locations.json";

interface ProvinceEntry {
  code: string;
  nameTh: string;
  nameEn: string;
}
const ALL_PROVINCES = thailandLocations as ProvinceEntry[];

/**
 * The REAL 78 distinct `Location.province` values in the dev DB, captured by
 * a direct query on 2026-07-26 (`prisma.location.findMany({distinct:['province']})`).
 * 77 of these match a real `ThailandLocation.provinceNameEn`; the sole miss,
 * `'x'`, is an orphaned placeholder row with no live `CampSite` attached
 * (verified: `campSite.count({where:{location:{province:{in:[...matched]}}}})`
 * === `campSite.count()`, i.e. every REAL camp's province resolves).
 */
const REAL_DISTINCT_LOCATION_PROVINCES = [
  "Chiang Mai", "Nakhon Ratchasima", "Chiang Rai", "Krabi", "Phuket", "Trat",
  "Surat Thani", "Phetchabun", "Loei", "Mae Hong Son", "x", "Nakhon Phanom",
  "Lamphun", "Lampang", "Uttaradit", "Phrae", "Nan", "Phayao", "Buri Ram",
  "Surin", "Si Sa Ket", "Ubon Ratchathani", "Yasothon", "Chaiyaphum",
  "Amnat Charoen", "Bueng Kan", "Nong Bua Lam Phu", "Khon Kaen", "Udon Thani",
  "Nong Khai", "Maha Sarakham", "Roi Et", "Kalasin", "Sakon Nakhon",
  "Mukdahan", "Bangkok", "Samut Prakan", "Nonthaburi", "Pathum Thani",
  "Phra Nakhon Si Ayutthaya", "Ang Thong", "Lop Buri", "Sing Buri",
  "Chai Nat", "Saraburi", "Nakhon Nayok", "Nakhon Sawan", "Uthai Thani",
  "Kamphaeng Phet", "Sukhothai", "Phitsanulok", "Phichit", "Suphan Buri",
  "Nakhon Pathom", "Samut Sakhon", "Samut Songkhram", "Chon Buri", "Rayong",
  "Chanthaburi", "Chachoengsao", "Prachin Buri", "Sa Kaeo", "Tak",
  "Ratchaburi", "Kanchanaburi", "Phetchaburi", "Prachuap Khiri Khan",
  "Nakhon Si Thammarat", "Phang Nga", "Ranong", "Chumphon", "Songkhla",
  "Satun", "Trang", "Phatthalung", "Pattani", "Yala", "Narathiwat",
] as const;

const ROOT = path.join(__dirname, "..");
const cardSrc = readFileSync(path.join(ROOT, "components", "CampgroundCard.tsx"), "utf8");
const wishlistSrc = readFileSync(path.join(ROOT, "app", "wishlist", "page.tsx"), "utf8");
const catalogResultsSrc = readFileSync(path.join(ROOT, "components", "CatalogResults.tsx"), "utf8");
const apiCampsitesSrc = readFileSync(path.join(ROOT, "app", "api", "campsites", "route.ts"), "utf8");

// ---------------------------------------------------------------------------
// Mocked prisma — the read-models module under test does a real DB round-trip
// (thailandLocation.findMany) that must never run against a live DB in a
// unit test.
// ---------------------------------------------------------------------------
const mockThailandLocationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    thailandLocation: {
      findMany: (...args: unknown[]) => mockThailandLocationFindMany(...args),
    },
  },
}));

const {
  buildCardPriceDisplay,
  buildLocationText,
} = await import("../components/CampgroundCard");
const {
  campCardSelect,
  getProvinceThaiNameMap,
  withProvinceThaiNames,
} = await import("../lib/read-models/camp-card");
const { parseTokens, resolveOver, resolveSurface, contrastRatio, CSS_PATH } = await import(
  "../scripts/check-contrast.mjs"
);
const translations = (await import("../locales/translations.json")).default;

beforeEach(() => {
  vi.clearAllMocks();
  // Real 77-row dataset (prisma/data/thailand-locations.json), same shape
  // `campCardSelect`'s query would receive: {provinceNameEn, provinceName}.
  mockThailandLocationFindMany.mockResolvedValue(
    ALL_PROVINCES.map((p) => ({ provinceNameEn: p.nameEn, provinceName: p.nameTh }))
  );
});

// ---------------------------------------------------------------------------
// AC-1 / AC-2 / BR-1..3 / EC-1 / EC-4 — localized location line, no country
// ---------------------------------------------------------------------------
describe("buildLocationText — AC-1/AC-2 (BR-1/BR-2/BR-3, EC-1/EC-4)", () => {
  const matched = { province: "Narathiwat", provinceTh: "นราธิวาส" };
  const unmatched = { province: "Narathiwat" };

  it("[normal] AC-1: TH mode renders the Thai province name ONLY — no country", () => {
    expect(buildLocationText(matched, "th")).toBe("นราธิวาส");
  });

  it("[normal] AC-2: EN mode renders the English province ONLY — no country", () => {
    expect(buildLocationText(matched, "en")).toBe("Narathiwat");
  });

  it("[null/empty] EC-1: TH mode falls back to the raw `province` value when there is no Thai-name match", () => {
    expect(buildLocationText(unmatched, "th")).toBe("Narathiwat");
  });

  it("[boundary] a `provinceTh` of undefined (explicit) behaves the same as absent", () => {
    const explicit = { province: "Trat", provinceTh: undefined };
    expect(buildLocationText(explicit, "th")).toBe("Trat");
  });

  it("[normal] EC-4 (district slot-in): a district prefixes the province when present, TH mode", () => {
    const withDistrict = { province: "Narathiwat", provinceTh: "นราธิวาส", district: "เมืองนราธิวาส" };
    expect(buildLocationText(withDistrict, "th")).toBe("เมืองนราธิวาส, นราธิวาส");
  });

  it("[normal] EC-4 (district slot-in): a district prefixes the province when present, EN mode", () => {
    const withDistrict = { province: "Narathiwat", district: "Mueang Narathiwat" };
    expect(buildLocationText(withDistrict, "en")).toBe("Mueang Narathiwat, Narathiwat");
  });

  it("[null/empty] EC-4: district null/absent renders province-only (today's real data shape)", () => {
    expect(buildLocationText({ province: "Trat", district: null }, "th")).toBe("Trat");
    expect(buildLocationText({ province: "Trat" }, "th")).toBe("Trat");
  });
});

describe("components/CampgroundCard.tsx — no country, no hardcoded \"Thailand\" (BR-3)", () => {
  it("[structural] the component source never hardcodes the string \"Thailand\"", () => {
    expect(cardSrc).not.toContain("Thailand");
  });

  it("[structural] buildLocationText is called with 2 args (province/district only — no country)", () => {
    expect(cardSrc).toContain("buildLocationText(campground.location, language)");
  });

  it("[structural] no leftover reference to a country locale key", () => {
    expect(cardSrc).not.toContain("countryName");
  });
});

describe("locales/translations.json — countryName key removed (no longer needed)", () => {
  it("[regression] campground.countryName does not exist in either language", () => {
    expect((translations.en.campground as Record<string, unknown>).countryName).toBeUndefined();
    expect((translations.th.campground as Record<string, unknown>).countryName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-3 / AC-4 / AC-5 / BR-5 / BR-6 / EC-2 / EC-3 — honest price (unchanged)
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
    const match = cardSrc.match(/data-testid="text--card-price">([\s\S]*?)<\/div>/);
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
// Rework — name-based Thai lookup, real-dataset coverage (coordinator finding)
// ---------------------------------------------------------------------------
describe("campCardSelect — the FK relation is GONE; district is wired through instead", () => {
  it("[regression] location.select does NOT select thaiLocation (the 12-of-652 FK path)", () => {
    expect("thaiLocation" in campCardSelect.location.select).toBe(false);
  });

  it("[shape] location.select.district === true (CAM-545: slot-in for future district data)", () => {
    expect(campCardSelect.location.select.district).toBe(true);
  });

  it("[regression] location.select.province is UNCHANGED (BR-4: the province filter depends on it)", () => {
    expect(campCardSelect.location.select.province).toBe(true);
  });

  it("[shape] priceHigh is still selected (kept from the prior slice)", () => {
    expect(campCardSelect.priceHigh).toBe(true);
  });
});

describe("getProvinceThaiNameMap — queries ALL province-level rows, not a FK-scoped subset", () => {
  it("[normal] queries thailandLocation.findMany with districtCode:'' (the seed's province-record marker), no id/FK filter", async () => {
    await getProvinceThaiNameMap();
    expect(mockThailandLocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { districtCode: "" } })
    );
  });

  it("[normal] the map size equals the full row count returned by the query (77) — nothing dropped client-side", async () => {
    const map = await getProvinceThaiNameMap();
    expect(map.size).toBe(ALL_PROVINCES.length);
  });

  it("[normal] a concrete real pair resolves correctly: Narathiwat -> นราธิวาส (the ticket's own example)", async () => {
    const map = await getProvinceThaiNameMap();
    expect(map.get("Narathiwat")).toBe("นราธิวาส");
  });
});

describe("withProvinceThaiNames — REAL-dataset coverage (coordinator finding: 12-row regression guard)", () => {
  it("[normal] 77 of the 78 REAL distinct Location.province values resolve a Thai name — not just one happy row", async () => {
    const map = await getProvinceThaiNameMap();
    const cards = REAL_DISTINCT_LOCATION_PROVINCES.map((province) => ({ location: { province } }));
    const enriched = withProvinceThaiNames(cards, map);

    const resolved = enriched.filter((c) => c.location.provinceTh !== undefined);
    const unresolved = enriched.filter((c) => c.location.provinceTh === undefined);

    expect(resolved.length).toBe(77);
    expect(unresolved.map((c) => c.location.province)).toEqual(["x"]);
  });

  it("[null/empty] a null province never throws and leaves provinceTh undefined", async () => {
    const map = await getProvinceThaiNameMap();
    const [card] = withProvinceThaiNames([{ location: { province: null } }], map);
    expect(card.location.provinceTh).toBeUndefined();
  });

  it("[structural] never mutates the input card objects", async () => {
    const map = await getProvinceThaiNameMap();
    const original = { location: { province: "Bangkok" } };
    withProvinceThaiNames([original], map);
    expect("provinceTh" in original.location).toBe(false);
  });

  it("[boundary] Prove-It (regression, cam-344-availability-badge.test.ts): a card whose `location` is missing entirely never throws — an unrelated fixture that predates this function must not 500 an endpoint that doesn't even render this field", async () => {
    const map = await getProvinceThaiNameMap();
    const malformed = { id: "c1" } as unknown as { location: { province: string | null } };
    expect(() => withProvinceThaiNames([malformed], map)).not.toThrow();
    const [card] = withProvinceThaiNames([malformed], map);
    expect(card.location.provinceTh).toBeUndefined();
  });
});

describe("app/wishlist/page.tsx — the same name-based seam (real caller of CampgroundCard)", () => {
  it("[structural] selects district (not thaiLocation) under location", () => {
    expect(wishlistSrc).toContain("district: true");
    expect(wishlistSrc).not.toContain("thaiLocation");
  });

  it("[structural] calls getProvinceThaiNameMap (fail-open) and attaches provinceTh", () => {
    expect(wishlistSrc).toContain("getProvinceThaiNameMap()");
    expect(wishlistSrc).toContain("provinceThaiNameMap.get(province)");
  });

  it("[scope] still does NOT switch to the shared campCardSelect (CAM-193 scope guard, unaffected)", () => {
    expect(wishlistSrc).not.toContain("campCardSelect");
  });
});

describe("components/CatalogResults.tsx + app/api/campsites/route.ts — enrichment wired into every card-feeding path", () => {
  it("[structural] CatalogResults.tsx calls getProvinceThaiNameMap + withProvinceThaiNames before serialising", () => {
    expect(catalogResultsSrc).toContain("getProvinceThaiNameMap()");
    expect(catalogResultsSrc).toContain("withProvinceThaiNames(campSites, provinceThaiNameMap)");
  });

  it("[structural] app/api/campsites/route.ts (cursor 'load more') also enriches before serialising", () => {
    expect(apiCampsitesSrc).toContain("getProvinceThaiNameMap()");
    expect(apiCampsitesSrc).toContain("withProvinceThaiNames(items, provinceThaiNameMap)");
  });
});

// ---------------------------------------------------------------------------
// AC-6 — favourite icon contrast, RECOMPUTED from the real tokens (unchanged)
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
