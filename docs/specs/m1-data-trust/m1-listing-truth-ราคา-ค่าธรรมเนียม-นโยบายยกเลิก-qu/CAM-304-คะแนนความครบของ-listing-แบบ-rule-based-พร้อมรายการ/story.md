---
linear: CAM-304
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v2
updated: 2026-07-04
---
# คะแนนความครบของ listing แบบ rule-based พร้อมรายการที่ยังขาด (CAM-304)

## Story
As a **Host**, I want the system to compute a deterministic completeness score (0–100) for my own campsite plus an itemized list of the fields still missing, so that I know exactly what to fix before a camper sees an incomplete listing (raises the share of listings that meet the M1 "Listing Truth" bar; not measured, baseline set after ship).
Why: M1 "Listing Truth" — a listing with a missing price / fee / cancellation policy makes campers hesitate; a host cannot fix what they cannot see itemized.
Scope: a pure, rule-based scoring function over atomic fields only (photos, price, extra-fee transparency, cancellation policy, zones/spots, amenities) computed live on every request, plus one owner-only GET endpoint that returns `{ score, missing[] }`. No UI, no AI, no randomness, no stored/cached score.
Depends on: CAM-268 (PREP-2 price/fee/cancellation-policy fields — MERGED)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp owned by the caller has zero photos and no cancellation policy | The completeness score is computed for that camp | The missing list contains `ยังไม่มีรูปภาพ` and `ยังไม่ระบุนโยบายยกเลิก`, and the score is below 100 | Score computed live from the current field state; nothing is stored or cached as the score | EC-1 |
| AC-2 | The host has just saved new data on the camp (e.g. added a photo, set the cancellation policy) | The score is computed again | Those items no longer appear in the missing list, and the score is higher than before by exactly the newly-satisfied criteria's weights | Every call recomputes from the latest field state; no stale value carries over | EC-3 |
| AC-3 | A camp satisfies every weighted criterion | The score is computed | Score = 100 and the missing list is empty (`—`) | `missing` is returned as an empty array | EC-2 |
| AC-4 | A camp is missing several criteria at once | The score is computed | Each missing criterion appears as its own itemized entry with its verbatim Thai label, never merged into one vague string | Each missing item carries a stable machine `key` (fixed weight-table order) so CAM-305 can deep-link to the right field | EC-3 |

## Rules
- BR-1 Deterministic + compute-on-the-fly: the same field state ALWAYS yields the same score — no AI, no randomness. The score is recomputed on every request from current field values and is NEVER stored or cached as the source of truth (Atomic Data Framework §12). (proves AC-1, AC-2)
- BR-2 Atomic fields only: the score reads only machine-readable atomic fields — image count, `priceLow`/`isFree`, `extraFeeAmount`+`extraFeeLabel`, `cancellationPolicy`, non-deleted `Spot` count, `options` (MasterData) count. No free-text field (`description`, `feeInfo`) is interpreted. (proves AC-4 stability)
- BR-3 Weight table — a fixed, testable constant summing to exactly 100. Score = sum of the weights of satisfied criteria. `MIN_PHOTOS_FOR_COMPLETE = 1` (raising it later requires updating the `ยังไม่มีรูปภาพ` copy — coupled). Price is satisfied when `priceLow != null` OR `isFree == true`.

  | key | criterion | weight | satisfied when |
  |---|---|---|---|
  | `photos` | รูปภาพ | 25 | image count ≥ `MIN_PHOTOS_FOR_COMPLETE` (=1) |
  | `price` | ราคา | 20 | `priceLow != null` OR `isFree == true` |
  | `cancellationPolicy` | นโยบายยกเลิก | 20 | `cancellationPolicy != null` |
  | `extraFee` | ค่าธรรมเนียมเพิ่มเติม (ความโปร่งใส) | 15 | see BR-5 |
  | `zones` | โซน/จุดกางเต็นท์ | 10 | ≥ 1 non-deleted `Spot` |
  | `amenities` | สิ่งอำนวยความสะดวก | 10 | ≥ 1 `options` (MasterData) row |

- BR-4 Authz — the score is visible only to the camp's owner, a platform ADMIN, or an authorized team member (via `requireCampSitePermission`, mirroring the sibling `[id]/holds` route). A non-authorized caller → `403`; an unknown or soft-deleted camp → `404`. Neither returns any listing data. (proves EC-1, EC-4)
- BR-5 Extra-fee transparency — the `extraFee` criterion is satisfied when the fee status is unambiguous: BOTH `extraFeeAmount` and `extraFeeLabel` present (a fully-specified fee) OR BOTH empty (no extra fee — a valid, truthful state). It is UNSATISFIED only on a partial fill (one set, the other empty), which lists `ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ`. (proves EC-3, EC-5)
- BR-6 Missing-item shape — each missing item is `{ key, label }`: `key` ∈ (`photos` | `price` | `cancellationPolicy` | `extraFee` | `zones` | `amenities`) is a stable machine identifier; `label` is the verbatim Thai display string below. Items are emitted in fixed weight-table order. (proves AC-4)

  | key | label (Thai verbatim) |
  |---|---|
  | `photos` | `ยังไม่มีรูปภาพ` |
  | `price` | `ยังไม่ระบุราคา` |
  | `cancellationPolicy` | `ยังไม่ระบุนโยบายยกเลิก` |
  | `extraFee` | `ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ` |
  | `zones` | `ยังไม่มีโซนหรือจุดกางเต็นท์` |
  | `amenities` | `ยังไม่ระบุสิ่งอำนวยความสะดวก` |

## Edge cases
- EC-1 IF the caller is not the camp's owner, a platform ADMIN, or an authorized team member THEN the endpoint returns `403` and computes no score (no listing data disclosed) (BR-4)
- EC-2 IF a camp has zero photos and no other completable data THEN the score is the floor (the sum of any inherently-satisfied criteria only — see BR-5), never negative or NaN, and every unsatisfied field appears in the missing list (BR-3)
- EC-3 IF `extraFeeAmount` is set but `extraFeeLabel` is empty (or vice versa) THEN the `extraFee` criterion is unsatisfied and the missing list includes `ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ` (BR-5)
- EC-4 IF the camp id does not exist or the camp is soft-deleted THEN the endpoint returns `404` and no score (BR-4)
- EC-5 IF both `extraFeeAmount` and `extraFeeLabel` are empty THEN the `extraFee` criterion is satisfied (no fee is a valid, truthful state) and does NOT appear in the missing list (BR-5)

## Data
- Read-only over existing `CampSite` fields + relations: `images` (count), `priceLow`, `isFree`, `extraFeeAmount`, `extraFeeLabel`, `cancellationPolicy`, `spots` (non-deleted count), `options` (MasterData count). No field is written. The score and missing list are computed values, never persisted. · migration: none (a `LISTING_COMPLETENESS_WEIGHTS` constant only — no schema change)
- Response payload (atomic, shaped at G2 per `types/api.ts`): `{ score: number 0–100, missing: Array<{ key: string, label: string }> }`

## Seams & refs
- Reuse: `lib/auth-utils.ts:requireCampSitePermission` for owner/ADMIN/team-member authz (same seam as `app/api/campsites/[id]/holds/route.ts`) · `lib/api-utils.ts:apiSuccess`/`apiError` for the response shape · Prisma `CampSite` model (`prisma/schema.prisma`) — no parallel field access
- New this story: `lib/listing-completeness.ts` (pure `computeListingCompleteness(campSite) → { score, missing }` — the single source of the rule) + `GET app/api/campsites/[id]/completeness/route.ts` (authz wrapper). Both ship here.
- **lib-vs-endpoint decision = lib + GET endpoint.** Rationale: the sole consumer surface (the host dashboard, `app/dashboard/*`) is a client component that fetches all per-camp data over HTTP (`fetch('/api/operator/dashboard')`), so the CAM-305 card cannot import a server-only Prisma-backed lib directly — the score must be reachable via an authz-gated endpoint. Shipping lib-only would strand CAM-305 and push data-layer authz into a UI story. This mirrors the sibling data story CAM-302 (lib `campsite-availability` + `[id]/holds` route). · Refs: ADR — Atomic Data Framework §12 (compute-on-the-fly, never cache as SoT)

## Out of scope
- Dashboard card / any UI that renders the score + missing checklist → CAM-305
- Using the score as a publish gate (block listing from going public below a threshold) → not this round (future M1 story)
- The exact `PermissionCode` passed to `requireCampSitePermission` (likely `CAMPSITE_UPDATE`) → architect confirms at G2

## Self-verify
- AC-1 → unit (lib: no-photos + no-policy fixture → score < 100, labels present) + integration (endpoint returns payload)
- AC-2 → unit (score increases by exactly the flipped criteria's weights when a field becomes satisfied; recomputed from latest state)
- AC-3 → unit (fully-complete fixture → score = 100, `missing` empty)
- AC-4 → unit (multi-missing fixture → itemized `{key,label}` entries in fixed weight-table order, no merged string)
- EC-1 → integration (non-owner caller → 403, no body data) · EC-4 → integration (unknown / soft-deleted id → 404)
- EC-2 → unit (empty camp → floor, non-negative, all applicable fields missing) · EC-3 → unit (amount w/o label → `extraFee` unsatisfied + label) · EC-5 → unit (both fee fields empty → `extraFee` satisfied, absent from missing)
- Story-specific: ownership 403/404 paths · determinism (same input run twice → identical output) · weight table sums to exactly 100 (guard test) · no score row/field written (assert Prisma performs read-only)
- Gate = /quality-gate · Done = every AC verified on the real Staging URL (call `GET /api/campsites/[id]/completeness` as the owner of a partially-filled camp, confirm `score` + verbatim `missing` labels)

## Changelog
- v2 (2026-07-04) — rewritten to story template v2 at G1: English framework + 6-col AC + Neg/edge twins, added `## Edge cases` (EC-1..5) and `## Seams & refs`, dropped `## Why`/`## Links`. Decisions recorded: ships **lib + GET endpoint** (dashboard consumers are client-fetch, per ground truth); CAM-268 fields confirmed merged so the v1 `รอฟีเจอร์นโยบายยกเลิก` fallback is dropped; extra-fee scored on transparency (BR-5); stable missing-item `key`+verbatim Thai `label` (BR-6); weight table as a testable constant summing to 100 (BR-3).
- v1 (2026-07-04) — created
