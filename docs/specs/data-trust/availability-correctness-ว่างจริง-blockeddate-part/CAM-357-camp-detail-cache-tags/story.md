<!--
ticket: CAM-357
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold) (CAM-22)
feature: Data & Trust
status: Draft (spec-lite, folded into the G3 packet)
version: v1
spec-class: LITE (S) — bug fix in the existing cache-freshness seam CAM-353's BR-8 flagged and
  peeled to a follow-up. No schema/migration · no new API contract (fixes wiring on an existing
  endpoint's write path, no new endpoint/route) · file-surface is lib/catalog-cache.ts (the cache
  wrapper) + app/api/campsites/[id]/route.ts (the one writer that was missing the bust) · diff is
  the wrapper refactor + a 4-line writer addition, well under the ~150-line spec-lite ceiling.
  G1 folds into the G3 packet per the gate policy v2 spec-lite class.
persona: Host
-->

## Story
As a **Host**, I want an edit I make to my camp or its spots/zones to appear on the public camp-detail page right away, so that I don't have to wonder whether my save actually worked or wait up to 5 minutes wondering if the camper is seeing stale info.
Why: CAM-353's BR-8 already flagged this cache-freshness seam and the spot/zone writers were wired to call `revalidateTag(campSlugTag(slug))` on that assumption (CAM-353/CAM-362) — but `getCampBySlug`'s `unstable_cache(..., { tags: [] })` fixes its tag set at module-load time, so every one of those calls has been silently inert since the cache was activated (CAM-195). Freshness has been relying on the 5-min TTL alone with no visible symptom (the page eventually updates), which is why it went unnoticed until this audit.
Scope: fix the cache-wrapper so it carries a REAL per-slug tag, and extend the one writer (`PUT`/`DELETE /api/campsites/[id]`) that was not already calling `revalidateTag(campSlugTag(...))` (the spot and zone writers already do — CAM-353 BR-8 / CAM-362 — and are left unchanged, now covered by a regression-guard test). No new endpoint, no schema change, no UI change.
Depends on: CAM-195 (cache activation, MERGED) · CAM-353 (spot section + BR-8 flag, MERGED) · CAM-362 (zone entity, MERGED).

## AC
<!-- Then = user-visible (verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host edits a published camp's price/name/description via the edit form and saves | Host saves the edit | The camp detail page (opened right after, by the host or a camper) shows the new value immediately — no stale value, no need to wait or hard-refresh | `getCampBySlug`'s cache entry for that camp's slug is busted the same request the write completes (`revalidateTag(campSlugTag(...))`, in addition to the existing `campTag(id)` + `CATALOG_TAG` busts) | EC-1 |
| AC-2 | A host deletes a camp | Host confirms the delete | The camp's detail page no longer resolves (404) right away, not up to 5 minutes later | The slug-keyed cache entry is busted using the already-returned deleted row (no extra lookup) | EC-2 |
| AC-3 | A host adds/edits/removes a spot or a zone on a camp (existing CAM-353/CAM-362 behavior) | Host saves the spot/zone change | The camp detail page reflects the change immediately (unchanged from today — this ticket does not touch these writers' behavior) | The existing `revalidateTag(campSlugTag(...))` calls in the spot/zone handlers now actually reach the cache entry (previously inert) | — (regression-guard, not a new behavior; covered by AC-1's mechanism) |

## Rules
- BR-1 **`unstable_cache`'s `tags` option is fixed at wrap time, not per call.** A module-level `unstable_cache(fn, keyParts, { tags: [...] })` can only carry a tag value known at import time — it cannot read a per-call argument (like the resolved slug). `getCampBySlug` must build its `unstable_cache(...)` wrapper **inside** the exported function, once per call, so `tags: [campSlugTag(slug)]` reads the real runtime slug. (proves AC-1, AC-2, AC-3)
- BR-2 **This does not turn every call into a fresh cache miss.** `unstable_cache`'s persisted store is looked up by a hash of `keyParts` (here `['camp-detail', slug]`) plus the call's serialized arguments — not by the JS identity of the `unstable_cache(...)` call site. Two calls for the same slug hash to the same key and hit the same entry; two calls for different slugs hash to different keys and get independent entries. (proves AC-1's "no regression to cache-hit behavior")
- BR-3 **Every writer that can change what a slug's detail page shows must bust that slug's cache entry.** `PUT`/`DELETE /api/campsites/[id]` must call `revalidateTag(campSlugTag(nameThSlug))` + `revalidateTag(campSlugTag(nameEnSlug))`, in addition to the pre-existing `campTag(id)` + `CATALOG_TAG` busts (unchanged, still fire). The spot (`.../spots/route.ts`, `.../spots/[spotId]/route.ts`) and zone (`.../zones/route.ts`, `.../zones/[zoneId]/route.ts`) writers already call both slug tags (CAM-353 BR-8 / CAM-362) and are unchanged by this ticket — a regression-guard test locks the count so a future refactor can't silently drop one. (proves AC-1, AC-2, AC-3)
- BR-4 **No extra Prisma round-trip.** The `PUT` handler already returns the updated row (with `nameThSlug`/`nameEnSlug`) from `prisma.campSite.update(...)`; the `DELETE` handler's `prisma.campSite.delete(...)` also returns the full deleted row by default. Both busts read the slug off that existing return value — no added `findUnique`/`findFirst` lookup. (proves AC-2, no N+1)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF a host edits a camp whose slug the cache never held an entry for (first-ever read hasn't happened yet) THEN the revalidateTag call is a safe no-op (Next.js tolerates busting a tag with no matching entry) and the next detail-page read is a normal cache miss that populates fresh (BR-3)
- EC-2 IF a host deletes a camp that was never read (no cache entry) THEN the same safe no-op applies; the detail page 404s from the DB query regardless of cache state (BR-3, BR-4)

## Data
- **No schema change. No migration.** This ticket only changes cache-wiring code (`lib/catalog-cache.ts`) and adds two `revalidateTag` calls to an existing writer (`app/api/campsites/[id]/route.ts`). No new field, no new table, no new endpoint.

## Seams & refs
- Reuse (edit these only): `lib/catalog-cache.ts` (`getCampBySlug` — rebuild the `unstable_cache` wrapper per call; `campSlugTag`/`campTag`/`CATALOG_TAG` helpers unchanged) · `app/api/campsites/[id]/route.ts` (`PUT`/`DELETE` — add the two `revalidateTag(campSlugTag(...))` calls, read the slug off the existing return value).
- Do NOT change: `app/api/campsites/[id]/spots/route.ts`, `.../spots/[spotId]/route.ts`, `.../zones/route.ts`, `.../zones/[zoneId]/route.ts` (already correct per CAM-353 BR-8 / CAM-362 — locked by a regression-guard test in this ticket, not modified) · `getDefaultCatalog` (`lib/catalog-cache.ts` — its `tags: [CATALOG_TAG]` is a fixed, non-per-argument tag; it does not have the CAM-357 bug and needs no change).
- Refs: CAM-195 (cache activation) · CAM-353 BR-8 (the seam this ticket closes) · CAM-362 (zone writer precedent).

## Out of scope
- Rewriting `getDefaultCatalog` or any other `unstable_cache` entry — audited in this ticket, found not to have the same bug (its tag is a fixed constant, not per-argument), left unchanged.
- Shortening the 5-min `DETAIL_REVALIDATE_S` TTL — the TTL stays as a safety net; this ticket's fix is what makes `revalidateTag` the primary freshness mechanism again, as originally intended.
- Any new UI/copy — this is a server-side cache-wiring fix with no visible new state.

## Self-verify
- AC-1, AC-3 → integration (mocked `unstable_cache` + mocked Prisma: real per-slug tag/keyParts assertions, cache-hit-preserved behavioral proof, writer inventory regression guard) — see `__tests__/cam-357-cache-tags.test.ts`
- AC-2 → integration (`DELETE` handler, mocked Prisma, asserts both slug tags busted off the returned deleted row, no extra Prisma call)
- Story-specific: cache-hit preserved for same-slug repeat reads (no accidental full-miss regression) · writer-inventory count locked (4/2/4/2/2 per handler file) · no N+1 introduced on the writer side
- Gate = /quality-gate · Done = every AC verified on the real Staging URL (observe a host edit surfacing on the detail page without a 5-minute wait)

## Changelog
- v1 (2026-07-05) — created
