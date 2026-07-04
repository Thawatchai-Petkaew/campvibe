---
linear: CAM-305
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v2
updated: 2026-07-04
---
# การ์ดเช็กลิสต์ "ข้อมูลที่ยังขาด" บนแดชบอร์ดโฮสต์ (CAM-305)

## Story
As a **Host**, I want a per-campsite card on my dashboard that shows each listing's completeness score plus the itemized list of what is still missing, each item linking straight to the screen where I fix it, so that I can close gaps in my own listing without waiting for a camper to hit the missing information first.
Why: M1 "Listing Truth" — a host today discovers a missing price / fee / cancellation policy only when a camper asks; surfacing it on the dashboard, with a one-click path to the fix, turns a reactive problem into a proactive one.
Scope: a UI-only story. One card per owned campsite on the operator dashboard (`app/dashboard/page.tsx`), consuming the frozen CAM-304 endpoint `GET /api/campsites/[id]/completeness` (`{ score, missing[] }`). It renders the score, the itemized missing list (labels verbatim from the API), a deep-link per item to the campsite edit surface, a "complete" affirmation at score 100, and the loading / error / empty states. No new backend, no new field, no scoring logic (CAM-304 owns that), no inline editing.
Depends on: CAM-304 (`GET /api/campsites/[id]/completeness` — MERGED, contract frozen)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The host owns a campsite whose completeness score is below 100 with several missing items | The dashboard card for that campsite finishes loading | The card shows the header `ข้อมูลลานของคุณครบ {N}%` (where `{N}` = the API score) and, below it, each missing item as its own row showing that item's verbatim Thai label from the API (e.g. `ยังไม่มีรูปภาพ`), one row per returned item, never merged into one string | Read-only: the score + missing list are read live from the completeness endpoint; nothing is written or cached | EC-5 |
| AC-2 | The card is showing the missing item `ยังไม่มีรูปภาพ` for a campsite | The host clicks that item | The host lands on that campsite's edit screen (`/dashboard/campsites/{id}/edit`), the surface that owns the photo field | Navigation only; no write | EC-6 |
| AC-3 | The host owns a campsite whose score is 100 with no missing items | The dashboard card for that campsite finishes loading | The card shows `ข้อมูลลานของคุณครบถ้วนแล้ว` (a positive, complete affirmation) with a success badge and no missing-item list | Read-only; `missing` came back empty | EC-4 |
| AC-4 | The completeness data for a campsite card is still loading | The dashboard first renders that card | The card shows a skeleton that mirrors the real card shape (title bar, score bar, list rows), not an empty frame, and a screen reader hears `กำลังโหลด…` | No write | EC-3 |
| AC-5 | The completeness fetch for a campsite card fails (network / server error) | The dashboard renders that card | The card shows `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` with a `ลองใหม่` button, and the host's other campsite cards still render normally | No write; pressing `ลองใหม่` re-fetches only that campsite's completeness | EC-1 |
| AC-6 | The host owns zero campsites | The host opens the dashboard | No completeness card and no completeness section is shown (there is nothing to complete); the dashboard's existing add-campsite call-to-action is the first-listing path | No write | EC-2 |
| AC-7 | The host owns more than one campsite | The host opens the dashboard | The host sees one completeness card per owned campsite, each titled with that campsite's name, laid out in the dashboard's responsive card grid — never a single aggregated card | Read-only; the campsite name comes from the existing dashboard payload, the score + missing from the completeness endpoint per campsite | EC-1 |

## Rules
- BR-1 Labels are rendered verbatim from the API, never re-derived. Each missing-item row displays the `label` string from the CAM-304 response character-for-character, in the order the API returns it. The card holds NO hardcoded Thai label map and never re-computes a label from the `key`. The six labels the API can return (CAM-304 BR-6, reproduced here for QA reference only — the card must NOT copy them into its own source): `ยังไม่มีรูปภาพ` · `ยังไม่ระบุราคา` · `ยังไม่ระบุนโยบายยกเลิก` · `ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ` · `ยังไม่มีโซนหรือจุดกางเต็นท์` · `ยังไม่ระบุสิ่งอำนวยความสะดวก`. (proves AC-1)
- BR-2 Link map — the fix target for a missing item is derived from its machine `key`, not its label. Every item links to the campsite's single edit surface with a forward-compatible section hash. The hash is progressive enhancement: today the edit form has no per-field anchors, so the link lands at the top of the edit form (correct surface); once anchors ship, the same link scrolls to the field. An unrecognized `key` links to the edit page with no hash (never a dead link). (proves AC-2, EC-5, EC-6)

  | key | fix link (route + hash) | field on that surface today |
  |---|---|---|
  | `photos` | `/dashboard/campsites/{id}/edit#photos` | present (photo upload) |
  | `price` | `/dashboard/campsites/{id}/edit#price` | present |
  | `cancellationPolicy` | `/dashboard/campsites/{id}/edit#cancellation-policy` | not built yet → CAM-341 (link lands on the edit page, the future home) |
  | `extraFee` | `/dashboard/campsites/{id}/edit#extra-fee` | not built yet → CAM-341 (link lands on the edit page, the future home) |
  | `zones` | `/dashboard/campsites/{id}/edit#zones` | partial (spot-view toggle + capacity in the edit form; no dedicated zones page) |
  | `amenities` | `/dashboard/campsites/{id}/edit#amenities` | present (amenities/options selector) |
  | *(unknown key)* | `/dashboard/campsites/{id}/edit` (no hash) | — |

- BR-3 Score display + complete state — the header reads `ข้อมูลลานของคุณครบ {N}%` where `{N}` is the API `score` (integer 0–100). When `score` = 100 (and `missing` is empty) the header/body is replaced by the affirmation `ข้อมูลลานของคุณครบถ้วนแล้ว` shown with a success badge; state is never conveyed by color alone (badge pairs color with an icon + text). (proves AC-1, AC-3)
- BR-4 One card per owned campsite — the card list is built by mapping over the campsites already in the dashboard payload (`data.campSites`). Each card's title = that campsite's name from the dashboard payload; its score + missing list come from the completeness endpoint for that campsite id. Cards are never aggregated into a single roll-up (a per-campsite deep-link needs a specific campsite id). (proves AC-7)
- BR-5 Loading — client-fetch anti-flicker via the `useMinimumLoading` hook (delay 300ms before showing, min-display 400ms once shown). The loading placeholder is a skeleton that mirrors the card's real layout (title + score + list rows), not a blank frame. a11y: the loading region carries `aria-busy="true"` + `role="status" aria-live="polite"` with the label `กำลังโหลด…`; decorative skeleton shapes are `aria-hidden`. (proves AC-4)
- BR-6 Error — a failed fetch (network, 5xx, or the defensive 403/404) renders `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` plus a `ลองใหม่` button that re-fetches only that campsite's completeness. One card's error never blanks the other cards. Because the host only ever fetches completeness for campsites they own, 403/404 are not expected in the normal flow; they resolve to this same error state defensively. (proves AC-5, EC-1)
- BR-7 Empty (zero campsites) — when the host owns no campsites the completeness section is not rendered at all; first-listing onboarding stays with the dashboard's existing add-campsite CTA and is not duplicated as an empty card. (proves AC-6, EC-2)

## Edge cases
- EC-1 IF a campsite's completeness fetch returns 5xx (or the defensive 403 / 404) THEN that campsite's card shows `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` + `ลองใหม่`, and every other campsite card renders unaffected (BR-6)
- EC-2 IF the host owns zero campsites THEN no completeness card and no completeness section is rendered (BR-7)
- EC-3 IF a completeness fetch resolves in under 300ms THEN no skeleton flashes (delay-before-show); IF it takes longer than 300ms THEN the mirroring skeleton is shown for at least 400ms (BR-5)
- EC-4 IF `score` = 100 and `missing` is empty THEN the card shows `ข้อมูลลานของคุณครบถ้วนแล้ว` and renders no missing-item list (BR-3)
- EC-5 IF the API returns a missing item whose `key` is not in the link map THEN the item still renders with its verbatim `label` and links to `/dashboard/campsites/{id}/edit` (no hash) — the item is never hidden and never a dead link (BR-1, BR-2)
- EC-6 IF a missing item's fix field is not built yet (`cancellationPolicy` / `extraFee` — CAM-341) THEN the item is still shown and clickable and its link navigates to the campsite edit page (the future home of those fields), not hidden (BR-2)

## Data
- Read-only. Consumes the CAM-304 payload per owned campsite via `GET /api/campsites/[id]/completeness` → `{ score: number 0–100, missing: Array<{ key: string, label: string }> }`. The campsite `id` + display name come from the existing `/api/operator/dashboard` payload (`data.campSites[]`). No field is written, no value is stored or cached, no new entity. · migration: none

## Seams & refs
- Extend: `app/dashboard/page.tsx` (`OperatorDashboard`) — add a listing-completeness section that maps over `data.campSites`. Reuse the client-fetch + `useMinimumLoading` + `aria-busy` / `role="status"` loading pattern already present in this file; do not introduce a parallel loading idiom.
- New this story: `components/ListingCompletenessCard.tsx` — one card per campsite (props: campsite `id` + name); client-fetches `/api/campsites/[id]/completeness`, renders score + missing list + per-item deep-links + all states.
- Reuse primitives (DESIGN.md §3.1 — do not rebuild): `components/ui/card.tsx` (Card), `components/ui/badge.tsx` (score / complete badge — token + icon + text, never color-only), `components/ErrorState.tsx` or `components/ui/error-banner.tsx` (inline error / forbidden / not-found), `components/ui/skeleton.tsx` (loading skeleton), `lib/hooks/use-minimum-loading.ts` (client-fetch anti-flicker), `next/link` (deep-links). All user-facing copy via `locales/translations.json` (never hardcode).
- Fix surface reality: there is exactly ONE campsite edit surface, `/dashboard/campsites/[id]/edit` (renders `components/CampgroundForm.tsx`, a single long form with NO per-field section anchors and NO separate photo/price/policy/fee/zones/amenities pages). The per-key `#anchor` is progressive enhancement (inert until a form-anchor story adds matching ids).
- Refs: CAM-304 (upstream endpoint contract — frozen) · `.claude/rules/loading.md` §4 (client-fetch loading model) · DESIGN.md §3.1 (primitive index) + §5 (8 states) · ADR — Atomic Data Framework §12 (score is computed live upstream; the card never persists or caches it).

## Out of scope
- The fee / policy edit-form fields (`cancellationPolicy`, `extraFee`) → CAM-341 (until it ships, those two items link to the edit page but the field is not there yet).
- Per-field scroll-to-section anchors inside `CampgroundForm` (the `#anchor` targets) → future form-anchor story (the hash is inert until then).
- A dedicated zones/spots management page (`/dashboard/campsites/[id]/spots` page route is not built; only its API exists) → not this story.
- A batched multi-campsite completeness endpoint (perf optimization for a host with many campsites) → future; N per-campsite fetches are acceptable for typical host counts.
- Editing any field inline in the card → the card is read-only + navigation only.
- Using the score as a publish gate (block a listing below a threshold) → future M1 story.
- Notification / email reminders about missing data → not scoped.

## Self-verify
- AC-1 → unit (source-inspection: card renders `score` as `ครบ {N}%`; maps `missing[]` to one row per item rendering the API `label`; no Thai missing-label literal hardcoded in the card source)
- AC-2 → unit (link map: each item's href = `/dashboard/campsites/{id}/edit#{anchor}` per the BR-2 table)
- AC-3 → unit (`score === 100` branch renders `ข้อมูลลานของคุณครบถ้วนแล้ว` + success badge, no list) · EC-4
- AC-4 → unit (uses `useMinimumLoading`; skeleton present with `aria-busy` + `role="status"` + `กำลังโหลด…`) · EC-3
- AC-5 → unit (error branch renders `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` + `ลองใหม่`; retry re-fetches; one card's error does not blank others) · EC-1
- AC-6 → unit (zero `campSites` → completeness section not rendered) · EC-2
- AC-7 → unit (maps over `campSites` → one card per campsite; card title = campsite name from the dashboard payload; never aggregated)
- EC-5 → unit (unknown `key` → item renders with verbatim `label`, links to `/edit` with no hash) · EC-6 → unit (policy/fee item still shown + clickable, links to `/edit`)
- Story-specific: labels never hardcoded (card source contains none of the six BR-1 label strings) · link map exhaustively covers the six keys + the unknown-key fallback · read-only (no fetch with a method other than GET; no write path)
- Gate = /quality-gate (`check:ds` + `check:palette` green for standard-class G2) · Done = every AC verified on the real Staging URL: sign in as a host with a partially-filled campsite; confirm the `ครบ {N}%` score, the missing labels matching the API byte-for-byte, each item navigating to that campsite's edit page, and the complete / loading / error / zero-campsite states.

## Changelog
- v2 (2026-07-04) — rewritten to story template v2 at G1: English framework + 6-col AC + Neg/edge twins, added `## Edge cases` (EC-1..6) and `## Seams & refs`, dropped `## Why`/`## Links`. Ground-truth corrections vs v1: there is a SINGLE edit surface `/dashboard/campsites/[id]/edit` with no per-field pages or anchors, so all six keys deep-link there (per-key `#anchor` = progressive enhancement, not a true deep-link today) — this supersedes v1 BR-1's "each link to the exact spot"; the `cancellationPolicy` / `extraFee` edit fields are not built (CAM-341), so those items link to the edit page as their future home; the card is placed on the Overview dashboard (`app/dashboard/page.tsx`), reusing its client-fetch + `useMinimumLoading` pattern; one card per owned campsite (not aggregated); labels render verbatim from the CAM-304 API (card never re-derives Thai copy). G2 = standard class (reuse-only; no new screen/flow/token).
- v1 (2026-07-04) — created
