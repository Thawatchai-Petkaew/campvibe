# Place-alias fill guide — hand-off prompt for AI

**Copy this whole file to an AI (or read it yourself) to safely fill / extend `prisma/data/place-aliases.json`.** It is self-contained: goal, schema, the guard rules, the canonical-matching rule, a 77-province checklist, and how to check your own work.

Generated 2026-07-28 · owner: CampVibe · staging/data only.

---

## (a) Goal + why

The AI camp-search chat (น้องกองไฟ) resolves a user's typed place name to a province/region/zone before it queries camps. Today it matches a **province only by substring on the official Thai name** (`AdminArea.nameTh`) plus a hardcoded Bangkok-only alias map — so **โคราช, เมืองคอน, อุบล, อุดร, หัวหิน, เกาะสมุย resolve to nothing.** This dataset is the missing lookup: colloquial / abbreviation / dialect / historical names → the official place.

**This file is DATA ONLY.** Wiring it into `resolveProvinceForSearch` / `resolveRegionForSearch` is a separate build story. Your job when filling: add correct, real aliases with the right guard metadata — nothing else.

Resolver context you need:
- Province match path: `lib/ai/tools/search-campsites.ts` → `resolveProvinceForSearch` (substring on `AdminArea.nameTh`).
- Region match path: `lib/thai-regions.ts` → `resolveRegionForSearch` (exact-key map `REGION_ALIASES`, 6-region partition).
- Zone/landmark path: `prisma/data/landmark-gazetteer.json` (proximity by lat/lng/radiusKm). **~25 landmarks already exist there — do not duplicate them here** (list in section e).
- Known hazard: short Thai aliases false-match as substrings. The resolver already guards a set of common-word province names (`AMBIGUOUS_PROVINCE_NAMES_TH` = เลย, ตาก, ตราด, น่าน, แพร่, ตรัง, ยะลา). Your aliases must carry their own guard metadata (`matchMode` / `contextGuard`).

## (b) Schema

Top-level object with three buckets:

```jsonc
{
  "provinceAliases": [
    {
      "canonicalCode": "30",              // province code from thailand-locations.json (MUST match)
      "canonicalTh": "นครราชสีมา",         // MUST equal that province's seeded nameTh
      "canonicalEn": "Nakhon Ratchasima", // MUST equal that province's seeded nameEn
      "aliases": [
        { "text": "โคราช", "matchMode": "substring", "kind": "colloquial" },
        { "text": "เมืองย่าโม", "matchMode": "substring", "kind": "colloquial" }
      ],
      "note": "optional free text"
    }
  ],
  "regionAliases": [
    { "canonicalRegion": "NORTHEAST",     // one of NORTH|NORTHEAST|CENTRAL|EAST|WEST|SOUTH
      "aliases": [ { "text": "ที่ราบสูงโคราช", "matchMode": "substring", "kind": "colloquial" } ],
      "note": "extends lib/thai-regions.ts REGION_ALIASES — additive only" }
  ],
  "zoneAliases": [
    { "id": "hua-hin",                    // unique kebab slug
      "nameTh": "หัวหิน",
      "aliases": ["อ.หัวหิน"],            // zone aliases are plain strings (proximity, not province equality)
      "provinceTh": "ประจวบคีรีขันธ์",     // MUST equal the province of provinceCode
      "provinceCode": "77",
      "kind": "town",                     // park|mountain|town|area
      "lat": null, "lng": null, "radiusKm": null,  // fill later, or leave null to map to province
      "note": "" }
  ]
}
```

**alias object** (province + region buckets): `{ text, matchMode, kind, contextGuard? }`
- `text` — the alias exactly as a user types it (Thai verbatim, real glyphs).
- `matchMode` — `"substring"` or `"exact"` (rule in section c).
- `kind` — `"colloquial"` | `"abbreviation"` | `"dialect"` | `"historical"`.
- `contextGuard` — optional boolean (default false); rule in section c.

## (c) Guard rules (the important part — get matchMode right)

Pick per-alias, not per-province (one province can hold both a safe substring alias and a risky exact one).

Use **`matchMode: "substring"`** when the alias is:
- ≥ 4 Thai characters, AND
- distinctive (not a substring of another place name), AND
- not a common everyday Thai word.
→ e.g. `โคราช`, `อุบล`, `ปากน้ำโพ`, `เจียงใหม่`, `แม่กลอง`.

Use **`matchMode: "exact"`** when the alias is:
- ≤ 3 characters (an abbreviation like `ศก`, `ขก`, `บร`), OR
- a substring of a longer place name (e.g. `ปากน้ำ` ⊂ `ปากน้ำโพ`; `สกล` ⊂ `สกลนคร`), OR
- also a common everyday word (`ปทุม`=lotus, `มุก`=pearl, `ลุง`=uncle).

Add **`contextGuard: true`** when the exact alias is *also a common non-place word* — the build step should only accept it when a camping/travel context marker is present (mirrors `CONTEXT_GUARDED_LANDMARK_NAMES_TH`). Examples: `เมืองหลวง`, `คอน`, `กำแพง`, `มุก`, `ลุง`, `นรา`.

Two hard bans (the validator enforces both):
- An alias **must not equal any official province `nameTh`** (it would shadow the real province match).
- An alias **must not map to two different provinces** (dataset-wide uniqueness). If a nickname is genuinely ambiguous (e.g. `เมืองเพชร` for both Phetchaburi and Phetchabun), pick the primary province, set `matchMode: exact` + `contextGuard: true`, and explain the collision in `note`.

## (d) Canonical rule — how to find the code

Every `canonicalCode` / `canonicalTh` / `canonicalEn` (and `provinceCode` / `provinceTh` for zones) **must match `prisma/data/thailand-locations.json` byte-for-byte.** That file is the seed source of truth for `AdminArea`. To find a province's row:

```bash
node -e 'JSON.parse(require("fs").readFileSync("prisma/data/thailand-locations.json","utf8")).forEach(p=>console.log(p.code,p.nameTh,p.nameEn))'
```

Copy `nameTh` / `nameEn` from that output — do not retype Thai from memory (a wrong glyph fails the validator).

## (e) 77-province checklist (fill the 🔲, respect the ⚪)

`✅` already in the file · `🔲` candidate to research + add · `⚪` no widely-used nickname found (leave out — honesty) · `(gaz)` covered by landmark-gazetteer.json · `(zone)` covered in zoneAliases.

**NORTH (9):** เชียงใหม่ ✅ · เชียงราย ✅ · ลำพูน ✅ · ลำปาง ✅ · แพร่ ✅ · น่าน ✅ · แม่ฮ่องสอน ✅ · พะเยา 🔲(ภูกามยาว?) · อุตรดิตถ์ 🔲(เมืองลับแล / ท่าเหนือ?)

**NORTHEAST / อีสาน (20):** นครราชสีมา ✅ · อุบลราชธานี ✅ · อุดรธานี ✅ · ขอนแก่น ✅ · บุรีรัมย์ ✅ · สุรินทร์ ✅ · ศรีสะเกษ ✅ · ยโสธร ✅ · มหาสารคาม ✅ · ร้อยเอ็ด ✅ · สกลนคร ✅ · มุกดาหาร ✅ · เลย ✅ (เชียงคาน/ภูเรือ zone · ภูกระดึง gaz) · ชัยภูมิ 🔲(เมืองพญาแล?) · กาฬสินธุ์ 🔲(เมืองน้ำดำ?) · นครพนม 🔲 · หนองคาย ⚪ · หนองบัวลำภู ⚪ · อำนาจเจริญ ⚪ · บึงกาฬ ⚪ (จังหวัดที่ 77, 2554)

**CENTRAL (22):** กรุงเทพมหานคร ✅ · พระนครศรีอยุธยา ✅ · ลพบุรี ✅ · นครสวรรค์ ✅ · พิษณุโลก ✅ · พิจิตร ✅ · กำแพงเพชร ✅ · สุพรรณบุรี ✅ · นครปฐม 🔲(เมืององค์พระ?) · สมุทรปราการ ✅ · นนทบุรี ✅ · ปทุมธานี ✅ · สมุทรสาคร ✅ · สมุทรสงคราม ✅ · เพชรบูรณ์ 🔲 (เขาค้อ/ภูทับเบิก gaz) · สุโขทัย ⚪ · อ่างทอง ⚪ · สิงห์บุรี ⚪ · ชัยนาท ⚪ · สระบุรี ⚪(มวกเหล็ก=zone?) · นครนายก ⚪ · อุทัยธานี ⚪

**EAST (7):** ชลบุรี ✅ (พัทยา/บางแสน zone) · จันทบุรี ✅ · ตราด ✅ (เกาะช้าง zone) · ฉะเชิงเทรา ✅ · ปราจีนบุรี ✅ · ระยอง 🔲 (เกาะเสม็ด zone) · สระแก้ว ⚪

**WEST (5):** ตาก ✅ (แม่สอด zone · ทีลอซู gaz) · กาญจนบุรี ✅ (สังขละบุรี/ทองผาภูมิ zone) · ราชบุรี ✅ (สวนผึ้ง gaz) · เพชรบุรี ✅ (แก่งกระจาน gaz) · ประจวบคีรีขันธ์ ✅ (หัวหิน/ปราณบุรี zone)

**SOUTH (14):** นครศรีธรรมราช ✅ · ภูเก็ต ✅ (ป่าตอง zone) · สุราษฎร์ธานี ✅ (สมุย/พะงัน/เต่า zone · เขาสก gaz) · สงขลา ✅ (หาดใหญ่ zone) · ตรัง ✅ · พัทลุง ✅ · ยะลา ✅ (เบตง zone) · นราธิวาส ✅ · ระนอง ✅ · กระบี่ 🔲 (อ่าวนาง/เกาะลันตา zone) · พังงา 🔲 (เขาหลัก gaz) · ชุมพร 🔲(ประตูสู่ภาคใต้?) · สตูล ⚪ (เกาะหลีเป๊ะ zone) · ปัตตานี ⚪

**Existing landmark-gazetteer.json (do NOT re-add as zones):** เขาใหญ่ · ปาย · เขาค้อ · ดอยอินทนนท์ · ภูทับเบิก · ปางอุ๋ง · เขาสก · ดอยอ่างขาง · ภูชี้ฟ้า · สวนผึ้ง · วังน้ำเขียว · ภูกระดึง · ภูหินร่องกล้า · ดอยตุง · ดอยแม่สลอง · เขาหลัก · เขาคิชฌกูฏ · น้ำตกเอราวัณ · เขื่อนศรีนครินทร์ · ทะเลบัวแดง · ภูทอก · แก่งกระจาน · ผาแต้ม · ดอยหลวงเชียงดาว · ทีลอซู.

## (f) Honesty rule

Add only names **real people actually use.** No inventing a nickname to fill a slot — a ⚪ province stays out. Prefer widely-recognized colloquial names, common abbreviations, attested dialect pronunciations (คำเมือง / อีสาน / ใต้), and genuine historical names. If unsure whether a name is real, leave it out and note it as a candidate.

## (g) Examples + check your work

Correct entries (from the shipped file):

```jsonc
// substring — distinctive, ≥4 chars
{ "text": "โคราช", "matchMode": "substring", "kind": "colloquial" }
// exact + guard — common word
{ "text": "มุก", "matchMode": "exact", "contextGuard": true, "kind": "colloquial" }
// exact — abbreviation
{ "text": "ศก", "matchMode": "exact", "contextGuard": true, "kind": "abbreviation" }
// dialect
{ "text": "เจียงใหม่", "matchMode": "substring", "kind": "dialect" }
```

After any edit, run the validator — it must exit 0:

```bash
node scripts/validate-place-aliases.mjs
# place-aliases.json OK — N provinces (M province aliases), R region groups, Z zones, 0 violations.
```

It cross-checks every `canonical*` against `thailand-locations.json`, rejects a duplicate alias, rejects an alias that equals an official province name, and rejects a region alias that already exists in `REGION_ALIASES`. A green validator = the data is safe for the build step to consume.
