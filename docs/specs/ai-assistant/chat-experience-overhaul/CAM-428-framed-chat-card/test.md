---
linear: CAM-428
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-19
---
# Test — Framed chat card (CAM-428)

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (price ฿{price}/คืน, tag, ★rating+reviewCount) | H | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| AC-2 (reviewCount=0 → ยังไม่มีรีวิว, never 0.0) | M | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| AC-3 (province null → no row at all) | M | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| AC-4 (remaining number → เหลือ {N} ที่ chip) | M | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| AC-5 (remaining absent → no chip, negative twin of AC-4) | M | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| AC-6 (tap → onSelect → /campgrounds/{slug}) | H | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts`, `__tests__/cam-272-ai-chat-components.test.ts` (AC-3 supersede block), `__tests__/cam-409-ai-chat-card-carousel.test.ts` (AC-4 supersede block) | ✅ pass |
| BR-1 (onSelect required, no CampgroundCard/next-link import) | H | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts`, `__tests__/cam-272-ai-chat-components.test.ts` (BR-4 supersede block) | ✅ pass |
| BR-2 (price fallback = free-when-null/0 convention) | M | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| BR-3 (new `aiChat.card.*` keys, no existing key overwritten) | M | structural/i18n | `__tests__/cam-428-framed-chat-card.test.ts`, `__tests__/cam-272-ai-chat-i18n.test.ts` (nested-namespace flatten) | ✅ pass |
| BR-4 (Expression Layer tokens only, no stray hex/px) | M | structural + real run | `__tests__/cam-428-framed-chat-card.test.ts` + `npm run check:ds` / `check:palette` (real run, 0 violations) | ✅ pass |
| EC-1 (empty options[] → tag omitted) | L | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| EC-2 (hasReviews absent → reviewCount>0&&avgRating!=null fallback) | M | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` | ✅ pass |
| EC-3 (non-empty province string → renders normally) | L | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` (condition asserted; positive-render is the AC-1/AC-6 happy path) | ✅ pass |
| EC-4 (remaining explicitly null → chip omitted, same as absent) | M | unit/source-inspection | `__tests__/cam-428-framed-chat-card.test.ts` (`typeof card.remaining === "number"` excludes null) | ✅ pass |
| EC-5 (EN slug missing → falls back to TH slug) | M | unit/source-inspection | `__tests__/cam-272-ai-chat-components.test.ts` (carousel slug-fallback assertion) | ✅ pass |

Test type is unit/source-inspection throughout because this repo's Vitest config runs `environment: 'node'` (no jsdom/@testing-library) — a repo-wide, pre-existing convention (see `__tests__/cam-368-photo-modal-a11y.test.ts`, `cam-396-*`, and every prior ai-chat component test: cam-272/cam-409/cam-411/cam-426). Rendered-DOM behavior is proven by reading the shipped source for the exact wiring the AC/BR/EC rows require; this is the ticket's own Self-verify plan (story.md), not a QA shortcut.

## Validation cases

- BR-1: `cardSrc` contains no `CampgroundCard` import, no `<Link`, no `next/link` import; `onSelect: (card: AiChatCardResponse) => void` is a required prop; the whole card is a native `<button type="button">` calling `onSelect(card)`.
- BR-2: price row reads `card.priceLow && card.priceLow > 0 ? ฿{THB_FORMAT.format(...)}/คืน : ฟรี` — same "null/0 = free" convention `CampgroundCard.tsx` already uses (verified against `lib/catalog-cursor.ts`'s `isFree` semantics, unchanged by this story).
- BR-3: `th.aiChat.card.{perNight,free,noReviews,reviews,remaining,viewDetail}` asserted verbatim (`/คืน`, `ฟรี`, `ยังไม่มีรีวิว`, `{count} รีวิว`, `เหลือ {count} ที่`, `ดูรายละเอียด`); no em-dash; EN key set matches TH key set exactly; every EN value non-empty.
- BR-4: `check:ds` (0 violations, R1-R8) and `check:palette` (0 violations) run for real against the touched files; card source asserted to use only `bg-card`/`border-ai-tint`/`shadow-ai-glow` + role-scale radius classes, no raw hex/px.
- EC-2/G7: `hasReviews = card.hasReviews ?? (card.reviewCount > 0 && card.avgRating != null)` — asserted verbatim in source; the rating row never renders a bare `0.0` (regex-asserted absence).
- EC-3/G8: `hasProvince = card.location.province.trim().length > 0` — the coerced `''` (server-side null coercion, `ai-camp-card.ts`, CAM-427) hides the row; a non-empty string renders it.
- a11y: `aria-label` composes `${name} ${t.aiChat.card.viewDetail}`; `focus-visible:ring-ring` (never a hardcoded ring color); decorative icons (`MapPin`/`Star`/`ChevronRight`) are `aria-hidden="true"`.
- Icons: lucide-only import, no emoji literal in the card source (standing owner rule).

## Coverage

Measured via `npx vitest run --coverage` (real run, 2026-07-19). `components/ai-chat/*.tsx` files are **not v8-instrumented** in this repo (never imported/rendered by any test — `environment: 'node'`, no jsdom, a repo-wide constraint, not introduced by this story) — their AC coverage is provided by the source-inspection tests above per the story's own Self-verify plan. Logic-layer files this story touches (route.ts / api-client.ts / conversation.ts) are covered under CAM-430's test.md — CAM-428 itself adds no new logic-layer code.

`check:ds` — PASS (0 violations). `check:palette` — PASS (0 violations). `npm run typecheck` — clean. `npm run lint` — 0 errors (pre-existing warning count unchanged by this diff, verified against `origin/dev`).

Full suite (combined with CAM-430, same PR): **224 test files / 7392 tests, all green** (see CAM-430's test.md for the full run + the 1 real gap QA closed).

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md`

## Changelog

- v1 (2026-07-19) — created; independent QA verification pass on PR #497 (branch `feature/cam-428-framed-card`).
