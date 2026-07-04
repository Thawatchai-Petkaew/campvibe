---
linear: CAM-352
feature: Data & Trust
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold)
persona: Host
artifact: tech
owner: architect
status: Draft — G2 design pass (360/panorama groundwork slice)
version: v1
updated: 2026-07-04
---
# Tech — Image.kind panorama groundwork (CAM-352)

> Scope of THIS artifact: only the **360/panorama structural groundwork** (BR-7 + BR-8) —
> the shared-model `Image.kind` migration, the read-path type plumbing, and the
> backward-compatible write-path input contract. The CRUD screen, soft-delete, and
> `deletedAt` list-filter (BR-1..BR-6) carry no schema change and are covered by
> `story.md ## Data` + the build; they are out of scope here.
>
> Owner of the Technical dimension at G2. This is a build-ready contract for `backend`
> to implement — no production code / no migration was executed in this slice (docs-only).

## Data model

### Schema diff (against the REAL `prisma/schema.prisma` `model Image`, lines 740–756)

Additive only. Two edits: a new `enum ImageKind` + one column on `model Image`.

```prisma
// NEW — place adjacent to `model Image` for locality (backend's exact placement call).
enum ImageKind {
  PHOTO
  PANORAMA
}

model Image {
  id         String    @id @default(uuid())
  url        String
  alt        String?
  kind       ImageKind @default(PHOTO) // [Public] 360/pano marker (CAM-352). PANORAMA = wide-strip pano, NOT equirectangular sphere.
  sortOrder  Int       @default(0)
  campSiteId String?
  campSite   CampSite? @relation(fields: [campSiteId], references: [id], onDelete: Cascade)
  spotId     String?
  spot       Spot?     @relation(fields: [spotId], references: [id], onDelete: Cascade)
  reviewId   String?
  review     Review?   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  createdAt  DateTime  @default(now())

  @@index([campSiteId])
  @@index([spotId])
  @@index([reviewId])
}
```

**Atomic / classification (Resolution Boundary):** `kind` is a single independently-queryable
Pixel — you can `where: { kind: 'PANORAMA' }`, it differs in meaning from `url`/`alt`/`sortOrder`,
and a future viewer reads it separately. Split-correct (not crammed into `url` or `alt`).
Classification **[Public]** (a gallery photo's medium is not PII/Financial/Geo). No index added:
`kind` is never a lead filter — galleries are already scoped by `campSiteId`/`spotId`/`reviewId`
(all indexed) and read as whole rows; an index on a 2-value enum on a small child table would be
dead weight (add only if a real "list all panoramas" query appears).

**Naming (durable, cross-story):** value is `PANORAMA`, **not** `PANO_360`. An iPhone Pano is a
**wide horizontal strip**, not a spherical/equirectangular 360. The value + the future viewer
(CAM-355) must not assume a sphere. Recorded as Decision D1 below.

### Migration plan — additive, reversible, no backfill

Postgres (`provider = "postgresql"`, schema line 9). Prisma emits:

```sql
-- up
CREATE TYPE "ImageKind" AS ENUM ('PHOTO', 'PANORAMA');
ALTER TABLE "Image" ADD COLUMN "kind" "ImageKind" NOT NULL DEFAULT 'PHOTO';
```
```sql
-- down (reverse)
ALTER TABLE "Image" DROP COLUMN "kind";
DROP TYPE "ImageKind";
```

- **No value backfill needed.** `NOT NULL DEFAULT 'PHOTO'` fills every existing `Image` row
  (CampSite + Spot + Review galleries alike) at `ALTER` time. On Postgres 11+ a `NOT NULL`
  column with a *constant* default is a metadata-only change — **no table rewrite, no lock storm**
  (EC-9 "backfills to PHOTO implicitly via the column default" is satisfied by the DB, not by a data script).
- **Reversible.** `down` drops the column then the type — full reverse, zero data loss on the
  reverse (only the `kind` marker is lost, which is the intent of a rollback). Stronger than the
  project's pre-launch baseline (ADR-000 index cross-cutting note allows reset+reseed); this one
  needs neither.
- **Test on Staging before prod:** `migrate up → down → up` on the Staging DB (reversibility proof),
  per `.claude/rules/ops.md` + `docs/RUNBOOK-db-migrations.md`. Suggested migration dir name
  (mirrors the repo pattern `YYYYMMDDHHMMSS_cam###_slug`): `<ts>_cam352_image_kind`.

## API contract

No new endpoint. All six existing Image-writing handlers keep their path/method/authz/error set;
the only change is the **image-input shape** they accept and one **response TYPE** addition. Authz
per endpoint is unchanged (already enforced — restated for the traceability map):

| Endpoint | Method | Authz (existing, unchanged) | Change in THIS slice |
|---|---|---|---|
| `/api/campsites/[id]/spots` | POST | `requireCampSitePermission(id, CAMPSITE_UPDATE)` → 403 | accepts `images: (string \| {url,kind})[]`; persists `kind` |
| `/api/campsites/[id]/spots/[spotId]` | PUT | `CAMPSITE_UPDATE`, IDOR-scoped `{id, campSiteId}` → 403/404 | accepts + replaces `kind` |
| `/api/campsites` | POST | `requireAuth` + operator scope → 401/403 | accepts `kind` (shared `<ImageUpload>` emits it) |
| `/api/campsites/[id]` | PUT | camp ownership → 403/404 | accepts `kind` |
| `/api/campgrounds/[id]` | PUT | camp ownership → 403/404 (legacy alias, uses `campSiteSchema`) | accepts `kind` |
| `/api/campgrounds` | POST | `requireAuth` (uses `campSiteSchema`) | accepts `kind` |

Error set unchanged and already complete on these routes: `400` (zod) · `401` (unauth) ·
`403` (no permission) · `404` (not found / cross-camp IDOR) · `500` (generic, detail logged
server-side via `apiError`). `409` N/A for image writes (no uniqueness/state conflict on a gallery).

## Blast-radius — every surface that reads/writes an `Image` row

`Image` is SHARED (polymorphic via nullable FKs `campSiteId`/`spotId`/`reviewId` — one row belongs
to exactly one of CampSite | Spot | Review). Verified each surface against code. **Key insight
that makes this cheap:** read paths that use `include: { images }` inherit `kind` at runtime for
free; the ONE read path that uses `select` (`campCardSelect`) is insulated and correctly stays
that way.

| # | Surface | File (verified) | Reads/Writes | Carries `kind`? | Change: now / later / never |
|---|---|---|---|---|---|
| 1 | Camp detail read | `lib/spot-aggregation.ts:48` `getCampSiteWithCapacity` `include:{images}` | read (full rows) | **rides free at runtime** | **no code change** — payload gains `kind` automatically |
| 2 | Spot list read | `app/api/campsites/[id]/spots/route.ts:37` GET `include:{images}` | read (full rows) | **rides free** | **no code change** |
| 3 | Spot single read | `app/api/campsites/[id]/spots/[spotId]/route.ts:38` GET `include:{images}` | read (full rows) | **rides free** | **no code change** |
| 4 | Catalog card read | `lib/read-models/camp-card.ts:39` `campCardSelect` `select:{url,sortOrder}` | read (explicit SELECT) | **does NOT ride** (select insulates) | **NEVER change** — cards don't branch on `kind`; keeping `select` prevents over-fetch. PO claim ✅ |
| 5 | Response TYPE — Spot | `types/api.ts:74` `SpotDTO.images?: {url}[]` | type only | must gain `kind?` | **change now** (additive optional) |
| 6 | Response TYPE — CampSite/wishlist | `types/api.ts:139` `CampSiteSummary.images?: {url}[]` | type only | wishlist card = catalog-equivalent, no viewer | **leave as-is** (adding `kind?` here is harmless but unused — omit to stay lean) |
| 7 | Image write helper | `lib/api-utils.ts:74,78` `imageCreateNested`/`imageReplaceNested(urls: string[])` | write (all 6 routes) | must accept + persist `kind` | **change now** — widen to a union input (below) |
| 8 | Spot write zod | `lib/validations/spot.ts:15` `images: array(string.url)` | input contract | must accept `kind` | **change now** (union) |
| 9 | Camp write zod | `lib/validations/campsite.ts:115` `images: array(string.url)` | input contract | must ACCEPT `kind` | **change now** (union) — see CORRECTION below |
| 10 | Shared upload component | `components/ImageUpload.tsx:11` `value: string[]` / `onChange:(string[])=>void` | UI write source | must carry per-image `kind` | **change now** (frontend build; contract = `string[]` → `{url, kind}[]`, default `PHOTO`) |
| 11 | Legacy camp zod | `lib/validations/campground-legacy.ts:85` `campgroundSchema` | — | **zero importers (dead code)** | **NEVER** — unused; out of scope (Info) |
| 12 | Review galleries | `Review.images` relation | inherits column | default `PHOTO`, no behavior change | **never** (this story) |

### Corrections vs the PO's blast-radius claims

- **PO claim "detail + spot routes use include (kind rides free)": CONFIRMED** (rows 1–3). Nuance
  the PO already flagged and I confirm: the runtime rows carry `kind`, but the response **TYPE**
  `SpotDTO.images` (row 5) enumerates only `url`, so `types/api.ts` needs the additive `kind?`.
- **PO claim "catalog cards stay url + sortOrder": CONFIRMED** (row 4). The reason it's *safe* to
  leave unchanged is structural: `campCardSelect` is a `select` (not an `include`), so a new column
  does not leak into it — no over-fetch, no viewer branch on the card. Do not touch.
- **PO claim "spot image input contract goes `string[]` → `{url,kind}[]`": PARTIALLY CORRECT —
  UNDERSTATED. [Important]** The two helpers `imageCreateNested`/`imageReplaceNested` are shared by
  **6 route handlers across camp AND spot** (rows 7, and all of the API-contract table), not spot
  create/update only. And the input shape lives in **`campSiteSchema` too** (row 9), not just
  `spotSchema` — because the SHARED `<ImageUpload>` (row 10) is used by `CampgroundForm.tsx:616`
  for the camp gallery. Once the component emits `{url,kind}[]`, the camp create/update zod MUST
  accept that shape **or every camp save 400s**. So the zod change list is **two schemas**
  (`spot.ts` + `campsite.ts`), applied via one shared union so the widened helper and every route
  stay backward-compatible. Getting this wrong (widening the helper signature to `{url,kind}[]`
  while leaving `campSiteSchema` at `string[]`, or vice-versa) is the trap that breaks camp saves.
- **New find (not in the PO trace): [Info]** `lib/validations/campground-legacy.ts` `campgroundSchema`
  also has `images: array(string.url)` but has **zero importers** — dead code. Do NOT change it;
  do NOT delete it in this slice (out of surface).

## Write-path contract (backward-compatible by addition — `api.md` rule 12)

The existing shape is `string[]`. The dispatch requires existing `string[]` callers to keep
working. Design a **union input normalized to `{url, kind}`**, so the payload may be EITHER the old
`string[]` OR the new `{url, kind}[]` (or a mix). This keeps cached forms / any older client alive.

**1. Shared zod primitive** (recommend a tiny new `lib/validations/image.ts`, or inline in each):

```ts
export const imageKindEnum = z.enum(['PHOTO', 'PANORAMA']); // mirrors Prisma enum ImageKind

// Accepts BOTH shapes; normalizes to a stable object so downstream code sees one shape.
export const imageInputSchema = z.union([
  z.string().url().transform((url) => ({ url, kind: 'PHOTO' as const })), // legacy shape → default PHOTO
  z.object({ url: z.string().url(), kind: imageKindEnum.default('PHOTO') }),
]);
export type ImageInput = z.infer<typeof imageInputSchema>; // { url: string; kind: 'PHOTO' | 'PANORAMA' }
```

**2. Apply to the two schemas that need it** (exactly these — enumerated):

- `lib/validations/spot.ts` — `images: z.array(imageInputSchema).optional()` (was `z.array(z.string().url())`).
- `lib/validations/campsite.ts` — `images: z.array(imageInputSchema).optional()` (same).
- **Do NOT touch** `lib/validations/campground-legacy.ts` (dead) and everything the catalog card reads.

**3. Widen the helper** (`lib/api-utils.ts`) to accept the union and persist `kind`; keep the raw
`string` branch so any un-migrated caller still compiles and behaves identically:

```ts
type ImageWriteInput = string | { url: string; kind?: ImageKind };
const norm = (items: (ImageWriteInput)[] | undefined | null) =>
  (items ?? [])
    .map((it) => (typeof it === 'string' ? { url: it, kind: 'PHOTO' as const } : it))
    .filter((it) => Boolean(it.url))
    .map((it, i) => ({ url: it.url, sortOrder: i, kind: it.kind ?? 'PHOTO' }));

export const imageCreateNested  = (items) => ({ create: norm(items) });
export const imageReplaceNested = (items) => ({ deleteMany: {}, create: norm(items) });
```

- Order preservation via `sortOrder` (unchanged behavior). `kind` omitted still lands as `PHOTO`
  (column default), so even a caller that never learns about `kind` is correct.
- No route handler body changes are required beyond passing `data.images` through unchanged — the
  routes already call `imageCreateNested(data.images)` / `imageReplaceNested(data.images)`; after
  the zod normalization, `data.images` is `{url,kind}[]` and the widened helper consumes it.

**Boundary check:** client → `<ImageUpload>` → `/api/*` route → zod → helper → Prisma. No client
hits Prisma directly; `kind` is validated at the boundary; the component is UI-only. Boundary intact.

## Decisions (MADR-style — recorded here in lieu of full ADRs; each carries a Confirmation)

### D1 — Flat `Image.kind` enum marker on the shared polymorphic model; `PANORAMA` = wide-strip, not sphere
- **Context.** 360/pano support confirmed; lay structure now, viewer later. `Image` is shared across
  CampSite/Spot/Review galleries.
- **Decision.** Store the medium as one additive enum Pixel `kind ImageKind @default(PHOTO)` on the
  existing `Image` row — NOT a separate `PanoramaImage` table, NOT a boolean, NOT a URL-encoded flag.
  Value `PANORAMA` is a **wide-strip** panorama; the future viewer must not assume equirectangular.
- **Alternatives rejected.** (a) Separate table — over-normalizes a 2-value attribute, breaks the
  single-gallery read, N+1 risk. (b) `isPanorama Boolean` — not extensible if a real spherical `PANO_360`
  or `VIDEO` medium arrives; an enum is the lean-but-open choice. (c) `PANO_360`/equirectangular naming
  — factually wrong for iPhone Pano; would mislead the viewer story.
- **Confirmation.** A migration test asserts `up → down → up` on Staging is clean; an integration test
  asserts an upload marked panorama persists `kind = 'PANORAMA'` and rides the DETAIL + SPOT payloads,
  an unmarked one persists `'PHOTO'`, and the catalog-card payload has no `kind`. The wide-strip
  semantic is enforced only by the schema comment + the CAM-355 stub (no tooling can assert "not a
  sphere") — flagged so it does not silently drift.

### D2 — Backward-compatible union input, not a breaking `{url,kind}[]` swap
- **Context.** `api.md` rule 12: change a contract by adding, never by breaking an existing field's type.
  Six routes + a shared helper + a shared component consume the image-input shape.
- **Decision.** Accept `z.union([string.url, {url, kind}])`, normalize to `{url, kind}` (default `PHOTO`).
  Old `string[]` payloads keep working end-to-end.
- **Alternatives rejected.** Hard swap `string[]` → `{url,kind}[]` on the helper signature — breaks the
  4 camp routes + the legacy alias at compile time and 400s any cached client; violates rule 12.
- **Confirmation.** A unit/contract test posts a legacy `images: ["https://…"]` payload to spot POST
  **and** camp POST and asserts `200/201` + persisted `kind = 'PHOTO'` (proves no regression); a second
  test posts `[{url, kind:'PANORAMA'}]` and asserts persistence. If either fails, the decision is violated.

### ADR verdict — NOT a full ADR (recorded here instead)
Judged against `.claude/rules/architecture.md` §16–17 ("hard-to-reverse OR cross-module"):
- The **migration mechanics are trivially reversible** (drop column + drop type, no backfill, no rewrite)
  — that half is not ADR-class.
- It **is cross-module** (shared model), but the change is purely additive with a default and zero
  behavior change to Review — "wide but shallow" blast radius, fully captured by the table above + D1/D2.
- The one genuinely sticky, ADR-worthy decision is **the future viewer's projection model**
  (equirectangular vs cylindrical vs flat-strip) **and the new viewer dependency's justification** —
  that decision belongs to **CAM-355** (the viewer slice), where it will get its own ADR alongside the
  `security.md` rule-6 dependency gate. Manufacturing an ADR now for a droppable enum column is
  premature (Iron Rule #6 / architecture §3 "Lean > complete").
- **What would flip this:** if the owner wants a durable, cross-cutting home for the wide-strip
  semantic *before* CAM-355 exists, promote D1 to a one-page `ADR-013-image-kind-panorama-marker.md`
  (PROPOSED) — low cost. I judged it not yet warranted; raising it as an open item at G2.

## CAM-355 orientation stub — enforcement-parity (do NOT design here; 3–5 lines to orient the future story)
> Sanity-check of the PO's framing, per dispatch. **Decision axes only — no design.**
- **Source of truth for PER-SPOT capacity:** derive live from non-deleted spots
  (`lib/spot-aggregation.ts` `calculateSpotCapacity`, gated by `campSite.useSpotView`) **vs** a persisted
  denormalized column (`maxGuestsPerDay` / CAM-304 `spotCount`) kept in sync on spot mutation.
- **Read-through vs persist:** compute-on-the-fly at read (current behavior) vs materialize at write-time
  for the booking-lock path (ADR-006 serializable txn) — the enforcement read MUST use the same
  `deletedAt: null` filter as BR-1 so the booked capacity matches the displayed capacity (no over-book
  on a soft-deleted spot).
- **Ticket-number note [Info]:** the dispatch labels this follow-up "CAM-355", but `story.md`
  Out-of-scope maps **CAM-355 = the interactive 360 viewer** and the enforcement-parity follow-up to the
  "CAM-351 enforcement-parity" line. Numbering to be reconciled by the orchestrator/PO — I did not assign
  a ticket id (no ticket-DB access; STOP RULE 1 on a spec/dispatch mismatch → report, don't improvise).

## Confirmation summary (tests to demand from the build — Self-verify BR-7/BR-8)
1. **Migration reversibility** — `up → down → up` clean on the Staging DB.
2. **Backward-compat** — legacy `images: string[]` payload → spot POST **and** camp POST return `201`
   and persist `kind = 'PHOTO'`.
3. **New shape** — `images: [{url, kind:'PANORAMA'}]` persists `kind = 'PANORAMA'`; unmarked → `'PHOTO'`.
4. **Read rides through** — DETAIL (`getCampSiteWithCapacity`) + SPOT payloads include `kind`;
   catalog-card payload does NOT include `kind` and cards still render.
5. **Existing rows** — pre-existing `Image` rows read as `PHOTO` post-migration (column default).

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` (`model Image`, lines 740–756) ·
`story.md` (## Data, BR-7/BR-8, AC-11, EC-9) · `.claude/rules/api.md` (rule 12) ·
`.claude/rules/architecture.md` (§10 Resolution Boundary, §16–17 ADR lifecycle/doubt-driven)

## Changelog
- v1 (2026-07-04) — created. G2 technical pass for the `Image.kind` panorama groundwork: schema diff
  (additive/reversible, no backfill), verified 12-row blast-radius table (2 corrections vs the PO's
  claims: shared 6-route helper + `campSiteSchema` must accept `kind`; legacy `campgroundSchema` is dead
  and out of scope), backward-compatible union write-path contract (2 zod schemas via one shared
  primitive), D1/D2 decisions + Confirmation, ADR verdict = NOT now (viewer-projection ADR deferred to
  CAM-355), CAM-355 enforcement-parity orientation stub + ticket-number reconciliation flag.
