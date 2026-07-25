---
ticket: CAM-513
epic: CAM-512
title: Terrain expansion — add sea/waterfall/swimming-hole/field/lake/cave/coast/farm (S1)
class: standard-story
version: 1
---

# CAM-513 — Terrain expansion (S1)

## Story

As a **camper**, I want to find camps by the natural feature I actually want (ทะเล, น้ำตก, แอ่งเล่นน้ำ, ทุ่ง, ทะเลสาบ, ถ้ำ, ไร่/ฟาร์ม), so that a search like "ลานริมทะเล" or "ลานมีน้ำตก" returns the right places instead of nothing — and so the assistant has richer terrain vocabulary to compose an intent.

Scope: add 8 Terrain codes to the existing `Terrain` MasterData group (data-driven — auto-flows to AI search, host form, camper filter + detail). NO migration, NO new group. First vertical slice of the taxonomy epic (CAM-512).
Depends on: —.

Why: our Terrain group has only 4 codes (BEAC/FORE/RIVE/MTNS); the v1 spec designed 12. Missing terrain directly caused cycle-1 misses (เด็กเล่นน้ำ → Swimming-hole/Waterfall; ทุ่ง → Field). Owner: Thailand has real seaside → add ทะเล.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camps tagged with the new terrain codes exist | a camper/assistant searches `terrain=SEA` (or WATF/SWMH/FILD/LAKE/CAVE/COAS/FARM) | Only camps with that terrain are returned | `buildCampSiteWhere` filters the options m2m by the code | AC-2 |
| AC-2 | A new terrain code is seeded | the host opens `CampgroundForm` | The new terrain option appears in the Terrain multiselect (auto, data-driven) + Thai label | selectable + round-trips on save/edit | — |
| AC-3 | A camp has a new terrain | a camper opens its detail page + the filter modal | The terrain shows with its Thai label + icon; a filter chip filters by it | rendered from MasterData/i18n + icon map | EC-1 |
| AC-4 | The assistant is asked "ลานริมทะเล" / "ลานมีน้ำตก" | it searches | It sets `terrain=SEA` / `terrain=WATF` (the jsonSchema description teaches the code + Thai trigger) | a real result, not a keyword miss | — |

## Rules

- BR-1: **Codes + labels + icons** (add to `Terrain` group):
  | code | nameTh | nameEn | icon (Lucide, must exist + be added to icon maps) |
  |---|---|---|---|
  | SEA | ทะเล | Sea | Sailboat |
  | COAS | ริมชายฝั่ง | Coastal | Anchor |
  | LAKE | ทะเลสาบ | Lake | Waves |
  | WATF | น้ำตก | Waterfall | Droplets |
  | SWMH | แอ่งเล่นน้ำ | Swimming hole | Droplet |
  | FILD | ทุ่ง | Field | Flower2 |
  | CAVE | ถ้ำ | Cave | Mountain |
  | FARM | ไร่ / ฟาร์มสเตย์ | Farm | Wheat |
  (If a suggested Lucide name is not a real icon, pick the closest valid one and use it consistently across every icon map.)
- BR-2: **Codes are a global PK** — none of these 8 collide with an existing MasterData code (verified: no SEA/COAS/LAKE/WATF/SWMH/FILD/CAVE/FARM today).
- BR-3: **Seed diversity — coastal/theme discipline** (the 475/475-or-0 lesson): SEA + COAS gated to `COASTAL_PROVINCES` (mirror the existing BEAC pattern, `gen-mock-data.mjs:445-491`); WATF/SWMH → mist/river/forest/lake themes; FILD/FARM → meadow theme; CAVE → mountain/forest; LAKE → lake theme. Add ALL 8 codes to the BR-3 guarantee list (`MASTERDATA_GROUPS` `{field:'terrain', codes:[...]}` at `gen-mock-data.mjs:508-515`) so each has ≥1 camp (floor), but presence comes from theme pools (natural spread) — never a flat region-wide pool.
- BR-4: The `terrain` write-path validation stays `z.array(z.string())` (unconstrained) — no `lib/validations/campsite.ts` change needed (codes validated at the DB by `resolveOptionConnect`).

## Edge cases

- EC-1: IF an icon name is missing from any of the three icon maps (`lib/facility-icon-map.ts`, `components/CampgroundDetailClient.tsx:470-532`, `components/FilterModal.tsx:35-42 ICON_MAP`) THEN the chip/detail falls back to a generic icon — add the new icons to ALL maps that render terrain.
- EC-2: IF a new terrain code has 0 camps after seeding THEN the BR-3 guarantee pass must inject it — verify by count (`campSite.count` per code > 0 and « 475).

## Data

8 new `MasterData` rows in `prisma/seed.ts` under `group: 'Terrain'` (shape: `{code, group:'Terrain', nameTh, nameEn, icon}`, upsert-seeded). No schema change. Regenerate + reload mock data (`scripts/gen-mock-data.mjs` → `prisma/data/mock-staging.json`) so dev/staging camps carry the new terrain.

## Seams & refs

- `prisma/seed.ts:68-71` — Terrain rows (append 8).
- `lib/ai/tools/search-campsites.ts:156` — add the 8 to `TERRAIN_CODES` (flows into both zod enum + jsonSchema enum); `:373` — extend the terrain `description` prose with the new codes + Thai trigger words so the model learns them.
- `scripts/gen-mock-data.mjs:78-151` theme pools + `:445-491` coastal gating + `:508-515` BR-3 floor.
- `locales/translations.json` — `filter.SEA`…`filter.FARM` in BOTH en and th blocks.
- Icon maps: `lib/facility-icon-map.ts`, `components/CampgroundDetailClient.tsx:470-532`, `components/FilterModal.tsx:35-42`.
- Auto (no change): host form Terrain multiselect (`CampgroundForm.tsx:1201`), FilterModal Terrain section, AI card (`lib/read-models/ai-camp-card.ts:7-9`), `resolveOptionConnect`.
- Pinned tests likely touched: `__tests__/cam-408-*.test.ts` (jsonSchema advertises real MasterData codes) — update the terrain-code expectation.

## Out of scope

- New GROUPS (Annotated/Camper-style/etc.) — later slices.
- CategoryBar/SearchModal home pills for the new terrain (only if we want them as home tabs — not this slice).

## Self-verify

- [ ] `npx prisma db seed` (or the seed step) adds the 8 rows; `npm run lint` + `npx tsc --noEmit` clean
- [ ] Regenerate + reload mock data; `campSite.count` per new code is > 0 and « 475 (discriminating, coastal-gated for SEA/COAS)
- [ ] `TERRAIN_CODES` has 12; the cam-408 jsonSchema test updated + green
- [ ] i18n keys present en+th; icons added to all 3 maps
- [ ] Manual: host form shows the new terrain; a camp detail + FilterModal render it; searchCampsites terrain=SEA returns coastal camps
