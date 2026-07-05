---
linear: CAM-362
feature: data-trust
epic: availability-correctness-ว่างจริง-blockeddate-part (CAM-22)
persona: Host
artifact: tech
owner: architect
status: In Progress
version: v1
updated: 2026-07-05
---
# Tech — Zone entity (per-camp reusable zones) (CAM-362)

> Rich API contract — this file is the G2 technical hand-off to `backend`/`frontend`.
> The Zone entity extracts the free-text `Spot.zone` string into a per-camp reusable
> Set, so a host creates a zone once and reuses it across spots. Direction is FINAL
> (owner-approved plan); the trade-offs still open for the human are collected in
> §0.3 — they are surfaced, not silently decided.

## 0. Summary, traceability, and open decisions

### 0.1 What ships in round 1 (CAM-362)

- A `Zone` Set (per-camp, soft-deletable) + `Spot.zoneId` FK.
- A reversible migration that **backfills** existing `Spot.zone` strings on staging into real `Zone` rows (owner-directed — see §0.3-A for the tension this creates with the recorded pre-launch convention).
- `/api/campsites/[id]/zones` (GET list · POST create) + `/api/campsites/[id]/zones/[zoneId]` (DELETE = soft-delete + detach-in-one-transaction).
- The host spot-management surface wired to the entity (dropdown of live zones on the spot form; zone badge on the host spots page reads the entity, not the string).

Out of round 1 (named follow-ups, §3.4 / §4.3): PATCH/rename · client-orderable `sortOrder` · switching the public detail page + booking read-paths off the `Spot.zone` string onto the Zone relation (CAM-361 grouping does that).

### 0.2 Traceability (design element → why)

| Owner requirement (locked default) | Design element |
|---|---|
| Per-camp scope, no global list | `Zone.campSiteId` FK + `@@index` + partial-unique scoped per camp (§1, §2) |
| Create once, reuse across spots | `Spot.zoneId` FK → one Zone row referenced by many spots (§1) |
| Add / remove from host UI | POST create · DELETE soft-delete (§3.2, §3.3) |
| Delete a zone with attached spots → DETACH to no-zone + warn with count | DELETE returns `detachedSpotCount`; detach = `UPDATE spots SET zoneId = null` in the SAME transaction as the soft-delete (§3.3) |
| Soft-delete semantics | `Zone.deletedAt` + CAS `where { deletedAt: null }`; partial-unique index `WHERE deletedAt IS NULL` so a deleted name is re-creatable (§1, §2, §3.2) |

### 0.3 Open decisions surfaced for G2 (do NOT let the build assume — the human picks)

- **A. Backfill vs the recorded pre-launch clean-reset convention (must confirm).** `docs/adr/ADR-000-index.md` §Cross-cutting records the standing convention: *"pre-launch → clean breaking migration + DB reset + re-seed (no backfill/expand-contract)."* The owner's FINAL direction for CAM-362 is the opposite — **preserve the real staging zone strings via a backfill**. This is a deliberate, defensible exception (host-entered zone names on staging are worth keeping), and this contract is designed for the backfill path. Flagging it because it contradicts a recorded convention: **confirm the exception at G2** (the alternative is drop-and-reseed, which is simpler but discards the staging strings). Recommendation: keep the backfill — it is low-risk (additive column, lossless rollback per §2.3) and there is repo precedent for hand-written backfill SQL in a Prisma migration (`prisma/migrations/20260626120330_agg1_maintained_rating`).
- **B. `Spot.zone` string continuity for booking/detail reads (T1 vs T2).** Four read consumers still render the `Spot.zone` string (booking list, operator bookings, booking detail, public detail — see §5). Two ways to keep them correct in round 1:
  - **T1 (recommended) — denormalize on write:** when a spot is saved with a `zoneId`, also mirror `Spot.zone = Zone.name`. Zero code change to those four consumers, zero user-visible regression. Cost: `Spot.zone` becomes a display-mirror of `Zone.name` — safe ONLY while zones have no rename (round 1 has no PATCH), and the rename follow-up MUST either fan-out the update or switch those reads to the relation (§4.3). This is a *display* mirror, not a second source of truth for *membership* (that is `zoneId`).
  - **T2 — no denormalize:** leave `Spot.zone = null` for entity-linked spots; the four consumers show no zone label for new spots until CAM-361 switches them to the Zone relation. Cleaner single-source data model; minor display degradation in the interim.
  - Recommendation: **T1** for round-1 continuity, with the rename constraint recorded loudly (§4.3). Owner picks at G2.
- **C. Case/whitespace uniqueness normalization.** Recommended default: duplicate detection is **case-insensitive + trim + internal-whitespace-collapsed** (so `"โซน A"`, `"โซน a"`, `"โซน  A "` collide). Owner-vetoable — if hosts should be allowed exact-case variants, drop to case-sensitive (§2.1, §3.2).
- **D. Name bounds.** Recommended `1..50` chars after trim, no special-character regex (a label may legitimately contain a space / `-` / `&`; live values are short: `โซน A`, `โซน VIP`, `ริมน้ำ`, `วิวหลัก`, `โซนเงียบ`, `โซนครอบครัว`). Owner-vetoable (§3.2).

---

## 1. Data model — schema diff

Diffed against the real `prisma/schema.prisma` on `origin/staging` (branch base `3bd96a1`): there is **no** `Zone` model today; `Spot.zone` is `String? // Zone name` (line 427).

### 1.1 New `Zone` Set

```prisma
// CAM-362 — per-camp reusable zone. Extracts the free-text Spot.zone string
// into a queryable Set (Pixel · Set · Buffet). Scope is per-camp (campSiteId),
// never a global list. Soft-deletable: a delete DETACHES attached spots to
// no-zone (Spot.zoneId = null) inside one transaction, it does NOT remove
// inventory. Uniqueness of `name` among LIVE rows is enforced by a PARTIAL
// unique index declared in the migration SQL (Prisma cannot express
// `WHERE deletedAt IS NULL` in-schema — see tech.md §2.1); the plain
// @@index below is for lookup only.
model Zone {
  id         String   @id @default(uuid())
  campSiteId String
  campSite   CampSite @relation(fields: [campSiteId], references: [id])
  name       String   @db.VarChar(50) // [Public] host-entered label, trimmed 1..50

  sortOrder  Int      @default(0) // display order; server-assigned in round 1 (no client input yet)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // soft-delete (business Set convention)
  version   Int       @default(1) // optimistic concurrency (business Set convention)

  spots Spot[]

  @@index([campSiteId, deletedAt]) // list live zones per camp (matches the GET where-clause)
  @@index([campSiteId, name])       // duplicate-name lookup on POST
  // NOTE: a UNIQUE index does NOT live here. The live-only uniqueness constraint
  // is `Zone_campSiteId_name_active_key` (partial, WHERE deletedAt IS NULL),
  // added by raw SQL in the migration (§2.1). Do not add @@unique([campSiteId,name])
  // — it would burn a name after soft-delete (see §2.1 "why not full unique").
}
```

Classification: `name` = **[Public]** (a host-facing label, no PII/Financial/Geo). Every Pixel passes the Resolution Boundary test — `name` is a single free-text label nobody filters sub-parts of; `sortOrder` is a distinct queryable Pixel (edited/ordered independently); `campSiteId` is the linking ID. Set metadata (`id`/`version`/`deletedAt`/`updatedAt`) present, matching the schema's stated business-Set convention (header comment at `schema.prisma` line 112).

### 1.2 `Spot` changes (additive)

```prisma
model Spot {
  id            String    @id @default(uuid())
  zone          String?   // DEPRECATED (CAM-362) — legacy free-text label. Kept as a
                          // fallback display string + the rollback anchor (§2.3). New
                          // writes go through zoneId; do NOT add new readers of this
                          // column. Retirement plan: api.md rule 12 — remove only after
                          // every read consumer (§5) has switched to the Zone relation.
  zoneId        String?   // CAM-362 — entity link; the source of truth for zone membership
  zoneRef       Zone?     @relation(fields: [zoneId], references: [id], onDelete: SetNull)
  // ...(all other fields unchanged)...

  @@index([campSiteId])
  @@index([zoneId]) // CAM-362 — detach-on-delete UPDATE + zone-grouped reads
}
```

- `zoneId` is **nullable** (a spot may have no zone; and it is null immediately after `ADD COLUMN`, before backfill) — this makes the column-add a metadata-only operation (§2.2).
- Relation field named `zoneRef` (not `zone`) because `zone` is the existing string column — avoids a name collision. `onDelete: SetNull` is a safety net only; soft-delete never fires it (the app detaches explicitly, §3.3).
- **`CampSite` gains** the back-relation `zones Zone[]` (add to the `CampSite` model's relation block; no column, no index change on CampSite itself).

### 1.3 DTO shape (for `types/api.ts` — backend adds; specified here)

```ts
export interface ZoneDTO {
  id: string;
  campSiteId: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}
// SpotDTO gains (additive):  zoneId?: string;
```

`deletedAt` / `version` are internal — NOT in the DTO (Buffet boundary: the client binds to the view, not the raw table).

---

## 2. Migration + backfill plan (reversible)

Single migration `<ts>_cam362_zone_entity`. Prisma will auto-generate the CreateTable / AddColumn / AddForeignKey / CreateIndex for the declared schema; the **backfill** and the **partial unique index** are NOT expressible in the Prisma schema and MUST be hand-appended to the generated `migration.sql` (repo precedent: `20260626120330_agg1_maintained_rating` ships a hand-written backfill `UPDATE`).

### 2.1 The uniqueness mechanism (the honest answer to the Prisma soft-delete limitation)

Requirement: `name` unique **per camp among LIVE rows only** — a soft-deleted `"โซน A"` must NOT block re-creating `"โซน A"`.

- **Why not `@@unique([campSiteId, name])`:** a Prisma/Postgres full unique constraint covers ALL rows including soft-deleted ones. After a host deletes `"โซน A"`, the tombstone row still occupies `(campSiteId, "โซน A")`, so re-adding it would wrongly 409. The name is "burned" on delete — a real UX trap given the owner flow is create + delete (re-adding a just-deleted name is a plausible host action).
- **Why not application-check-only:** a check-then-insert in the handler has a TOCTOU race (two concurrent POSTs both pass, both insert) — not airtight as the sole mechanism.
- **Chosen mechanism (partial unique index + app check):**
  1. Prisma schema declares a plain `@@index([campSiteId, name])` (lookup only, §1.1).
  2. Migration SQL adds the airtight backstop — a **partial, expression unique index**:
     ```sql
     CREATE UNIQUE INDEX "Zone_campSiteId_name_active_key"
       ON "Zone" ("campSiteId", (lower(btrim("name"))))
       WHERE "deletedAt" IS NULL;
     ```
     `lower(btrim(...))` makes the DB backstop match the app's case-insensitive + trimmed semantics (§0.3-C); `WHERE deletedAt IS NULL` scopes uniqueness to live rows so a deleted name is re-creatable. (Thai has no case → `lower()` is a no-op on Thai and only folds the Latin `A/B/C`.)
  3. The POST handler does a live-rows duplicate check for the friendly 409 Thai copy BEFORE the insert, and catches `P2002` from this index as the race backstop → also 409 (§3.2).
- **Honest caveats the builder must respect:** Prisma does not manage this index (it is not in the schema), so (a) it will NOT appear in `prisma migrate diff` from the schema — it lives only in the committed migration SQL; (b) a `prisma migrate reset` / regenerate-from-schema-alone would lose it — therefore it MUST stay in the committed migration and the reset/reseed runbook. The plain `@@index([campSiteId, name])` in-schema will not fight it (no unique declared in-schema). Confirmation for this in §6 (test #7).

### 2.2 UP — statement order + lock characteristics

Postgres DDL is transactional; the whole file runs atomically (no `CONCURRENTLY`, so it stays inside the migration transaction).

1. `CREATE TABLE "Zone" (...)` + its two plain indexes + FK to `CampSite`. New table → no lock on existing tables.
2. `ALTER TABLE "Spot" ADD COLUMN "zoneId" TEXT;` — nullable, no default → **metadata-only** in PG 11+ (brief `ACCESS EXCLUSIVE`, no table rewrite).
3. `CREATE INDEX "Spot_zoneId_idx" ON "Spot"("zoneId");` — `SHARE` lock (blocks writes, not reads) for the build. Trivial on staging's small table. *At prod scale, use `CREATE INDEX CONCURRENTLY` outside the txn — not needed pre-launch.*
4. `ALTER TABLE "Spot" ADD CONSTRAINT "Spot_zoneId_fkey" ... ON DELETE SET NULL;` — brief `SHARE ROW EXCLUSIVE`; validates existing rows (all `zoneId` NULL at this point) → instant.
5. **Backfill INSERT (hand-written)** — one Zone row per DISTINCT normalized live zone string per camp, deduped case-insensitively to satisfy the partial index:
   ```sql
   INSERT INTO "Zone" ("id","campSiteId","name","sortOrder","createdAt","updatedAt","version")
   SELECT DISTINCT ON (s."campSiteId", lower(btrim(s."zone")))
          gen_random_uuid(), s."campSiteId", btrim(s."zone"), 0, now(), now(), 1
   FROM "Spot" s
   WHERE s."zone" IS NOT NULL AND btrim(s."zone") <> '' AND s."deletedAt" IS NULL
   ORDER BY s."campSiteId", lower(btrim(s."zone")), s."createdAt";  -- deterministic representative
   ```
   (`gen_random_uuid()` is built into PG 13+; for < 13 the migration must `CREATE EXTENSION IF NOT EXISTS pgcrypto;` first — note for the builder.)
6. **Backfill LINK (hand-written)** — point each live spot at its Zone by normalized name:
   ```sql
   UPDATE "Spot" s SET "zoneId" = z."id"
   FROM "Zone" z
   WHERE z."campSiteId" = s."campSiteId"
     AND lower(btrim(z."name")) = lower(btrim(s."zone"))
     AND s."zone" IS NOT NULL AND s."deletedAt" IS NULL;
   ```
   `ROW EXCLUSIVE` on the updated Spot rows only.
7. **Partial unique index LAST (hand-written)** — created AFTER the INSERT so a backfill dedup bug surfaces as a loud index-build failure rather than silent duplicates:
   ```sql
   CREATE UNIQUE INDEX "Zone_campSiteId_name_active_key"
     ON "Zone" ("campSiteId", (lower(btrim("name")))) WHERE "deletedAt" IS NULL;
   ```

Note: the UP migration **never touches `Spot.zone`** — it only ADDS `zoneId`, backfills it, and creates the Zone table. That is what makes the rollback lossless (§2.3).

### 2.3 DOWN — reversibility guarantee

```sql
DROP INDEX IF EXISTS "Zone_campSiteId_name_active_key";
ALTER TABLE "Spot" DROP CONSTRAINT IF EXISTS "Spot_zoneId_fkey";
DROP INDEX IF EXISTS "Spot_zoneId_idx";
ALTER TABLE "Spot" DROP COLUMN IF EXISTS "zoneId";
DROP TABLE IF EXISTS "Zone";
```

**Reversibility guarantee (stated explicitly):** because UP never modifies `Spot.zone`, DOWN restores the exact prior state — every original `Spot.zone` string is still present. The ONLY thing lost on rollback is the extracted entity (Zone rows + the `zoneId` links) — the dispatch's accepted "backfill loss." No data-destroying rollback. Under T1 (§0.3-B), new entity-linked spots created after UP also carry a denormalized `Spot.zone` string, so they too revert cleanly to string-based zones.

### 2.4 Prove-on-local instruction for the builder

1. Reset local DB; seed a fixture that MIRRORS the real staging distinct strings across **≥2 camps** — `โซน A`, `โซน B`, `โซน C`, `โซน VIP`, `ริมน้ำ`, `วิวหลัก`, `โซนเงียบ`, `โซนครอบครัว` — and deliberately include an **intra-camp case/whitespace duplicate** (`"โซน A"` and `"โซน a "` on the same camp) plus one **soft-deleted spot** with a zone string (to prove `deletedAt` rows are excluded).
2. `npx prisma migrate dev --create-only` → open the generated `migration.sql` → hand-append steps 5–7 of §2.2 (Prisma will not generate them). Do the same for the `down`.
3. `npx prisma migrate dev` (apply) → assert: (a) Zone-rows-per-camp == DISTINCT normalized live zone strings per camp; (b) every live spot with a zone string has `zoneId` set and its `Zone.name` matches; (c) the case/whitespace duplicate collapsed to **ONE** Zone row and both spots point at it; (d) the soft-deleted spot contributed no Zone row.
4. Prove up→down→up is idempotent (`migrate reset` then re-apply), and that after DOWN `Spot.zone` strings are intact and `Zone`/`zoneId` are gone.
5. Inspect via `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` to confirm no unexpected drift (the partial index is intentionally invisible to diff — §2.1).

---

## 3. API contract — `/api/campsites/[id]/zones`

Conventions reused from the sibling routes (`app/api/campsites/[id]/spots/*`, `.../holds/*`): `requireCampSitePermission` for mutations, `apiSuccess`/`apiError` helpers, the private-camp `isCampSitePublic`/`canViewCampSite` gate that answers **404 (not 403)** to avoid information-disclosure, and `revalidateTag(campTag(id) ...)` cache busting on writes. Error shape is the existing `{ error: string, details? }` from `lib/api-utils.ts` (details exposed only on 4xx). Money N/A here (no financial fields).

### 3.1 GET `/api/campsites/[id]/zones` — list live zones

- **Authz:** mirror the **spots GET visibility gate** (NOT `requireCampSitePermission`). Public camp → readable by anyone; non-public camp → only a viewer (`canViewCampSite`) else 404. Rationale: zones are non-sensitive host-config labels and the CAM-361 public detail grouping will consume this list; gating behind `CAMPSITE_VIEW` would block that. (Decision noted for G2; low-stakes.)
- **Input:** path `id` (campSiteId). No body/query in round 1.
- **Query:** `prisma.zone.findMany({ where: { campSiteId: id, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id, campSiteId, name, sortOrder, createdAt, updatedAt } })` — single indexed query (`@@index([campSiteId, deletedAt])`), **no N+1**.
- **Output:** `200` → `ZoneDTO[]` (live only, `sortOrder` asc then `name` asc; empty array when none).
- **Errors:** `404` camp not found OR not viewable (no info-disclosure) · `500` server. `400` N/A (no input) · `401`/`403` deliberately folded into `404` for the private-camp case per the sibling pattern · `409` N/A.

### 3.2 POST `/api/campsites/[id]/zones` — create a zone

- **Authz:** `requireCampSitePermission(id, 'CAMPSITE_UPDATE')` (mirrors spot POST — creating a zone edits camp composition).
- **Input (zod — new `lib/validations/zone.ts`, shared client+server per ux.md #1):**
  ```ts
  export const zoneCreateSchema = z.object({
    name: z.string()
      .transform((s) => s.replace(/\s+/g, ' ').trim())   // collapse internal whitespace + trim
      .pipe(z.string().min(1, 'nameRequired').max(50, 'nameTooLong')),
  });
  ```
  `sortOrder` is NOT client-accepted in round 1 — server assigns `sortOrder = <count of live zones for this camp>` so new zones append (client-orderable is a follow-up, §0.1).
- **Duplicate rule (BR):** inside a `$transaction` — query live zones case-insensitively for the normalized name (`findFirst({ where: { campSiteId: id, deletedAt: null, name: { equals: normalized, mode: 'insensitive' } } })`); if found → `409`. Else create. Catch `P2002` (partial-unique race, §2.1) → `409` (same body). A previously **soft-deleted** name is NOT a duplicate → `201` (the partial index excludes tombstones).
- **Output:** `201` → the created `ZoneDTO`.
- **Errors (full set):** `400` zod (empty/whitespace-only → `กรุณากรอกชื่อโซน`; > 50 chars → `ชื่อโซนต้องไม่เกิน 50 ตัวอักษร`) · `401` not signed in · `403` no `CAMPSITE_UPDATE` · `404` camp not found · `409` duplicate live name → **`มีโซนชื่อนี้อยู่แล้ว`** · `500` server.
- **Cache:** on success `revalidateTag(campTag(id))` + slug tags (mirror spot POST) so a new zone surfaces on the detail page once CAM-361 consumes it.
- Thai copy above is the contract; it lands verbatim in `locales/` (frontend authors) — no em-dash, no jargon (ux.md / DESIGN.md).

### 3.3 DELETE `/api/campsites/[id]/zones/[zoneId]` — soft-delete + detach (one transaction)

- **Authz:** `requireCampSitePermission(id, 'CAMPSITE_UPDATE')` (per dispatch). Justified deviation from the spot-DELETE-uses-`CAMPSITE_DELETE` sibling: deleting a zone only **re-labels spots to no-zone** — it destroys no bookable inventory and no booking history (spots + their bookings survive untouched). It is an UPDATE-class edit, not a DELETE-class destruction. (Noted for G2; owner may prefer `CAMPSITE_DELETE` for symmetry.)
- **Behavior (atomic — the detach and the soft-delete MUST be one `prisma.$transaction`):**
  ```ts
  const detachedSpotCount = await prisma.$transaction(async (tx) => {
    // 1) CAS soft-delete, live-only + camp-scoped (no cross-camp IDOR, no double-delete race)
    const del = await tx.zone.updateMany({
      where: { id: zoneId, campSiteId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (del.count === 0) throw new NotFound();          // rolls back everything
    // 2) detach every LIVE attached spot to no-zone (membership cleared; Spot.zone string left as-is per §4.2)
    const detached = await tx.spot.updateMany({
      where: { campSiteId: id, zoneId, deletedAt: null },
      data: { zoneId: null },
    });
    // 3) audit (money-adjacent? no — but an important host-data mutation; api.md rule 8 + ADR-012 pattern)
    await tx.auditLog.create({ data: {
      actorId: session.user.id, action: 'zone.deleted',
      entityType: 'Zone', entityId: zoneId,
      metadata: { campSiteId: id, detachedSpotCount: detached.count },
    }});
    return detached.count;
  });
  ```
  Compare-and-swap on the zone (`updateMany where { id, campSiteId, deletedAt: null }`) mirrors the holds `DELETE` (`app/api/campsites/[id]/holds/[holdId]/route.ts`): a missing zone, a zone under another camp, or an already-deleted zone all answer `404` with zero rows changed and no separate find-then-update window. A concurrent double-DELETE → exactly one sees `del.count = 1` (detaches once), the other `del.count = 0` → `404`.
- **Output:** `200` → `{ success: true, detachedSpotCount: number }`. The count feeds the host's warning dialog ("ย้าย {N} จุดกางเต็นท์ออกจากโซนนี้" — copy authored by designer/frontend; the CONTRACT is the integer `detachedSpotCount`).
- **Errors (full set):** `401` not signed in · `403` no `CAMPSITE_UPDATE` · `404` zone not found / not live / cross-camp · `500` server. `400` N/A (no body) · `409` N/A.
- **Cache:** `revalidateTag(campTag(id))` + slug tags on success.

### 3.4 No PATCH / rename in round 1 (explicit)

Rename is a **follow-up story**, not this contract. When it ships as `PATCH /api/campsites/[id]/zones/[zoneId] { name }`, it carries the load-bearing consequence in §4.3 (under T1 it must fan-out `Spot.zone` on every attached spot, or the read-paths must switch to the Zone relation first). `sortOrder` reordering is the same follow-up class.

### 3.5 `schema/api-schema.json` entries (to transcribe at build — NOT edited in this PR)

This PR commits **only** tech.md; `schema/api-schema.json` is updated by `backend` at build. The entries to add:

```json
{
  "GET /api/campsites/[id]/zones": {
    "auth": "public camp → anyone; private camp → canViewCampSite else 404 (mirrors spots GET)",
    "input": { "id": "string (campSite uuid, path)" },
    "output": "ZoneDTO[] (live only, sortOrder asc, name asc)",
    "errors": { "404": "camp not found or not viewable", "500": "server" },
    "shape": "{ error: { message } }",
    "query": "zone.findMany where {campSiteId, deletedAt:null} — single indexed query, no N+1"
  },
  "POST /api/campsites/[id]/zones": {
    "auth": "requireCampSitePermission(id,'CAMPSITE_UPDATE')",
    "input": { "name": "string 1..50, trimmed + whitespace-collapsed" },
    "output": { "…ZoneDTO": "201" },
    "errors": {
      "400": "zod — empty → กรุณากรอกชื่อโซน / >50 → ชื่อโซนต้องไม่เกิน 50 ตัวอักษร",
      "401": "unauthenticated", "403": "no CAMPSITE_UPDATE", "404": "camp not found",
      "409": "duplicate live name → มีโซนชื่อนี้อยู่แล้ว", "500": "server"
    },
    "shape": "{ error: { message } }",
    "notes": "dup check case-insensitive+trim inside $transaction; P2002 (partial unique) → 409; soft-deleted name re-creatable"
  },
  "DELETE /api/campsites/[id]/zones/[zoneId]": {
    "auth": "requireCampSitePermission(id,'CAMPSITE_UPDATE')",
    "input": { "id": "campSite uuid", "zoneId": "zone uuid" },
    "output": { "success": true, "detachedSpotCount": "int" },
    "errors": { "401": "unauthenticated", "403": "no CAMPSITE_UPDATE", "404": "zone not found / not live / cross-camp", "500": "server" },
    "shape": "{ error: { message } }",
    "notes": "soft-delete + detach in ONE $transaction; CAS updateMany where {id,campSiteId,deletedAt:null}; audit zone.deleted"
  }
}
```

---

## 4. Read-path threading

### 4.1 Where the zones list rides (host surfaces)

**Decision: a separate `GET /api/campsites/[id]/zones` call, NOT an extended spots payload.**

- The host spots page (`app/dashboard/campsites/[id]/spots/page.tsx`) already fetches `/spots` + `/campsites/[id]` + `/auth/session` in ONE `Promise.all`. Add `/zones` as a fourth parallel request → still one round-trip, **no N+1**, no added latency in the critical path.
- Do NOT reshape the spots list response. `GET /spots` returns a bare `Spot[]` (`apiSuccess(spots)`); the page does `Array.isArray(spotsData) ? spotsData : []`, and the booking/operator consumers `select { spot: { zone } }`. Wrapping it as `{ spots, zones }` is a **breaking** change across all of those (api.md rule 12 — change by addition, never reshape an existing contract).
- The spot form dialog's zone `<input>` (currently free text, `components/spot-form-dialog.tsx`) becomes a `<Select>` over the live zones from `/zones` + an inline "create new zone" that POSTs `/zones` then re-selects — frontend's build, contract is `/zones`.

Rationale summary: a small extra parallel request is cheaper than a breaking payload reshape across four consumers; the zone list also has its own refetch lifecycle (a host adds/removes zones without refetching every spot).

### 4.2 Spot create/update — the `zoneId` transition contract

Extend `spotSchema` (`lib/validations/spot.ts`) **additively**:

```ts
zone:   z.string().optional(),                 // DEPRECATED (kept — backward compatible)
zoneId: z.string().uuid().optional(),          // NEW — the entity link
```

- **NOT strict XOR.** Both optional; **`zoneId` takes precedence** when present. Reason: forcing XOR-required would break every existing caller that still sends `zone`. This is a transition, not a cutover.
- **Resolution rule on write (spot POST/PUT):**
  - If `zoneId` present → validate it belongs to THIS camp and is live (`zone.findFirst({ where: { id: zoneId, campSiteId: id, deletedAt: null } })`; not found → `400`/`404` — no cross-camp IDOR). Set `Spot.zoneId`. Under **T1** (§0.3-B) also set `Spot.zone = <resolved Zone.name>` (denormalized display mirror); under **T2** set `Spot.zone = null`.
  - If only legacy `zone` string present → behave exactly as today (write `Spot.zone`, leave `zoneId` null). Unchanged path for un-migrated callers.
- On zone **detach** (DELETE, §3.3) the spot's `Spot.zone` string is left as-is (the string is a deprecated display fallback; membership is what detaches). The host spots page shows the spot as unzoned via `zoneId = null` (see §5 — that page's badge switches to the entity this story).

### 4.3 Detail-page grouping (CAM-361) + the rename constraint

- CAM-361 ships zone grouping **string-based first** (groups spots by the `Spot.zone` string). It switches to the entity by grouping on `zoneId` and reading the label from the included `Zone` relation (`spots: { include: { zoneRef: { select: { name } } } }`), or from the denormalized `Spot.zone` under T1. That switch is CAM-361's scope, not CAM-362's.
- **Load-bearing constraint to record now:** under **T1**, `Spot.zone` is a denormalized mirror of `Zone.name`. It is correct in round 1 ONLY because round 1 has no rename (§3.4). **When the rename follow-up ships, it MUST either** (a) fan-out `UPDATE Spot SET zone = <newName> WHERE zoneId = <id> AND deletedAt IS NULL` inside the rename transaction, **or** (b) first switch every §5 read consumer onto the Zone relation and stop reading the `Spot.zone` mirror. Do not ship rename without doing one of these — otherwise every attached spot's booking/detail label goes stale (architecture rule 12: a mirror that can silently drift from its source is the failure mode to avoid).

---

## 5. Blast-radius table — every `Spot.zone` consumer today

Grepped `app/`, `lib/`, `components/`, `types/`, `prisma/`, `__tests__/`. **Correction to the dispatch's assumed list:** `seed.ts` does **NOT** set `Spot.zone` (its `zone` matches are coincidental — `nameThSlug` and a `feeInfo`/`toiletInfo` sentence); only `bulk-seed` + `scrape-seed` write it. And `lib/listing-completeness.ts` has a criterion **named** `zones` but it reads `spotCount`/`maxGuestsPerDay`, **not** `Spot.zone` — it is NOT a consumer.

| # | Surface | File | Reads/Writes `Spot.zone` | Change NOW (CAM-362) or LATER |
|---|---|---|---|---|
| 1 | Spot POST/PUT write | `app/api/campsites/[id]/spots/route.ts`, `.../[spotId]/route.ts` | writes `zone` | **NOW** — accept + resolve `zoneId` (§4.2); keep `zone` write for legacy |
| 2 | Spot zod schema | `lib/validations/spot.ts` | — | **NOW** — add optional `zoneId` (§4.2) |
| 3 | Spot form dialog | `components/spot-form-dialog.tsx` | zone free-text input | **NOW** — free-text → `<Select>` over `/zones` + inline create (frontend) |
| 4 | Host spots page | `app/dashboard/campsites/[id]/spots/page.tsx` | badge reads `spot.zone` (line 233) | **NOW** — fetch `/zones` (4th parallel); badge reads the entity so detach visibly takes effect |
| 5 | `SpotDTO` type | `types/api.ts` | `zone?: string` | **NOW** — add `zoneId?: string` (additive) |
| 6 | Public detail spot section | `components/CampgroundDetailClient.tsx` (l.809) | reads `spot.zone` | **LATER (CAM-361)** — grouping switches to `zoneId`/relation; string keeps working meanwhile (T1) |
| 7 | Booking list read | `app/api/bookings/route.ts` (select `spot.zone`) | reads `spot.zone` | **LATER** — string kept; snapshot note below |
| 8 | Operator booking list | `app/api/operator/bookings/route.ts` | reads `spot.zone` | **LATER** — string kept |
| 9 | Booking detail read model | `lib/bookings.ts` (select `spot.zone`) | reads `spot.zone` | **LATER** — string kept |
| 10 | Booking detail view | `app/bookings/[id]/BookingDetailClient.tsx` (l.43, 225) | renders `spot.zone` | **LATER** — string kept (label continuity via T1) |
| 11 | bulk-seed | `app/api/bulk-seed/route.ts` (l.105) | writes `zone: 'Zone X'` | **LATER (optional)** — dev seed; can create Zone rows + `zoneId` for realism, non-blocking |
| 12 | scrape-seed | `app/api/scrape-seed/route.ts` (l.192) | writes `zone: 'Zone A'` | **LATER (optional)** — dev seed; same as above |
| — | listing-completeness | `lib/listing-completeness.ts` | **name coincidence — reads `spotCount`, not `Spot.zone`** | **NO CHANGE** |
| — | `prisma/seed.ts` | — | **does not set `Spot.zone`** (dispatch correction) | **NO CHANGE** |

Booking snapshot note (rows 7–10): a Booking already crystallizes `snapshotSpotName` (ADR-005) but NOT the zone. Round 1 leaves booking zone display reading the live `Spot.zone` string (as today) — no regression. If the human wants the booked zone frozen against later edits, that is a separate snapshot-a-new-pixel decision (out of scope; flag only).

---

## 6. Confirmation (MADR) — the test list the build MUST satisfy

A decision with no failing check drifts. Each row is the CI test that FAILS if the design is violated (`backend` + `qa` author these before Done):

| # | Guards | Test that must fail on violation |
|---|---|---|
| 1 | Backfill correctness | `__tests__/cam-362-zone-migration.test.ts` — on a fixture mirroring the real distinct strings across ≥2 camps: Zone-rows-per-camp == DISTINCT normalized live zone strings per camp; every live spot with a zone string has `zoneId` set + `Zone.name` matches; the intra-camp case/whitespace dup collapses to ONE Zone row; a soft-deleted spot contributes no Zone row |
| 2 | Reversibility | same file — up→down→up idempotent; after DOWN, `Spot.zone` strings intact and `Zone`/`zoneId` gone |
| 3 | Detach transactionality | `__tests__/cam-362-zone-delete.test.ts` — DELETE of a zone with N attached spots → all N `zoneId = null` AND `zone.deletedAt` set atomically; a forced mid-tx failure rolls BOTH back (no orphan detach, no half-delete); concurrent double-DELETE → exactly one `detachedSpotCount`, the other `404`, spots detached once |
| 4 | 409 duplicate + soft-delete semantics | `__tests__/cam-362-zone-api.test.ts` — POST same name (case/whitespace variant) twice → 2nd `409` + `มีโซนชื่อนี้อยู่แล้ว`; the partial unique index rejects a concurrent race insert (`P2002` → `409`); POST → DELETE → POST same name → `201` (deleted name re-creatable) |
| 5 | Name bounds | same file — empty/whitespace-only → `400` + `กรุณากรอกชื่อโซน`; > 50 chars → `400` + `ชื่อโซนต้องไม่เกิน 50 ตัวอักษร` |
| 6 | Authz / IDOR | same file — POST/DELETE without `CAMPSITE_UPDATE` → `403`; unauthenticated → `401`; a zone of camp B addressed under camp A's path → `404`; GET of a private camp by a non-viewer → `404` |
| 7 | Partial-unique index present after migrate | `__tests__/cam-362-zone-migration.test.ts` asserts the index `Zone_campSiteId_name_active_key` exists WITH `WHERE (deletedAt IS NULL)` (guards §2.1 caveat b — a reset that drops it fails here) |

Confirmation: the seven tests above (`__tests__/cam-362-zone-migration.test.ts`, `__tests__/cam-362-zone-delete.test.ts`, `__tests__/cam-362-zone-api.test.ts`) are the enforcement — any regression against this contract fails one of them. `npx prisma validate` guards the schema; `node scripts/ticket-sync.mjs audit` guards the story `## Data`.

---

## 7. ADR verdict

**Verdict: tech.md-decisions are sufficient — NO separate ADR for round 1.** Rationale:

- This is a **single, tactical field-extraction** on one existing model, not cross-module architecture. It matches the weight class of CAM-352 (spot soft-delete), CAM-353, and CAM-268 (atomic fee pixels) — all shipped as story + tech decisions referencing existing ADRs (003/005/006), none minting its own ADR.
- The two genuinely durable decisions — (a) the **partial-unique-index `WHERE deletedAt IS NULL`** mechanism (the Prisma soft-delete-limitation workaround future migrations must not clobber, §2.1) and (b) the **deliberate deviation from the pre-launch clean-reset convention** to run a real backfill (§0.3-A) — are recorded here with MADR Confirmation (test #7 for (a); the reversibility guarantee §2.3 + owner G2 confirmation for (b)). That is enforceable without a standalone ADR.
- **Promotion trigger (stated, not premature):** if the "free-text → normalized entity with a deprecated-string fallback + partial-unique-live index" pattern is reused a SECOND time (e.g. extracting `Spot.environment` or `Spot.nearFacilities`), promote it to a real ADR then (ADR-on-second-occurrence, per architecture rule 3 lean + rule 16 lifecycle). Round 1 does not clear that bar.

If the owner prefers the decision recorded as a durable ADR regardless (it does touch a recorded cross-cutting convention), the fastest path is a short `ADR-013-freetext-to-entity-extraction.md` (Context = §0.3-A tension · Decision = §1/§2 · Alternatives = full-unique / app-check-only / clean-reset · Consequences = §2.1 caveats + §4.3 rename constraint). Flagged as an owner call at G2 — not authored here (this PR is tech.md only).

## Links

`../../feature.md` · `../epic.md` (CAM-22) · `prisma/schema.prisma` (Spot l.425) · sibling routes `app/api/campsites/[id]/spots/*` + `.../holds/[holdId]/route.ts` · `docs/adr/ADR-000-index.md` (§Cross-cutting) · `docs/adr/ADR-005-booking-snapshot.md` · `docs/adr/ADR-012-hostos-data-model.md` · `schema/api-schema.json` (entries transcribed by backend, §3.5)

## Changelog
- v1 (2026-07-05) — G2 tech contract authored: Zone Set + `Spot.zoneId`, reversible backfill migration + partial-unique-live-index mechanism, `/zones` GET/POST/DELETE contract with full error sets + Thai copy, read-path threading (separate `/zones` call · `zoneId` transition · CAM-361 grouping) + rename constraint, blast-radius table (with `seed.ts`/`listing-completeness` corrections), MADR confirmation list, ADR verdict (tech.md sufficient). Open decisions A–D surfaced for G2.
