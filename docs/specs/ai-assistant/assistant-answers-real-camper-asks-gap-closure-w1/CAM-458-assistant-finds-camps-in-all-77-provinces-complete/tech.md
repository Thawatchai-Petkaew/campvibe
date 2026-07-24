---
linear: CAM-458
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: tech
owner: architect
status: In Progress — G2 design (architect)
version: v1
updated: 2026-07-21
---
# Tech — assistant finds camps in all 77 provinces (CAM-458)

> Data + seed + one resolver extension. NO new API contract, NO schema change
> (`provinceName`/`provinceNameEn` columns exist). Four G2 decisions below.

## D1 — Bangkok-alias mechanism
**Decision:** an alias map **in resolver code** — a frozen `Record<string,string>` in
`lib/ai/tools/search-campsites.ts`, applied by **exact-key** lookup inside `resolveProvinceForSearch`
BEFORE the `ThailandLocation` `contains` query: `กทม`·`กทม.`·`กรุงเทพฯ`·`บางกอก` → `กรุงเทพมหานคร`
(then the existing lookup maps to `Bangkok`). Substring forms (`กรุงเทพ`) already resolve via `contains` — no entry needed.
**Rationale:** pure + deterministic (no DB, exact-key = one mapping), a future alias is a one-line map add; aliases are a lexicon concern, not canonical location data.
**Rejected:** alias ROWS in the JSON / an `aliases` field per row — pollutes the canonical `ThailandLocation` Set with non-canonical synonyms, breaks the 77-row/`provinceCode` count invariant, needs a `contains` match that could become ambiguous (non-deterministic), and the field variant needs a schema change (out of scope).
**Confirmation:** `__tests__/cam-458-province-resolve.test.ts` asserts each alias resolves to `Bangkok` and an unmapped word falls through unchanged.

## D2 — Idempotent seed + env delivery
**Decision:** reuse the existing `prisma/seed.ts` step-2 upsert loop (BR-2); **upsert key = the existing composite `@@unique([provinceCode, districtCode])`** with `districtCode=""` for a province row. No new script, no migration.
- **Dev:** `npm run seed` (= `prisma db seed` → `tsx prisma/seed.ts`, idempotent upsert), or the rows arrive via `npm run db:sync-from-staging` (one-way staging→dev, syncs all models incl. `ThailandLocation`).
- **Staging:** `migrate deploy` in `vercel-build` does **NOT** run seeds → **manual release step required**: run `npm run seed` against the staging `DATABASE_URL` (staging already carries mock data; the ThailandLocation upserts are additive + idempotent). This is a **release-checklist item** (see below).
- **Prod:** the full `prisma/seed.ts` also inserts 12 mock camps → **NOT prod-safe**. This story ships to dev+staging only (epic KPI measured on the CAM-457 golden suite, pre-prod). Prod province delivery = a prod-safe **targeted `ThailandLocation`-only upsert** decided at release time — flagged, not built here.
**Rationale:** the loop is already idempotent and prod-neutral for the ThailandLocation block; adding a bespoke loader now is premature (YAGNI) since the story is not prod-bound.
**Confirmation:** CI (`ci.yml`) runs `prisma migrate deploy && tsx prisma/seed.ts` on a clean Postgres before the regression suite → a duplicate/throw fails CI; a data test asserts exactly 77 province rows after a double run.

## D3 — Data source shape
**Decision:** one JSON (`prisma/data/thailand-locations.json`) grows from 12 → **77 province entries**, each `{ id, code, nameTh, nameEn, districts: [] }`; the 65 new entries carry `districts: []` (province-level only). The seed loop reads only `code`/`nameTh`/`nameEn`/`districts`; the JSON `id` is cosmetic ordering (DB `id` is a `uuid @default`). **No schema change** — `provinceCode`/`provinceName`/`provinceNameEn` all exist.
**Source of spellings:** the official 2-digit province codes + Thai names per **กรมการปกครอง (DOPA)**; English = **RTGS** (Royal Thai General System of Transcription, as `Location.province` already stores, e.g. บึงกาฬ→`Bueng Kan`, code `38`), cross-checked against **ISO 3166-2:TH / TIS 1099-2548**.
**Rejected:** a new `province` reference table / normalized codes — a parallel Set the resolver and every existing consumer would have to migrate to; the additive-rows path is non-breaking (Seams sweep: all other readers are NO-CHANGE).
**Confirmation:** `__tests__/cam-458-thailand-locations-data.test.ts` asserts 77 province entries, unique 2-digit codes, non-empty `nameTh`+`nameEn`, and spot-checks Bangkok=`10` / Bueng Kan=`38`.

## D4 — Test surface
- `__tests__/cam-458-province-resolve.test.ts` (vitest, **mock prisma**, mirrors cam-404): alias normalization (AC-2), non-province + English passthrough / no-throw fallback (EC-4/BR-4).
- `__tests__/cam-458-thailand-locations-data.test.ts` (pure JSON, no DB): 77-row completeness + spellings (BR-1) — this is what actually proves the data, since a mocked resolver cannot.
- End-to-end Thai→seeded-row→English for a NEW province (AC-1) + honest-empty (AC-3): the CAM-457 golden eval re-run + owner-verify on the real chat (a camp seeded in a new province). QA owns the exact matrix.
**Confirmation:** the two `cam-458-*` files above run in the vitest suite; the golden suite (CAM-457) is re-run and must not regress.

## Release checklist flag (for the release note)
> **STAGING/PROD DATA STEP — not covered by `migrate deploy`.** Before this feature is exercised on staging: run `npm run seed` against the staging DB (additive, idempotent). Prod: run a prod-safe ThailandLocation-only upsert (NEVER the full seed — it injects mock camps); decide the exact prod mechanism at release. No prod behavior change ships in this story beyond the resolver alias extension.

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` · `prisma/seed.ts` (step 2) · `prisma/data/thailand-locations.json` · `lib/ai/tools/search-campsites.ts` · `story.md`
