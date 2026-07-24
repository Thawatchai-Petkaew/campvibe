---
linear: CAM-469
feature: platform-hardening
epic: platform-hardening (CAM-46)
persona: platform
artifact: story
owner: product-owner
status: In Progress — spec-lite (G1 folds into G3 packet)
version: v1
updated: 2026-07-24
---
# Gate checkAvailability tool — reject unpublished/deleted campSiteId (CAM-469)

<!-- Spec-lite (S): no schema/migration · no new API contract · single tool-file surface · diff ≤ ~40 lines. G1 folds into G3 per Gate policy v2. SECURITY fix (confirmed live LOW info-disclosure). -->

## Story
As the **platform**, I want the AI `checkAvailability` tool to refuse a campSiteId that is not publicly visible (isActive/isPublished true, deletedAt null), so that a forged or guessed id can no longer leak real capacity/booked/held numbers for an unpublished or deleted camp.
Why: confirmed live LOW info-disclosure (found via CAM-460 security-carry) — `lib/campsite-availability.ts getRemainingCapacity` does `findUnique({where:{id}})` with no visibility gate; the tool passes the model/guest-provided id straight in. Reachable today by direct prompt; CAM-460's guest lastResults widens it. Fix at the TOOL layer only — `getRemainingCapacity` is shared by operator/booking-preview paths that legitimately query their own unpublished camp, so gating the shared lib would over-reach.
Scope: in `lib/ai/tools/check-availability.ts`, verify the camp passes the public visibility gate BEFORE calling getRemainingCapacity; if it fails, return the same "no data / not available" result shape a nonexistent id already returns — never confirm the camp exists, never return its numbers. No change to `getRemainingCapacity` or any non-AI caller.
Depends on: —

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A campSiteId that is published + active + not deleted | The assistant calls checkAvailability | Returns the real capacity/booked/held/remaining exactly as today | No behavior change for legitimate published camps | EC-1 |
| AC-2 | A campSiteId that is unpublished, inactive, or soft-deleted | The assistant calls checkAvailability | Returns the not-available/no-data shape (capacity null), identical to an unknown id — the camp's real numbers are NOT returned and its existence is NOT confirmed | No capacity/booked/held disclosed for a non-public camp | EC-2 |
| AC-3 | A syntactically valid but nonexistent campSiteId | The assistant calls checkAvailability | Returns the same not-available/no-data shape as AC-2 (indistinguishable) | Unpublished and nonexistent are indistinguishable to the caller | — |

## Rules
- BR-1 The gate lives in the TOOL (`check-availability.ts`), not in `getRemainingCapacity` (shared — must stay ungated for operator/booking-preview callers).
- BR-2 Visibility predicate = `isActive: true AND isPublished: true AND deletedAt: null` (the same gate `getCampDetail` at get-camp-detail.ts already uses — reuse, do not invent a new one).
- BR-3 A blocked id returns the EXISTING no-data result shape — no new error type, no message that distinguishes "unpublished" from "nonexistent" (no existence oracle).

## Edge cases
- EC-1 IF the camp is public THEN the result is byte-identical to pre-change (regression guard) (AC-1).
- EC-2 IF the camp is unpublished/inactive/deleted THEN same shape as nonexistent — the visibility check adds at most one indexed lookup; if that lookup itself is expensive, reuse the fields getRemainingCapacity already fetches rather than a second round-trip (perf note, not a blocker).

## Data
- No schema/DB/migration. File: `lib/ai/tools/check-availability.ts` (+ its test). Reuses the existing visibility predicate.

## Seams & refs
- `lib/ai/tools/get-camp-detail.ts` (the isActive/isPublished/deletedAt gate to reuse) · `lib/campsite-availability.ts getRemainingCapacity` (READ only — do NOT gate it) · CAM-460 tech.md (the security-carry that found this) · `.claude/rules/security.md` (default-deny, no existence oracle).

## Out of scope
- Gating `getRemainingCapacity` itself or any non-AI caller · the public availability badge path · CAM-460's feature work.

## Self-verify
- Test: public id → real numbers (unchanged); unpublished/inactive/deleted id → no-data shape (no leak); nonexistent id → same shape (no oracle) · `npm run lint` · `npx tsc --noEmit` · full `npm test` · `npm audit --omit=dev` still 0 high/critical.

## Changelog
- v1 (2026-07-24) — spec-lite authored at intake (orchestrator, Gate v2 spec-lite class); security fix for a confirmed live LOW info-disclosure found via CAM-460's security-carry; owner sequenced it BEFORE CAM-460.
