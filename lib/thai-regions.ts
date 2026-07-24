/**
 * CAM-463 Decision 1/BR-1 — the derived 6-region rollup (region-as-a-search-
 * FILTER only, NO DB entity, NO migration). Scheme = Thailand's standard
 * 6-region geographic partition (การแบ่ง 6 ภาคของคณะกรรมการภูมิศาสตร์แห่งชาติ /
 * NESDB), a partition of all 77 provinces: 9+20+22+7+5+14 = 77.
 *
 * Vocabulary — the map's values are the exact English `provinceNameEn`
 * strings `Location.province` stores and `resolveProvinceForSearch`
 * (CAM-404/458) returns, sourced from `prisma/data/thailand-locations.json`
 * `nameEn` (the seed's SoT). Region-expansion and single-province filtering
 * therefore speak ONE vocabulary.
 *
 * `__tests__/cam-463-thai-regions.test.ts` asserts this map is a partition of
 * the exact seeded `provinceNameEn` set (77, no dup, none missing) — the map
 * can never silently drift from the seed.
 *
 * Note (6-region ≠ tourism/4-region): the lower-north provinces (Nakhon
 * Sawan, Sukhothai, Phitsanulok, Phichit, Phetchabun, Kamphaeng Phet, Uthai
 * Thani) fall under CENTRAL, and Tak falls under WEST — this is why NORTH is
 * only 9, not a tourism grouping.
 */

export type ThaiRegion = 'NORTH' | 'NORTHEAST' | 'CENTRAL' | 'EAST' | 'WEST' | 'SOUTH';

/** BR-1 — the authoritative 6-region partition, `provinceNameEn` (copied verbatim from tech.md). */
export const REGION_TO_PROVINCES: Readonly<Record<ThaiRegion, readonly string[]>> = Object.freeze({
  NORTH: [
    'Chiang Mai', 'Lamphun', 'Lampang', 'Uttaradit', 'Phrae',
    'Nan', 'Phayao', 'Chiang Rai', 'Mae Hong Son',
  ],
  NORTHEAST: [
    'Nakhon Ratchasima', 'Buri Ram', 'Surin', 'Si Sa Ket', 'Ubon Ratchathani',
    'Yasothon', 'Chaiyaphum', 'Amnat Charoen', 'Bueng Kan', 'Nong Bua Lam Phu',
    'Khon Kaen', 'Udon Thani', 'Loei', 'Nong Khai', 'Maha Sarakham',
    'Roi Et', 'Kalasin', 'Sakon Nakhon', 'Nakhon Phanom', 'Mukdahan',
  ],
  CENTRAL: [
    'Bangkok', 'Samut Prakan', 'Nonthaburi', 'Pathum Thani', 'Phra Nakhon Si Ayutthaya',
    'Ang Thong', 'Lop Buri', 'Sing Buri', 'Chai Nat', 'Saraburi',
    'Nakhon Nayok', 'Nakhon Sawan', 'Uthai Thani', 'Kamphaeng Phet', 'Sukhothai',
    'Phitsanulok', 'Phichit', 'Phetchabun', 'Suphan Buri', 'Nakhon Pathom',
    'Samut Sakhon', 'Samut Songkhram',
  ],
  EAST: ['Chon Buri', 'Rayong', 'Chanthaburi', 'Trat', 'Chachoengsao', 'Prachin Buri', 'Sa Kaeo'],
  WEST: ['Tak', 'Kanchanaburi', 'Ratchaburi', 'Phetchaburi', 'Prachuap Khiri Khan'],
  SOUTH: [
    'Nakhon Si Thammarat', 'Krabi', 'Phang Nga', 'Phuket', 'Surat Thani',
    'Ranong', 'Chumphon', 'Songkhla', 'Satun', 'Trang',
    'Phatthalung', 'Pattani', 'Yala', 'Narathiwat',
  ],
});

/**
 * CAM-463 Decision 3/BR-2 — exact-key alias map (NOT `contains`, unlike
 * `resolveProvinceForSearch`'s DB substring lookup): `เหนือ` and `ตะวันออก`
 * are substrings of `ตะวันออกเฉียงเหนือ`, so an exact match on the whole
 * trimmed word avoids that collision. Additive only — a form outside this
 * set is not an error (falls through to the raw-passthrough below, BR-4).
 *
 * CAM-463 security hardening — built via `Object.create(null)` (no
 * `Object.prototype` in the chain) rather than an object literal. A plain
 * `{}` literal inherits `Object.prototype`, so a client-supplied lookup key
 * of `'__proto__'` / `'constructor'` / `'toString'` / `'valueOf'` /
 * `'hasOwnProperty'` would return an INHERITED truthy value (an object or
 * function) instead of `undefined`, which `resolveRegionForSearch` would
 * then wrongly treat as a resolved region — defeating its "never throws"
 * contract (BR-4/AC-6). A null-prototype map has no inherited properties at
 * all, so every one of those adversarial keys correctly misses and falls
 * through to the raw-passthrough below.
 */
const REGION_ALIASES: Readonly<Record<string, ThaiRegion>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, ThaiRegion>, {
    ภาคเหนือ: 'NORTH',
    เหนือ: 'NORTH',
    ทางเหนือ: 'NORTH',
    ภาคตะวันออกเฉียงเหนือ: 'NORTHEAST',
    ภาคอีสาน: 'NORTHEAST',
    อีสาน: 'NORTHEAST',
    ภาคกลาง: 'CENTRAL',
    กลาง: 'CENTRAL',
    ภาคตะวันออก: 'EAST',
    ตะวันออก: 'EAST',
    ภาคตะวันตก: 'WEST',
    ตะวันตก: 'WEST',
    ภาคใต้: 'SOUTH',
    ใต้: 'SOUTH',
    ปักษ์ใต้: 'SOUTH',
  } satisfies Record<string, ThaiRegion>),
);

/**
 * CAM-463 Decision 2/3 — resolves a Thai region phrase (formal name or BR-2
 * alias) to its canonical region's `provinceNameEn` list. Pure + synchronous
 * (no DB round-trip — the map is a code constant), unlike the DB-backed
 * `resolveProvinceForSearch`. An unrecognized word (a typo, a province name,
 * or genuine nonsense) returns the RAW value unchanged — never throws, never
 * invents a region (BR-4/AC-6): the raw string then flows to
 * `buildCampSiteWhere` as a single-province equality that matches nothing,
 * yielding the honest 0-rows + banner path.
 */
export function resolveRegionForSearch(word: string): string | string[] {
  const region = REGION_ALIASES[word.trim()];
  if (region) return [...REGION_TO_PROVINCES[region]];
  return word;
}
