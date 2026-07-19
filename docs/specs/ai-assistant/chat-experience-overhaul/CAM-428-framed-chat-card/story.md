## Story
As a **Camper**, I want the assistant's in-chat camp card to be a dedicated, readable card built on the real fields CAM-427 now exposes, so that I can see the price, rating, tag, province, and (when I gave dates) the live remaining spots at a glance without leaving the chat.
Why: the interim CAM-272 card was a thin wrapper around `CampgroundCard` (a shared catalog/wishlist component) with a baked `<Link>`; that coupling blocks the chat surface from ever repointing the tap target at an in-chat floating detail card (design.md §5, a later story) without touching catalog/wishlist behavior. design.md §4 sanctions a dedicated chat-only card as a named BR-4 exception.
Scope: `components/ai-chat/AiChatCampCard.tsx` (rebuilt, decoupled) + `components/ai-chat/AiChatCardCarousel.tsx` (wires `onSelect`) + `locales/translations.json` (`aiChat.card.*` keys). Does NOT touch `CampgroundCard.tsx`, the floating detail card (§5, out of scope below), or any API/schema.
Depends on: CAM-427 (real fields on `AiChatCardResponse`), CAM-426 (Expression Layer tokens `--ai-tint`/`--ai-glow`/`bg-card`), CAM-409 (carousel container).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp has a price, a first tag, and reviews | The assistant returns that camp as a card | Card shows `฿{price}/คืน`, the terrain tag chip, and `★{rating} ({N} รีวิว)` | Card reads `priceLow`/`options[0]`/`avgRating`+`reviewCount` straight from the wire payload, no fabricated value | EC-1 |
| AC-2 | A camp has `reviewCount = 0` | The assistant returns that camp as a card | Card shows `ยังไม่มีรีวิว`, never `0.0` | `hasReviews` (or the `reviewCount>0 && avgRating!=null` fallback) gates the rating row | EC-2 |
| AC-3 | A camp's `location.province` was null server-side | The assistant returns that camp as a card | No province line at all (not a blank row) | Card hides the province row when the coerced `''` is empty | EC-3 |
| AC-4 | The camper gave a stay date range and the payload carries `remaining` | The assistant returns that camp as a card | Card shows `เหลือ {N} ที่` | Chip renders only when `typeof remaining === 'number'` | EC-4 |
| AC-5 | The camper gave no date range (`remaining` absent/null) | The assistant returns that camp as a card | No availability chip at all | Chip omitted, never a fabricated count | — (same condition as AC-4's negative) |
| AC-6 | Camper taps anywhere on the card | Camper taps | Card navigates to `/campgrounds/{slug}` (the real camp page) | `AiChatCampCard` calls the caller's `onSelect(card)`; `AiChatCardCarousel` resolves the slug (`nameEnSlug`/`nameThSlug` per language) and calls `router.push` | EC-5 |

## Rules
- BR-1 `AiChatCampCard` takes a required `onSelect: (card) => void` prop instead of a baked `<Link>` — the chat surface owns what "select" means (design.md §4/§5, BR-4 exception); it must never import `CampgroundCard` or `next/link`.
- BR-2 Price fallback mirrors `CampgroundCard.tsx`'s own convention: `priceLow` null/0 -> `t.aiChat.card.free` (`ฟรี`) — `priceLow` is null exactly when the schema's `isFree` is true (`lib/catalog-cursor.ts`), so "hide the price row" would contradict the rest of the app's existing free-camp display.
- BR-3 Every card copy string is a new `aiChat.card.*` key (TH+EN) — no existing `aiChat.*` key is overwritten.
- BR-4 Frame uses only Expression Layer tokens already shipped by CAM-426 (`bg-card`, `border-ai-tint`, `shadow-ai-glow`, `rounded-2xl`/`rounded-t-2xl`/`rounded-xl`) — no new token, no stray hex/px.

## Edge cases
- EC-1 IF the payload's `options` array is empty THEN the tag chip is omitted (never a placeholder tag).
- EC-2 IF `hasReviews` is absent (older/unaware payload) THEN the fallback `reviewCount > 0 && avgRating != null` decides the row.
- EC-3 IF `location.province` is a non-empty string THEN the province row renders normally (only the empty-string sentinel hides it).
- EC-4 IF `remaining` is explicitly `null` (date range requested but nothing computed) THEN the chip is still omitted, same as absent.
- EC-5 IF the camp's EN slug is missing THEN the carousel falls back to the TH slug for the EN-locale link (mirrors `CampgroundCard.tsx`'s existing `||` fallback).

## Data
No schema/API change — reads only the CAM-427 wire fields already on `AiChatCardResponse` (`lib/api-client.ts`). Migration: none.

## Seams & refs
- Reuse: `components/ui/badge.tsx` (`Badge variant="secondary"`), `components/ui/image-with-fallback.tsx` (hero image, frame+fade), `contexts/LanguageContext.tsx` (`t`/`language`), `next/navigation` `useRouter` (same navigation primitive Next.js App Router client components already use elsewhere).
- Refs: design.md §4 (framed chat card field map + BR-4 exception) · §5 (future S5 floating detail card, out of scope) · CAM-427 `lib/read-models/ai-camp-card.ts` (real fields) · CAM-409 (carousel container, unchanged layout).

## Out of scope
- The floating detail card (`AiChatDetailCard`, design.md §5) that a later story (S5) will repoint `onSelect` at.
- Cleaning up `CampgroundCard.tsx`'s now-unused `variant="compact"` branch (flagged as a follow-up cleanup ticket; out of this story's file surface).
- Any schema/API change (`isFree`/`priceCurrency` are not yet on the wire payload — price falls back to the existing null-means-free convention instead).

## Self-verify
- AC-1..AC-5 → unit/source-inspection (`__tests__/cam-428-framed-chat-card.test.ts`)
- AC-6 → unit/source-inspection (`__tests__/cam-428-framed-chat-card.test.ts`, `__tests__/cam-272-ai-chat-components.test.ts` AC-3 block, `__tests__/cam-409-ai-chat-card-carousel.test.ts` AC-4 block)
- Design gate: `check:ds` + `check:palette` green (token-only, no stray hex/px/shadow) · a11y (focus ring, aria-label, decorative icons `aria-hidden`) · i18n (`aiChat.card.*` TH verbatim + EN parity, no em-dash)
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
