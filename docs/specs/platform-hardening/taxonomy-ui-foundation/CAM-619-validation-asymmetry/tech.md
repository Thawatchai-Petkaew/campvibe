---
linear: CAM-619
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: in-progress
version: v2
updated: 2026-07-28
---
# Tech — Carry each sibling's guard across to the endpoint that lacks it (CAM-619)

## Data model
No schema/DB change. No migration. All five fixes are zod-boundary tightening or an added in-memory rate-limit check; no Prisma column, table, or trigger is touched (`prisma/schema.prisma` and the `campsite_coords_sync` trigger are explicitly out of this story's file surface).

## API contract

### 1. Coordinates (`CampSite.latitude`/`longitude`)
- Shared schema extracted into `lib/validations/location.ts`: `latitudeSchema = z.number().finite().min(-90).max(90)`, `longitudeSchema = z.number().finite().min(-180).max(180)` — imported by `lib/validations/campsite.ts` (was a bare `z.number()`, no bound at all).
- `POST /api/campsites`, `PUT /api/campsites/[id]`: `400` (zod `Validation Error`, existing shape) on an out-of-range/non-finite value — rejected before `prisma.campSite.create`/`update` runs, so the `campsite_coords_sync` trigger (fires only as a side effect of that Prisma call) never sees the bad value and `Location.lat/lon` is never overwritten.
- `.finite()` is provably redundant against `.min()/.max()` for `±Infinity` (`z.number().min(-90).max(90).safeParse(Infinity)` is already `false` — confirmed by direct zod invocation before writing this fix) but kept explicit, same defense-in-depth idiom as `lib/validations/ai-chat.ts`'s `shownResultSchema.priceLow`.

### 2. Price range (`CampSite.priceLow`/`priceHigh`)
- `priceLow`/`priceHigh`: `z.number().finite().min(0, PRICE_RANGE_ERROR).max(100000, PRICE_RANGE_ERROR).optional().nullable()` — bound + Thai copy (`ราคาต้องอยู่ระหว่าง 0–100,000 บาท`) match the existing `pricePerNight` catalog row (`.claude/rules/ux.md` §2) and this file's own `extraFeeAmount` field. Verified against the live DB: current max `priceHigh` = 32,500 THB, well under the new ceiling — no real host is affected.
- Ordering (`priceLow<=priceHigh`) is enforced by `isPriceOrderValid()`, exported from `lib/validations/campsite.ts`, called from `POST /api/campsites` (create) ONLY, AFTER a successful `campSiteSchema.safeParse()` — deliberately NOT a top-level `.refine()`/`.superRefine()` on `campSiteSchema` itself. `campSiteSchema.partial()` is called by `app/api/campsites/[id]/route.ts` (in this story's surface) AND `components/CampgroundForm.tsx`'s client-side pre-check (`campSiteSchema.partial().safeParse(campPayload)`, line ~714 — OUTSIDE this story's allowed file surface). Wrapping the object in `.refine()` turns the exported const into `ZodEffects<ZodObject<...>>`, which has NO `.partial()` method — that would break BOTH call sites at compile time. `isPriceOrderValid` is a plain function instead.
- Error: `400` `ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้` (`PRICE_ORDER_ERROR`, reused verbatim from the existing `minPriceError` client-side copy in `locales/translations.json`).
- **v2 CORRECTION (CI regression, PR 700):** `PUT` ORIGINALLY also called `isPriceOrderValid`, projecting the post-save value for whichever side a partial request omitted (`data.priceLow !== undefined ? data.priceLow : existing.priceLow != null ? Number(existing.priceLow) : null`, mirroring the `isPublishTransition` projection pattern a few lines below). CI's `e2e/regression/ac1-edit-round-trip.spec.ts` failed: `putRes.status()` was `400`, not `200`. Reproduced directly against the real seeded camp `khao-yai-camping-site-2` (`priceLow: 250, priceHigh: 600`) by calling the actual route handler with the exact body `CampgroundForm.tsx` sends for that edit (`{ priceLow: 777, priceHigh: 600 }` — the form submits the FULL current form state on every save, not a per-field diff, so `priceHigh` is always present, unchanged, in the body): confirmed real `400 { "error": "ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้" }`. The initial hypothesis (comparison running against an `undefined` omitted field) was checked and ruled out — both fields were genuinely present and genuinely inverted relative to each other; the defect was enforcing a same-request/same-save atomicity assumption ("both bounds must be consistent together") that the form's actual save model (one save per user action, no forced coupling between the two fields) does not honor. **Fix:** the `isPriceOrderValid` call is removed from PUT entirely. Kept on POST because a brand-new listing has no prior state to preserve, so requiring order correctness at creation time is safe (verified: `e2e/regression/ac5-create-camp.spec.ts` never sets price fields at all, using `CampgroundForm.tsx`'s already-ordered defaults 500/1200; no e2e collision). This is a deliberate, stated create-vs-update asymmetry — the exact "leave it with a reason" case story.md's own instructions describe — not a reintroduction of the original defect (the `.min(0).max(100000)` range bound this story added is unchanged on both routes).

### 3. Taxonomy array caps
Each `.max(N)` added to `lib/validations/campsite.ts`'s array fields. `N` = the real ceiling, not an invented round number:

| Field | Group / basis | N | Source |
|---|---|---|---|
| `accessTypes` | Access type | 4 | `prisma.masterData.groupBy` on the live dev DB, 2026-07-28 |
| `accommodationTypes` | Accommodation type | 5 | ″ |
| `facilities` | Internal facility | 19 | ″ |
| `externalFacilities` | External facility | 4 | ″ |
| `equipment` | Equipment for rent | 11 | ″ |
| `activities` | Activity | 10 | ″ |
| `terrain` | Terrain | 12 | ″ |
| `annotatedFeatures` | Annotated features | 5 | ″ |
| `camperStyle` | Camper style | 4 | ″ |
| `stayConnected` | Stay connected | 3 | ″ |
| `markingMethod` | Marking method | 2 | ″ |
| `driveway` | Driveway | 3 | ″ |
| `images` | real-usage ceiling (not MasterData) | 50 | live DB: max real gallery = 30 images across 795 published camps |
| `tags` | real-usage ceiling (host free-text CSV) | 20 | live DB: max real tag count = 4; `tagsPlaceholder` copy shows a 3-tag example |

Each MasterData-group bound = that group's exact current row count — a host cannot legitimately need to pick more distinct codes than exist in the group's own fixed option list. `images`/`tags` are capped at generous headroom above the observed real maxima (not tied to a fixed option list, since they are free-form). Adding a new code to an existing MasterData group is a data-only change (no migration); the matching constant in `lib/validations/campsite.ts` must be bumped in that same PR — documented inline.
- Error: `400` (zod `Validation Error`, existing shape) — array rejected before `resolveOptionConnect`'s `prisma.masterData.findMany({ where: { code: { in: [...wanted] } } })` call (`lib/api-utils.ts`), closing the same "cap a client-controlled array length before the query" hole `.claude/rules/security.md`'s CAM-344 row names and `lib/ai/tools/compare-camps.ts` (Decision 4) already closes on the AI branch.

### 4. Rate limit — `PUT`/`DELETE /api/campsites/[id]`
- `PUT`: `checkRateLimit('campsite:update:<userId>', { limit: 30, windowMs: 3_600_000 })`, checked AFTER `requireCampSitePermission` resolves (that helper — `lib/auth-utils.ts` — is outside this story's file surface and is the only source of the session's `userId` at this point in the handler). `429` `{ error: 'rate_limited', message: 'ถึงขีดจำกัดการแก้ไขแคมป์แล้ว กรุณาลองใหม่ภายหลัง' }` + `Retry-After` header.
- `DELETE`: `checkRateLimit('campsite:delete:<userId>', { limit: 10, windowMs: 3_600_000 })`, same placement. `429` `{ error: 'rate_limited', message: 'ถึงขีดจำกัดการลบแคมป์แล้ว กรุณาลองใหม่ภายหลัง' }` + `Retry-After` header.
- Limits chosen from the OBSERVED call pattern (grep of every `/api/campsites/${id}` caller: `components/CampgroundForm.tsx` fires exactly one `PUT` per explicit Save click, one `DELETE` per explicit delete confirmation; `app/dashboard/campsites/page.tsx`'s delete button, same shape) — no bulk-loop caller exists for either verb. `PUT` gets 3x `POST`'s 10/hour because the publish-completeness gate (`isPublishTransition`) is DESIGNED to make a host re-save several times while completing a listing (save → see "missing" fields → fix → save again); `DELETE` mirrors `POST`'s one-shot cadence.

### 5. Rate limit — `GET /api/locations/search`, `GET /api/admin-areas/subdistricts`
- Both: `checkRateLimit('<route>:<ip>', { limit: 100, windowMs: 900_000 })` (the general baseline `.claude/rules/security.md` states: "start: general ~100/15 min"), checked FIRST — before any param parsing or DB read (mirrors `app/api/ai/camp-detail/[id]/route.ts`'s own ordering/comment: "a public read-only route still needs a floor guard against scraping/abuse"). `429` `{ error: 'rate_limited' }` + `Retry-After` header — no Thai message, matching the `camp-detail` precedent's shape (the client, `components/LocationPicker.tsx`, does not branch on `res.ok`; it treats any non-array JSON body as "no results" and shows an empty combobox, so a machine-code error is sufficient here).
- 100/15min chosen because `LocationPicker.tsx` debounces at 300ms across at most 2 (province/district, `/api/locations/search`) or 1 (sub-district, `/api/admin-areas/subdistricts`) cascading comboboxes — a real host session stays a small fraction of this floor even retyping several times.

## ADRs
No new ADR — this story carries existing patterns (shared coordinate bound, `checkRateLimit`, the CAM-344 array-cap lesson) across to siblings that lacked them; it introduces no new architectural decision.

Confirmation: `npx vitest run __tests__/cam-619-*.test.ts` — every AC/BR above has a rejected-input (or 429-boundary) test that fails on the pre-fix code and passes after; the coordinate fix additionally has a real-DB test (`hasRealDb`-gated, mirrors `__tests__/cam-575-coordinate-sync-invariant.test.ts`'s own pattern) proving the invalid write never reaches `prisma.campSite.update`/`create`, so `campsite_coords_sync` never fires with the bad value.

## Links
`../../feature.md` (if present) · `prisma/schema.prisma` (unchanged — read for context only) · `story.md` · `docs/RUNBOOK-db-migrations.md` (not applicable — no migration this story)

## Changelog
- v1 (2026-07-28) — created
- v2 (2026-07-28) — corrected BR-2: `isPriceOrderValid` is called on `POST` (create) only, not `PUT` (update), after CI's `e2e/regression/ac1-edit-round-trip.spec.ts` caught a real regression. See §2's v2 CORRECTION paragraph for the full repro + reasoning.
