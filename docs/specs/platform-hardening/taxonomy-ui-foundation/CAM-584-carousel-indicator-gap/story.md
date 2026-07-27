## Story
As a **Camper** using the น้องกองไฟ chat assistant, I want the pagination indicator (chevrons + `{cur}/{N}`/dots) to sit close under the result cards, so that the card strip and its own indicator read as one connected control instead of two things separated by an empty band.
Why: owner report from staging, 2026-07-27 — CAM-547's own shadow-clearance fix (`pb-14`, grown from `py-4` to stop the card's `shadow-ai-glow` being clipped by the track's forced `overflow-y:auto`) reserves 56px of space inside the track's own box; because the indicator is a sibling BELOW that box, the reserved space visually pushed it down with it, growing the gap from 24px (pre-CAM-547) to 64px.
Scope: `components/ai-chat/AiChatCardCarousel.tsx` only — the indicator row's own vertical margin. Does NOT touch the track's `pt-4 pb-14` (the shadow-clearance fix itself, byte-for-byte preserved), the dot/counter treatments (CAM-547/CAM-569, unchanged), `scroll-px-4` (CAM-547's mobile gutter fix, unchanged), or any other file (`AiChatCampCard.tsx`, `AiChatPanel.tsx`, `AiChatMessageList.tsx`, `AiChatLauncher.tsx`, tokens, `components/ui/**`).
Depends on: CAM-547 (introduced `pb-14`, the padding this story must not shrink) · CAM-569 (the counter contrast fix, asserted unchanged here) · CAM-409 (the original carousel + indicator)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A search returns 2+ campsite cards (any viewport) | The card strip and its indicator row render | The indicator (chevrons + dots/counter) sits close under the cards — no large empty band between them | The indicator row's own top margin moves from `mt-2` (+8px) to `-mt-8` (-32px); the track's `pt-4 pb-14` is completely unchanged (same class string, same reserved box size) | EC-1 |
| AC-2 | A card's `shadow-ai-glow` inside the multi-card strip (CAM-547's fix) | The card renders, with the indicator now closer beneath it | The soft glow under the card is still not hard-cut along the bottom edge — unchanged from CAM-547 | The track's padding-box (and therefore its `overflow-y:auto` clip boundary) is byte-for-byte the same size as before this story; only a transparent, non-clipping SIBLING moved, not the box that decides clipping | EC-2 |
| AC-3 | The dot shape (CAM-547) and the `{cur}/{N}` counter contrast treatment (CAM-569) | The indicator renders at any card count | Both render exactly as before this story (no colour/shape/copy change) | `h-1.5 w-4 rounded-full bg-primary` / `h-1.5 w-1.5 rounded-full bg-muted-foreground/60` / `text-foreground/70` on the counter — all byte-for-byte unchanged | — (regression-only; no behavior change intended, so no failure twin) |

## Rules
- BR-1 The indicator row's margin is `-mt-8` (was `mt-2`) — chosen to land the visual gap (card's rendered bottom edge to the indicator's rendered top edge) back at 24px, the same gap that shipped before CAM-547 grew `pb-14`, measured with a real Chromium render at both 390px and 1440px (proves AC-1).
- BR-2 The track's own className (`-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-4 pb-14 no-scrollbar motion-safe:scroll-smooth`) is NOT edited by this story — the reserved padding-bottom that protects the shadow from the track's forced `overflow-y:auto` clip is a completely separate concern from where the sibling indicator paints (proves AC-2).
- BR-3 The dot/counter classes CAM-547/CAM-569 shipped are pinned unchanged; this story touches only the indicator ROW's own margin utility, nothing inside it (proves AC-3).

## Edge cases
- EC-1 IF the card strip has exactly 1 card THEN no carousel chrome (chevrons/indicator) renders at all — unaffected by this story (pre-existing BR-1/EC-1 from CAM-409, unchanged).
- EC-2 IF a card sits at the FIRST or LAST position in the strip THEN its shadow still gets the same widened bottom clearance from CAM-547 — this story does not touch that mechanism at all (BR-2).

## Data
- No schema/migration. No new field, no wire-contract change — a pure CSS/layout fix on one existing element.

## Seams & refs
- Reuse: no new component/token; a standard Tailwind negative-margin utility (`-mt-8`) from the existing spacing scale, the same class family (`mt-*`) already used on this element.
- Refs: CAM-547 story.md (BR-4, the `pb-14` shadow-clearance math this story's fix must not regress) · CAM-569 story.md (the counter contrast fix, asserted unchanged here).

## Out of scope
- Redesigning the indicator itself (dot-vs-counter switch, shape, colour) — none of that changed here; CAM-547/CAM-569 already settled it.
- Any change to the track's own padding/scroll-snap classes.

## Self-verify
- AC-1 → unit (source-inspection: `-mt-8` present on the indicator row, `mt-2` gone) + real-browser measurement (Playwright against the actual compiled Tailwind CSS at 390px and 1440px): gap 64px → 24px at both widths.
- AC-2 → unit (source-inspection: the track's `pt-4 pb-14` class substring byte-for-byte unchanged) + real-browser measurement: the card's real computed `box-shadow` dominant layer's downward reach (52px, computed from the live browser, not hand-typed) stays ≤ the track's real padding-bottom (56px, computed) — i.e. not clipped, same result as before this story.
- AC-3 → unit (source-inspection: the dot classes and the counter's `text-foreground/70` class are pinned unchanged, byte-for-byte, from CAM-547/CAM-569's own tests).
- Story-specific: full suite re-run as the last act (grep `__tests__/` for `AiChatCardCarousel`, `cam-547`, `cam-569`, `status--ai-chat-cards-position` before handoff — all must still pass unmodified).
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-27) — created
