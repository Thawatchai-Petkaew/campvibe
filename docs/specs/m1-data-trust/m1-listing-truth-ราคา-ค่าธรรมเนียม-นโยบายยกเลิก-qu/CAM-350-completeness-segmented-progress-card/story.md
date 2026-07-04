---
linear: CAM-350
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-04
class: full
---
# การ์ดความครบถ้วนแบบแถบแบ่งตามน้ำหนัก พร้อมงานที่เหลือและ +N% (CAM-350)

## Story
As a **Host**, I want my listing-completeness card to show a weight-segmented progress bar plus a
remaining-jobs list where each missing item shows how many percent I gain by fixing it (`+N%`) and
links straight to that field, so that I can see at a glance which gaps cost the most and fix the
highest-value ones first — instead of reading a bare percentage that hides what each fix is worth.
Why: the owner picked chat wireframe A (2026-07-04) as the FINAL direction; a bare `ครบ {N}%` line
under-motivates because it hides each criterion's weight and payoff. This story FORMALIZES + builds
that redesign; the direction is pre-approved (G2), this ticket specifies + implements it.
Scope: a UI-only presentation change to the existing `ListingCompletenessCard` body + one new
display primitive `components/ui/segmented-progress.tsx`. It reuses the frozen CAM-304 contract
(`GET /api/campsites/[id]/completeness → { score, missing[] }`), the weights export
`LISTING_COMPLETENESS_WEIGHTS` (pure, client-importable), the CAM-305 client-fetch / loading /
error / retry / deep-link plumbing, and the CAM-341 section anchors. NO API change, NO new field,
NO scoring logic, NO new screen/flow, NO new design token.
Depends on: CAM-304 (completeness endpoint — MERGED, frozen) · CAM-305 (the card being revised —
MERGED) · CAM-341 (real edit-form section anchors + fee/policy inputs — MERGED)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The host owns a campsite whose completeness score is below 100 with several missing items | The dashboard card finishes loading | A horizontal bar split into 6 segments whose widths are proportional to each criterion's weight — satisfied criteria filled, missing criteria shown translucent — with a score pill `ครบ {N}%` (`{N}` = the API score) and the line `งานที่เหลือ {N} รายการ` (`{N}` = number of missing items) | Read-only: score + missing read live from the completeness endpoint; nothing written or cached | EC-6 |
| AC-2 | The bar shows one or more missing criteria for a campsite | The card renders the remaining-jobs list | Each missing item is its own row showing that item's verbatim Thai label from the API (e.g. `ยังไม่ระบุนโยบายยกเลิก`), a payoff badge `+{N}%` (`{N}` = that criterion's weight, e.g. `+20%`), and a link-out cue — one row per returned item, never merged into one string | Read-only; labels come verbatim from the API, the payoff weight from the imported weights table | EC-5 |
| AC-3 | The card is showing a missing-item row for a campsite | The host clicks that row | The host lands on that campsite's edit screen at the field's section (`/dashboard/campsites/{id}/edit#{anchor}`), the surface that owns the field | Navigation only; no write | EC-5 |
| AC-4 | The host owns a campsite whose score is 100 with no missing items | The dashboard card finishes loading | The bar is fully filled and the card shows `ข้อมูลลานของคุณครบถ้วนแล้ว` with a success badge, and no missing-item list and no `งานที่เหลือ` line | Read-only; `missing` came back empty | EC-4 |
| AC-5 | The completeness data for a card is still loading | The dashboard first renders that card | The card shows a skeleton that mirrors the new layout (title bar, score pill, the bar, the count line, job rows), not an empty frame, and a screen reader hears `กำลังโหลด…` | No write | EC-3 |
| AC-6 | The completeness fetch for a card fails (network / server error) | The dashboard renders that card | The card shows `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` with a `ลองใหม่` button, and the host's other campsite cards still render normally | No write; pressing `ลองใหม่` re-fetches only that campsite's completeness | EC-1 |
| AC-7 | The host owns zero campsites | The host opens the dashboard | No completeness card and no completeness section is shown; the dashboard's existing add-campsite call-to-action is the first-listing path | No write | EC-2 |
| AC-8 | The card is rendered narrower than the label-strip threshold (e.g. the 3-column desktop grid) | The card renders | The per-segment label strip under the bar is not shown, while the bar, the `ครบ {N}%` pill, the `งานที่เหลือ {N} รายการ` line and the full remaining-jobs list all still render (nothing actionable is lost) | No write | EC-7 |

## Rules
- BR-1 Weights are single-source, never hardcoded — every segment width and every `+{N}%` payoff derives from `LISTING_COMPLETENESS_WEIGHTS` imported from `lib/listing-completeness.ts` (photos 25 · price 20 · cancellationPolicy 20 · extraFee 15 · zones 10 · amenities 10). The card and the primitive contain NO literal `25`/`20`/`15`/`10` weight and never re-derive a weight. Segment width = `weight ÷ Σweight` (Σ = 100 today). The `ครบ {N}%` pill uses the API `score` directly (authoritative), not a re-sum of segments. (proves AC-1, AC-2)
- BR-2 Missing-item labels verbatim from the API (preserves CAM-305 BR-1) — each remaining-jobs row renders the `label` string from the CAM-304 response character-for-character, in API order; the card holds NO hardcoded Thai missing-label map and never re-derives a label from `key`. The six labels the API can return (CAM-304 BR-6, for QA reference only — the card must NOT copy them into its source): `ยังไม่มีรูปภาพ` · `ยังไม่ระบุราคา` · `ยังไม่ระบุนโยบายยกเลิก` · `ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ` · `ยังไม่มีโซนหรือจุดกางเต็นท์` · `ยังไม่ระบุสิ่งอำนวยความสะดวก`. The chat sketch's `ระบุนโยบายยกเลิก` is superseded by the verbatim API label `ยังไม่ระบุนโยบายยกเลิก`. (proves AC-2)
- BR-3 Segment short labels are a separate presentational set — the under-bar strip's short criterion names (`รูปภาพ` · `ราคา` · `นโยบายยกเลิก` · `ค่าธรรมเนียม` · `โซน` · `สิ่งอำนวยความสะดวก`) are NEW i18n keys `listingCompleteness.segment.{key}` (TH + EN in `locales/`, keyed by machine key), NOT the API scoring labels. They are display-only; the API supplies no short name. Overflow in a narrow cell is handled by `TruncatedLabel` (ellipsis + tooltip of the full label). This is not a BR-2 violation: BR-2 governs the missing-item labels (still verbatim from the API in the jobs list). (proves AC-1, AC-8)
- BR-4 Deep-link map reuse — the fix target for a row is derived from its machine `key`, not its label, via the existing CAM-305 BR-2 `ANCHOR_BY_KEY` map: `photos→#photos` · `price→#price` · `cancellationPolicy→#cancellation-policy` · `extraFee→#extra-fee` · `zones→#zones` · `amenities→#amenities` (all now resolve to CAM-341's real section anchors). An unrecognized `key` links to `/dashboard/campsites/{id}/edit` with no hash — never hidden, never a dead link. (proves AC-3, EC-5)
- BR-5 Satisfied vs missing segment styling (never color-alone) — satisfied segment = `bg-primary` (teal; progress uses the brand token, `success` is reserved for the 100% affirmation); missing segment = `bg-muted` + `border border-border` (the border supplies the ≥3:1 non-text boundary since `bg-muted` is near-white on the card). The satisfied/missing distinction is additionally carried by: the under-bar cell's icon (lucide `Check` / `Minus`) + short label + `ขาด {N}%` text, the remaining-jobs list (names each missing item in text), and the bar's `role="img"` summary. State is never conveyed by color alone. (proves AC-1)
- BR-6 100% affirmation — when `score` = 100 and `missing` is empty, the bar renders fully filled and the body is the affirmation `ข้อมูลลานของคุณครบถ้วนแล้ว` in a `Badge variant="success"` with a lucide `CheckCircle2`; no jobs list and no `งานที่เหลือ` line. (proves AC-4, EC-4)
- BR-7 Loading + error unchanged from CAM-305 — loading uses the `useMinimumLoading` client-fetch anti-flicker (delay 300ms / min-display), a skeleton that mirrors the NEW layout (title + score pill + bar + count line + job rows, `bg-muted` via `Skeleton`), `aria-busy="true"` + `role="status" aria-live="polite"` + `กำลังโหลด…` (`t.common.loading_sr`), skeleton shapes `aria-hidden`, shimmer off under `prefers-reduced-motion`. A failed fetch (network / 5xx / defensive 403 / 404) renders `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` + a `ลองใหม่` button that re-fetches only that card; one card's error never blanks another. (proves AC-5, AC-6, EC-1, EC-3)
- BR-8 Motion / reduced-motion — the bar's optional entrance animates `transform`/`opacity` only (120–250ms, easing `cubic-bezier(0.23,1,0.32,1)`, gated `motion-safe:`); segment width / `flex-basis` is NEVER animated (DESIGN.md §2). Under `prefers-reduced-motion: reduce` the entrance is disabled and the bar renders at its final state — no fill animation under reduce. (proves AC-1)

## Edge cases
- EC-1 IF a campsite's completeness fetch returns 5xx (or the defensive 403 / 404) THEN that card shows `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` + `ลองใหม่`, and every other campsite card renders unaffected (BR-7)
- EC-2 IF the host owns zero campsites THEN no completeness card and no completeness section is rendered (BR-7 / CAM-305 BR-7, dashboard-level; unchanged)
- EC-3 IF a completeness fetch resolves in under 300ms THEN no skeleton flashes (delay-before-show); IF it takes longer THEN the layout-mirroring skeleton shows for at least the min-display window (BR-7)
- EC-4 IF `score` = 100 and `missing` is empty THEN the bar is fully filled, the card shows `ข้อมูลลานของคุณครบถ้วนแล้ว`, and no missing-item list and no `งานที่เหลือ` line render (BR-6)
- EC-5 IF the API returns a missing item whose `key` is not in the weights table / link map THEN the row still renders with its verbatim `label`, OMITS the `+{N}%` payoff badge (no weight to show), links to `/dashboard/campsites/{id}/edit` with no hash, and no extra segment is drawn — the item is never hidden and never a dead link (BR-1, BR-2, BR-4)
- EC-6 IF `score` = 0 (all six criteria missing) THEN all six segments render translucent (`bg-muted` + border), the pill reads `ครบ 0%`, `งานที่เหลือ 6 รายการ`, and the jobs list shows all six rows each with its `+{N}%` (BR-1, BR-5)
- EC-7 IF the card content is narrower than the label-strip threshold (`@sm`, ~384px) THEN the under-bar per-segment label strip is hidden while the bar, score pill, count line and jobs list still render; the segment short names remain reachable via the `TruncatedLabel` tooltip when the strip is shown at wider widths (BR-3)
- EC-8 IF `prefers-reduced-motion: reduce` is set THEN the bar renders with no entrance/fill animation (BR-8)

## Data
- Read-only. Consumes the CAM-304 payload per owned campsite via `GET /api/campsites/[id]/completeness` → `{ score: number 0–100, missing: Array<{ key: string, label: string }> }` (frozen contract, unchanged). The campsite `id` + display name come from the existing `/api/operator/dashboard` payload (`data.campSites[]`). The per-criterion weight comes from the pure module `lib/listing-completeness.ts` (`LISTING_COMPLETENESS_WEIGHTS`), imported client-side (no Prisma in that module). No field is written, nothing is stored or cached, no new entity, no new column. · migration: none

## Seams & refs
- Revise: `components/ListingCompletenessCard.tsx` — keep the fetch / `useMinimumLoading` / `attempt`-retry / `aria-busy` / `role="status"` / `hasError` plumbing and the `fixLinkFor` + `ANCHOR_BY_KEY` map exactly as-is (CAM-305 BR-2/BR-5/BR-6); replace only the rendered body — the score line + plain `<ul>` become the score pill + `<SegmentedProgress>` + optional under-bar strip + `งานที่เหลือ` count + payoff-annotated jobs list; swap `ChevronRight`→`ArrowUpRight`; import `LISTING_COMPLETENESS_WEIGHTS` to derive segment widths + per-row `+N%`; update the skeleton to mirror the new layout.
- New (the only new primitive): `components/ui/segmented-progress.tsx` — a display primitive (props `segments: {key,weight,complete}[]`, required `aria-label`, `className?`); renders `role="img"` track + proportional segments (`bg-primary` satisfied / `bg-muted border-border` missing); the single inline `style={{ flexBasis }}` per segment is data-driven layout (no color/px literal → `check:palette` clean); lives in `components/ui/**` (excluded from `check:ds`). Full anatomy/tokens/motion/a11y in `design.md`.
- Reuse (no parallel logic, DESIGN.md §3.1): `components/ui/card.tsx` · `components/ui/badge.tsx` (`variant="muted"` score pill + `+N%`; `variant="success"` 100% — color via variant prop, never `bg-*` in className → `check:ds` R5b safe) · `components/ui/button.tsx` (retry `size="sm"`, no inline `h-N` → R7 safe) · `components/ui/error-banner.tsx` · `components/ui/skeleton.tsx` · `components/ui/truncated-label.tsx` (overflowing segment labels) · `lib/hooks/use-minimum-loading.ts` · `next/link` · lucide-react icons only (`Check`/`Minus`/`ArrowUpRight`/`CheckCircle2`) per DESIGN.md §7 / `check:ds` R1.
- Copy: all user-facing strings via `locales/translations.json` (TH + EN), never hardcoded. Reuse `listingCompleteness.complete` · `.loadError` · `.retry` · `.sectionTitle` and `common.loading_sr`. NEW keys to add: `listingCompleteness.scorePercent` = `ครบ {N}%` / `{N}% complete` · `listingCompleteness.remainingJobs` = `งานที่เหลือ {N} รายการ` / `{N} tasks left` · `listingCompleteness.payoff` = `+{N}%` / `+{N}%` · `listingCompleteness.barSummary` = `ความครบถ้วนของข้อมูลลาน {N}%` / `Listing completeness {N}%` · `listingCompleteness.segment.{photos|price|cancellationPolicy|extraFee|zones|amenities}` = `รูปภาพ`/`Photos` · `ราคา`/`Price` · `นโยบายยกเลิก`/`Cancellation policy` · `ค่าธรรมเนียม`/`Extra fee` · `โซน`/`Zones` · `สิ่งอำนวยความสะดวก`/`Amenities`. The existing `listingCompleteness.header` becomes unused by the card (leaving it in `locales/` is harmless; pruning it is out of scope).
- Tests: update `__tests__/cam-305-listing-completeness-card.test.ts` to the new layout (source-inspection convention, node env — see the file header) — replace the `copy.header.replace(...)` / plain-`<ul>` / `ChevronRight` / old-skeleton assertions with the new structure (score pill, `<SegmentedProgress>`, weights import, `+N%` payoff, `ArrowUpRight`, layout-mirroring skeleton); keep the BR-1 "no hardcoded Thai missing-label / no Thai literal in card source", the BR-4 link-map, the read-only-GET, and the per-card-retry assertions green. Add coverage for the weights-single-source rule (no literal weight in the card) + the unknown-key no-payoff EC-5.
- Refs: CAM-304 (frozen endpoint) · CAM-305 (the card being revised; BR-2 link map, BR-5 loading, BR-6 error — all preserved) · CAM-341 (BR-5 real section anchors) · `lib/listing-completeness.ts` (`LISTING_COMPLETENESS_WEIGHTS`) · `.claude/rules/loading.md` (§2 skeleton-mirrors-layout, §4 client-fetch anti-flicker, §5 a11y) · DESIGN.md §2/§3.1/§5/§6 · ADR — Atomic Data Framework §12 (score computed live upstream; the card never persists/caches it).

## Out of scope
- Sorting the jobs list by payoff (the rows render in the API's fixed weight-table order) → not this story; a future enhancement if hosts ask.
- Any API / contract / scoring change, or a batched multi-campsite completeness endpoint → CAM-304 owns scoring; N per-campsite fetches stay (CAM-305 boundary).
- Applying the segmented-progress primitive to any other surface (public listing, admin, etc.) → this story ships the primitive + the one dashboard consumer only.
- Ring / radial / stepper variants of the primitive → not built; one horizontal bar only.
- Pruning the now-unused `listingCompleteness.header` locale key → a follow-up locale cleanup (out of this story's surface).
- Using the score/segments as a publish gate → future M1 story (CAM-305 out-of-scope, unchanged).

## Self-verify
- AC-1 → unit (source-inspection: card renders `<SegmentedProgress>` with segments built from `LISTING_COMPLETENESS_WEIGHTS`; score pill uses `scorePercent` with the API `score`; `remainingJobs` count uses `missing.length`) · EC-6
- AC-2 → unit (missing[] maps to one row per item rendering `item.label` verbatim + a `+{N}%` payoff whose N is the weight looked up by `key`; no literal weight number in the card source) · EC-5
- AC-3 → unit (each row href = `fixLinkFor(campSiteId, item.key)` per the BR-4 anchor map) · EC-5
- AC-4 → unit (`score === 100 && missing empty` branch → filled bar + `complete` affirmation + success badge, no jobs list / no count line) · EC-4
- AC-5 → unit (uses `useMinimumLoading`; skeleton present, mirrors the new layout, with `aria-busy` + `role="status"` + `loading_sr`) · EC-3
- AC-6 → unit (error branch renders `loadError` + `retry`; retry re-fetches only this card via `[campSiteId, attempt]`; one card's error does not blank others) · EC-1
- AC-7 → unit (dashboard: zero `campSites` → completeness section not rendered) · EC-2
- AC-8 → unit (the under-bar label strip carries the container-query collapse class; the bar + pill + count + jobs list are outside that gate) · EC-7
- EC-5 → unit (unknown `key` → row renders with verbatim `label`, no `+N%` badge, href `/edit` no hash, no extra segment) · EC-8 → owner-verify (reduced-motion: no bar entrance/fill animation)
- Story-specific: no hardcoded weight literal in the card/primitive source (import-only) · no Thai missing-label literal in the card source (BR-2) · segment short labels come from `t.listingCompleteness.segment.*` (i18n, not hardcoded) · read-only (no non-GET fetch, no write path) · `SegmentedProgress` is non-interactive (no focus/disabled state on the bar; interactive states live on the job-row links + retry button)
- Gate = /quality-gate (`npm run lint` · `npm run typecheck` · `npm test` ≥80% new code · `npm run build` · `check:ds` + `check:palette` green — the primitive uses tokens only + one data-driven `flex-basis`). **G2 = full class** (introduces the new `SegmentedProgress` primitive) — direction pre-approved by the owner (chat wireframe A, 2026-07-04); `design.md` is the design contract. Done = every AC verified on the real Staging URL: as a host with a partially-filled campsite, confirm the segmented bar (satisfied filled / missing translucent), the `ครบ {N}%` pill matching the API score, each missing row showing the verbatim label + `+N%` + deep-linking to the edit section, the 100% affirmation, the loading / error / zero-campsite states, and the narrow-card label collapse.

## Changelog
- v1 (2026-07-04) — created. Formalizes + specs the owner-approved chat wireframe A (2026-07-04, FINAL direction): weight-segmented progress bar + remaining-jobs list with `+N%` payoff, replacing the CAM-305 text-only body. New `SegmentedProgress` primitive (class = full). Locked owner decisions recorded: 6 segments sized by `LISTING_COMPLETENESS_WEIGHTS` (single-source import, no hardcoded weights); satisfied = `bg-primary` filled, missing = translucent `bg-muted` + border; never color-alone (icon + label + jobs-list text); rows = verbatim API labels + `+N%` from weights + CAM-305/CAM-341 deep-links; 100% keeps `ข้อมูลลานของคุณครบถ้วนแล้ว` + success badge, no list; all 8 states incl. a layout-mirroring skeleton; container-query collapse for the under-bar labels on narrow cards; lucide icons (`ArrowUpRight` replaces `ChevronRight`) per DESIGN.md §7 / `check:ds` R1; no API/scoring/token change.
