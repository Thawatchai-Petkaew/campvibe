---
linear: CAM-147
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-23
---
# Design — แสดงคะแนนรีวิวจริงบนการ์ดและ map popup (เลิก hardcode 4.8) (CAM-147)

## User Job

Camper browses the home page, search results, or wishlist, and sees each camp's real average rating on its card and on the map popup — so they can compare camps at a glance without opening each detail page.

## Flow

```
Camper opens home / search / wishlist
  → [A] CampgroundCard title row (right side): rating slot
        has-reviews → Star + real avg (1 decimal)
        no-reviews  → "ยังไม่มีรีวิว" muted text, no star

Camper taps a map marker
  → [B] MapComponent popup: rating row (below camp name)
        has-reviews → Star + real avg
        no-reviews  → "ยังไม่มีรีวิว" muted text, no star
```

Data path: server-side computation via `computeAvgRating` in `app/page.tsx`, `app/wishlist/page.tsx`, and the map data source. Props `avgRating: number` + `reviewCount: number` flow into the card and popup — no array of reviews, no author data.

---

## Surface A — CampgroundCard Rating Slot

### Card display decision: avg-only (no count)

Show **`{avg}`** (one decimal) with the star icon. Do not show the count `({N})` alongside it.

Rationale: the card title row already truncates the camp name (`truncate pr-4`) and is the most compact context in the product. The detail page (CAM-79) shows the full `4.2 (5 รีวิว)` pattern with the count — that is where count becomes meaningful. On the card the count adds visual noise to a tight row without helping the comparison (Campers scan the number, not the count, at the list stage). Keeping avg-only also avoids the `pr-4` gap closing further when both avg + count render. This is consistent with many booking platforms (Airbnb cards show avg-only at the list level).

### States — Surface A (CampgroundCard)

| State | Rating slot content | Notes |
|---|---|---|
| **has-reviews** | `<Star aria-hidden> {avg}` — filled star icon + bold avg number | avg = 1 decimal (`Math.round(avg*10)/10`); `tabular-nums` on the number span |
| **no-reviews (empty)** | `ยังไม่มีรีวิว` — plain muted text, no star, no "0", no empty star ring | Matches CAM-79 empty pattern; uses `text-muted-foreground` |
| **loading** | Not applicable — card is server-rendered; no async client fetch for the rating | No skeleton needed on the card itself |
| **error** | Fall back to empty state: show `ยังไม่มีรีวิว` | Review computation error = treat as count 0 |
| **hover** | Inherited from the parent `<Link>` card hover; the rating slot itself has no separate hover | — |
| **focus** | Rating slot is non-interactive; focus travels to the parent `<Link>` | — |
| **active** | N/A — rating slot is display-only | — |
| **disabled** | N/A | — |

### No-CLS rule — Surface A

The rating slot must occupy consistent vertical space whether it renders a number or the muted empty text, so the card height never shifts as data loads or changes.

Implementation: the rating `<div>` sits on the same flex row (`flex items-center gap-1`) as the camp name. Both the `{avg}` span and `ยังไม่มีรีวิว` text are `text-sm` — matching the existing `<span className="text-sm">4.8</span>` at line 161. No height change between states; the slot is always a single inline text node of the same size.

Do not use `min-w` on the slot — it is unnecessary because both the star+number and the muted text are similarly narrow, and `min-w` could push the name truncation earlier than needed. The `text-sm` size parity is sufficient to prevent CLS.

### Token table — Surface A

| Element | Token / class | Notes |
|---|---|---|
| Star icon (filled) | `fill-foreground text-foreground` | Exact match: existing line 160 in `CampgroundCard.tsx` |
| Star icon size | `w-3.5 h-3.5` | Exact match: existing line 160 |
| Star icon | `aria-hidden="true"` | Decorative — screen reader skips it |
| Average number | `text-sm tabular-nums` | `tabular-nums` required per DESIGN.md §2 and CAM-79 |
| Rating wrapper `aria-label` | `"คะแนน {avg} จาก 5 ดาว"` | Readable value for screen reader |
| Empty text | `text-sm text-muted-foreground` | Same size as the number span; no star rendered |
| Empty wrapper `aria-label` | `"ยังไม่มีรีวิว"` | Matches CAM-79 aria pattern |

No new tokens. All values map to existing DESIGN.md tokens.

---

## Surface B — MapComponent Popup Rating Row

### States — Surface B (MapComponent popup)

| State | Rating row content | Notes |
|---|---|---|
| **has-reviews** | `<Star aria-hidden> {avg}` — filled star + bold avg number | Same avg computation; `tabular-nums` on number |
| **no-reviews (empty)** | `ยังไม่มีรีวิว` — muted text, no star, no "0" | Replaces the current `<Star/> 4.8` at line 88–89 of `MapComponent.tsx` |
| **loading** | N/A — popup data comes from the same server-rendered map campgrounds array | — |
| **error** | Fall back to empty state: `ยังไม่มีรีวิว` | — |
| **hover / focus / active / disabled** | N/A — popup rating row is display-only | — |

### Token table — Surface B

| Element | Token / class | Notes |
|---|---|---|
| Star icon (filled) | `fill-foreground text-foreground` | Exact match: existing line 88 in `MapComponent.tsx` |
| Star icon size | `w-3 h-3` | Exact match: existing line 88 (popup uses slightly smaller star than card) |
| Star icon | `aria-hidden="true"` | Decorative |
| Average number | `font-semibold text-sm tabular-nums` | Matches existing `font-semibold` at line 89 |
| Rating wrapper `aria-label` | `"คะแนน {avg} จาก 5 ดาว"` | Same aria pattern as Surface A |
| Empty text | `text-sm text-muted-foreground` | Replaces the `<Star/> 4.8` block entirely |
| Empty wrapper `aria-label` | `"ยังไม่มีรีวิว"` | — |
| Province separator | `text-muted-foreground` `·` character | Existing line 90; unchanged |

No new tokens.

---

## States Matrix (full — both surfaces)

| Surface | has-reviews | no-reviews (empty) | loading | error | hover | focus | active | disabled |
|---|---|---|---|---|---|---|---|---|
| CampgroundCard rating slot | Star `w-3.5` + `{avg}` `text-sm tabular-nums` | `ยังไม่มีรีวิว` `text-sm text-muted-foreground`, no star | N/A (server rendered) | Fallback to empty | Inherited from parent Link | N/A (non-interactive) | N/A | N/A |
| MapComponent popup rating | Star `w-3` + `{avg}` `font-semibold text-sm tabular-nums` | `ยังไม่มีรีวิว` `text-sm text-muted-foreground`, no star | N/A (server rendered) | Fallback to empty | N/A | N/A | N/A | N/A |

---

## a11y — WCAG 2.1 AA

- **Rating wrapper (has-reviews):** `aria-label="คะแนน {avg} จาก 5 ดาว"` — interpolate the real avg value. Reuses the aria pattern from CAM-79 Surface A (shorter form without count, since count is not displayed on the card).
- **Star icon:** `aria-hidden="true"` on both surfaces — decorative icon, not read by screen reader.
- **Empty state wrapper (no-reviews):** `aria-label="ยังไม่มีรีวิว"` or plain rendered text is sufficient since the text itself is readable.
- **Non-interactive display:** rating slot has no role, no button, no tabindex — it is a display element. Focus moves naturally through the parent `<Link>` (card) or the popup close control.
- **Contrast:** `text-muted-foreground` for empty text — not measured here; DESIGN.md §2 specifies this token meets the muted/secondary use-case. Primary text `text-foreground` + star `fill-foreground` on `bg-card` background meets 4.5:1 AA (token-guaranteed). Mark: **not individually measured for this story** (token-guaranteed per DESIGN.md §2).
- **Tap target:** rating slot is non-interactive, no tap-target requirement. The parent card `<Link>` and the map popup close button must remain ≥44px — unchanged by this story.
- **Color not the only signal:** avg number is numeric text, empty state is text — neither relies on color alone to convey meaning. The muted color of `ยังไม่มีรีวิว` is supplementary to the text content itself.

---

## i18n — Locales

Both keys already exist in `locales/translations.json` from CAM-79. Frontend must **reuse them, not add duplicates**.

| Key | Thai (TH) | English (EN) | Status |
|---|---|---|---|
| `reviews.noReviews` | `ยังไม่มีรีวิว` | `No reviews yet` | Already in `locales/translations.json` — **reuse** |
| `reviews.ratingAriaLabel` | `คะแนน {avg} จาก 5 ดาว จาก {count} รีวิว` | `Rating {avg} out of 5 stars from {count} reviews` | Already exists — note: for card/popup (avg-only display, no count), use the shorter aria template `"คะแนน {avg} จาก 5 ดาว"` inline or add a new key below |

Since the card/popup aria pattern is `"คะแนน {avg} จาก 5 ดาว"` (no count) and the existing `reviews.ratingAriaLabel` includes `{count}`, Frontend must either interpolate with count omitted or add one new key:

| Key (new, if needed) | Thai (TH) | English (EN) |
|---|---|---|
| `reviews.ratingAriaLabelShort` | `คะแนน {avg} จาก 5 ดาว` | `Rating {avg} out of 5 stars` |

Thai copy rules applied: no em-dash separator, no technical jargon, `{avg}` is the interpolation placeholder.

**No other new keys.** Do not add a duplicate of `reviews.noReviews`.

---

## Components used (from `components/ui/*` + `lucide-react` only)

| Component / icon | Surface | Usage |
|---|---|---|
| `Star` from `lucide-react` | A, B | Filled star (`fill-foreground text-foreground`) — decorative, `aria-hidden` |

No new components invented. No `@tabler/icons-react` (removed, DS-5). No out-of-system component.

---

## Props contract (for Frontend — not a data/API contract)

The card and popup remain display-only. Frontend receives:

```
CampgroundCardProps: { avgRating: number; reviewCount: number; /* ...existing props */ }
MapComponent campground shape: { avgRating: number; reviewCount: number; /* ...existing fields */ }
```

Branch logic inside the component:

```
reviewCount === 0  →  render empty state (ยังไม่มีรีวิว, no star)
reviewCount > 0    →  render Star + avg formatted to 1 decimal (Math.round(avgRating * 10) / 10)
```

No `reviews[]` array, no `authorId`, no PII enters the client component.

---

## Test IDs

Following `<type>--<module>-<detail>` convention per DESIGN.md §6:

| Element | data-testid |
|---|---|
| Card rating slot (has-reviews) | `rating--card-avg` |
| Card rating slot (no-reviews) | `empty--card-rating` |
| Map popup rating slot (has-reviews) | `rating--map-popup-avg` |
| Map popup rating slot (no-reviews) | `empty--map-popup-rating` |

---

## Anti-Slop Checklist

- [ ] Star color: `fill-foreground text-foreground` — no amber hex, no `text-yellow-400`, no custom gold. Matches existing codebase pattern at CampgroundCard line 160 and MapComponent line 88.
- [ ] No emoji in copy.
- [ ] Empty state = plain `text-muted-foreground` text only — no empty star ring, no decorative illustration, no "0 stars".
- [ ] Rating display is a single inline element — no card-within-card, no shadow, no gradient.
- [ ] No hardcoded color hex/px anywhere — every value from a token or scale utility.
- [ ] `tabular-nums` on the avg number to prevent numeric jitter.
- [ ] `ยังไม่มีรีวิว` is `text-sm` on both surfaces — same vertical footprint as the number, preventing CLS.

---

## Design Gate (Frontend must satisfy before merge)

The PR is blocked if any of the following fail:

1. **Hardcoded "4.8" removed** — the string `"4.8"` no longer appears as a literal in `CampgroundCard.tsx` or `MapComponent.tsx`.
2. **Token-only** — `npm run check:palette` passes with zero violations in the touched files.
3. **Empty state correct** — when `reviewCount === 0`, both surfaces show only `ยังไม่มีรีวิว` (`text-muted-foreground`) with no star icon, no "0", no empty star outline.
4. **has-reviews correct** — when `reviewCount > 0`, both surfaces show the `Star` icon (`fill-foreground text-foreground`, correct size) + the avg formatted to 1 decimal with `tabular-nums`.
5. **No CLS** — the card layout does not shift between the has-reviews and empty state; both render at `text-sm` in the same flex row position.
6. **Aria labels present** — rating wrapper carries `aria-label="คะแนน {avg} จาก 5 ดาว"` (has-reviews) or `aria-label="ยังไม่มีรีวิว"` (no-reviews); all `Star` icons carry `aria-hidden="true"`.
7. **No PII leaked** — `authorId`, `reviews[]` array, or any author data must not appear in rendered HTML or JSON passed to the client.
8. **Copy from locales** — `ยังไม่มีรีวิว` comes from `reviews.noReviews` (already in `locales/translations.json`); no hardcoded Thai strings in TSX.
9. **`tabular-nums`** — the avg number span uses the `tabular-nums` class.
10. **Test IDs present** — `rating--card-avg`, `empty--card-rating`, `rating--map-popup-avg`, `empty--map-popup-rating` are present on the correct elements.
11. **Staging AC verified** — open a camp with reviews on `campvibe-staging.vercel.app`; card and map popup show real avg (not "4.8"). Open a camp with no reviews; both show `ยังไม่มีรีวิว` with no star.

---

## Reference

- CAM-79 design brief (`docs/delivery/discovery-search/camper-detail-reviews/CAM-79-แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า-detail/design.md`) — rating display, aria pattern, and empty-state decisions that this story must match.
- `DESIGN.md` §2 (tokens), §5 (anti-slop), §6 (gate), §7 (lucide-only icons).
- `locales/translations.json` lines 559–569 (EN) and 1181–1189 (TH) — the `reviews` namespace already containing `noReviews` and `ratingAriaLabel`.
- `components/CampgroundCard.tsx` lines 157–163 — existing title row flex layout and star pattern.
- `components/MapComponent.tsx` lines 87–91 — existing popup rating row.

---

## Links

- `../../feature.md` (discovery-search feature overview)
- `story.md` (this directory) — AC 1–5, Rules
- `DESIGN.md` — token tables, anti-slop, a11y gate
- `locales/translations.json` — copy source of truth

## Changelog

- v1 (2026-06-23) — created
