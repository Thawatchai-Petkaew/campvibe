/**
 * CAM-501 (P1 Place Resolver) BR-1 — a deterministic, pure pre-pass that
 * parses an explicit Thai/English PROVINCE name or a Thai REGION (ภาค) out
 * of free-form camper text, so the model is never left to guess/infer/drop
 * a place the camper actually named (root-cause fix for the CAM-500 P0
 * over-correction: "แคมป์ริมน้ำเชียงใหม่" made the model drop
 * province=เชียงใหม่ entirely and answer with RIVE camps from anywhere in
 * the country while falsely claiming they were "ในเชียงใหม่").
 *
 * Reuses the SAME 77-province gazetteer `resolveProvinceForSearch`
 * (lib/ai/tools/search-campsites.ts) and `resolveRegionForSearch`
 * (lib/thai-regions.ts) already resolve against — no new province list is
 * hand-written here (BR-1). Unlike `resolveProvinceForSearch`, this is a
 * PURE, synchronous function: no DB round-trip, no `async` — it only needs
 * to decide WHETHER the camper named a place at all, not resolve a
 * DB-backed alias; the tool call itself still runs the real DB-backed
 * resolution once the model (now hinted, BR-2) sets the argument.
 *
 * province wins over region when both are present (mirrors the tool's own
 * "province wins" rule, `executeSearchCampsites` — CAM-463 Decision 2/BR-3).
 * A terrain/facility word (ริมน้ำ/ริมทะเล/ภูเขา/ป่า) is never treated as a
 * place (AC-4) — it simply never appears in either candidate list below.
 *
 * CAM-596 — extends this SAME pure/synchronous pre-pass with a DISTRICT
 * detector (`detectDistrict` below), the missing half of CAM-587: that
 * story wired `district`/`subDistrict` into the TOOL and proved the
 * resolution layer (`matchAdminArea`, CAM-566) works, but nothing made the
 * MODEL actually set the argument — this pre-pass is that mechanism,
 * mirroring exactly how it already forces province/region/near. Sub-district
 * free-text detection was measured (real regression run against this file's
 * own `cam-501` suite) and deliberately dropped from this story's scope —
 * see `detectDistrict`'s own doc comment for the evidence. Deliberately
 * stays synchronous/DB-free (see this story's own tech.md,
 * `docs/specs/platform-hardening/taxonomy-ui-foundation/
 * CAM-596-district-through-the-model/tech.md`, for why calling
 * `matchAdminArea` directly here would be redundant, not safer): the
 * candidate gazetteer is `thailandLocations` below — the EXACT seed source
 * of the live `AdminArea` table `matchAdminArea` queries (`prisma/seed.ts`),
 * so a pre-pass "yes, this looks like a district" can never name something
 * the real resolver wouldn't also recognize, and a pre-pass false positive
 * is caught downstream by the tool's existing honest-empty path (CAM-587
 * BR-2), never silently wrong.
 */
import thailandLocations from '@/prisma/data/thailand-locations.json';
import landmarkGazetteerData from '@/prisma/data/landmark-gazetteer.json';

export interface ResolvedPlace {
  /** DB-canonical English province name (`Location.province` / `ThailandLocation.provinceNameEn`), e.g. "Chiang Mai". */
  province?: string;
  /**
   * Canonical Thai region phrase, e.g. "ภาคเหนือ" — always one of the exact
   * keys `resolveRegionForSearch`'s alias table (`lib/thai-regions.ts`)
   * recognizes, so the tool always expands it (never falls through to the
   * raw-passthrough / zero-rows path).
   */
  region?: string;
  /**
   * CAM-502 (P2 geo proximity) BR-3 — a PROXIMITY mention: "ใกล้/แถว/รอบๆ/
   * ย่าน/บริเวณ" + a province ("ใกล้กรุงเทพ" != "ในกรุงเทพ" — the camper wants
   * camps AROUND that province, not narrowed to exactly-inside it). Mutually
   * exclusive with `province` on the same resolved place — `resolvePlace`
   * never sets both. Left as the RAW province text the camper used (not
   * pre-resolved to the DB-canonical English form the way `province` above
   * is) — `near`'s downstream Thai/English resolution already happens in
   * `executeSearchCampsites` via the same `resolveProvinceForSearch` reuse
   * (BR-2), so this pre-pass has no need to duplicate that DB round-trip.
   *
   * CAM-503 (P3 landmark) BR-2 — ALSO set (with `nearIsLandmark: true`) when
   * the camper named a curated landmark/area (e.g. "เขาใหญ่", "ปาย") — a
   * landmark spans multiple provinces so it is never a `province` value, and
   * unlike a province proximity mention it needs NO proximity marker (a bare
   * landmark name already implies area-intent). Left as the landmark's
   * canonical `nameTh` from `prisma/data/landmark-gazetteer.json` — the
   * downstream gazetteer-first lookup in `executeSearchCampsites` (BR-3)
   * matches on that exact value.
   */
  near?: string;
  /** CAM-503 BR-2 — true when `near` above came from the landmark gazetteer, not a province proximity mention. Absent/false = province. */
  nearIsLandmark?: boolean;
  /**
   * CAM-596 — an exact Thai อำเภอ (district) name detected in free text,
   * e.g. "แม่ริม". Checked BEFORE the plain `province` detection below (a
   * named district is more specific — mirrors the tool's own real
   * precedence, `near` > `district` > `province` > `region`, CAM-587 BR-1).
   * MAY be set together with `province` when the SAME message also names
   * one (CAM-596 BR-2) — that province is consulted only as a scoping hint
   * by the existing, unchanged `resolveExactInsideAdminAreaIds`, never as a
   * competing top-level filter. Sub-district free-text detection was
   * measured and deliberately NOT added in this story — see
   * `detectDistrict`'s own doc comment below for the evidence (a bare
   * "ตำบล" mention today gets no pre-pass hint, unchanged from before this
   * story; the model may still set `subDistrict` on its own initiative per
   * the tool's own parameter description).
   */
  district?: string;
}

interface ProvinceEntry {
  nameTh: string;
  nameEn: string;
}

const PROVINCES: readonly ProvinceEntry[] = (thailandLocations as ReadonlyArray<{ nameTh: string; nameEn: string }>).map(
  (p) => ({ nameTh: p.nameTh, nameEn: p.nameEn })
);

/**
 * Thai names, longest-first (defensive — `__tests__/cam-458-thailand-locations-data.test.ts`
 * already proves no full `nameTh` is an ambiguous substring of another real
 * province's `nameTh`, so any order is actually safe for THAT collision;
 * longest-first is kept anyway as the same defensive idiom the region list
 * below needs for real, and it costs nothing).
 */
const PROVINCES_BY_TH_LENGTH_DESC = [...PROVINCES].sort((a, b) => b.nameTh.length - a.nameTh.length);
const PROVINCES_BY_EN_LENGTH_DESC = [...PROVINCES].sort((a, b) => b.nameEn.length - a.nameEn.length);

/** Escapes a string for safe interpolation into a `RegExp` source. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * CAM-501-DEF-1 (QA Important defect) — a curated set of province Thai
 * names that are ALSO ordinary, high-frequency Thai vocabulary unrelated to
 * a place: "เลย" is one of the most common emphasis particles in casual
 * Thai (เยอะเลย, ดีเลย — "a lot", "great!") and also Loei province; "ตาก" is
 * the ordinary verb "to sun-dry / expose to the sun/wind" (ตากแดด, ตากผ้า —
 * "sunbathe", "hang laundry") and also Tak province; "ตราด"/"น่าน"/"แพร่"/
 * "ตรัง"/"ยะลา" are similarly short (≤4-char) names with no distinctive
 * marker of their own. A plain substring scan (or even a "context word
 * immediately before it" check — "ไป"/"ที่" precede both "ไปตากแดด" and a
 * genuine "ไปจังหวัดตาก" identically, since Thai has no spaces) cannot
 * reliably tell these apart from the ordinary word without a real
 * tokenizer, which this deterministic pre-pass deliberately does not carry
 * (BR-1 "pure function", not an NLP dependency). Per story fix-direction
 * decision: SKIP free-text substring matching for this curated set
 * entirely — a false MANDATORY province hint corrupting an unrelated
 * search is worse than missing the (rare) genuine ambiguous-province
 * mention, which still falls back to the model's own general BR-2
 * non-infer guidance already in the system prompt.
 */
const AMBIGUOUS_PROVINCE_NAMES_TH: ReadonlySet<string> = new Set([
  'เลย', // Loei — collides with the emphasis particle เลย
  'ตาก', // Tak — collides with the verb ตาก (sun-dry/expose to sun/wind)
  'ตราด', // Trat
  'น่าน', // Nan
  'แพร่', // Phrae
  'ตรัง', // Trang
  'ยะลา', // Yala
]);

/**
 * EC-4 (MVP-accepted): Thai has no built-in word-boundary marker, so a
 * (non-ambiguous) province's Thai name is matched as a plain substring —
 * the SAME tolerance `resolveProvinceForSearch`'s own DB `contains` lookup
 * already has in production; a minor over-match (a camp NAME that happens
 * to contain a province's Thai name) is accepted per story EC-4, not
 * solved here. CAM-501-DEF-1 carves the curated ambiguous set above OUT of
 * this scan entirely (see its own docblock).
 *
 * English names get an explicit `\b...\b` word-boundary check instead
 * (English text IS space-delimited, so this is free precision this file
 * doesn't have to give up) — guards common short names like "Tak" or "Nan"
 * from firing inside an unrelated English word (e.g. "mistake").
 */
function detectProvince(text: string): string | undefined {
  for (const p of PROVINCES_BY_TH_LENGTH_DESC) {
    if (p.nameTh.length === 0 || AMBIGUOUS_PROVINCE_NAMES_TH.has(p.nameTh)) continue;
    if (text.includes(p.nameTh)) return p.nameEn;
  }

  const lower = text.toLowerCase();
  for (const p of PROVINCES_BY_EN_LENGTH_DESC) {
    if (p.nameEn.length === 0) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(p.nameEn.toLowerCase())}\\b`);
    if (pattern.test(lower)) return p.nameEn;
  }

  return undefined;
}

type ThaiRegionName = 'NORTH' | 'NORTHEAST' | 'CENTRAL' | 'EAST' | 'WEST' | 'SOUTH';

interface RegionAlias {
  alias: string;
  /**
   * The exact canonical phrase to hand back — deliberately one of
   * `lib/thai-regions.ts`'s own `REGION_ALIASES` keys (verified by this
   * file's own drift-guard test calling the real `resolveRegionForSearch`
   * against every canonical value), so the resulting hint always resolves.
   */
  canonical: string;
  region: ThaiRegionName;
}

/**
 * BR-1/EC-2 — mirrors (does not import; `lib/thai-regions.ts`'s
 * `REGION_ALIASES` is a private, EXACT-match-only lookup meant for an
 * already-isolated word, not a free-text scanner) the alias set
 * `lib/thai-regions.ts` recognizes. Kept intentionally small and 1:1 with
 * that table; `__tests__/cam-501-place-resolver.test.ts` asserts every
 * `canonical` value here round-trips through the real
 * `resolveRegionForSearch` so the two can never silently drift apart.
 *
 * CAM-501-DEF-1 (QA Important defect) — this list is deliberately narrower
 * than `lib/thai-regions.ts`'s own `REGION_ALIASES`: that table is safe
 * because it is EXACT-match against an already-isolated, trimmed word (a
 * model-emitted `region` argument); a free-text SCANNER over arbitrary
 * camper sentences is a different, riskier match surface. The bare, short
 * aliases "เหนือ"/"กลาง"/"ตะวันออก"/"ตะวันตก"/"ใต้" (and "ทางเหนือ") are
 * ordinary Thai vocabulary on their own — "เหนือ" alone means "above/over"
 * (เหนือกว่า = "better than"), "กลาง" means "middle" (กลางคืน = "nighttime",
 * กลางแจ้ง = "outdoors"), "ใต้" means "under/below" (ใต้ต้นไม้ = "under a
 * tree") — so a naive substring scan false-positives a region hint onto a
 * completely unrelated sentence. Kept here ONLY: the six formal
 * `ภาค`-prefixed names (each unambiguous — no ordinary Thai word starts
 * with "ภาค") plus two standalone aliases that are themselves distinctive
 * compounds with no ordinary-vocabulary meaning ("อีสาน", "ปักษ์ใต้") and
 * the bare Northeast form ("ตะวันออกเฉียงเหนือ", long/distinctive enough on
 * its own). This intentionally narrows real-world recall (a bare "ไปเที่ยว
 * เหนือกันไหม" no longer sets a region hint) in exchange for eliminating
 * the false-positive class QA found — the model's own general guidance
 * still applies on a turn with no hint.
 */
const REGION_ALIASES: readonly RegionAlias[] = [
  { alias: 'ภาคตะวันออกเฉียงเหนือ', canonical: 'ภาคตะวันออกเฉียงเหนือ', region: 'NORTHEAST' },
  { alias: 'ตะวันออกเฉียงเหนือ', canonical: 'ภาคตะวันออกเฉียงเหนือ', region: 'NORTHEAST' },
  { alias: 'ภาคอีสาน', canonical: 'ภาคอีสาน', region: 'NORTHEAST' },
  { alias: 'อีสาน', canonical: 'ภาคอีสาน', region: 'NORTHEAST' },
  { alias: 'ภาคเหนือ', canonical: 'ภาคเหนือ', region: 'NORTH' },
  { alias: 'ภาคกลาง', canonical: 'ภาคกลาง', region: 'CENTRAL' },
  { alias: 'ภาคตะวันออก', canonical: 'ภาคตะวันออก', region: 'EAST' },
  { alias: 'ภาคตะวันตก', canonical: 'ภาคตะวันตก', region: 'WEST' },
  { alias: 'ปักษ์ใต้', canonical: 'ภาคใต้', region: 'SOUTH' },
  { alias: 'ภาคใต้', canonical: 'ภาคใต้', region: 'SOUTH' },
];

/**
 * EC-2 — sorted longest-alias-first so, e.g., "ตะวันออกเฉียงเหนือ" (18
 * chars) is always checked BEFORE the shorter "เหนือ" (5 chars) it
 * textually contains: exactly the collision `lib/thai-regions.ts:55`'s
 * comment names ("เหนือ"/"ตะวันออก" are substrings of
 * "ตะวันออกเฉียงเหนือ"). Without this ordering a naive first-match scan
 * would mis-resolve a Northeast mention as North (or East).
 */
const REGION_ALIASES_BY_LENGTH_DESC = [...REGION_ALIASES].sort((a, b) => b.alias.length - a.alias.length);

function detectRegion(text: string): string | undefined {
  for (const entry of REGION_ALIASES_BY_LENGTH_DESC) {
    if (text.includes(entry.alias)) return entry.canonical;
  }
  return undefined;
}

/**
 * CAM-502 (P2 geo proximity) BR-3 — a proximity preposition immediately
 * signals "camps AROUND X", not "camps IN X". Kept deliberately as a plain
 * substring scan (the same EC-4-accepted tolerance `detectProvince` already
 * has) since each of these five words/compounds is distinctive enough on
 * its own that a stray match is an acceptable false-positive rate for a
 * pre-pass this narrow in scope (mirrors the acceptance already recorded on
 * `detectProvince`'s own docblock, not a new risk category introduced here).
 */
const PROXIMITY_MARKERS_TH = ['ใกล้', 'แถว', 'รอบๆ', 'ย่าน', 'บริเวณ'] as const;

function hasProximityMarker(text: string): boolean {
  return PROXIMITY_MARKERS_TH.some((marker) => text.includes(marker));
}

/**
 * CAM-502 — bare "กรุงเทพ" (no ฯ/มหานคร suffix) is the highest-frequency way
 * campers write Bangkok, in BOTH proximity phrasing ("ใกล้กรุงเทพ", the P2
 * story's own AC-1 example) and exact phrasing ("ในกรุงเทพ", a bare mention
 * with no proximity marker). `detectProvince` cannot catch either form: its
 * substring check requires the FULL formal name ("กรุงเทพมหานคร") to appear
 * IN the text, which "กรุงเทพ" alone never satisfies (the substring
 * relationship runs the other way). This mirrors the `BANGKOK_ALIASES`
 * precedent in `lib/ai/tools/search-campsites.ts` (Bangkok is the one
 * curated exception in that file too) — scoped to Bangkok only.
 *
 * CAM-504 (GEO-2 fix) — originally this pre-pass fired ONLY under proximity
 * mode, leaving a bare/exact "ในกรุงเทพ" mention fully unresolved (`{}`, no
 * hint at all). With P2's `near` capability now in the system prompt, an
 * un-hinted turn let the model reach for `near` even when the camper meant
 * an EXACT province — the GEO-2 regression this story fixes. `resolvePlace`
 * below now calls this check UNCONDITIONALLY (both with and without a
 * proximity marker) so a bare Bangkok mention always resolves to a
 * deterministic hint — `near` under proximity, `province="Bangkok"`
 * otherwise — exactly mirroring how every other province already resolves
 * to `province` by default (BR-3 "ใน X"/bare province -> exact, never
 * inferred as `near`).
 */
function isBareBangkokMention(text: string): boolean {
  return text.includes('กรุงเทพ');
}

/**
 * CAM-503 (P3 landmark search) BR-1 — the curated gazetteer entry shape
 * (`prisma/data/landmark-gazetteer.json`). Only the fields this pre-pass
 * scans (`nameTh`/`aliases`) are typed here; the geo fields (`lat`/`lng`/
 * `radiusKm`) are consumed downstream by `executeSearchCampsites`, not by
 * this pure text-detection module.
 */
interface LandmarkGazetteerEntry {
  id: string;
  nameTh: string;
  aliases: string[];
}

const LANDMARK_GAZETTEER: readonly LandmarkGazetteerEntry[] = landmarkGazetteerData as LandmarkGazetteerEntry[];

/**
 * CAM-503-DEF-2 (QA Important defect, fixed) — a landmark whose bare
 * `nameTh` collides with ordinary Thai vocabulary is NOT skipped outright
 * (a bare skip would defeat P3's whole point — the flagship "เขาใหญ่" query
 * itself must still resolve). Instead, a match on this candidate is
 * accepted ONLY when a camping/place-search context marker
 * (`CAMPING_CONTEXT_MARKERS_TH` below) is also present in the text — a
 * context-guard, not a skip.
 *
 * "เขาใหญ่" is the highest-risk case: "เขา" is one of the most common Thai
 * pronouns (he/she/they) and "ใหญ่" is the ordinary adjective "big" — the
 * pronoun+adjective collocation ("เขาใหญ่กว่าฉัน" = "he/she is bigger than
 * me") is common conversational Thai wholly unrelated to the national
 * park. "เขาหลัก" collides the same way as a PREFIX of ordinary compounds
 * ("เขาหลักฐาน..." = "he/she has evidence...", "เขาหลักการ..." = "he/she
 * has principles..."). "เขาสก" collides as a prefix of "สกปรก" (dirty:
 * "เขาสกปรก" = "he/she is dirty"). "เขาค้อ" collides as a prefix of "ค้อม"
 * (stoop/bend: "เขาค้อม..." = "he/she bends..."). "ปาย" (CAM-503-EC-2,
 * originally a bare-skip) is short enough on its own to warrant the same
 * treatment — folded in here so a genuine "แคมป์ปาย"/"ลานกางเต็นท์ปาย" now
 * resolves instead of being silently dropped.
 *
 * Every OTHER entry's bare `nameTh` (e.g. "ดอยอินทนนท์", "ภูทับเบิก",
 * "วังน้ำเขียว", "สวนผึ้ง") is a distinctive multi-syllable compound with no
 * known ordinary-vocabulary collision — those stay direct-match, same as
 * before this fix. Every ALIAS (e.g. "เขาใหญ่นครราชสีมา", "เขาหลักพังงา",
 * "อำเภอปาย") is already qualified/distinctive by construction (it carries
 * a province/descriptor word) and is NEVER context-guarded — see
 * `LANDMARK_CANDIDATES` below, which only sets `requiresCampingContext` on
 * the bare-`nameTh` candidate.
 */
const CONTEXT_GUARDED_LANDMARK_NAMES_TH: ReadonlySet<string> = new Set([
  'เขาใหญ่', // Khao Yai — collides with the pronoun+adjective "เขา...ใหญ่" (he/she is big)
  'เขาหลัก', // Khao Lak — collides as a prefix of "เขาหลักฐาน"/"เขาหลักการ" (he/she has evidence/principles)
  'เขาสก', // Khao Sok — collides as a prefix of "เขาสกปรก" (he/she is dirty)
  'เขาค้อ', // Khao Kho — collides as a prefix of "เขาค้อม..." (he/she bends/stoops...)
  'ปาย', // Pai — short (3 chars); real collision risk lower than the เขา* set, guarded defensively per CAM-503-EC-2
]);

/**
 * CAM-503-DEF-2 — a search/camping-intent marker whose presence, together
 * with a context-guarded landmark name, is what distinguishes a genuine
 * place query ("ลานกางเต็นท์เขาใหญ่", "แคมป์ปาย") from an ordinary sentence
 * that merely happens to contain the same substring ("แฟนเขาใหญ่กว่าฉัน").
 * A terrain word (ริมน้ำ/ริมทะเล/ชายหาด) also counts — a camper describing a
 * terrain characteristic together with a landmark name ("ริมน้ำเขาใหญ่") is
 * still a camping search, per AC-2. Deliberately a flat substring list (the
 * same EC-4-accepted tolerance every other scanner in this file already
 * has) — a stray false-positive marker match is an acceptable rate for a
 * pre-pass this narrow in scope.
 */
const CAMPING_CONTEXT_MARKERS_TH = [
  'แคมป์',
  'แคมปิ้ง',
  'ลานกางเต็นท์',
  'กางเต็นท์',
  'ที่กางเต็นท์',
  'พักแรม',
  'นอนเต็นท์',
  'ที่พัก',
  'ไปเที่ยว',
  'เที่ยว',
  'ที่เที่ยว',
  'ริมน้ำ',
  'ริมทะเล',
  'ชายหาด',
] as const;

function hasCampingContextMarker(text: string): boolean {
  return CAMPING_CONTEXT_MARKERS_TH.some((marker) => text.includes(marker));
}

/** Same Thai-Unicode-range test `lib/ai/tools/search-campsites.ts` uses (not imported — that file's constant is private) — mirrored here for this module's own, narrower purpose: filtering an English/ASCII alias out of this Thai free-text scanner. */
const THAI_CHAR_PATTERN = /[ก-๙]/;

/** True only when `text` contains at least one Thai character — used to skip an English/ASCII alias in this Thai free-text scanner (that alias still matches downstream, in `executeSearchCampsites`'s exact-string gazetteer lookup, when the MODEL itself emits it). */
function containsThaiChar(text: string): boolean {
  return THAI_CHAR_PATTERN.test(text);
}

interface LandmarkCandidate {
  /** The exact substring this pre-pass scans camper text for. */
  matchText: string;
  /** The landmark's canonical `nameTh` to hand back as `near` (matches the gazetteer's own key, BR-3). */
  canonical: string;
  /** CAM-503-DEF-2 — true ONLY for a context-guarded landmark's bare `nameTh` candidate; a match is accepted only alongside a `CAMPING_CONTEXT_MARKERS_TH` hit. Always false for an alias (already qualified/distinctive). */
  requiresCampingContext: boolean;
}

/**
 * Every landmark's bare `nameTh` (context-guarded per
 * `CONTEXT_GUARDED_LANDMARK_NAMES_TH` above where applicable) + every
 * Thai-language alias (never guarded), flattened once at module load and
 * sorted longest-match-first — the same "longer/more-specific wins"
 * ordering `detectProvince`/`detectRegion` already use, so e.g.
 * "อุทยานแห่งชาติเขาใหญ่" never partially matches on a shorter, unrelated
 * candidate first.
 */
const LANDMARK_CANDIDATES: readonly LandmarkCandidate[] = LANDMARK_GAZETTEER.flatMap((entry) => {
  const candidates: LandmarkCandidate[] = [
    {
      matchText: entry.nameTh,
      canonical: entry.nameTh,
      requiresCampingContext: CONTEXT_GUARDED_LANDMARK_NAMES_TH.has(entry.nameTh),
    },
  ];
  for (const alias of entry.aliases) {
    if (containsThaiChar(alias)) {
      candidates.push({ matchText: alias, canonical: entry.nameTh, requiresCampingContext: false });
    }
  }
  return candidates;
}).sort((a, b) => b.matchText.length - a.matchText.length);

/**
 * CAM-503 BR-2/EC-4 — a bare landmark mention (no proximity marker needed;
 * the landmark name itself already implies area-intent). Same EC-4-accepted
 * plain-substring tolerance `detectProvince` documents (no real tokenizer).
 * CAM-503-DEF-2 — a `requiresCampingContext` candidate that matches the
 * text but finds no camping-context marker is SKIPPED (not an immediate
 * `undefined` return) so a later, unguarded candidate elsewhere in the text
 * can still match.
 */
function detectLandmark(text: string): string | undefined {
  for (const candidate of LANDMARK_CANDIDATES) {
    if (!text.includes(candidate.matchText)) continue;
    if (candidate.requiresCampingContext && !hasCampingContextMarker(text)) continue;
    return candidate.canonical;
  }
  return undefined;
}

/**
 * CAM-596 — the DISTRICT candidate gazetteer, built ONCE at module load from
 * the SAME `thailandLocations` import `PROVINCES` above already uses (never
 * a second data file). Every district `nameTh` is flattened out of the full
 * hierarchy (930 districts) and then filtered through the collision guards
 * this story's tech.md documents (measured, not guessed):
 *
 * 1. Shorter than 4 Thai characters -> excluded entirely (mirrors
 *    `AMBIGUOUS_PROVINCE_NAMES_TH`'s own "too short/generic" treatment).
 * 2. Already in `AMBIGUOUS_PROVINCE_NAMES_TH` (e.g. ตรัง, ยะลา) -> excluded,
 *    reusing that one curated set rather than a second one.
 * 3. A substring of ANY province's own `nameTh` (INCLUDING an exact match)
 *    -> excluded entirely. Measured false-match risk, not hypothetical:
 *    อุทัย/หนองบัว/พนม are each a district in a DIFFERENT province than the
 *    one whose name contains them (อุทัย -> Ayutthaya, not อุทัยธานี;
 *    หนองบัว -> Nakhon Sawan, not หนองบัวลำภู; พนม -> Surat Thani, not
 *    นครพนม) — a bare mention of THAT province would otherwise wrongly fire
 *    the wrong-province district. A district that IS itself an exact
 *    province name ("พระนครศรีอยุธยา") is excluded too — `detectProvince`
 *    already resolves that bare mention correctly, so firing the district
 *    on the identical text is redundant at best.
 * 4. Exactly "เมือง" + its own province's name (the provincial-capital-
 *    district naming pattern, measured 75 of 77 provinces) -> excluded
 *    entirely: the plain province name is always co-present as a substring
 *    of this exact pattern, so the existing (unchanged) province detector
 *    already covers the camper's intent — firing the district on top would
 *    silently over-narrow a province-shaped ask.
 *
 * Every SURVIVING candidate is tagged `requiresCampingContext`: true only
 * when it starts with "เมือง" (the 4 names that are NOT the capital-district
 * pattern above) or "ท่า" (an ordinary Thai word for "pier/dock", measured
 * across 23 district names) — the same context-guard treatment
 * CAM-503-DEF-2 already gave "เขาใหญ่"/"เขาหลัก".
 *
 * Sub-district detection was measured and DELIBERATELY DROPPED from this
 * story's scope (see story.md "Out of scope"): the same context-guard
 * mechanism gives no real protection at sub-district scale, because a
 * camping-context marker is present in nearly every message this assistant
 * ever receives — proven by a red regression run against the existing
 * `cam-501` suite, where real sub-district names "เหนือ" (above/north),
 * "กลาง" (middle), and "ตากแดด" (sunbathe, literally a real sub-district in
 * 3 separate provinces) all fired even WITH a camping-context marker
 * present, breaking pinned EC-2 false-match-guard tests. District-level
 * detection carries no such measured collision beyond guards 1-4 above.
 */
interface AdminAreaCandidate {
  nameTh: string;
  requiresCampingContext: boolean;
}

const MIN_ADMIN_AREA_NAME_LENGTH = 4;
const CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH = ['เมือง', 'ท่า'] as const;

/**
 * True when `name` appears as a substring inside ANY province's own
 * `nameTh` — including an EXACT match (guard #3 above). Deliberately does
 * NOT exclude the self-equality case: measured, a district
 * ("พระนครศรีอยุธยา") is an EXACT duplicate of a real province's own name.
 * `detectProvince` already resolves a bare mention of it correctly; firing
 * a district hint on the identical text would be redundant.
 */
function isSubstringOfAnyProvince(name: string): boolean {
  return PROVINCES.some((p) => p.nameTh.length > 0 && p.nameTh.includes(name));
}

function buildAdminAreaCandidates(): readonly AdminAreaCandidate[] {
  const byName = new Map<string, AdminAreaCandidate>();

  for (const province of thailandLocations as ReadonlyArray<{
    nameTh: string;
    districts: ReadonlyArray<{ nameTh: string }>;
  }>) {
    for (const district of province.districts) {
      const nameTh = district.nameTh;
      if (byName.has(nameTh)) continue;
      if (nameTh.length < MIN_ADMIN_AREA_NAME_LENGTH) continue;
      if (AMBIGUOUS_PROVINCE_NAMES_TH.has(nameTh)) continue;
      if (nameTh === `เมือง${province.nameTh}`) continue; // capital-district pattern — province detection already covers it
      if (isSubstringOfAnyProvince(nameTh)) continue;

      const requiresCampingContext = CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH.some((prefix) => nameTh.startsWith(prefix));
      byName.set(nameTh, { nameTh, requiresCampingContext });
    }
  }

  return Array.from(byName.values()).sort((a, b) => b.nameTh.length - a.nameTh.length);
}

const ADMIN_AREA_CANDIDATES_BY_LENGTH_DESC: readonly AdminAreaCandidate[] = buildAdminAreaCandidates();

/**
 * CAM-596 — first (longest, per the sort above) surviving district candidate
 * whose `nameTh` appears in `text`, skipping (not stopping at) a context-
 * guarded candidate when no camping-context marker is present — same "skip
 * and keep scanning" idiom `detectLandmark` already uses for its own
 * context-guarded names. `undefined` = no district plausibly named.
 */
function detectDistrict(text: string): string | undefined {
  for (const candidate of ADMIN_AREA_CANDIDATES_BY_LENGTH_DESC) {
    if (!text.includes(candidate.nameTh)) continue;
    if (candidate.requiresCampingContext && !hasCampingContextMarker(text)) continue;
    return candidate.nameTh;
  }
  return undefined;
}

/**
 * BR-1/BR-3 — the resolver itself. CAM-503 BR-2/EC-4 — a landmark match is
 * checked FIRST, ahead of the proximity/province/region checks below: a
 * landmark name already implies area-intent on its own (no proximity marker
 * required), and per EC-4 a landmark match takes precedence when the text
 * names a specific landmark (the current gazetteer has no nameTh collision
 * with a real province's full name, so this ordering never shadows a
 * genuine province mention today). Below the landmark check, behavior is
 * BYTE-IDENTICAL to before this story: `near` (proximity) is checked next —
 * a proximity marker + a province mention resolves to `near`, never
 * `province` (EC-3, mutually exclusive). Absent a proximity marker, province
 * wins over region when both are found (EC-3 from CAM-501); neither is set
 * when neither is found (AC-4 — a bare terrain/facility word resolves to
 * `{}`).
 *
 * CAM-596 BR-1 — a district check is inserted here, AFTER the landmark +
 * Bangkok-bare-mention checks above (both unchanged) and BEFORE the plain
 * `province`/`region` checks below — mirroring the tool's own real
 * precedence (`near` > `district` > `province` > `region`, CAM-587 BR-1). A
 * proximity marker has NO effect on this branch (EC-3 of this story) — the
 * tool's own `near` parameter description already tells the model never to
 * use `near` for a district/town, so a stray proximity word next to a
 * district name is simply ignored here, unlike its effect on a bare
 * province mention below. A province named in the SAME message is still
 * attached alongside the district (BR-2/AC-4) purely as a scoping hint for
 * the existing, unchanged `resolveExactInsideAdminAreaIds`.
 */
export function resolvePlace(text: string): ResolvedPlace {
  if (!text) return {};

  const landmark = detectLandmark(text);
  if (landmark) return { near: landmark, nearIsLandmark: true };

  const proximity = hasProximityMarker(text);

  // CAM-504 — checked unconditionally (not just under proximity): a bare
  // "กรุงเทพ" mention with NO proximity marker is an EXACT province mention
  // ("ในกรุงเทพ", or the province name on its own), same as every other
  // province already resolves to `province` by default below.
  if (isBareBangkokMention(text)) {
    return proximity ? { near: 'กรุงเทพ' } : { province: 'Bangkok' };
  }

  const district = detectDistrict(text);
  if (district) {
    const coProvince = detectProvince(text);
    return { district, ...(coProvince ? { province: coProvince } : {}) };
  }

  const province = detectProvince(text);
  if (province) return proximity ? { near: province } : { province };

  const region = detectRegion(text);
  if (region) return { region };

  return {};
}
