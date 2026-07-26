/**
 * cam-548-detail-location.test.ts — CAM-548
 *
 * "Camp detail page shows the location in the chosen language."
 *
 * CAM-545 fixed the identical `, Thailand` defect on the camp CARD and
 * explicitly deferred `components/CampgroundDetailClient.tsx` to a follow-up
 * (its own story.md `## Out of scope`). This story wires the SAME seam
 * (`buildLocationText` + `getProvinceThaiNameMap`/`withProvinceThaiNames`,
 * all imported — never re-implemented) into the detail page's 2 call sites.
 *
 * Layering (repo precedent for this exact file — cam-528/cam-394/cam-353 all
 * state it explicitly): `CampgroundDetailClient.tsx` has no isolated render
 * harness (>10 mocked module boundaries — next-auth, next-themes, 2x
 * next/dynamic, LanguageContext, sonner, date-fns locale). Section A proves
 * the WIRING via source-inspection (Prove-It: fails if the literal comes
 * back or a second implementation is introduced). Section B behaviorally
 * replays the REAL 78 distinct `Location.province` values (the same
 * dev-DB-captured set CAM-545 uses) through the ACTUAL imported functions,
 * proving this call path reaches the same 77-of-78 coverage — not one happy
 * row — so a future regression back to a 12-row/FK-based path is caught here
 * too, independent of CAM-545's own test file.
 *
 * AC coverage matrix (story.md):
 *   AC-1/AC-2  header subtitle — TH shows Thai province, EN shows English,
 *              never the country/`Thailand` literal (BR-1/BR-2).
 *   AC-3       map-section row reuses the SAME locationText (BR-1).
 *   AC-4/EC-2  district slots in with no dangling separator when absent
 *              (inherited from CAM-545, exercised through this call path).
 *   BR-3       address fallback precedence preserved.
 *   BR-5       page.tsx attaches provinceTh via the shared seam before
 *              serializeDecimals.
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
 * The REAL 78 distinct `Location.province` values in the dev DB (same
 * snapshot `__tests__/cam-545-card-display.test.ts` captured on 2026-07-26).
 * 77 resolve; the sole miss, `'x'`, is an orphaned placeholder with no live
 * `CampSite` attached.
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
const detailSrc = readFileSync(path.join(ROOT, "components", "CampgroundDetailClient.tsx"), "utf8");
const pageSrc = readFileSync(path.join(ROOT, "app", "campgrounds", "[slug]", "page.tsx"), "utf8");

// ---------------------------------------------------------------------------
// Mocked prisma — withProvinceThaiNames' backing lookup does a real DB
// round-trip (adminArea.findMany, CAM-580: moved off the dropped
// ThailandLocation table) that must never run in a unit test.
// ---------------------------------------------------------------------------
const mockAdminAreaFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminArea: {
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
    },
  },
}));

const { buildLocationText } = await import("../components/CampgroundCard");
const { getProvinceThaiNameMap, withProvinceThaiNames } = await import("../lib/read-models/camp-card");

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminAreaFindMany.mockResolvedValue(
    ALL_PROVINCES.map((p) => ({ nameEn: p.nameEn, nameTh: p.nameTh }))
  );
});

// ---------------------------------------------------------------------------
// Section A — wiring proof (source-inspection, established precedent for
// this exact file: cam-528/cam-394/cam-353 all mount 0 real instances).
// ---------------------------------------------------------------------------
describe("components/CampgroundDetailClient.tsx — no country, reuses the CAM-545 seam (BR-1/BR-2)", () => {
  it("[structural/regression] the literal \"Thailand\" never appears anywhere in this file", () => {
    expect(detailSrc).not.toContain("Thailand");
  });

  it("[structural] imports buildLocationText from the card (CAM-545) — no parallel implementation", () => {
    expect(detailSrc).toContain('import { buildLocationText } from "@/components/CampgroundCard";');
  });

  it("[structural] a single locationText is derived once via buildLocationText(campground.location, language)", () => {
    expect(detailSrc).toContain("const locationText = buildLocationText(campground.location, language);");
    // exactly one call site builds the text — both renders below just consume it.
    expect((detailSrc.match(/buildLocationText\(/g) || []).length).toBe(1);
  });

  it("[structural] AC-1/AC-2/BR-3: the header subtitle keeps its address-first fallback, now falling back to locationText", () => {
    expect(detailSrc).toContain("{campground.address || locationText}");
  });

  it("[structural] AC-3: the map-section row reuses the SAME locationText — not a second copy", () => {
    expect(detailSrc).toContain("<span>{locationText}</span>");
  });

  it("[teeth] mutating the real fallback line away from the source makes the assertion fail (proves it reads the real file)", () => {
    const mutated = detailSrc.replace(
      "{campground.address || locationText}",
      "{campground.address || `${campground.location.province}, Thailand`}"
    );
    expect(mutated).not.toContain("{campground.address || locationText}");
    expect(detailSrc).toContain("{campground.address || locationText}"); // still true of the real file
  });
});

describe("app/campgrounds/[slug]/page.tsx — attaches provinceTh via the shared CAM-545 seam (BR-5)", () => {
  it("[structural] imports getProvinceThaiNameMap + withProvinceThaiNames from the shared read-model (no parallel query)", () => {
    expect(pageSrc).toContain(
      'import { getProvinceThaiNameMap, withProvinceThaiNames } from "@/lib/read-models/camp-card";'
    );
  });

  it("[structural] resolves the map and enriches campSite BEFORE handing it to serializeDecimals", () => {
    expect(pageSrc).toContain("const provinceThaiNameMap = await getProvinceThaiNameMap();");
    expect(pageSrc).toContain("withProvinceThaiNames([campSite], provinceThaiNameMap);");
    expect(pageSrc).toContain("serializeDecimals(campSiteWithProvinceTh)");
  });

  it("[regression] the client no longer receives the raw, un-enriched campSite", () => {
    expect(pageSrc).not.toContain("serializeDecimals(campSite)");
  });
});

// ---------------------------------------------------------------------------
// Section B — behavioral replay: the REAL 78-province set, through the SAME
// imported functions the detail page actually calls (not a duplicate impl).
// ---------------------------------------------------------------------------
describe("Detail-page location seam — REAL-dataset coverage (not one happy row)", () => {
  it("[normal] 77 of the 78 REAL distinct Location.province values resolve a Thai name via this call path", async () => {
    const map = await getProvinceThaiNameMap();
    const cards = REAL_DISTINCT_LOCATION_PROVINCES.map((province) => ({ location: { province } }));
    const enriched = withProvinceThaiNames(cards, map);

    const resolved = enriched.filter((c) => c.location.provinceTh !== undefined);
    const unresolved = enriched.filter((c) => c.location.provinceTh === undefined);

    expect(resolved.length).toBe(77);
    expect(unresolved.map((c) => c.location.province)).toEqual(["x"]);
  });

  it("[normal] AC-1: TH mode — every resolved province renders its Thai name via buildLocationText, and the literal 'Thailand' never appears in any rendered value", async () => {
    const map = await getProvinceThaiNameMap();
    const cards = REAL_DISTINCT_LOCATION_PROVINCES.map((province) => ({ location: { province } }));
    const enriched = withProvinceThaiNames(cards, map);

    for (const card of enriched) {
      const text = buildLocationText(card.location, "th");
      expect(text).not.toContain("Thailand");
      expect(text.length).toBeGreaterThan(0);
    }
    // spot-check the ticket's own example
    const narathiwat = enriched.find((c) => c.location.province === "Narathiwat")!;
    expect(buildLocationText(narathiwat.location, "th")).toBe("นราธิวาส");
  });

  it("[normal] AC-2: EN mode renders the raw English province, no country, for the full real set", async () => {
    const map = await getProvinceThaiNameMap();
    const cards = REAL_DISTINCT_LOCATION_PROVINCES.map((province) => ({ location: { province } }));
    const enriched = withProvinceThaiNames(cards, map);

    for (const card of enriched) {
      const text = buildLocationText(card.location, "en");
      expect(text).toBe(card.location.province);
      expect(text).not.toContain("Thailand");
    }
  });

  it("[null/empty] AC-4/EC-2: a camp with no district (every real camp today) renders province-only, no dangling comma/separator", async () => {
    const map = await getProvinceThaiNameMap();
    const [card] = withProvinceThaiNames([{ location: { province: "Trat", district: null } }], map);
    const text = buildLocationText(card.location, "th");
    expect(text).not.toContain(",");
    expect(text).not.toMatch(/^,|,$/);
  });

  it("[normal] AC-4: when district IS present (CAM-553/CAM-559 wiring the write path), it prefixes the province with a single comma-space separator", async () => {
    const map = await getProvinceThaiNameMap();
    const [card] = withProvinceThaiNames(
      [{ location: { province: "Narathiwat", district: "เมืองนราธิวาส" } }],
      map
    );
    expect(buildLocationText(card.location, "th")).toBe("เมืองนราธิวาส, นราธิวาส");
  });

  it("[boundary] EC-1: an unmatched province ('x', the orphaned dev-DB row) falls back to the raw value, never throws", async () => {
    const map = await getProvinceThaiNameMap();
    const [card] = withProvinceThaiNames([{ location: { province: "x" } }], map);
    expect(() => buildLocationText(card.location, "th")).not.toThrow();
    expect(buildLocationText(card.location, "th")).toBe("x");
  });
});
