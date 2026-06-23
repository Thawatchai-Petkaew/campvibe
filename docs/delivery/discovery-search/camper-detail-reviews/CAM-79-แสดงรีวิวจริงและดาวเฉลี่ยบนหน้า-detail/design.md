---
linear: CAM-79
feature: discovery-search
epic: camper-detail-reviews (CAM-34)
persona: camper
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-23
---
# Design — แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า detail (CAM-79)

## User Job

Camper opens a campground detail page (`/campgrounds/[slug]`) and sees real review data — average rating + count in two places near the top, then a list of actual reviews further down — so they can judge the camp on real evidence before booking.

## Flow

```
Camper opens /campgrounds/[slug]
  → [A] Average-rating display near the campsite title    (top of page)
  → [A] Average-rating display in the right booking widget (sticky sidebar)
  → Camper scrolls down
  → [B] Review section header "รีวิว"
  → [B] Review list (has-reviews) or empty state or error state
  → (if reviewCount > 10) "ดูรีวิวทั้งหมด" placeholder button
```

Data is loaded server-side in `app/campgrounds/[slug]/page.tsx` and passed as props to `CampgroundDetailClient`. No separate client-fetch.

---

## Surface A — Average-Rating Display

This component replaces the hardcoded `4.8` and `12 reviews` in two existing locations:
- Line ~356 (title area): `<Star className="w-4 h-4 fill-foreground text-foreground" /><span>4.8</span><span>(12 reviews)</span>`
- Line ~760 (booking widget): `<Star className="w-3.5 h-3.5 fill-foreground text-foreground" /><span>4.8</span><span>12 reviews</span>`

### States — Surface A

| State | What the user sees | Notes |
|---|---|---|
| **has-reviews** | `★ 4.2 (5 รีวิว)` — Star icon filled + bold avg + count in parens | avg = `Math.round(avg * 10) / 10`; count is real integer |
| **empty (count = 0)** | `ยังไม่มีรีวิว` — plain text, no star, no number | No star icon; no "0"; no empty star ring; text only |
| **loading** | Skeleton: a short inline rect, same width as the text it will show | Use `Skeleton` from `components/ui/skeleton` |
| **error** | Fall back to empty state — show `ยังไม่มีรีวิว` | Review fetch error is isolated; rating display defaults to empty |
| hover | Inherited from parent row (no separate hover on the rating chip itself) | — |
| focus | N/A — rating display is non-interactive | — |
| active | N/A | — |
| disabled | N/A | — |

### Token table — Surface A

| Element | Token / class | Usage note |
|---|---|---|
| Star icon fill | `fill-foreground text-foreground` | Matches existing pattern in CampgroundCard (line 160) and detail title area (line 356) — **do not use amber/yellow** |
| Star icon size (title area) | `w-4 h-4` | Match existing line 356 |
| Star icon size (widget) | `w-3.5 h-3.5` | Match existing line 760 |
| Average number text | `font-semibold text-foreground` | `tabular-nums` required on the number span |
| Count text (title area) | `text-muted-foreground` | e.g. `(5 รีวิว)` |
| Count text (widget) | `text-muted-foreground/60` | Match existing widget dim-text pattern line 762 |
| Empty-state text | `text-muted-foreground` | No star rendered alongside |
| Skeleton | `Skeleton` component, `h-4 w-24 rounded-xl` | Inline, replaces the whole rating row |

### a11y — Surface A

- The star icon must carry `aria-hidden="true"` (decorative).
- The wrapping element must carry `aria-label` with the readable value:
  - has-reviews: `aria-label="คะแนน 4.2 จาก 5 ดาว จาก 5 รีวิว"` (substitute real values)
  - empty: `aria-label="ยังไม่มีรีวิว"`
- The average number span uses `tabular-nums` (`className="tabular-nums"`).
- This is a display element, not interactive — no role, no button.

---

## Surface B — Review Section

Rendered below the booking zone, after the amenities/description area. Full-width on mobile; same full-width column on desktop.

### States — Surface B

| State | What the user sees | Notes |
|---|---|---|
| **has-reviews (1–10)** | Section header `รีวิว` + `<ul>` of review items, newest first | Up to 10 items; each item: reviewer name, star rating 1–5, written date (Thai format), content if present |
| **has-reviews (>10)** | Same as above + `ดูรีวิวทั้งหมด` button below the list | Button is a non-functional placeholder; see aria note below |
| **empty** | Section header `รีวิว` + message `ยังไม่มีรีวิวสำหรับแคมป์นี้` | No list element rendered |
| **loading** | Section header + 3 skeleton review cards | Use `Skeleton` rows, each ~`h-20` |
| **error** | Section header `รีวิว` + message `ไม่สามารถโหลดรีวิวได้ในขณะนี้` | Isolated — no ErrorBanner at page top; rest of page stays usable |
| **review item — no content** | Name + stars + date only; content block not rendered at all | Never render an empty `<p>` or empty content box |
| hover | Row background shifts to `bg-muted/40` on review items (subtle, non-mandatory) | — |
| focus | N/A — list items are not interactive | — |
| active | N/A | — |
| disabled | N/A | — |

### Review item structure (one `<li>`)

```
[Reviewer name] (font-semibold text-foreground) — fallback "ผู้ใช้งาน"
[Star rating: 1–5 filled stars]  [Written date (Thai format)]
[Content paragraph — only if content field is non-null / non-empty]
```

### Star rating within review item (1–5 stars)

Render exactly `rating` filled stars + `(5 - rating)` unfilled stars.

- Filled star: `Star` icon with `fill-foreground text-foreground` + `w-3.5 h-3.5`
- Unfilled star: `Star` icon with `text-muted-foreground` (no fill) + `w-3.5 h-3.5`
- The star row as a group carries `aria-label="คะแนน {rating} จาก 5 ดาว"` and all individual icons carry `aria-hidden="true"`.

### Token table — Surface B

| Element | Token / class | Usage note |
|---|---|---|
| Section heading | `text-xl font-semibold text-foreground` | Plain `<h2>` or `<h3>` depending on page heading hierarchy; match existing section headings on the detail page |
| Review list container | `<ul>` semantic element | `space-y-6` between items |
| Review item | `<li>` + `py-4 border-b border-border last:border-b-0` | Divider below each except the last |
| Reviewer name | `font-semibold text-foreground text-sm` | — |
| Written date | `text-sm text-muted-foreground tabular-nums` | Thai date format: use the same `format(date, 'd MMM yyyy')` helper + Thai locale already used in the file, or format to `d MMMM yyyy` |
| Content paragraph | `text-sm text-foreground leading-relaxed mt-1` | Only rendered when content is non-null and non-empty string |
| Empty state text | `text-muted-foreground text-sm` | Below the section heading |
| Error state text | `text-muted-foreground text-sm` | Below the section heading; NOT a full-page ErrorBanner |
| Skeleton row | `Skeleton h-20 w-full rounded-xl` | 3 rows while loading |
| "ดูรีวิวทั้งหมด" button | `Button variant="outline" size="md"` (`h-11 rounded-full`) | Centered below the list; `mt-4` |

### "ดูรีวิวทั้งหมด" placeholder button

The button is rendered when `reviewCount > 10`. It is a placeholder and must NOT navigate or open a modal at this stage (C-2.6 will wire it).

- Render as `<Button variant="outline" size="md" disabled aria-disabled="true" aria-label="ดูรีวิวทั้งหมด (ยังไม่พร้อมใช้งาน)">ดูรีวิวทั้งหมด</Button>`
- Use `disabled` prop so it is visually and semantically inert.
- The `aria-label` makes the inert state comprehensible to screen readers.
- Do NOT use `onClick={() => {}}` with no-op — use `disabled`.

### a11y — Surface B

- Review list is `<ul>` with `<li>` children; no custom role needed.
- Section heading is a proper `<h2>` or `<h3>` (match the heading level of adjacent sections on the page to preserve document outline).
- Star rating group within each item carries `role="img" aria-label="คะแนน {rating} จาก 5 ดาว"` with all `<Star>` icons `aria-hidden="true"`.
- Reviewer name fallback `"ผู้ใช้งาน"` is sufficient as accessible text.
- Empty and error messages are plain text — no special role needed.
- Placeholder button: `disabled` attribute present; `aria-disabled="true"` explicitly set for clarity.

---

## Components used (from `components/ui/*` only)

| Component | Usage |
|---|---|
| `Skeleton` | Loading state for both Surface A and Surface B |
| `Button` (variant="outline", size="md") | "ดูรีวิวทั้งหมด" placeholder |
| `Star` from `lucide-react` | Rating icon — filled and unfilled variants via `fill-foreground` / no fill |

No new components invented. No `@tabler/icons-react` (removed, DS-5). All icons from `lucide-react`.

---

## Locales — new keys required

All copy lives in `locales/translations.json` (TH + EN). No hardcoding in component.

Add under a `reviews` namespace:

| Key | Thai (TH) | English (EN) |
|---|---|---|
| `reviews.noReviews` | `ยังไม่มีรีวิว` | `No reviews yet` |
| `reviews.noReviewsSection` | `ยังไม่มีรีวิวสำหรับแคมป์นี้` | `No reviews for this camp yet` |
| `reviews.loadError` | `ไม่สามารถโหลดรีวิวได้ในขณะนี้` | `Reviews could not be loaded right now` |
| `reviews.sectionHeading` | `รีวิว` | `Reviews` |
| `reviews.viewAll` | `ดูรีวิวทั้งหมด` | `View all reviews` |
| `reviews.authorFallback` | `ผู้ใช้งาน` | `User` |
| `reviews.ratingAriaLabel` | `คะแนน {avg} จาก 5 ดาว จาก {count} รีวิว` | `Rating {avg} out of 5 stars from {count} reviews` |
| `reviews.itemRatingAriaLabel` | `คะแนน {rating} จาก 5 ดาว` | `Rating {rating} out of 5 stars` |
| `reviews.viewAllAriaLabel` | `ดูรีวิวทั้งหมด (ยังไม่พร้อมใช้งาน)` | `View all reviews (not available yet)` |

Thai copy rules applied:
- No em-dash as separator anywhere.
- No technical jargon.
- `{avg}`, `{count}`, `{rating}` are interpolation placeholders — verbatim in the key string.

---

## Responsive layout

| Breakpoint | Surface A — title area | Surface A — widget | Surface B — review section |
|---|---|---|---|
| Mobile (`< md`) | Inline row below the campsite title; same row as location | Booking widget stacks below the detail content; rating row appears within it | Full-width column, `space-y-6` |
| Desktop (`md+`) | Inline row below title, left column | Sticky right sidebar widget; rating sits above the date inputs | Full-width within the left content column |

The rating display does not reflow or stack — it is always a single horizontal inline row (star + number + count, or just the no-review text). On very narrow screens where the parent flex-wraps, the rating group stays together (`whitespace-nowrap` if needed).

---

## Test IDs

Following `<type>--<module>-<detail>` convention:

| Element | data-testid |
|---|---|
| Average rating display (title area) | `rating--detail-title` |
| Average rating display (booking widget) | `rating--detail-widget` |
| Review section container | `section--reviews` |
| Review list (`<ul>`) | `list--reviews` |
| Individual review item | `item--review-{index}` (e.g. `item--review-0`) |
| Empty state message | `empty--reviews` |
| Error state message | `error--reviews` |
| "ดูรีวิวทั้งหมด" button | `btn--reviews-view-all` |

---

## Anti-Slop Checklist

- [ ] Star color: `fill-foreground text-foreground` — matches existing codebase pattern; no amber hex, no `text-yellow-400`, no custom gold.
- [ ] No emoji in copy.
- [ ] No fabricated user avatars or images in review items — name text only.
- [ ] Empty and error states use plain `text-muted-foreground` text — no decorative illustrations or icon stacks.
- [ ] Rating display in the widget reuses the exact same `fill-foreground` pattern as the title area — one consistent treatment across both locations.
- [ ] No card-within-card nesting for review items — `<li>` with a bottom border divider only (border + spacing, not shadow).
- [ ] No gradient on the section or review items.
- [ ] No hardcoded color hex/px anywhere in the component — every value from a token.

---

## Design Gate (Frontend must satisfy before merge)

The PR is blocked if any of the following fail:

1. **Hardcoded values removed** — the strings `"4.8"` and `"12"` no longer appear as literals in `CampgroundDetailClient.tsx`.
2. **Token-only** — `npm run check:palette` passes with zero violations in the new review component code.
3. **Empty state correct** — when `reviewCount === 0`, Surface A shows only `ยังไม่มีรีวิว` (no star, no "0", no empty star ring). Surface B shows `ยังไม่มีรีวิวสำหรับแคมป์นี้`.
4. **Error state isolated** — when review query throws, Surface B shows `ไม่สามารถโหลดรีวิวได้ในขณะนี้` and the rest of the page (images, amenities, booking widget) remains usable.
5. **No content box when content is null** — review items without a content string render only name + stars + date, no empty paragraph or placeholder text.
6. **Aria labels present and correct** — Surface A rating wrapper has `aria-label` conveying avg and count; Surface B star group in each item has `role="img" aria-label` with rating value; all Star icons have `aria-hidden="true"`.
7. **Semantic list** — review list is `<ul>` with `<li>` children.
8. **Placeholder button is `disabled`** — `ดูรีวิวทั้งหมด` button has `disabled` prop and `aria-disabled="true"`; no `onClick` handler.
9. **authorId not exposed** — `authorId` must not appear in any rendered HTML or in the JSON passed to the client component.
10. **Copy in locales** — all visible strings come from `locales/translations.json` keys; no hardcoded Thai or English strings in the TSX.
11. **tabular-nums** — the average number and dates use `tabular-nums` class.
12. **Staging AC verified** — open a camp with reviews in staging DB and confirm star + count display; open a camp with no reviews and confirm `ยังไม่มีรีวิว` / `ยังไม่มีรีวิวสำหรับแคมป์นี้` display.

---

## Links

- `../../feature.md` (discovery-search feature overview)
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/DESIGN.md` — token tables, anti-slop, a11y gate
- `story.md` (this directory) — AC 1–6, Rules
- `components/CampgroundDetailClient.tsx` — file under edit (lines ~354–362, ~759–764)
- `locales/translations.json` — copy source of truth

## Changelog

- v1 (2026-06-23) — created
